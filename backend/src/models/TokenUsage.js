const mongoose = require("mongoose");

const tokenUsageSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      unique: true,
      required: true,
    },
    tokensUsed: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("TokenUsage", tokenUsageSchema);
