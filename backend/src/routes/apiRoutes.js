const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { logoUpload, pdfUpload } = require("../middleware/upload");
const { requireAuth, requireRole } = require("../middleware/auth");
const c = require("../controllers/resourceController");

const router = express.Router();

router.use(requireAuth);

router.get("/institutes", asyncHandler(c.listInstitutes));
router.post("/institutes", requireRole("super_admin"), logoUpload.single("logo"), asyncHandler(c.createInstitute));
router.put("/institutes/:id", requireRole("super_admin"), logoUpload.single("logo"), asyncHandler(c.updateInstitute));
router.delete("/institutes/:id", requireRole("super_admin"), asyncHandler(c.deleteInstitute));

router.get("/courses", asyncHandler(c.listCourses));
router.post("/courses", requireRole("super_admin"), asyncHandler(c.createCourse));
router.put("/courses/:id", requireRole("super_admin"), asyncHandler(c.updateCourse));
router.delete("/courses/:id", requireRole("super_admin"), asyncHandler(c.deleteCourse));

router.get("/semesters", asyncHandler(c.listSemesters));
router.post("/semesters", requireRole("super_admin"), asyncHandler(c.createSemester));
router.put("/semesters/:id", requireRole("super_admin"), asyncHandler(c.updateSemester));
router.delete("/semesters/:id", requireRole("super_admin"), asyncHandler(c.deleteSemester));

router.get("/subjects", asyncHandler(c.listSubjects));
router.post("/subjects", requireRole("super_admin"), asyncHandler(c.createSubject));
router.put("/subjects/:id", requireRole("super_admin"), asyncHandler(c.updateSubject));
router.delete("/subjects/:id", requireRole("super_admin"), asyncHandler(c.deleteSubject));

router.get("/pyqs", asyncHandler(c.listPyqs));
router.post("/pyqs", requireRole("super_admin", "admin"), pdfUpload.single("pdf"), asyncHandler(c.createPyq));
router.delete("/pyqs/:id", requireRole("super_admin", "admin"), asyncHandler(c.deletePyq));
router.post("/pyqs/:id/view", asyncHandler(c.incrementPyqViews));
router.post("/pyqs/:id/ask-ai", asyncHandler(c.askAiOnPyq));
router.get("/chats/:pyqId", asyncHandler(c.getChatHistory));
router.delete("/chats/:pyqId", asyncHandler(c.clearChatHistory));

router.get("/users", requireRole("super_admin"), asyncHandler(c.listUsers));
router.post("/users", requireRole("super_admin"), asyncHandler(c.createUser));
router.patch("/users/:id/role", requireRole("super_admin"), asyncHandler(c.assignAdmin));
router.get("/admin/token-usage", requireRole("super_admin"), asyncHandler(c.getTokenUsage));
router.get("/users/token-status", asyncHandler(c.getUserTokenStatus));
router.post("/users/borrow", asyncHandler(c.borrowTokens));

module.exports = router;
