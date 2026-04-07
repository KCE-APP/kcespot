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
      batch,
      semester,
      type,
      resourceLink,
      certificateLink,
      submissionType,
      submissionRequired,
      certificateRequired,
      dueDate,
    } = req.body;

    if (!title || !department || !batch || !semester || !type) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    // 1. Fetch Students by Department and Batch
    const students = await User.find({
      department,
      batch,
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
      batch,
      semester,
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

// 👩‍🏫 REVIEW SUBMISSION (Staff/Admin)
exports.reviewSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { status, marks, reviewRemarks } = req.body;

    if (!status || !["accepted", "rejected", "reupload"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    submission.status = status;
    submission.reviewRemarks = reviewRemarks || submission.reviewRemarks;
    submission.reviewedBy = req.user.id;
    submission.reviewedAt = Date.now();

    if (status === "accepted" && marks !== undefined) {
      if (marks < 0 || marks > 100) {
        return res.status(400).json({ message: "Marks must be between 0 and 100" });
      }
      submission.marks = marks;
    } else if (status === "reupload") {
      // Clear the previously uploaded bad file/link so the student can submit a new one
      submission.submissionLink = null;
      submission.fileUrl = null;
      submission.marks = null;
    }

    await submission.save();

    res.json({ message: "Submission reviewed successfully", submission });
  } catch (err) {
    console.error("Review submission error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// 🔄 ROLLOVER SEMESTER (Admin Only)
exports.rolloverSemester = async (req, res) => {
  try {
    const result = await Assignment.updateMany(
      { status: "active" },
      { $set: { status: "archived" } }
    );

    res.json({
      message: "Semester rollover successful",
      archivedCount: result.modifiedCount,
    });
  } catch (err) {
    console.error("Rollover semester error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// 🎓 GET GRADED CERTIFICATE (Student)
exports.getGradedCertificate = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const studentId = req.user.id;

    const submission = await Submission.findOne({ _id: submissionId, studentId })
      .populate("assignmentId", "title description department type")
      .populate("studentId", "name rollNo batch department collegeName");

    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    if (submission.status !== "accepted") {
      return res.status(400).json({ message: "Certificate not ready. Submission status is not accepted." });
    }

    res.json({
      message: "Certificate data fetched successfully",
      data: {
        studentName: submission.studentId.name,
        rollNo: submission.studentId.rollNo,
        batch: submission.studentId.batch,
        department: submission.studentId.department,
        collegeName: submission.studentId.collegeName,
        assignmentTitle: submission.assignmentId.title,
        marks: submission.marks,
        maxMarks: 100,
        reviewedAt: submission.reviewedAt,
      },
    });
  } catch (err) {
    console.error("Get graded certificate error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// 📋 GET ALL ASSIGNMENTS (Staff/Admin)
exports.getAllAssignments = async (req, res) => {
  try {
    const { page = 1, limit = 10, department, batch, semester, status, type } = req.query;

    const query = {};
    if (department) query.department = department;
    if (batch) query.batch = batch;
    if (semester) query.semester = parseInt(semester, 10);
    if (status) query.status = status;
    if (type) query.type = type;

    const pageConfig = parseInt(page, 10);
    const limitConfig = parseInt(limit, 10);
    const skip = (pageConfig - 1) * limitConfig;

    const totalItems = await Assignment.countDocuments(query);
    const assignments = await Assignment.find(query)
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitConfig);

    res.json({
      data: assignments,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / limitConfig),
        currentPage: pageConfig,
        pageSize: limitConfig,
      },
    });
  } catch (err) {
    console.error("Get all assignments error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✏️ UPDATE ASSIGNMENT (Staff/Admin)
exports.updateAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const updateData = req.body;

    const assignment = await Assignment.findByIdAndUpdate(
      assignmentId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    res.json({ message: "Assignment updated successfully", assignment });
  } catch (err) {
    console.error("Update assignment error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// 🗑️ DELETE ASSIGNMENT (Staff/Admin)
exports.deleteAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;

    const assignment = await Assignment.findByIdAndDelete(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    // Optionally cleanup submissions
    await Submission.deleteMany({ assignmentId });

    res.json({ message: "Assignment and related submissions deleted successfully" });
  } catch (err) {
    console.error("Delete assignment error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// 📥 GET ASSIGNMENT SUBMISSIONS (Staff/Admin)
exports.getAssignmentSubmissions = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { page = 1, limit = 10, status } = req.query;

    const query = { assignmentId };
    if (status) {
      query.status = status;
    }

    const pageConfig = parseInt(page, 10);
    const limitConfig = parseInt(limit, 10);
    const skip = (pageConfig - 1) * limitConfig;

    const totalItems = await Submission.countDocuments(query);
    const submissions = await Submission.find(query)
      .populate("studentId", "name rollNo batch department collegeName")
      .populate("reviewedBy", "name")
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limitConfig);

    res.json({
      data: submissions,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / limitConfig),
        currentPage: pageConfig,
        pageSize: limitConfig,
      },
    });
  } catch (err) {
    console.error("Get assignment submissions error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
