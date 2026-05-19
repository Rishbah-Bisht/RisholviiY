const mongoose = require("mongoose");

async function connectDb() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGO_URI or MONGODB_URI is required");
  }

  const options = process.env.MONGODB_DB_NAME
    ? { dbName: process.env.MONGODB_DB_NAME }
    : undefined;

  await mongoose.connect(mongoUri, options);
  console.log("MongoDB connected");
}

module.exports = connectDb;
