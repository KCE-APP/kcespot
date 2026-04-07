const express = require("express");
const router = express.Router();
const assignmentController = require("../controllers/assignmentController");
const { protect, staffOnly, userOnly } = require("../middleware/authMiddleware");

// 🔑 Staff/Admin only
router.post("/create", protect, staffOnly, assignmentController.createAssignment);
router.get("/all", protect, staffOnly, assignmentController.getAllAssignments);
router.put("/:assignmentId", protect, staffOnly, assignmentController.updateAssignment);
router.delete("/:assignmentId", protect, staffOnly, assignmentController.deleteAssignment);
router.get("/:assignmentId/submissions", protect, staffOnly, assignmentController.getAssignmentSubmissions);
router.patch("/submissions/:submissionId/review", protect, staffOnly, assignmentController.reviewSubmission);
router.post("/semester-rollover", protect, staffOnly, assignmentController.rolloverSemester);

// 👤 Student only
router.get("/my", protect, userOnly, assignmentController.getMyAssignments);
router.post("/submit", protect, userOnly, assignmentController.submitAssignment);
router.get("/submissions/:submissionId/certificate-data", protect, userOnly, assignmentController.getGradedCertificate);

module.exports = router;
