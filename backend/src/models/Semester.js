const mongoose = require("mongoose");

const semesterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    number: { type: Number, required: true, min: 1, max: 12 },
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
  },
  { timestamps: true }
);

semesterSchema.index({ course: 1, number: 1 }, { unique: true });

module.exports = mongoose.model("Semester", semesterSchema);
