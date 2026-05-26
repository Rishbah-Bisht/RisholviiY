const fs = require("fs");
const path = require("path");
const multer = require("multer");
const cloudinary = require("../config/cloudinary");

const isVercel =
  process.env.VERCEL ||
  process.env.NOW_REGION ||
  process.env.LAMBDA_TASK_ROOT ||
  process.env.NODE_ENV === "production";

const useCloudinary = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

// ---------- local disk storage (dev without Cloudinary) ----------
const uploadRoot = isVercel
  ? path.join("/tmp", "uploads")
  : path.join(__dirname, "..", "..", "uploads");
const logoDir = path.join(uploadRoot, "logos");
const pyqDir = path.join(uploadRoot, "pyqs");

if (!useCloudinary) {
  for (const dir of [logoDir, pyqDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function storageFor(folder) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, folder),
    filename: (_req, file, cb) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
      cb(null, `${Date.now()}-${safeName}`);
    },
  });
}

// Use memory storage when Cloudinary is configured so we get req.file.buffer
const memStorage = multer.memoryStorage();

const logoUpload = multer({
  storage: useCloudinary ? memStorage : storageFor(logoDir),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});

const pdfUpload = multer({
  storage: useCloudinary ? memStorage : storageFor(pyqDir),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF files are allowed"));
    }
    cb(null, true);
  },
});

// ---------- Cloudinary helpers ----------

/**
 * Upload a buffer to Cloudinary.
 * @param {Buffer} buffer
 * @param {string} folder  – e.g. "pyqs" or "logos"
 * @param {string} resourceType – "raw" for PDFs, "image" for images
 * @returns {Promise<{url: string, publicId: string}>}
 */
function uploadToCloudinary(buffer, folder, resourceType = "raw") {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType, type: "upload" },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

/**
 * Delete a file from Cloudinary by public_id.
 */
function deleteFromCloudinary(publicId, resourceType = "raw") {
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

module.exports = {
  logoUpload,
  pdfUpload,
  uploadToCloudinary,
  deleteFromCloudinary,
  useCloudinary,
};
