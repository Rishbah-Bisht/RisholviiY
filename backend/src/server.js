require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const passport = require("passport");
const connectDb = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const apiRoutes = require("./routes/apiRoutes");
const { configureGoogleAuth } = require("./controllers/authController");

const app = express();

app.set("trust proxy", 1);

configureGoogleAuth();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(morgan("dev"));
app.use(passport.initialize());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 10000 }));

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/auth", authRoutes);
app.use("/api", apiRoutes);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({
    message: error.message || "Internal server error",
  });
});

const port = process.env.PORT || 5000;

const isVercel = process.env.VERCEL || process.env.NOW_REGION || process.env.LAMBDA_TASK_ROOT || process.env.NODE_ENV === "production";

if (isVercel) {
  // Serverless DB Connection Middleware
  let cachedConnection = null;
  app.use(async (req, res, next) => {
    try {
      if (!cachedConnection) {
        cachedConnection = connectDb();
      }
      await cachedConnection;
      next();
    } catch (err) {
      cachedConnection = null; // Reset on failure
      next(err);
    }
  });
} else {
  // Local environment DB connection & Server setup
  connectDb()
    .then(() => {
      app.listen(port, () => console.log(`API running on http://localhost:${port}`));
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = app;
