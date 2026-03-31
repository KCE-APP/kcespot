const express = require("express");
const router = express.Router();
const certificateController = require("../controllers/certificateController");
const { protect, userOnly } = require("../middleware/authMiddleware");

// 👤 Student only
router.get("/my", protect, userOnly, certificateController.getMyCertificates);

module.exports = router;
