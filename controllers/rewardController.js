const User = require("../models/User");
const RewardCatalog = require("../models/RewardCatalog");
const Redemption = require("../models/Redemption");
const RewardPointsLedger = require("../models/RewardPointsLedger");
const Badge = require("../models/Badge");
const AchievementSubmission = require("../models/AchievementSubmission");
const Staff = require("../models/Staff");
const PointRule = require("../models/PointRule");
const Achiever = require("../models/Achiever");
const ExcelJS = require("exceljs");
const mongoose = require("mongoose");
const crypto = require("crypto");
const { ACHIEVEMENT_CATEGORIES } = require("../config/constants");
const {
  sendSubmissionStatusNotification,
} = require("../service/pushNotificationService");

// Helper: Badge Evaluation
const evaluateBadges = async (userId) => {
  const user = await User.findById(userId);
  const badges = await Badge.find({
    pointsRequired: { $lte: user.lifetimePoints },
  });

  const earnedBadgeIds = badges.map((b) => b._id.toString());
  const userBadgeIds = user.badges.map((b) => b.toString());

  const newBadges = badges.filter(
    (b) => !userBadgeIds.includes(b._id.toString()),
  );

  if (newBadges.length > 0) {
    user.badges = [...new Set([...userBadgeIds, ...earnedBadgeIds])];
    await user.save();
    // TODO: Trigger Notification for new badge
  }
};

// Helper: Award Points
const awardPoints = async (
  userId,
  amount,
  reason,
  referenceId,
  referenceModel,
) => {
  const user = await User.findById(userId);
  if (!user) return;

  user.pointsBalance += amount;
  user.lifetimePoints += amount;
  await user.save();

  await RewardPointsLedger.create({
    studentId: userId,
    amount,
    type: "credit",
    reason,
    referenceId,
    referenceModel,
  });

  await evaluateBadges(userId);
};

// @desc    Submit Achievement
// @route   POST /api/rewards/submit
exports.submitAchievement = async (req, res) => {
  try {
    const entryData = { ...req.body };

    const { title, category, description, evidenceUrl } = entryData;
    const student = await User.findById(req.user.id);

    if (!student) return res.status(404).json({ message: "Student not found" });

    const evidenceImage = req.file ? req.file.path : null;

    if (!evidenceUrl && !evidenceImage) {
      return res.status(400).json({
        success: false,
        message: "Please provide either an evidence URL or an image.",
      });
    }

    // Duplicate detection: Hash of Title + Evidence (Url or Image Path)
    const evidenceSource = evidenceImage || evidenceUrl;
    const evidenceHash = crypto
      .createHash("sha256")
      .update(`${title}-${evidenceSource}`)
      .digest("hex");

    const existing = await AchievementSubmission.findOne({ evidenceHash });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "This achievement has already been submitted.",
      });
    }

    const submission = await AchievementSubmission.create({
      studentId: req.user.id,
      title,
      category,
      description,
      evidenceUrl,
      evidenceImage,
      evidenceHash,
      collegeName: student.collegeName,
      department: student.department || student.dept, // Handle both field names
    });
    res.status(201).json({ success: true, data: submission });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Verify Achievement (Staff Only)
