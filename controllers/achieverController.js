const Achiever = require("../models/Achiever");
const Reaction = require("../models/Reaction");
const User = require("../models/User");
const {
  sendAchieverNotification,
} = require("../service/pushNotificationService");
const { optimizeImage } = require("../service/imageService");

// CREATE
exports.createAchiever = async (req, res) => {
  try {
    const entryData = { ...req.body };

    // Sanitize posterImage: if it's an object (e.g. {}), remove it so Mongoose validation doesn't fail
    if (entryData.posterImage && typeof entryData.posterImage === "object") {
      delete entryData.posterImage;
    }

    // Parse students if it's a string (from FormData)
    if (typeof entryData.students === "string") {
      entryData.students = JSON.parse(entryData.students);
    }

    // Handle File Uploads (Poster + Student Images)
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        if (file.fieldname === "posterImage") {
          entryData.posterImage = await optimizeImage(file.buffer, file.originalname);
        } else if (file.fieldname.startsWith("studentImage_")) {
          // Extract index from fieldname "studentImage_0", "studentImage_1", etc.
          const index = parseInt(file.fieldname.split("_")[1]);
          if (entryData.students && entryData.students[index]) {
            entryData.students[index].imageUrl = await optimizeImage(file.buffer, file.originalname);
          }
        }
      }
    }

    const achiever = new Achiever(entryData);
    const savedAchiever = await achiever.save();

    // --- Reward System Integration: Admin Success Post ---
    // If Admin posts, award points automatically to found students
    const { awardPoints } = require("./rewardController");
    const PointRule = require("../models/PointRule");

    if (savedAchiever.students && savedAchiever.students.length > 0) {
      for (const s of savedAchiever.students) {
        if (s.rollNo) {
          // 1. Case-Insensitive Matching
          const user = await User.findOne({
            rollNo: { $regex: `^${s.rollNo}$`, $options: "i" },
          });

          if (user) {
            // 2. Duplication Prevention: Check if points were already awarded for a similar achievement
            // We check the Ledger for a credit to this student with same reason/reference
            const RewardPointsLedger = require("../models/RewardPointsLedger");
            const alreadyAwarded = await RewardPointsLedger.findOne({
              studentId: user._id,
              referenceId: savedAchiever._id,
              referenceModel: "Achiever",
            });

            if (!alreadyAwarded) {
              // Find rule for this category
              const rule = await PointRule.findOne({
                category: savedAchiever.category,
              });
              const points = rule ? rule.points : 100; // Fallback to 100 for admin posts if no rule

              await awardPoints(
                user._id,
                points,
                `Admin Achievement Post: ${savedAchiever.category}`,
                savedAchiever._id,
                "Achiever",
              );
            } else {
              console.log(
                `Points already awarded for student ${s.rollNo} on achiever ${savedAchiever._id}`,
              );
            }
          }
        }
      }
    }

    // --- Send Push Notification ---

    const users = await User.find({ status: true });
    const allTokens = users.flatMap((user) => user.pushTokens || []);

    if (allTokens.length > 0) {
      console.log(
        `[Achiever Notification] Found ${users.length} users, ${allTokens.length} tokens.`,
      );
      sendAchieverNotification(allTokens, savedAchiever).catch((err) =>
        console.error("Achiever push notification error:", err),
      );
    }

    res.status(201).json({
      message: "Achiever saved and notification sent",
      achiever: savedAchiever,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// READ (ALL) with Pagination and Search
exports.getAchievers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", college = "" } = req.query;

    const query = { isDeleted: false, status: true };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { college: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }, // Added description for completeness
      ];
    }

    if (college) {
      query.college = { $regex: `^${college}$`, $options: "i" };
    }

    const count = await Achiever.countDocuments(query);

    let achievers = await Achiever.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean(); // Use lean() to get plain JS objects

    // ENRICH DATA: Add userReaction field
    if (req.user && req.user.id) {
      const achieverIds = achievers.map((a) => a._id);

      const userReactions = await Reaction.find({
        user: req.user.id,
        achiever: { $in: achieverIds },
      });

      // Create a map: achieverId -> reactionType
      const reactionMap = {};
      userReactions.forEach((reaction) => {
        reactionMap[reaction.achiever.toString()] = reaction.type;
      });

      // Attach to achievers
      achievers = achievers.map((achiever) => {
        const reactions = achiever.reactions || {};
        const totalReactions =
          (reactions.r1 || 0) +
          (reactions.r2 || 0) +
          (reactions.r3 || 0) +
          (reactions.r4 || 0) +
          (reactions.r5 || 0);

        return {
          ...achiever,
          userReaction: reactionMap[achiever._id.toString()] || null,
          totalReactions,
        };
      });
    } else {
      // If no user is logged in (just in case), ensure field exists as null
      achievers = achievers.map((achiever) => {
        const reactions = achiever.reactions || {};
        const totalReactions =
          (reactions.r1 || 0) +
          (reactions.r2 || 0) +
          (reactions.r3 || 0) +
          (reactions.r4 || 0) +
          (reactions.r5 || 0);

        return {
          ...achiever,
          userReaction: null,
          totalReactions,
        };
      });
    }

    res.json({
      data: achievers,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      totalItems: count,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// READ (ALL) with Pagination and Search for Admin
exports.getAdminAchivers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", college = "" } = req.query;

    const query = { isDeleted: false, submissionId: null };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { college: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }, // Added description for completeness
      ];
    }

    if (college) {
      query.college = { $regex: `^${college}$`, $options: "i" };
    }

    const count = await Achiever.countDocuments(query);

    let achievers = await Achiever.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean(); // Use lean() to get plain JS objects

    // ENRICH DATA: Add userReaction field
    if (req.user && req.user.id) {
      const achieverIds = achievers.map((a) => a._id);

      const userReactions = await Reaction.find({
        user: req.user.id,
        achiever: { $in: achieverIds },
      });

      // Create a map: achieverId -> reactionType
      const reactionMap = {};
      userReactions.forEach((reaction) => {
        reactionMap[reaction.achiever.toString()] = reaction.type;
      });

      // Attach to achievers
      achievers = achievers.map((achiever) => {
        const reactions = achiever.reactions || {};
        const totalReactions =
          (reactions.r1 || 0) +
          (reactions.r2 || 0) +
          (reactions.r3 || 0) +
          (reactions.r4 || 0) +
          (reactions.r5 || 0);

        return {
          ...achiever,
          userReaction: reactionMap[achiever._id.toString()] || null,
          totalReactions,
        };
      });
    } else {
      // If no user is logged in (just in case), ensure field exists as null
      achievers = achievers.map((achiever) => {
        const reactions = achiever.reactions || {};
        const totalReactions =
          (reactions.r1 || 0) +
          (reactions.r2 || 0) +
          (reactions.r3 || 0) +
          (reactions.r4 || 0) +
          (reactions.r5 || 0);

        return {
          ...achiever,
          userReaction: null,
          totalReactions,
        };
      });
    }

    res.json({
      data: achievers,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      totalItems: count,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE
exports.updateAchiever = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("Update Achiever Body:", req.body);
    console.log("Update Achiever Files:", req.files);
    const updateData = { ...req.body };
    let posterImageWarning = null;

    // Sanitize posterImage: if it's an object (e.g. {}), remove it so Mongoose validation doesn't fail
    if (updateData.posterImage && typeof updateData.posterImage === "object") {
      delete updateData.posterImage;
      posterImageWarning =
        "posterImage was received as an object (e.g. {}), not a file. Please ensure you are sending a File/Blob in FormData.";
    }

    // Parse students if it's a string
    if (typeof updateData.students === "string") {
      updateData.students = JSON.parse(updateData.students);
    }

    // Handle File Uploads (Poster + Student Images)
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        if (file.fieldname === "posterImage") {
          updateData.posterImage = await optimizeImage(file.buffer, file.originalname);
        } else if (file.fieldname.startsWith("studentImage_")) {
          const index = parseInt(file.fieldname.split("_")[1]);
          if (updateData.students && updateData.students[index]) {
            updateData.students[index].imageUrl = await optimizeImage(file.buffer, file.originalname);
          }
        }
      }
    }

    const updatedAchiever = await Achiever.findByIdAndUpdate(
      id,
      updateData,
      { new: true }, // return updated document
    );

    if (!updatedAchiever) {
      return res.status(404).json({ message: "Achiever not found" });
    }

    const response = {
      message: "Achiever updated successfully",
      achiever: updatedAchiever,
    };
    if (posterImageWarning) {
      response.warning = posterImageWarning;
    }

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE (Soft Delete)
exports.deleteAchiever = async (req, res) => {
  try {
    const { id } = req.params;

    // Use findByIdAndUpdate to soft delete
    const deletedAchiever = await Achiever.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true },
    );

    if (!deletedAchiever) {
      return res.status(404).json({ message: "Achiever not found" });
    }

    res.json({ message: "Achiever deleted successfully (Soft Delete)" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE REACTION
exports.updateReaction = async (req, res) => {
  try {
    const { id } = req.params; // Achiever ID
    const { reactionType } = req.body; // "r1", "r2", "r3", "r4", "r5"
    const userId = req.user.id; // From authMiddleware

    const validReactions = ["r1", "r2", "r3", "r4", "r5"];
    if (!validReactions.includes(reactionType)) {
      return res.status(400).json({ message: "Invalid reaction type" });
    }

    // 1. Check if user already reacted
    const existingReaction = await Reaction.findOne({
      user: userId,
      achiever: id,
    });
    let updatedAchiever;
    let message = "";
    let userReaction = null;

    if (existingReaction) {
      if (existingReaction.type === reactionType) {
        // A. Toggle OFF (Remove reaction)
        await Reaction.findByIdAndDelete(existingReaction._id);

        // Atomic Decrement
        updatedAchiever = await Achiever.findByIdAndUpdate(
          id,
          { $inc: { [`reactions.${reactionType}`]: -1 } },
          { new: true },
        );
        message = "Reaction removed";
        userReaction = null;
      } else {
        // B. Switch Reaction (e.g., from r1 to r2)
        const oldType = existingReaction.type;

        // Update existing reaction doc
        existingReaction.type = reactionType;
        await existingReaction.save();

        // Atomic Switch: Dec old, Inc new
        updatedAchiever = await Achiever.findByIdAndUpdate(
          id,
          {
            $inc: {
              [`reactions.${oldType}`]: -1,
              [`reactions.${reactionType}`]: 1,
            },
          },
          { new: true },
        );
        message = "Reaction updated";
        userReaction = reactionType;
      }
    } else {
      // C. New Reaction
      try {
        await Reaction.create({
          user: userId,
          achiever: id,
          type: reactionType,
        });

        // Atomic Increment
        updatedAchiever = await Achiever.findByIdAndUpdate(
          id,
          { $inc: { [`reactions.${reactionType}`]: 1 } },
          { new: true },
        );
        message = "Reaction added";
        userReaction = reactionType;
      } catch (err) {
        // Handle duplicate key error (race condition double-click)
        if (err.code === 11000) {
          return res
            .status(409)
            .json({ message: "You have already reacted to this post." });
        }
        throw err;
      }
    }

    if (!updatedAchiever) {
      return res.status(404).json({ message: "Achiever not found" });
    }

    res.json({
      message,
      reactions: updatedAchiever.reactions,
      userReaction,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
// GET REACTIONS Details
exports.getAchieverReactions = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, page = 1, limit = 20 } = req.query;

    const query = { achiever: id };
    if (type) {
      query.type = type;
    }

    const count = await Reaction.countDocuments(query);
    const reactions = await Reaction.find(query)
      .populate("user", "name email rollNo department collegeName imageUrl") // Populate necessary user fields
      .sort("-createdAt")
      .limit(limit * 1)
      .skip((page - 1) * limit);

    res.json({
      success: true,
      data: reactions,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      totalItems: count,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
