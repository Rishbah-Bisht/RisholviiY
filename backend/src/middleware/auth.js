const jwt = require("jsonwebtoken");
const User = require("../models/User");

function signToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token =
      authHeader.startsWith("Bearer ") ? authHeader.slice(7) : req.cookies.token;

    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id).select("-password").populate("adminScopes.institute adminScopes.course");
    if (!user) {
      return res.status(401).json({ message: "Invalid session" });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired session" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
  };
}

function canManageCourse(user, instituteId, courseId) {
  if (user.role === "super_admin") return true;
  if (user.role !== "admin") return false;

  return user.adminScopes.some(
    (scope) =>
      scope.institute.toString() === instituteId.toString() &&
      scope.course.toString() === courseId.toString()
  );
}

function requireCourseScope(getScope) {
  return async (req, res, next) => {
    const { institute, course } = await getScope(req);
    if (!institute || !course || !canManageCourse(req.user, institute, course)) {
      return res.status(403).json({ message: "Course scope not assigned" });
    }
    next();
  };
}

module.exports = { signToken, requireAuth, requireRole, canManageCourse, requireCourseScope };
