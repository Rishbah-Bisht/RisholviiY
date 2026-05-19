const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "ai"],
      required: true
    },
    content: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const chatSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    pyq: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PYQ",
      required: true,
      index: true
    },
    messages: [chatMessageSchema],
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  { timestamps: true }
);

// TTL index: Automatically deletes the chat document 48 hours (172800 seconds) after the last message.
chatSchema.index({ lastMessageAt: 1 }, { expireAfterSeconds: 172800 });

module.exports = mongoose.model("Chat", chatSchema);
