const eventEmailTemplate = require("./../templates/eventInfoTemplate.js");
const Event = require("../models/Event.js");
const User = require("../models/User.js");
const { sendEventNotification } = require("../service/pushNotificationService");
const { optimizeImage } = require("../service/imageService");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");
const path = require("path");
const highUsersList = require("./../legit/users.js");

// CREATE event
exports.createEvent = async (req, res) => {
  try {
    const entryData = { ...req.body };

    if (req.file) {
      entryData.eventImage = await optimizeImage(req.file.buffer, req.file.originalname);
    }

    const event = new Event(entryData);
    const savedEvent = await event.save();

    const users = await User.find({ status: true });

    const allTokens = users.flatMap((user) => user.pushTokens || []);

    console.log(`[Notification Debug] Found ${users.length} active users.`);
    console.log(
      `[Notification Debug] Extracted ${allTokens.length} push tokens.`,
    );

    if (allTokens.length > 0) {
      console.log(
        `[Notification Debug] Sending notifications to tokens:`,
        allTokens,
      );
      // Added 'await' to catch errors in the frontend response
      await sendEventNotification(allTokens, savedEvent);
    } else {
      console.log(
        "[Notification Debug] No tokens found, skipping notification sending.",
      );
    }

    res.status(201).json({
      message: "Event saved and notification sent",
      event: savedEvent,
    });
  } catch (err) {
    console.error("Create event error:", err);
    res.status(500).json({ error: err.message });
  }
};

// GET all events with Pagination, Search, and Filter
exports.getEvents = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", campus = "" } = req.query;

    const query = { isDeleted: false, status: true };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { campus: { $regex: search, $options: "i" } },
      ];
    }

    if (campus) {
      query.campus = { $regex: `^${campus}$`, $options: "i" };
    }

    // Filter events based on user visibility
    if (req.user && req.user.id) {
      const user = await User.findById(req.user.id);

      // If user is admin, show all events. Otherwise check email visibility.
      if (user && user.role !== "admin" && user.email) {
        const email = user.email.toLowerCase();

        if (email.includes("@kce.ac.in")) {
          query.visibility = "KCE";
        } else if (email.includes("@karpagamtech.in")) {
          query.visibility = "KIT";
        } else if (email.includes("@kahedu.edu.in")) {
          query.visibility = "KAHE";
        } else if (email.includes("karpagam")) {
          // Show all events
        }
      }
    }

    const count = await Event.countDocuments(query);
    const events = await Event.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    res.json({
      data: events,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      totalItems: count,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
// GET all events with Pagination, Search, and Filter for Admin
exports.getEventsforAdmin = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", campus = "" } = req.query;

    const query = { isDeleted: false };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { campus: { $regex: search, $options: "i" } },
      ];
    }

    if (campus) {
      query.campus = { $regex: `^${campus}$`, $options: "i" };
    }

    const count = await Event.countDocuments(query);
    const events = await Event.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    res.json({
      data: events,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      totalItems: count,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET single event by ID
exports.getEventById = async (req, res) => {
  console.log(`[getEventById] Hit with ID: ${req.params.id}`);
  try {
    const { id } = req.params;
    let event = await Event.findOne({ _id: id, isDeleted: false });

    // Fallback if ID is passed differently
    if (!event) {
      event = await Event.findOne({ id: id, isDeleted: false });
    }

    if (!event) {
      console.log(`[getEventById] Event not found for ID: ${id}`);
      return res.status(404).json({ message: "Event not found" });
    }

    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE event
exports.updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    if (req.file) {
      updateData.eventImage = await optimizeImage(req.file.buffer, req.file.originalname);
    }

    const updated = await Event.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE (Soft Delete)
exports.deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;

    await Event.findByIdAndUpdate(id, { isDeleted: true });
    res.json({ message: "Event deleted successfully (Soft)" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// send notification to high authorities about the event updates
exports.sendEventInfo = async (req, res) => {
  try {
    const { id, userId } = req.body;

    if (!id || !userId) {
      return res
        .status(400)
        .json({ message: "Event ID and User ID are required" });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid Event ID" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid User ID" });
    }

    const requestEvent = await Event.findById(id);
    if (!requestEvent) {
      return res.status(404).json({ message: "Event Not Found" });
    }

    const fromInfo = await User.findById(userId);
    if (!fromInfo) {
      return res.status(404).json({ message: "Admin not found" });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    let imagePath = null;
    if (requestEvent.eventImage) {
      imagePath = path.join(
        __dirname,
        "..",
        requestEvent.eventImage.replace(/\\/g, "/"),
      );
    }

    const mailOptions = {
      from: `"${fromInfo.name}" <${process.env.EMAIL_USER}>`,
      to: highUsersList,
      subject: `Event Notification from KI: ${requestEvent.title}`,
      html: eventEmailTemplate(requestEvent, fromInfo),
    };

    if (imagePath) {
      mailOptions.attachments = [
        {
          filename: "event-poster.jpg",
          path: imagePath,
          cid: "eventimage",
        },
      ];
    }

    await transporter.sendMail(mailOptions);

    return res.json({ message: "Event information sent successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
};
