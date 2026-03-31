const Assignment = require("../models/Assignment");
const Submission = require("../models/Submission");
const User = require("../models/User");
const { sendAssignmentNotification } = require("../service/pushNotificationService");

// 🆕 CREATE ASSIGNMENT (Staff/Admin)
exports.createAssignment = async (req, res) => {
  try {
    const {
      title,
      description,
      instructions,
      department,
      section,
      type,
      resourceLink,
      certificateLink,
      submissionType,
      submissionRequired,
      certificateRequired,
      dueDate,
    } = req.body;

    if (!title || !department || !section || !type) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    // 1. Fetch Students by Department and Section
    const students = await User.find({
      department,
      section,
      role: { $in: ["user", "student"] }, // Support both role names
      status: true,
    });

    const assignedStudents = students.map((s) => s._id);

    // 2. Save Assignment
    const assignment = new Assignment({
      title,
      description,
      instructions,
      department,
      section,
      type,
      resourceLink,
      certificateLink,
      submissionType,
      submissionRequired,
      certificateRequired,
      dueDate,
      assignedStudents,
      createdBy: req.user.id,
    });

    await assignment.save();

    // 3. Send Notifications
    const allPushTokens = students.reduce((acc, student) => {
      if (student.pushTokens && student.pushTokens.length > 0) {
        acc.push(...student.pushTokens);
      }
      return acc;
    }, []);

    if (allPushTokens.length > 0) {
      // Async notification - don't block response
      sendAssignmentNotification(allPushTokens, assignment).catch((err) =>
        console.error("Notification trigger error:", err)
      );
    }

    res.status(201).json({
      message: "Assignment created successfully",
      assignmentId: assignment._id,
      assignedCount: assignedStudents.length,
    });
  } catch (err) {
    console.error("Create assignment error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// 📌 GET MY ASSIGNMENTS (Student Only)
exports.getMyAssignments = async (req, res) => {
  try {
    const studentId = req.user.id;
    const assignments = await Assignment.find({
      assignedStudents: studentId,
      status: "active",
    })
      .select("-assignedStudents") // Exclude list of all students for privacy/payload size
      .sort({ createdAt: -1 });

    res.json(assignments);
  } catch (err) {
    console.error("Get my assignments error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// 📤 SUBMIT ASSIGNMENT (Student Only)
exports.submitAssignment = async (req, res) => {
  try {
    const { assignmentId, submissionLink, fileUrl } = req.body;
    const studentId = req.user.id;

    if (!assignmentId) {
      return res.status(400).json({ message: "Assignment ID required" });
    }

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    // Check if the student is actually assigned
    if (!assignment.assignedStudents.includes(studentId)) {
      return res.status(403).json({ message: "You are not assigned to this assignment" });
    }

    // Handle existing submission (update or prevent)
    let submission = await Submission.findOne({ studentId, assignmentId });
    if (submission) {
      submission.submissionLink = submissionLink || submission.submissionLink;
      submission.fileUrl = fileUrl || submission.fileUrl;
      submission.submittedAt = Date.now();
      await submission.save();
    } else {
      submission = new Submission({
        studentId,
        assignmentId,
        submissionLink,
        fileUrl,
      });
      await submission.save();
    }

    res.json({
      message: "Submission saved successfully",
      submissionId: submission._id,
    });
  } catch (err) {
    console.error("Submit assignment error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
