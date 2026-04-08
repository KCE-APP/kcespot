const express = require("express");
const router = express.Router();
const assignmentController = require("../controllers/assignmentController");
const { protect, staffOnly, userOnly } = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");

// 🔑 Staff/Admin only - Specific paths first
router.post("/create", protect, staffOnly, assignmentController.createAssignment);
router.get("/all", protect, staffOnly, assignmentController.getAllAssignments);
router.post("/semester-rollover", protect, staffOnly, assignmentController.rolloverSemester);

// 👤 Student only - Specific paths BEFORE generic /:id
router.get("/my", protect, userOnly, assignmentController.getMyAssignments);
router.post("/submit", protect, userOnly, upload.single("file"), assignmentController.submitAssignment);
router.get("/submissions/:submissionId/certificate-data", protect, userOnly, assignmentController.getGradedCertificate);

// Nested specific routes BEFORE generic /:id route
router.get("/:assignmentId/submissions", protect, staffOnly, assignmentController.getAssignmentSubmissions);
router.patch("/submissions/:submissionId/review", protect, staffOnly, assignmentController.reviewSubmission);
router.get("/:assignmentId/my-submission", protect, userOnly, assignmentController.getMySubmission);

// 📄 Generic routes last (lowest priority)
router.get("/:id", protect, assignmentController.getAssignmentById);
router.put("/:assignmentId", protect, staffOnly, assignmentController.updateAssignment);
router.delete("/:assignmentId", protect, staffOnly, assignmentController.deleteAssignment);

module.exports = router;
