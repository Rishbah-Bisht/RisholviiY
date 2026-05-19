const express = require("express");
const passport = require("passport");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const {
  register,
  login,
  me,
  logout,
  googleCallback,
  getGoogleOAuthConfig,
  updatePreferences,
} = require("../controllers/authController");

const router = express.Router();

function requireGoogleConfig(_req, res, next) {
  const googleConfig = getGoogleOAuthConfig();
  if (!googleConfig.clientID || !googleConfig.clientSecret) {
    return res.status(501).json({ message: "Google authentication is not configured" });
  }
  next();
}

router.post("/register", asyncHandler(register));
router.post("/login", asyncHandler(login));
router.get("/me", requireAuth, asyncHandler(me));
router.put("/preferences", requireAuth, asyncHandler(updatePreferences));
router.post("/logout", logout);

router.get("/google", requireGoogleConfig, passport.authenticate("google", { scope: ["profile", "email"], session: false }));
router.get(
  "/google/callback",
  requireGoogleConfig,
  passport.authenticate("google", { failureRedirect: "/api/auth/google/failure", session: false }),
  googleCallback
);
router.get("/google/failure", (_req, res) => res.status(401).json({ message: "Google authentication failed" }));

module.exports = router;
