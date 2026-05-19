const mongoose = require("mongoose");

const instituteSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    shortForm: { type: String, required: true, trim: true, uppercase: true },
    logoUrl: { type: String },
  },
  { timestamps: true }
);

instituteSchema.index({ shortForm: 1 }, { unique: true });

module.exports = mongoose.model("Institute", instituteSchema);
