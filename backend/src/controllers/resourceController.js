const path = require("path");
const fs = require("fs/promises");
const bcrypt = require("bcryptjs");
const pdfParse = require("pdf-parse");
const Institute = require("../models/Institute");
const Course = require("../models/Course");
const Semester = require("../models/Semester");
const Subject = require("../models/Subject");
const PYQ = require("../models/PYQ");
const User = require("../models/User");
const { canManageCourse } = require("../middleware/auth");
const {
  deleteInstituteTree,
  deleteCourseTree,
  deleteSemesterTree,
  deleteSubjectTree,
} = require("../utils/cascade");

const fileUrl = (req) => {
  if (!req.file) return undefined;
  const uploadsRoot = path.join(__dirname, "..", "..", "uploads");
  const relativeDir = path.relative(uploadsRoot, req.file.destination).replaceAll("\\", "/");
  return `/uploads/${relativeDir}/${req.file.filename}`;
};

const uploadsRoot = path.join(__dirname, "..", "..", "uploads");
const MAX_PDF_BYTES = 12 * 1024 * 1024;
const MIN_USEFUL_PDF_TEXT_CHARS = 120;
const MAX_PROMPT_CHARS = 18000;
const OCR_MAX_PAGES = Number(process.env.PYQ_AI_OCR_MAX_PAGES || 3);
const OCR_SCALE = Number(process.env.PYQ_AI_OCR_SCALE || 3);
const pyqTextCache = new Map();

