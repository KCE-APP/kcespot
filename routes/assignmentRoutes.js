const express = require("express");
const router = express.Router();
const assignmentController = require("../controllers/assignmentController");
const { protect, staffOnly, userOnly } = require("../middleware/authMiddleware");

// 🔑 Staff/Admin only
router.post("/create", protect, staffOnly, assignmentController.createAssignment);

// 👤 Student only
router.get("/my", protect, userOnly, assignmentController.getMyAssignments);
router.post("/submit", protect, userOnly, assignmentController.submitAssignment);

module.exports = router;
