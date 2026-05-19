const bcrypt = require("bcryptjs");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");
const { signToken } = require("../middleware/auth");

function userPayload(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    adminScopes: user.adminScopes,
    institute: user.institute,
    course: user.course,
    semester: user.semester,
  };
}

function getGoogleOAuthConfig() {
  const clientID = process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET;
  let callbackURL =
    process.env.GOOGLE_CALLBACK_URL ||
    process.env.AUTH_GOOGLE_CALLBACK_URL ||
    "http://localhost:5000/api/auth/google/callback";

  if (callbackURL) {
    // Automatically fix double slashes (e.g. domain.com//api -> domain.com/api)
    callbackURL = callbackURL.replace(/([^:]\/)\/+/g, "$1");
  }

  return { clientID, clientSecret, callbackURL };
}

function configureGoogleAuth() {
  const googleConfig = getGoogleOAuthConfig();

  if (!googleConfig.clientID || !googleConfig.clientSecret) {
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: googleConfig.clientID,
        clientSecret: googleConfig.clientSecret,
        callbackURL: googleConfig.callbackURL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value?.toLowerCase();
          if (!email) return done(new Error("Google account has no email"));

          const user = await User.findOneAndUpdate(
            { email },
            {
              $setOnInsert: {
                name: profile.displayName || email,
                email,
                role: "user",
              },
              $set: { googleId: profile.id },
            },
            { upsert: true, returnDocument: "after" }
          );

          done(null, user);
        } catch (error) {
          done(error);
        }
      }
    )
  );
}

async function register(req, res) {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 8) {
    return res.status(400).json({ message: "Name, email, and 8+ character password are required" });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ message: "User already exists" });
  }

  const hashed = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, password: hashed });
  const token = signToken(user);

  res.cookie("token", token, { httpOnly: true, sameSite: "lax" });
  res.status(201).json({ token, user: userPayload(user) });
}

async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email?.toLowerCase() }).populate("adminScopes.institute adminScopes.course");
  if (!user || !user.password) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = signToken(user);
  res.cookie("token", token, { httpOnly: true, sameSite: "lax" });
  res.json({ token, user: userPayload(user) });
}

async function me(req, res) {
  res.json({ user: userPayload(req.user) });
}

function logout(_req, res) {
  res.clearCookie("token");
  res.json({ message: "Logged out" });
}

function googleCallback(req, res) {
  const token = signToken(req.user);
  res.cookie("token", token, { httpOnly: true, sameSite: "lax" });
  res.redirect(`${process.env.CLIENT_URL || "http://localhost:3000"}/auth/callback?token=${token}`);
}

async function updatePreferences(req, res) {
  const { institute, course, semester } = req.body;
  if (!institute || !course || !semester) {
    return res.status(400).json({ message: "Institute, course, and semester are required" });
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  user.institute = institute;
  user.course = course;
  user.semester = semester;
  await user.save();
  await user.populate("adminScopes.institute adminScopes.course");

  res.json({ message: "Preferences updated successfully", user: userPayload(user) });
}

module.exports = {
  getGoogleOAuthConfig,
  configureGoogleAuth,
  register,
  login,
  me,
  logout,
  googleCallback,
  updatePreferences,
};
