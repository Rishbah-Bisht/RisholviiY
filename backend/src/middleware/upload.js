const fs = require("fs");
const path = require("path");
const multer = require("multer");

const uploadRoot = path.join(__dirname, "..", "..", "uploads");
const logoDir = path.join(uploadRoot, "logos");
const pyqDir = path.join(uploadRoot, "pyqs");

for (const dir of [logoDir, pyqDir]) {
  fs.mkdirSync(dir, { recursive: true });
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

const logoUpload = multer({
  storage: storageFor(logoDir),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});

const pdfUpload = multer({
  storage: storageFor(pyqDir),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF files are allowed"));
    }
    cb(null, true);
  },
});

module.exports = { logoUpload, pdfUpload };