const resolveUploadPath = (filePath) => {
  if (!filePath || typeof filePath !== "string") return null;
  if (!filePath.startsWith("/uploads/")) return null;
  const relativePath = filePath.replace(/^\/uploads\//, "");
  const absolutePath = path.join(uploadsRoot, relativePath);
  const normalizedRoot = path.normalize(uploadsRoot + path.sep);
  const normalizedTarget = path.normalize(absolutePath);
  if (!normalizedTarget.startsWith(normalizedRoot)) return null;
  return normalizedTarget;
};

const normalizePaperText = (value = "") =>
  String(value)
    .replace(/OnlinePhotoScanner\.?com/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

async function callAIWithFailover(messages, preferredProvider, openRouterModel) {
  const apis = [];
  
  const allApis = {
    groq: {
      name: "Groq API",
      base: "groq",
      key: process.env.GROQ_API_KEY,
      url: "https://api.groq.com/openai/v1/chat/completions",
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile"
    },
    gemini: {
      name: "Gemini API",
      base: "gemini",
      key: process.env.GEMINI_API_KEY,
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      model: openRouterModel || process.env.GEMINI_MODEL || "gemini-2.5-flash"
    },
    openrouter: {
      name: "OpenRouter",
      base: "openrouter",
      key: process.env.OPENROUTER_API_KEY,
      url: "https://openrouter.ai/api/v1/chat/completions",
      model: openRouterModel || process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free"
    }
  };

  if (preferredProvider && allApis[preferredProvider] && allApis[preferredProvider].key) {
    apis.push(allApis[preferredProvider]);
  }

  Object.keys(allApis).forEach((key) => {
    if (key !== preferredProvider && allApis[key].key) {
      apis.push(allApis[key]);
    }
  });

  if (apis.length === 0) {
    throw new Error("No AI API keys are configured in the environment");
  }

  let lastError = null;

  for (const apiConfig of apis) {
    try {
      console.log(`📡 Attempting AI completion using ${apiConfig.name} (${apiConfig.base})...`);
      
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiConfig.key}`,
      };

      if (apiConfig.base === "openrouter") {
        headers["HTTP-Referer"] = "https://github.com/rishabh-pyq";
        headers["X-Title"] = "PYQ Platform";
      }

      const payload = {
        model: apiConfig.model,
        temperature: 0.4,
        max_tokens: 700,
        messages,
      };

      const response = await fetch(apiConfig.url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      
      if (!response.ok) {
        const errMsg = data.error?.message || `HTTP error status ${response.status}`;
        console.warn(`⚠️ ${apiConfig.name} failed: ${errMsg}`);
        lastError = new Error(`${apiConfig.name}: ${errMsg}`);
        continue;
      }

      const text = data.choices?.[0]?.message?.content;
      if (!text) {
        console.warn(`⚠️ ${apiConfig.name} returned empty completion`);
        lastError = new Error(`${apiConfig.name}: Empty completion returned`);
        continue;
      }

      console.log(`✅ Success with ${apiConfig.name}!`);
      return {
        text,
        totalTokens: data.usage?.total_tokens || 0,
        provider: apiConfig.base,
        model: apiConfig.model
      };
    } catch (err) {
      console.warn(`⚠️ ${apiConfig.name} threw error: ${err.message}`);
      lastError = err;
    }
  }

  throw lastError || new Error("All configured AI APIs failed");
}

const hasUsefulPaperText = (value = "") => {
  const normalized = normalizePaperText(value);
  const words = normalized.split(/\s+/).filter(Boolean);
  return normalized.length >= MIN_USEFUL_PDF_TEXT_CHARS && words.length >= 25;
};

async function extractTextWithOcr(pdfPath) {
  const [{ pdf }, { createWorker }] = await Promise.all([
    import("pdf-to-img"),
    import("tesseract.js"),
  ]);

  const document = await pdf(pdfPath, { scale: OCR_SCALE });
  const worker = await createWorker("eng", undefined, {
    langPath: path.join(__dirname, "..", ".."),
    cachePath: path.join(__dirname, "..", ".."),
  });

  try {
    const pageCount = Math.min(document.length || OCR_MAX_PAGES, OCR_MAX_PAGES);
    const pageTexts = [];

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const image = await document.getPage(pageNumber);
      const result = await worker.recognize(image);
      const text = (result.data?.text || "").trim();
      if (text) pageTexts.push(`--- Page ${pageNumber} ---\n${text}`);
    }

    return pageTexts.join("\n\n").trim();
  } finally {
    await worker.terminate().catch(() => {});
    document.destroy?.();
  }
}

async function extractPaperText({ pdfBuffer, pdfPath, stat }) {
  const cacheKey = `${pdfPath}:${stat.size}:${stat.mtimeMs}`;
  const cached = pyqTextCache.get(cacheKey);
  if (cached) return cached;

  let extractedText = "";
  let source = "pdf-text";

  const parsed = await pdfParse(pdfBuffer);
  extractedText = (parsed.text || "").trim();

  if (!hasUsefulPaperText(extractedText)) {
    source = "ocr";
    extractedText = await extractTextWithOcr(pdfPath);
  }

  const result = {
    text: extractedText.trim(),
    source,
  };

  if (hasUsefulPaperText(result.text)) {
    pyqTextCache.set(cacheKey, result);
  }

  return result;
}

const buildPyqContext = (pyq, clippedText, source) => {
  const subjectLabel = [pyq.subject?.code, pyq.subject?.name].filter(Boolean).join(" - ");
  return [
    "Use this exact PYQ as the source of truth.",
    `Text source: ${source === "ocr" ? "OCR from scanned PDF" : "PDF text layer"}`,
    `Institute: ${pyq.institute?.shortForm || pyq.institute?.name || "Unknown"}`,
    `Course: ${pyq.course?.name || "Unknown"}`,
    `Semester: ${pyq.semester?.name || pyq.semester?.number || "Unknown"}`,
    `Subject: ${subjectLabel || pyq.title || "Unknown"}`,
    `Exam: ${pyq.examType || "Unknown"}`,
    `Year: ${pyq.year || "Unknown"}`,
    "",
    "Extracted PYQ text:",
    clippedText,
  ].join("\n");
};

const normalizeLogoUrl = (value) => {
  if (!value || typeof value !== "string" || !value.trim()) return undefined;
  const trimmed = value.trim();

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return trimmed;
    }
  } catch (_error) {
    const error = new Error("Logo URL must be a valid http(s) URL");
    error.status = 400;
    throw error;
  }

  const error = new Error("Logo URL must be a valid http(s) URL");
  error.status = 400;
  throw error;
};

const logoUrlFromRequest = (req) => fileUrl(req) || normalizeLogoUrl(req.body.logoUrl);

async function listInstitutes(_req, res) {
  const institutes = await Institute.find().sort("name");
  res.json({ institutes });
}

async function createInstitute(req, res) {
  const institute = await Institute.create({
    name: req.body.name,
    shortForm: req.body.shortForm,
    logoUrl: logoUrlFromRequest(req),
  });
  res.status(201).json({ institute });
}

async function updateInstitute(req, res) {
  const patch = {
    name: req.body.name,
    shortForm: req.body.shortForm,
  };
  const nextLogoUrl = logoUrlFromRequest(req);
  if (nextLogoUrl) patch.logoUrl = nextLogoUrl;

  const institute = await Institute.findByIdAndUpdate(req.params.id, patch, {
    returnDocument: "after",
    runValidators: true,
  });
  if (!institute) return res.status(404).json({ message: "Institute not found" });
  res.json({ institute });
}

async function deleteInstitute(req, res) {
  const institute = await Institute.findByIdAndDelete(req.params.id);
  if (!institute) return res.status(404).json({ message: "Institute not found" });
  await deleteInstituteTree(req.params.id);
  res.json({ message: "Institute and related data deleted" });
}

async function listCourses(req, res) {
  const filter = req.query.institute ? { institute: req.query.institute } : {};
  const courses = await Course.find(filter).populate("institute", "name shortForm").sort("name");
  res.json({ courses });
}

async function createCourse(req, res) {
  const course = await Course.create(req.body);
  res.status(201).json({ course });
}

async function updateCourse(req, res) {
  const course = await Course.findByIdAndUpdate(req.params.id, req.body, {
    returnDocument: "after",
    runValidators: true,
  });
  if (!course) return res.status(404).json({ message: "Course not found" });
  res.json({ course });
}

async function deleteCourse(req, res) {
  const course = await Course.findByIdAndDelete(req.params.id);
  if (!course) return res.status(404).json({ message: "Course not found" });
  await deleteCourseTree(req.params.id);
  res.json({ message: "Course and related data deleted" });
}

async function listSemesters(req, res) {
  const filter = {};
  if (req.query.course) filter.course = req.query.course;
  if (req.query.institute) filter.institute = req.query.institute;
  const semesters = await Semester.find(filter).populate("course", "name").sort("number");
  res.json({ semesters });
}

async function createSemester(req, res) {
  const course = await Course.findById(req.body.course);
  if (!course) return res.status(404).json({ message: "Course not found" });
  const semester = await Semester.create({
    name: req.body.name,
    number: req.body.number,
    course: course._id,
    institute: course.institute,
  });
  res.status(201).json({ semester });
}

async function updateSemester(req, res) {
  const semester = await Semester.findByIdAndUpdate(req.params.id, req.body, {
    returnDocument: "after",
    runValidators: true,
  });
  if (!semester) return res.status(404).json({ message: "Semester not found" });
  res.json({ semester });
}

async function deleteSemester(req, res) {
  const semester = await Semester.findByIdAndDelete(req.params.id);
  if (!semester) return res.status(404).json({ message: "Semester not found" });
  await deleteSemesterTree(req.params.id);
  res.json({ message: "Semester and related data deleted" });
}

async function listSubjects(req, res) {
  const filter = {};
  for (const key of ["institute", "course", "semester", "year"]) {
    if (req.query[key]) filter[key] = req.query[key];
  }
  const subjects = await Subject.find(filter)
    .populate("institute", "name shortForm")
    .populate("course", "name")
    .populate("semester", "name number")
    .sort("course semester year name");
  res.json({ subjects });
}

async function createSubject(req, res) {
  const semester = await Semester.findById(req.body.semester);
  if (!semester) return res.status(404).json({ message: "Semester not found" });

  const year = Number(req.body.year);
  if (!Number.isInteger(year) || year < 1990 || year > 2100) {
    return res.status(400).json({ message: "A valid subject year is required" });
  }

  const requestedSubjects = Array.isArray(req.body.subjects)
    ? req.body.subjects
    : [{ name: req.body.name, code: req.body.code }];

  const subjectDocs = requestedSubjects
    .map((subject) => ({
      name: subject.name?.trim(),
      code: subject.code?.trim(),
      year,
      institute: semester.institute,
      course: semester.course,
      semester: semester._id,
    }))
    .filter((subject) => subject.name);

  if (!subjectDocs.length) {
    return res.status(400).json({ message: "Add at least one subject name" });
  }

  const duplicateNames = subjectDocs
    .map((subject) => subject.name.toLowerCase())
    .filter((name, index, names) => names.indexOf(name) !== index);

  if (duplicateNames.length) {
    return res.status(409).json({ message: "Duplicate subject names found in the same request" });
  }

  const existingSubject = await Subject.findOne({
    semester: semester._id,
    year,
    name: { $in: subjectDocs.map((subject) => subject.name) },
  });

  if (existingSubject) {
    return res.status(409).json({ message: `${existingSubject.name} already exists for this semester and year` });
  }

  try {
    const subjects = await Subject.insertMany(subjectDocs);
    res.status(201).json({ subjects });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "One or more subjects already exist for this semester and year" });
    }
    throw error;
  }
}

async function updateSubject(req, res) {
  const patch = {
    name: req.body.name,
    code: req.body.code,
    year: req.body.year,
  };

  Object.keys(patch).forEach((key) => patch[key] === undefined && delete patch[key]);

  const subject = await Subject.findByIdAndUpdate(req.params.id, patch, {
    returnDocument: "after",
    runValidators: true,
  });
  if (!subject) return res.status(404).json({ message: "Subject not found" });
  res.json({ subject });
}

async function deleteSubject(req, res) {
  const subject = await Subject.findByIdAndDelete(req.params.id);
  if (!subject) return res.status(404).json({ message: "Subject not found" });
  await deleteSubjectTree(req.params.id);
  res.json({ message: "Subject and related PYQs deleted" });
}

async function listPyqs(req, res) {
  const filter = {};
  for (const key of ["institute", "course", "semester", "subject", "year"]) {
    if (req.query[key]) filter[key] = req.query[key];
  }

  if (req.query.subjectYear && !req.query.subject) {
    const subjectFilter = { year: req.query.subjectYear };
    for (const key of ["institute", "course", "semester"]) {
      if (req.query[key]) subjectFilter[key] = req.query[key];
    }
    const matchingSubjects = await Subject.find(subjectFilter).select("_id");
    filter.subject = { $in: matchingSubjects.map((subject) => subject._id) };
  }

  if (req.user.role === "user") {
    if (req.user.institute) filter.institute = req.user.institute;
    if (req.user.course) filter.course = req.user.course;
    if (req.user.semester) filter.semester = req.user.semester;
  }

  if (req.user.role === "admin") {
    if (!req.user.adminScopes.length) {
      return res.json({ pyqs: [] });
    }
    filter.$or = req.user.adminScopes.map((scope) => ({
      institute: scope.institute,
      course: scope.course,
    }));
  }

  const pyqs = await PYQ.find(filter)
    .populate("institute", "name shortForm")
    .populate("course", "name")
    .populate("semester", "name number")
    .populate("subject", "name code year")
    .populate("uploadedBy", "name email")
    .sort("-createdAt");

  res.json({ pyqs });
}

async function createPyq(req, res) {
  const subject = await Subject.findById(req.body.subject);
  if (!subject) return res.status(404).json({ message: "Subject not found" });
  if (!canManageCourse(req.user, subject.institute, subject.course)) {
    return res.status(403).json({ message: "Course scope not assigned" });
  }
  if (!req.file) return res.status(400).json({ message: "PDF file is required" });

  const pyq = await PYQ.create({
    title: subject.code || subject.name,
    year: req.body.year,
    examType: req.body.examType || "End Semester",
    fileUrl: fileUrl(req),
    originalName: req.file.originalname,
    uploadedBy: req.user._id,
    institute: subject.institute,
    course: subject.course,
    semester: subject.semester,
    subject: subject._id,
  });
  res.status(201).json({ pyq });
}

async function deletePyq(req, res) {
  const pyq = await PYQ.findById(req.params.id);
  if (!pyq) return res.status(404).json({ message: "PYQ not found" });
  if (!canManageCourse(req.user, pyq.institute, pyq.course)) {
    return res.status(403).json({ message: "Course scope not assigned" });
  }
  await pyq.deleteOne();
  res.json({ message: "PYQ deleted" });
}

async function incrementPyqViews(req, res) {
  const pyq = await PYQ.findByIdAndUpdate(
    req.params.id,
    { $inc: { views: 1 } },
    { new: true }
  );
  if (!pyq) return res.status(404).json({ message: "PYQ not found" });
  res.json({ message: "Views incremented", views: pyq.views });
}

function checkAndResetUserTokens(user, todayStr) {
  if (user.lastActiveDate !== todayStr) {
    user.tokensUsedToday = 0;
    user.tokensBorrowedToday = 0;
    user.lastActiveDate = todayStr;
  }
}

async function getSharedPoolStatus() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const totalCapacity = 100000;
  
  // Find all active users today
  const activeUsers = await User.find({ lastActiveDate: todayStr });
  const totalConsumed = activeUsers.reduce((sum, u) => sum + (u.tokensUsedToday || 0), 0);
  
  return Math.max(0, totalCapacity - totalConsumed);
}

async function askAiOnPyq(req, res) {
  try {
    console.log("🤖 Ask AI endpoint called");
    console.log("User:", req.user?.email || "Unknown");
    console.log("PYQ ID:", req.params.id);

    const todayStr = new Date().toISOString().slice(0, 10);
    const dbUser = await User.findById(req.user._id);
    if (!dbUser) return res.status(404).json({ message: "User not found" });

    checkAndResetUserTokens(dbUser, todayStr);
    await dbUser.save();

    const now = new Date();
    const fourteenHoursAgo = new Date(now.getTime() - 14 * 60 * 60 * 1000);
    
    // Reset cycle if 14 hours have passed
    if (!dbUser.currentCycleStartedAt || dbUser.currentCycleStartedAt < fourteenHoursAgo) {
      dbUser.currentCycleStartedAt = now;
      dbUser.cycleCreditsUsed = 0;
      dbUser.cycleChatsCompleted = 0;
      await dbUser.save();
    }

    // Rate limit checks for standard students
    if (dbUser.role === "user") {
      const Chat = require("../models/Chat");
      const existingChat = await Chat.findOne({ user: dbUser._id, pyq: req.params.id });

      // If they are starting a new chat session on a different PYQ
      if (!existingChat && dbUser.cycleChatsCompleted >= 1) {
        const nextReset = new Date(dbUser.currentCycleStartedAt.getTime() + 14 * 60 * 60 * 1000);
        const remainingMs = nextReset.getTime() - now.getTime();
        const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
        const remainingMins = Math.ceil((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        return res.status(403).json({
          message: `Limit reached: You are allowed 1 free chat session every 14 hours. Please wait ${remainingHours}h ${remainingMins}m for the next reset cycle.`
        });
      }

      // If they exceeded 15 credits (i.e. 15 questions asked) in this cycle
      if (dbUser.cycleCreditsUsed >= 15) {
        const nextReset = new Date(dbUser.currentCycleStartedAt.getTime() + 14 * 60 * 60 * 1000);
        const remainingMs = nextReset.getTime() - now.getTime();
        const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
        const remainingMins = Math.ceil((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        return res.status(403).json({
          message: `Limit reached: You have exhausted your 15 free credits for this 14-hour cycle. Please wait ${remainingHours}h ${remainingMins}m.`
        });
      }
    }

    const userLimit = 500 + (dbUser.tokensBorrowedToday || 0);
    const userUsed = dbUser.tokensUsedToday || 0;
    const sharedPool = await getSharedPoolStatus();

    const selectedModel = req.body.selectedModel || "groq";
    const isGroq = selectedModel === "groq";

    if (isGroq) {
      // 1. Quota Exhausted Check
      if (userUsed >= userLimit) {
        return res.status(402).json({
          code: "QUOTA_EXHAUSTED",
          message: `Your daily quota is used up. Shared pool has ${sharedPool} credits — borrow 200 to continue, or come back tomorrow when your quota resets.`,
          sharedPool
        });
      }

      // 2. Low Zone (90-100% used) Check - require confirmation to proceed
      const initialPercentage = (userUsed / userLimit) * 100;
      if (initialPercentage >= 90 && !req.body.confirmLowQuota) {
        const remainingTokens = userLimit - userUsed;
        return res.status(202).json({
          code: "LOW_QUOTA_WARNING",
          message: `You have ${remainingTokens} credits left. Want to borrow from the shared pool (up to 200 tokens)?`,
          remainingTokens,
          sharedPool
        });
      }
    }
    
    if (typeof fetch !== "function") {
      return res.status(500).json({ message: "Fetch API is not available on this server" });
    }
    const hasAnyApiKey = process.env.GROQ_API_KEY ||
                          process.env.OPENROUTER_API_KEY ||
                          process.env.GEMINI_API_KEY;
    if (!hasAnyApiKey) {
      console.error("❌ No AI API keys configured");
      return res.status(500).json({ message: "No AI API keys configured on the server" });
    }

    const pyq = await PYQ.findById(req.params.id)
      .populate("institute", "name shortForm")
      .populate("course", "name")
      .populate("semester", "name number")
      .populate("subject", "name code year");
    if (!pyq) return res.status(404).json({ message: "PYQ not found" });

    if (req.user.role === "admin" && !canManageCourse(req.user, pyq.institute, pyq.course)) {
      return res.status(403).json({ message: "Course scope not assigned" });
    }

    if (req.user.role === "user") {
      if (req.user.institute && String(req.user.institute) !== String(pyq.institute?._id || pyq.institute)) {
        return res.status(403).json({ message: "Not allowed for this institute" });
      }
      if (req.user.course && String(req.user.course) !== String(pyq.course?._id || pyq.course)) {
        return res.status(403).json({ message: "Not allowed for this course" });
      }
      if (req.user.semester && String(req.user.semester) !== String(pyq.semester?._id || pyq.semester)) {
        return res.status(403).json({ message: "Not allowed for this semester" });
      }
    }

    const pdfPath = resolveUploadPath(pyq.fileUrl);
    if (!pdfPath) return res.status(400).json({ message: "PYQ file path is invalid" });

    let pdfBuffer;
    let stat;
    try {
      stat = await fs.stat(pdfPath);
      if (stat.size > MAX_PDF_BYTES) {
        return res.status(413).json({ message: "PDF is too large for AI analysis" });
      }
      pdfBuffer = await fs.readFile(pdfPath);
    } catch (_error) {
      return res.status(404).json({ message: "PYQ file not found" });
    }

    let paperText = "";
    let textSource = "";
    try {
      const extracted = await extractPaperText({ pdfBuffer, pdfPath, stat });
      paperText = extracted.text;
      textSource = extracted.source;
    } catch (error) {
      console.error("Failed to extract PYQ text:", error.message);
      return res.status(502).json({ message: "Failed to read PYQ content for AI analysis" });
    }

    if (!hasUsefulPaperText(paperText)) {
      return res.status(422).json({
        message: "I could not read enough question text from this PYQ. Please upload a clearer scan or a text-based PDF."
      });
    }

    const clippedText = paperText.length > MAX_PROMPT_CHARS
      ? `${paperText.slice(0, MAX_PROMPT_CHARS)}\n\n[Text truncated due to length]`
      : paperText;
    const pyqContext = buildPyqContext(pyq, clippedText, textSource);

    const systemPrompt = [
      "You are an academic assistant helping students study a selected PYQ.",
      "Base every answer on the provided PYQ context and metadata.",
      "Do not give a generic syllabus answer when the PYQ contains specific questions.",
      "When analyzing, mention the actual question themes, repeated patterns, marks, and course outcomes visible in the PYQ.",
      "If OCR text is unclear, say which part is unclear instead of inventing details.",
      "Keep responses concise, organized with bullet points, and actionable.",
    ].join("\n");

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: pyqContext },
      { role: "assistant", content: "I will answer using this selected PYQ as the source of truth." },
    ];
    const question = req.body.question || "Analyze this exam paper and explain important topics, patterns, and study tips to improve marks.";
    const conversationHistory = req.body.conversationHistory || [];

    conversationHistory.slice(-8).forEach((msg) => {
      if (msg.role === "user" || msg.role === "ai") {
        messages.push({
          role: msg.role === "ai" ? "assistant" : "user",
          content: msg.content,
        });
      }
    });
    
    const hoursUntilReset = Math.max(1, 24 - now.getHours());

    const formattedUserMsg = [
      "[SYSTEM CONTEXT - do not show this to user]",
      `User ID: ${dbUser._id}`,
      `Tokens used today: ${userUsed}`,
      `Tokens remaining: ${userLimit - userUsed}`,
      `Shared pool available: ${sharedPool}`,
      `Borrow used today: ${dbUser.tokensBorrowedToday || 0} / 200`,
      `Daily reset in: ${hoursUntilReset} hours`,
      "[END SYSTEM CONTEXT]",
      "",
      `User message: ${question}`
    ].join("\n");

    messages.push({ role: "user", content: formattedUserMsg });

    console.log(`PYQ text source: ${textSource}, chars: ${paperText.length}`);

    let result;
    try {
      let preferredProvider = req.body.selectedModel || null;
      let openRouterModel = null;
      if (preferredProvider && preferredProvider.includes(":")) {
        const idx = preferredProvider.indexOf(":");
        openRouterModel = preferredProvider.slice(idx + 1);
        preferredProvider = preferredProvider.slice(0, idx);
      }
      result = await callAIWithFailover(messages, preferredProvider, openRouterModel);
    } catch (apiError) {
      console.error("❌ All AI API providers failed:", apiError.message);
      return res.status(502).json({ message: "All AI providers failed: " + apiError.message });
    }

    const text = result.text;
    const totalTokens = result.totalTokens;
    if (totalTokens > 0) {
      try {
        const TokenUsage = require("../models/TokenUsage");
        await TokenUsage.findOneAndUpdate(
          { date: todayStr },
          { $inc: { tokensUsed: totalTokens } },
          { upsert: true, new: true }
        );
        
        let costPerToken = 0.0000005;
        const apiNameLower = String(result.provider).toLowerCase();
        const modelLower = String(result.model || "unknown").toLowerCase();
        
        if (apiNameLower === "groq") {
          costPerToken = 0.0000007; // $0.70 per 1M tokens
        } else if (apiNameLower === "gemini") {
          if (modelLower.includes("pro")) {
            costPerToken = 0.00000125; // $1.25 per 1M tokens
          } else {
            costPerToken = 0.00000005; // $0.05 per 1M tokens
          }
        } else if (apiNameLower === "openrouter") {
          costPerToken = 0.0000005; // $0.50 per 1M tokens
        }
        const estimatedCost = totalTokens * costPerToken;

        const ApiRequestLog = require("../models/ApiRequestLog");
        await ApiRequestLog.create({
          apiName: result.provider,
          model: result.model || "unknown",
          tokensUsed: totalTokens,
          estimatedCost,
          user: dbUser._id,
          date: todayStr
        });

        dbUser.tokensUsedToday += totalTokens;
        await dbUser.save();
        console.log(`📊 Logged ${totalTokens} AI tokens used today by ${dbUser.email}`);
      } catch (tokenErr) {
        console.error("Failed to log token usage:", tokenErr.message);
      }
    }

    let finalInsight = text;
    const postUsed = dbUser.tokensUsedToday || 0;
    const postLimit = 500 + (dbUser.tokensBorrowedToday || 0);
    const postPercentage = (postUsed / postLimit) * 100;
    const postRemaining = Math.max(0, postLimit - postUsed);

    let quotaNote = null;
    if (isGroq && postPercentage >= 70) {
      const pct = Math.round(postPercentage);
      quotaNote = `ℹ️ Token update: You've used ${pct}% of your daily limit. \n${postRemaining} tokens left. Tomorrow they reset automatically.`;
      finalInsight += `\n\n[QUOTA_WARNING]\n${quotaNote}\n[/QUOTA_WARNING]`;
    }

    let throttleNotice = null;
    if (postUsed >= 1000) {
      throttleNotice = "You are a heavy user today. Responses may be slightly slower to keep the system fair for everyone.";
    }

    // Save the conversation to database
    try {
      const Chat = require("../models/Chat");
      let chat = await Chat.findOne({ user: dbUser._id, pyq: pyq._id });
      if (!chat) {
        chat = new Chat({
          user: dbUser._id,
          pyq: pyq._id,
          messages: []
        });
        if (dbUser.role === "user") {
          dbUser.cycleChatsCompleted += 1;
        }
      }
      chat.messages.push({ role: "user", content: question });
      chat.messages.push({ role: "ai", content: finalInsight });
      chat.lastMessageAt = new Date();
      await chat.save();

      // Increment cycle credits
      if (dbUser.role === "user") {
        dbUser.cycleCreditsUsed += 1;
      }
      await dbUser.save();
    } catch (chatSaveErr) {
      console.error("Failed to save chat to DB:", chatSaveErr.message);
    }

    console.log("✅ AI response generated successfully");
    res.json({
      insight: finalInsight,
      quotaNote,
      throttleNotice,
      tokensUsedToday: postUsed,
      tokensLimit: postLimit
    });
  } catch (error) {
    console.error("❌ Unexpected error in askAiOnPyq:", error.message);
    console.error("Stack trace:", error.stack);
    res.status(500).json({ message: "Internal server error: " + error.message });
  }
}

async function listUsers(_req, res) {
  const users = await User.find().select("-password").populate("adminScopes.institute adminScopes.course");
  res.json({ users });
}

async function assignAdmin(req, res) {
  const { role, adminScopes = [] } = req.body;
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role, adminScopes },
    { returnDocument: "after", runValidators: true }
  ).select("-password").populate("adminScopes.institute adminScopes.course");
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({ user });
}