// @route   PATCH /api/rewards/verify/:id
exports.verifyAchievement = async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    let { pointsAwarded } = req.body;
    const submission = await AchievementSubmission.findById(req.params.id);

    if (!submission)
      return res.status(404).json({ message: "Submission not found" });

    if (submission.status !== "pending") {
      return res.status(400).json({ message: "Achievement already processed" });
    }

    submission.status = status;
    submission.verifiedBy = req.user.id;

    if (status === "approved") {
      // 1. Fetch points from PointRule if not provided by Admin
      if (!pointsAwarded || req.user.role === "instructor") {
        const rule = await PointRule.findOne({ category: submission.category });
        if (!rule) {
          // Fallback to 0 if no rule exists, but mention it
          console.warn(
            `No PointRule found for category: ${submission.category}`,
          );
          pointsAwarded = 0;
        } else {
          pointsAwarded = rule.points;
        }
      }

      submission.pointsAwarded = pointsAwarded;
      await awardPoints(
        submission.studentId,
        submission.pointsAwarded,
        `Achievement Approved: ${submission.title}`,
        submission._id,
        "AchievementSubmission",
      );

      // Auto-post to Achiever collection
      const student = await User.findById(submission.studentId);
      await Achiever.create({
        name: submission.title,
        college: submission.collegeName,
        batch: student.batch ? student.batch.split("-").pop() : "N/A",
        category: submission.category,
        description: submission.description,
        status: true,
        posterImage: submission.evidenceImage,

        students: [
          {
            name: student.name,
            rollNo: student.rollNo,
            email: student.email,
            year: student.year,
            dept: student.department || student.dept,
          },
        ],
        submissionId: submission._id,
      });

      // Notify the student
      if (student.pushTokens && student.pushTokens.length > 0) {
        sendSubmissionStatusNotification(
          student.pushTokens,
          submission,
          "approved",
        );
      }
    } else if (status === "rejected") {
      submission.rejectionReason = rejectionReason;
    }

    await submission.save();
    res.json({ success: true, data: submission });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Redeem Reward
// @route   POST /api/rewards/redeem
exports.redeemReward = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { rewardId } = req.body;
    const user = await User.findById(req.user.id).session(session);
    const reward = await RewardCatalog.findById(rewardId).session(session);

    if (!reward) throw new Error("Reward not found");
    if (reward.stock <= 0) throw new Error("Reward out of stock");
    if (user.pointsBalance < reward.pointsCost)
      throw new Error("Insufficient points");

    reward.stock -= 1;
    user.pointsBalance -= reward.pointsCost;

    await reward.save({ session });
    await user.save({ session });

    const redemption = await Redemption.create(
      [
        {
          studentId: user._id,
          rewardId: reward._id,
          status: "pending",
        },
      ],
      { session },
    );

    await RewardPointsLedger.create(
      [
        {
          studentId: user._id,
          amount: -reward.pointsCost,
          type: "debit",
          reason: `Redeemed: ${reward.name}`,
          referenceId: redemption[0]._id,
          referenceModel: "Redemption",
        },
      ],
      { session },
    );

    await session.commitTransaction();
    res.json({ success: true, data: redemption[0] });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};

