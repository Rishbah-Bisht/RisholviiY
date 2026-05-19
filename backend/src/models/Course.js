const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    institute: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institute",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

courseSchema.index({ institute: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Course", courseSchema);
