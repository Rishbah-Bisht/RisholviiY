const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, uppercase: true },
    year: { type: Number, required: true, min: 1990, max: 2100, index: true },
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
  },
  { timestamps: true }
);

subjectSchema.index({ semester: 1, year: 1, name: 1 }, { unique: true });
subjectSchema.index({ institute: 1, course: 1, semester: 1, year: 1 });

module.exports = mongoose.model("Subject", subjectSchema);