// @desc    Get Student Stats & History
// @route   GET /api/rewards/my-stats
exports.getMyStats = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate("badges");
    const pointsHistory = await RewardPointsLedger.find({
      studentId: req.user.id,
    }).sort("-createdAt");
    const redemptionHistory = await Redemption.find({ studentId: req.user.id })
      .populate("rewardId")
      .sort("-createdAt");
    const submissionHistory = await AchievementSubmission.find({
      studentId: req.user.id,
    }).sort("-createdAt");

    res.json({
      success: true,
      data: {
        pointsBalance: user.pointsBalance,
        lifetimePoints: user.lifetimePoints,
        earnedBadges: user.badges,
        pointsHistory,
        redemptionHistory,
        submissionHistory,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Catalog for Students
// @route   GET /api/rewards/catalog
exports.getCatalog = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", category } = req.query;

    const query = { stock: { $gt: 0 }, isDeleted: { $ne: true } };

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    if (category) query.category = category;

    const count = await RewardCatalog.countDocuments(query);
    const rewards = await RewardCatalog.find(query)
      .sort({ pointsCost: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    res.json({
      data: rewards,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      totalItems: count,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add Reward Item (Admin Only)
// @route   POST /api/rewards/catalog
exports.addRewardItem = async (req, res) => {
  try {
    const {
      name,
      description,
      pointsCost,
      stock,
      category,
      expiryDate,
      imageUrl,
    } = req.body;

    let finalImageUrl = imageUrl;
    if (req.file) {
      finalImageUrl = req.file.path;
    }

    const reward = await RewardCatalog.create({
      name,
      description,
      pointsCost,
      stock,
      category,
      expiryDate,
      imageUrl: finalImageUrl,
    });
    res.status(201).json({ success: true, data: reward });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update Reward Item (Admin Only)
// @route   PATCH /api/rewards/catalog/:id
exports.updateRewardItem = async (req, res) => {
  try {
    const updates = { ...req.body };
    if (req.file) {
      updates.imageUrl = req.file.path;
    }

    const reward = await RewardCatalog.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true },
    );
    if (!reward) {
      return res
        .status(404)
        .json({ success: false, message: "Reward not found" });
    }
    res.json({ success: true, data: reward });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete Reward Item (Soft Delete) (Admin Only)
// @route   DELETE /api/rewards/catalog/:id
exports.deleteRewardItem = async (req, res) => {
  try {
    const reward = await RewardCatalog.findByIdAndUpdate(
      req.params.id,
      { isDeleted: true },
      { new: true },
    );
    if (!reward) {
      return res
        .status(404)
        .json({ success: false, message: "Reward not found" });
    }
    res.json({ success: true, message: "Reward deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add/Update Point Rule (Admin Only)
// @route   POST /api/rewards/rules
exports.upsertPointRule = async (req, res) => {
  try {
    const { category, points } = req.body;
    const rule = await PointRule.findOneAndUpdate(
      { category },
      { points },
      { upsert: true, new: true },
    );
    res.json({ success: true, data: rule });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all Point Rules
// @route   GET /api/rewards/rules
exports.getPointRules = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;
    const query = { isDeleted: { $ne: true } };
    if (search) {
      query.category = { $regex: search, $options: "i" };
    }

    const count = await PointRule.countDocuments(query);
    const rules = await PointRule.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    res.json({
      data: rules,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      totalItems: count,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete Point Rule (Admin Only)
// @route   DELETE /api/rewards/rules/:id
exports.deletePointRule = async (req, res) => {
  try {
    const rule = await PointRule.findById(req.params.id);
    if (!rule) {
      return res
        .status(404)
        .json({ success: false, message: "Rule not found" });
    }

    await PointRule.findByIdAndUpdate(req.params.id, { isDeleted: true });
    res.json({ success: true, message: "Point rule deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update Point Rule (Admin Only)
// @route   PATCH /api/rewards/rules/:id
exports.updatePointRule = async (req, res) => {
  try {
    const { points, category } = req.body;
    const rule = await PointRule.findByIdAndUpdate(
      req.params.id,
      { points, category },
      { new: true, runValidators: true },
    );

    if (!rule) {
      return res
        .status(404)
        .json({ success: false, message: "Rule not found" });
    }

    res.json({ success: true, data: rule });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get All Badge Tiers
// @route   GET /api/rewards/badges
exports.getAllBadges = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const count = await Badge.countDocuments();
    const badges = await Badge.find()
      .sort("pointsRequired")
      .limit(limit * 1)
      .skip((page - 1) * limit);

    res.json({
      data: badges,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      totalItems: count,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Submissions (Staff/Admin Only)
// @route   GET /api/rewards/submissions
exports.getSubmissions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status, // Can be pending, approved, rejected, resubmit, or empty for all
      category,
      collegeName,
      department,
      studentId,
      search = "",
    } = req.query;

    const filter = { isDeleted: { $ne: true } };

    // 1. Status Filter
    if (status && status !== "all") {
      filter.status = status;
    }

    // 2. Instructor Category Restriction
    if (req.user.role === "instructor") {
      const staff = await Staff.findById(req.user.id);
      if (staff && staff.assignedCategory) {
        filter.category = staff.assignedCategory;
      }
    }

    // 3. Other Basic Filters
    if (category) filter.category = category;
    if (collegeName) filter.collegeName = collegeName;
    if (department) filter.department = department;
    if (studentId) filter.studentId = studentId;

    // 4. Advanced Search (Achievement Details OR Student Details)
    if (search) {
      // Find students matching name, rollNo, or email
      const matchingStudents = await User.find({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { rollNo: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ],
      }).select("_id");

      const studentIds = matchingStudents.map((s) => s._id);

      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { studentId: { $in: studentIds } },
      ];
    }

    const count = await AchievementSubmission.countDocuments(filter);
    const submissions = await AchievementSubmission.find(filter)
      .populate("studentId", "name rollNo department collegeName email")
      .populate("verifiedBy", "name email role")
      .sort("-createdAt")
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Filter and map to specific response format
    const formattedSubmissions = submissions.map((sub) => ({
      submissionId: sub._id,
      name: sub.studentId?.name || "N/A",
      rollNo: sub.studentId?.rollNo || "N/A",
      email: sub.studentId?.email || "N/A",
      dept: sub.department || sub.studentId?.department || "N/A",
      category: sub.category,
      status: sub.status,
      title: sub.title,
    }));

    res.json({
      success: true,
      data: formattedSubmissions,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      totalItems: count,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Point History (Student)
// @route   GET /api/rewards/history/points
exports.getPointHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10, type, search = "" } = req.query;
    const query = { studentId: req.user.id };
    if (type) query.type = type;
    if (search) query.reason = { $regex: search, $options: "i" };

    const count = await RewardPointsLedger.countDocuments(query);
    const history = await RewardPointsLedger.find(query)
      .sort("-createdAt")
      .limit(limit * 1)
      .skip((page - 1) * limit);

    res.json({
      data: history,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      totalItems: count,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Redemption History (Student)
// @route   GET /api/rewards/history/redemptions
exports.getRedemptionHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search = "" } = req.query;
    const query = { studentId: req.user.id };
    if (status) query.status = status;

    // If search is provided, find matching reward IDs first
    if (search) {
      const rewards = await RewardCatalog.find({
        name: { $regex: search, $options: "i" },
      }).select("_id");
      const rewardIds = rewards.map((r) => r._id);
      query.rewardId = { $in: rewardIds };
    }

    const count = await Redemption.countDocuments(query);
    const history = await Redemption.find(query)
      .populate("rewardId")
      .sort("-createdAt")
      .limit(limit * 1)
      .skip((page - 1) * limit);

    res.json({
      success: true,
      data: history,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      totalItems: count,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
// @desc    Get Student Achievements (Paginated)
// @route   GET /api/rewards/my-submissions
exports.getStudentAchievements = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search = "" } = req.query;
    const query = { studentId: req.user.id, isDeleted: { $ne: true } };

    if (status) query.status = status;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const count = await AchievementSubmission.countDocuments(query);
    let achievements = await AchievementSubmission.find(query)
      .sort("-createdAt")
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    // Fetch reactions from Achiever model
    const submissionIds = achievements.map((sub) => sub._id);
    const achievers = await Achiever.find({
      submissionId: { $in: submissionIds },
    }).select("submissionId reactions");

    const reactionMap = {};
    achievers.forEach((achiever) => {
      reactionMap[achiever.submissionId.toString()] = achiever.reactions;
    });

    // Attach reactions to achievements
    achievements = achievements.map((sub) => ({
      ...sub,
      reactions: reactionMap[sub._id.toString()] || {
        r1: 0,
        r2: 0,
        r3: 0,
        r4: 0,
        r5: 0,
      },
    }));

    res.json({
      success: true,
      data: achievements,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      totalItems: count,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Single Submission Details (Staff/Admin Only)
// @route   GET /api/rewards/submission/:id
exports.getSubmissionDetails = async (req, res) => {
  try {
    const submission = await AchievementSubmission.findById(req.params.id)
      .populate(
        "studentId",
        "name rollNo department collegeName email year batch",
      )
      .populate("verifiedBy", "name email role");

    if (!submission) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }

    res.json({
      success: true,
      data: submission,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Achievement Categories
// @route   GET /api/rewards/categories
exports.getCategories = async (req, res) => {
  try {
    res.json({
      success: true,
      data: ACHIEVEMENT_CATEGORIES,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
// @desc    Update Achievement
// @route   PUT /api/rewards/submission/:id
exports.updateAchievement = async (req, res) => {
  try {
    const { title, category, description, evidenceUrl } = req.body;
    const submission = await AchievementSubmission.findById(req.params.id);

    if (!submission) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }

    // Check ownership
    if (submission.studentId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to edit this achievement",
      });
    }

    // Check status
    if (!["pending", "rejected", "resubmit"].includes(submission.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot edit achievement with status: ${submission.status}`,
      });
    }

    const evidenceImage = req.file ? req.file.path : submission.evidenceImage;

    // Generate new evidenceHash if title or evidence changes
    let evidenceHash = submission.evidenceHash;
    if (
      title !== submission.title ||
      evidenceUrl !== submission.evidenceUrl ||
      (req.file && req.file.path !== submission.evidenceImage)
    ) {
      const evidenceSource = evidenceImage || evidenceUrl || "";
      evidenceHash = crypto
        .createHash("sha256")
        .update(`${title || submission.title}-${evidenceSource}`)
        .digest("hex");

      // Check for duplicate if hash changed
      if (evidenceHash !== submission.evidenceHash) {
        const existing = await AchievementSubmission.findOne({ evidenceHash });
        if (existing && existing._id.toString() !== submission._id.toString()) {
          return res.status(400).json({
            success: false,
            message: "This achievement has already been submitted.",
          });
        }
      }
    }

    submission.title = title || submission.title;
    submission.category = category || submission.category;
    submission.description = description || submission.description;
    submission.evidenceUrl = evidenceUrl || submission.evidenceUrl;
    submission.evidenceImage = evidenceImage;
    submission.evidenceHash = evidenceHash;

    // If it was rejected, moving it back to pending
    if (submission.status === "rejected" || submission.status === "resubmit") {
      submission.status = "pending";
    }

    await submission.save();
    res.json({ success: true, data: submission });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete Achievement
// @route   DELETE /api/rewards/submission/:id
exports.deleteAchievement = async (req, res) => {
  try {
    const submission = await AchievementSubmission.findById(req.params.id);

    if (!submission) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }

    // Check ownership
    // if (submission.studentId.toString() !== req.user.id) {
    //   return res.status(403).json({
    //     success: false,
    //     message: "Not authorized to delete this achievement",
    //   });
    // }

    // Check status - only pending achievements can be deleted
    // if (submission.status !== "pending") {
    //   return res.status(400).json({
    //     success: false,
    //     message: "Only pending achievements can be deleted",
    //   });
    // }

    await AchievementSubmission.findByIdAndUpdate(req.params.id, {
      isDeleted: true,
    });
    res.json({ success: true, message: "Achievement deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get All Redemptions (Staff/Admin Only)
// @route   GET /api/rewards/admin/redemptions
exports.getAllRedemptions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      collegeName,
      department,
      batch,
      search = "",
    } = req.query;

    const filter = {};

    if (status) filter.status = status;

    // Student identity filters
    const studentQuery = {};
    if (collegeName) studentQuery.collegeName = collegeName;
    if (department) studentQuery.department = department; // Note: model uses 'department'
    if (batch) studentQuery.batch = batch;

    if (search) {
      studentQuery.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { rollNo: { $regex: search, $options: "i" } },
      ];
    }

    // Find matching students first to filter redemptions
    let studentIds = [];
    if (Object.keys(studentQuery).length > 0) {
      const matchingStudents = await User.find(studentQuery).select("_id");
      studentIds = matchingStudents.map((s) => s._id);
      filter.studentId = { $in: studentIds };
    }

    const count = await Redemption.countDocuments(filter);
    const redemptions = await Redemption.find(filter)
      .populate("studentId", "name rollNo department collegeName email batch")
      .populate("rewardId", "name pointsCost category imageUrl")
      .sort("-redeemedAt")
      .limit(limit * 1)
      .skip((page - 1) * limit);

    res.json({
      success: true,
      data: redemptions,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      totalItems: count,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update Redemption Status (Staff/Admin Only)
// @route   PATCH /api/rewards/admin/redemptions/:id
exports.updateRedemptionStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const redemption = await Redemption.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true },
    );

    if (!redemption) {
      return res
        .status(404)
        .json({ success: false, message: "Redemption not found" });
    }

    res.json({ success: true, data: redemption });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Export Achievement Submissions to Excel
// @route   GET /api/rewards/export/submissions
exports.exportSubmissionsToExcel = async (req, res) => {
  try {
    const submissions = await AchievementSubmission.find({
      isDeleted: { $ne: true },
    }).populate("studentId", "name rollNo department collegeName email batch");

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Submissions");

    worksheet.columns = [
      { header: "Student Name", key: "studentName", width: 25 },
      { header: "Roll No", key: "rollNo", width: 15 },
      { header: "College", key: "college", width: 10 },
      { header: "Department", key: "department", width: 15 },
      { header: "Title", key: "title", width: 30 },
      { header: "Category", key: "category", width: 25 },
      { header: "Status", key: "status", width: 15 },
      { header: "Points Awarded", key: "points", width: 15 },
      { header: "Submitted At", key: "createdAt", width: 20 },
    ];

    submissions.forEach((sub) => {
      worksheet.addRow({
        studentName: sub.studentId?.name || "N/A",
        rollNo: sub.studentId?.rollNo || "N/A",
        college: sub.studentId?.collegeName || "N/A",
        department: sub.studentId?.department || "N/A",
        title: sub.title,
        category: sub.category,
        status: sub.status,
        points: sub.pointsAwarded,
        createdAt: sub.createdAt.toLocaleString(),
      });
    });

    worksheet.getRow(1).font = { bold: true };
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=submissions.xlsx",
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Export Point Rules to Excel
// @route   GET /api/rewards/export/rules
exports.exportPointRulesToExcel = async (req, res) => {
  try {
    const rules = await PointRule.find({ isDeleted: { $ne: true } });
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Point Rules");

    worksheet.columns = [
      { header: "Category", key: "category", width: 30 },
      { header: "Points", key: "points", width: 15 },
    ];

    rules.forEach((rule) => {
      worksheet.addRow({ category: rule.category, points: rule.points });
    });

    worksheet.getRow(1).font = { bold: true };
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=point_rules.xlsx",
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Export Reward Catalog to Excel
// @route   GET /api/rewards/export/catalog
exports.exportCatalogToExcel = async (req, res) => {
  try {
    const catalog = await RewardCatalog.find({ isDeleted: { $ne: true } });
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Reward Catalog");

    worksheet.columns = [
      { header: "Name", key: "name", width: 25 },
      { header: "Category", key: "category", width: 20 },
      { header: "Points Cost", key: "pointsCost", width: 15 },
      { header: "Stock", key: "stock", width: 10 },
      { header: "Description", key: "description", width: 40 },
    ];

    catalog.forEach((item) => {
      worksheet.addRow({
        name: item.name,
        category: item.category,
        pointsCost: item.pointsCost,
        stock: item.stock,
        description: item.description,
      });
    });

    worksheet.getRow(1).font = { bold: true };
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", "attachment; filename=catalog.xlsx");
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Export Redemptions to Excel
// @route   GET /api/rewards/export/redemptions
exports.exportRedemptionsToExcel = async (req, res) => {
  try {
    const redemptions = await Redemption.find()
      .populate("studentId", "name rollNo department collegeName email batch")
      .populate("rewardId", "name pointsCost category");

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Redemptions");

    worksheet.columns = [
      { header: "Student Name", key: "studentName", width: 25 },
      { header: "Roll No", key: "rollNo", width: 15 },
      { header: "Department", key: "department", width: 15 },
      { header: "Reward Name", key: "reward", width: 25 },
      { header: "Points Cost", key: "points", width: 15 },
      { header: "Status", key: "status", width: 15 },
      { header: "Redeemed At", key: "date", width: 20 },
    ];

    redemptions.forEach((red) => {
      worksheet.addRow({
        studentName: red.studentId?.name || "N/A",
        rollNo: red.studentId?.rollNo || "N/A",
        department: red.studentId?.department || "N/A",
        reward: red.rewardId?.name || "N/A",
        points: red.rewardId?.pointsCost || 0,
        status: red.status,
        date: red.redeemedAt.toLocaleString(),
      });
    });

    worksheet.getRow(1).font = { bold: true };
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=redemptions.xlsx",
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
