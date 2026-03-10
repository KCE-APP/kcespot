const express = require("express");
const router = express.Router();
const {
  createAchiever,
  getAchievers,
  getAdminAchivers,
  getAchieverById,
  updateAchiever,
  deleteAchiever,
  updateReaction,
  getAchieverReactions,
} = require("../controllers/achieverController");

const upload = require("../middleware/upload");
const { protect, adminOnly, staffOnly } = require("../middleware/authMiddleware");

router.post("/", protect, staffOnly, upload.any(), createAchiever);
router.get("/", protect, getAchievers);
router.get("/admin", protect, staffOnly, getAdminAchivers);
router.get("/:id", protect, getAchieverById);
router.put("/:id", protect, staffOnly, upload.any(), updateAchiever);
router.delete("/:id", protect, staffOnly, deleteAchiever);
router.get("/:id/reactions", protect, getAchieverReactions);
router.patch("/reaction/:id", protect, updateReaction);

module.exports = router;
