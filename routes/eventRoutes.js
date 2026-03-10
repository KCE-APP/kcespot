const express = require("express");
const router = express.Router();
const {
  createEvent,
  getEvents,
  getEventsforAdmin,
  getEventById,
  updateEvent,
  deleteEvent,
  sendEventInfo,
} = require("../controllers/eventController");
const User = require("../models/User");
const { sendEventNotification } = require("../service/pushNotificationService");
const upload = require("../middleware/upload");
const { adminOnly, protect, staffOnly } = require("../middleware/authMiddleware");

router.post("/post-event", protect, staffOnly, adminOnly, sendEventInfo)


router.post("/", protect, staffOnly, upload.single("eventImage"), createEvent);
router.get("/", protect, getEvents);
router.get("/admin", protect, staffOnly, getEventsforAdmin);
router.get("/:id", protect, getEventById);
router.put(
  "/:id",
  protect,
  staffOnly,
  upload.single("eventImage"),
  updateEvent,
);
router.delete("/:id", protect, staffOnly, deleteEvent);



//test


router.post("/test-notification", protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find({ status: true });
    const tokens = users.flatMap(user => user.pushTokens || []);

    if (tokens.length === 0) {
      return res.status(400).json({ message: "No push tokens found" });
    }

    await sendEventNotification(tokens, {
      _id: "test-event-id",
      title: "Test Notification 🚀"
    });

    res.json({
      message: "Test notification sent",
      tokensCount: tokens.length
    });
  } catch (err) {
    console.error("Test notification error:", err);
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;
