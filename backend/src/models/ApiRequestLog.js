const mongoose = require("mongoose");

const apiRequestLogSchema = new mongoose.Schema(
  {
    apiName: {
      type: String,
      required: true,
      enum: ["groq", "gemini", "openrouter"],
    },
    model: {
      type: String,
      required: true,
    },
    tokensUsed: {
      type: Number,
      default: 0,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    date: {
      type: String, // YYYY-MM-DD
      required: true,
      index: true,
    },
    estimatedCost: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ApiRequestLog", apiRequestLogSchema);