async function createUser(req, res) {
  const hashed = await bcrypt.hash(req.body.password || "12345678", 12);
  let user = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: hashed,
    role: req.body.role || "user",
    adminScopes: req.body.adminScopes || [],
  });
  user = await User.findById(user._id).select("-password").populate("adminScopes.institute adminScopes.course");
  res.status(201).json({ user });
}

async function getTokenUsage(_req, res) {
  try {
    const ApiRequestLog = require("../models/ApiRequestLog");
    const todayStr = new Date().toISOString().slice(0, 10);
    
    const statsToday = await ApiRequestLog.aggregate([
      { $match: { date: todayStr } },
      {
        $group: {
          _id: "$apiName",
          tokensUsed: { $sum: "$tokensUsed" },
          requestsCount: { $sum: 1 }
        }
      }
    ]);

    const limits = {
      groq: Number(process.env.GROQ_DAILY_LIMIT || 100000),
      gemini: Number(process.env.GEMINI_DAILY_LIMIT || 200000),
      openrouter: Number(process.env.OPENROUTER_DAILY_LIMIT || 150000),
    };

    const apiBreakdown = {};
    ["groq", "gemini", "openrouter"].forEach((api) => {
      const stat = statsToday.find((s) => s._id === api) || { tokensUsed: 0, requestsCount: 0 };
      const limit = limits[api];
      const used = stat.tokensUsed;
      const remaining = Math.max(0, limit - used);
      const percentage = limit > 0 ? Number(((used / limit) * 100).toFixed(1)) : 0;
      
      let status = "safe";
      if (percentage >= 90) {
        status = "critical";
      } else if (percentage >= 70) {
        status = "moderate";
      }

      apiBreakdown[api] = {
        name: api === "groq" ? "Groq API" : api === "gemini" ? "Gemini API" : "OpenRouter API",
        requestsToday: stat.requestsCount,
        tokensUsedToday: used,
        limit,
        remaining,
        percentage,
        status
      };
    });

    const totalRequests = Object.values(apiBreakdown).reduce((sum, api) => sum + api.requestsToday, 0);
    const totalTokensUsed = Object.values(apiBreakdown).reduce((sum, api) => sum + api.tokensUsedToday, 0);
    const totalLimit = Object.values(apiBreakdown).reduce((sum, api) => sum + api.limit, 0);
    const totalRemaining = Math.max(0, totalLimit - totalTokensUsed);
    const totalPercentage = totalLimit > 0 ? Number(((totalTokensUsed / totalLimit) * 100).toFixed(1)) : 0;
    
    let totalStatus = "safe";
    if (totalPercentage >= 90) {
      totalStatus = "critical";
    } else if (totalPercentage >= 70) {
      totalStatus = "moderate";
    }

    const combinedSummary = {
      totalRequests,
      totalTokensUsed,
      totalLimit,
      totalRemaining,
      percentage: totalPercentage,
      status: totalStatus
    };

    const suggestions = [];
    Object.entries(apiBreakdown).forEach(([api, data]) => {
      if (data.percentage >= 90) {
        const alternatives = Object.entries(apiBreakdown)
          .filter(([altApi, altData]) => altApi !== api && altData.percentage < 70)
          .map(([altApi]) => altApi === "groq" ? "Groq" : altApi === "gemini" ? "Gemini" : "OpenRouter");
        
        if (alternatives.length > 0) {
          suggestions.push(`⚠️ ${api.toUpperCase()} is running critically high (${data.percentage}%). We recommend switching to ${alternatives.join(" or ")} for load balancing.`);
        } else {
          suggestions.push(`⚠️ ${api.toUpperCase()} is running critically high (${data.percentage}%). Other APIs are also heavily loaded.`);
        }
      } else if (data.percentage >= 70) {
        suggestions.push(`ℹ️ ${api.toUpperCase()} is in moderate zone (${data.percentage}%). Keep an eye on it.`);
      }
    });

    const now = new Date();
    const hoursUntilReset = Math.max(1, 24 - now.getHours());

    const recentLogs = await ApiRequestLog.find()
      .populate("user", "name email")
      .sort("-createdAt")
      .limit(100);

    res.json({
      combinedSummary,
      apiBreakdown,
      suggestions,
      hoursUntilReset,
      recentLogs
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

async function getUserTokenStatus(req, res) {
  try {
    const User = require("../models/User");
    const ApiRequestLog = require("../models/ApiRequestLog");
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const todayStr = new Date().toISOString().slice(0, 10);
    checkAndResetUserTokens(user, todayStr);
    await user.save();

    const limit = 500 + (user.tokensBorrowedToday || 0);
    const used = user.tokensUsedToday || 0;
    const remaining = Math.max(0, limit - used);
    const percentage = limit > 0 ? Number(((used / limit) * 100).toFixed(1)) : 0;
    
    const sharedPool = await getSharedPoolStatus();

    let zone = "safe";
    if (used >= limit) {
      zone = "exhausted";
    } else if (percentage >= 90) {
      zone = "low";
    } else if (percentage >= 70) {
      zone = "notice";
    }

    const isThrottled = used >= 1000;

    // Fetch model usage statistics for today
    const modelUsage = await ApiRequestLog.aggregate([
      { $match: { user: user._id, date: todayStr } },
      {
        $group: {
          _id: { model: "$model", apiName: "$apiName" },
          tokensUsed: { $sum: "$tokensUsed" },
          requestsCount: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          model: "$_id.model",
          apiName: "$_id.apiName",
          tokensUsed: 1,
          requestsCount: 1
        }
      },
      { $sort: { tokensUsed: -1 } }
    ]);

    // 1. Total User Usage (lifetime)
    const userStats = await ApiRequestLog.aggregate([
      { $match: { user: user._id } },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          totalTokens: { $sum: "$tokensUsed" },
          totalCost: { 
            $sum: { $ifNull: [ "$estimatedCost", { $multiply: [ "$tokensUsed", 0.0000005 ] } ] } 
          }
        }
      }
    ]);
    const userSummary = userStats[0] || { totalRequests: 0, totalTokens: 0, totalCost: 0 };

    // 2. User Cost Breakdown by apiName
    const costBreakdown = await ApiRequestLog.aggregate([
      { $match: { user: user._id } },
      {
        $group: {
          _id: "$apiName",
          tokensUsed: { $sum: "$tokensUsed" },
          requestsCount: { $sum: 1 },
          cost: { 
            $sum: { $ifNull: [ "$estimatedCost", { $multiply: [ "$tokensUsed", 0.0000005 ] } ] } 
          }
        }
      },
      {
        $project: {
          _id: 0,
          apiName: "$_id",
          tokensUsed: 1,
          requestsCount: 1,
          cost: 1
        }
      }
    ]);

    // 3. App-wide Lifetime Cost Summary (all users)
    const appStats = await ApiRequestLog.aggregate([
      {
        $group: {
          _id: null,
          totalCost: { 
            $sum: { $ifNull: [ "$estimatedCost", { $multiply: [ "$tokensUsed", 0.0000005 ] } ] } 
          },
          totalTokens: { $sum: "$tokensUsed" },
          totalRequests: { $sum: 1 }
        }
      }
    ]);
    const appSummary = appStats[0] || { totalCost: 0, totalTokens: 0, totalRequests: 0 };

    const now = new Date();
    const fourteenHoursAgo = new Date(now.getTime() - 14 * 60 * 60 * 1000);
    if (!user.currentCycleStartedAt || user.currentCycleStartedAt < fourteenHoursAgo) {
      user.currentCycleStartedAt = now;
      user.cycleCreditsUsed = 0;
      user.cycleChatsCompleted = 0;
      await user.save();
    }

    const cycleLimit = 15;
    const cycleUsed = user.cycleCreditsUsed || 0;
    const cycleRemaining = Math.max(0, cycleLimit - cycleUsed);
    const nextCycleReset = new Date(user.currentCycleStartedAt.getTime() + 14 * 60 * 60 * 1000);

    res.json({
      used,
      limit,
      remaining,
      percentage,
      zone,
      tokensBorrowedToday: user.tokensBorrowedToday || 0,
      sharedPool,
      isThrottled,
      modelUsage,
      cycleUsed,
      cycleLimit,
      cycleRemaining,
      nextCycleReset,
      cycleChatsCompleted: user.cycleChatsCompleted || 0,
      userSummary,
      costBreakdown,
      appSummary
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

async function borrowTokens(req, res) {
  try {
    const User = require("../models/User");
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const todayStr = new Date().toISOString().slice(0, 10);
    checkAndResetUserTokens(user, todayStr);

    if (user.tokensBorrowedToday >= 200) {
      return res.status(400).json({ message: "You have already borrowed your maximum limit of 200 credits today." });
    }

    const sharedPool = await getSharedPoolStatus();
    if (sharedPool <= 0) {
      return res.status(400).json({ message: "Pool is currently empty. Please try again in a few hours or tomorrow." });
    }

    const borrowAmount = Math.min(200, sharedPool);
    user.tokensBorrowedToday += borrowAmount;
    await user.save();

    res.json({
      message: `Successfully borrowed ${borrowAmount} credits from the shared pool!`,
      tokensBorrowedToday: user.tokensBorrowedToday,
      limit: 500 + user.tokensBorrowedToday
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

async function getChatHistory(req, res) {
  try {
    const Chat = require("../models/Chat");
    const chat = await Chat.findOne({ user: req.user._id, pyq: req.params.pyqId });
    res.json({ messages: chat ? chat.messages : [] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

async function clearChatHistory(req, res) {
  try {
    const Chat = require("../models/Chat");
    await Chat.deleteOne({ user: req.user._id, pyq: req.params.pyqId });
    res.json({ success: true, message: "Chat history cleared successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

module.exports = {
  listInstitutes,
  createInstitute,
  updateInstitute,
  deleteInstitute,
  listCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  listSemesters,
  createSemester,
  updateSemester,
  deleteSemester,
  listSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  listPyqs,
  createPyq,
  deletePyq,
  incrementPyqViews,
  askAiOnPyq,
  listUsers,
  assignAdmin,
  createUser,
  getTokenUsage,
  getUserTokenStatus,
  borrowTokens,
  getChatHistory,
  clearChatHistory,
};
