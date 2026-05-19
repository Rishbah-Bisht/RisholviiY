const mongoose = require("mongoose");

const pyqSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },
    year: { type: Number, required: true, min: 1990 },
    examType: { type: String, trim: true, default: "End Semester" },
    views: { type: Number, default: 0 },
    fileUrl: { type: String, required: true },
    originalName: { type: String, required: true },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    institute: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institute",
      required: true,
      index: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    semester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Semester",
      required: true,
      index: true,
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

pyqSchema.index({ institute: 1, course: 1, semester: 1, subject: 1, year: 1 });

module.exports = mongoose.model("PYQ", pyqSchema);
