const Career = require("../models/Career");
const CareerReaction = require("../models/CareerReaction");
const { optimizeImage } = require("../service/imageService");




exports.createCareer = async (req, res) => {
    try {
        const entryData = { ...req.body };

        if (req.file) {
            entryData.imageUrl = await optimizeImage(req.file.buffer, req.file.originalname);
        }

        const career = new Career(entryData);
        const savedcareer = await career.save();

        res.status(201).json({
            message: "Career created successfully",
            career: savedcareer
        })
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getCareers = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = "", campus = "" } = req.query;

        const query = { isDeleted: false };

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: "i" } },
                { campus: { $regex: search, $options: "i" } },
            ];
        }

        const count = await Career.countDocuments(query);
        let careers = await Career.find(query)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .lean();

        // Enrich with user reaction
        if (req.user && req.user.id) {
            const careerIds = careers.map((c) => c._id);
            const userReactions = await CareerReaction.find({
                user: req.user.id,
                career: { $in: careerIds },
            });

            const reactionMap = {};
            userReactions.forEach((r) => {
                reactionMap[r.career.toString()] = r.type;
            });

            careers = careers.map((career) => {
                const reactions = career.reactions || {};
                const totalReactions =
                    (reactions.r1 || 0) +
                    (reactions.r2 || 0) +
                    (reactions.r3 || 0) +
                    (reactions.r4 || 0) +
                    (reactions.r5 || 0);

                return {
                    ...career,
                    userReaction: reactionMap[career._id.toString()] || null,
                    totalReactions,
                };
            });
        } else {
            careers = careers.map((career) => {
                const reactions = career.reactions || {};
                const totalReactions =
                    (reactions.r1 || 0) +
                    (reactions.r2 || 0) +
                    (reactions.r3 || 0) +
                    (reactions.r4 || 0) +
                    (reactions.r5 || 0);

                return {
                    ...career,
                    userReaction: null,
                    totalReactions,
                };
            });
        }

        res.json({
            data: careers,
            totalPages: Math.ceil(count / limit),
            currentPage: Number(page),
            totalItems: count,
            status: "success",
            statusCode: 200,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


exports.getCareersforAdmin = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = "", campus = "" } = req.query;

        const query = { isDeleted: false };

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: "i" } },
                { campus: { $regex: search, $options: "i" } },
            ];
        }

        const count = await Career.countDocuments(query);
        let careers = await Career.find(query)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .lean();

        // Enrich with user reaction
        if (req.user && req.user.id) {
            const careerIds = careers.map((c) => c._id);
            const userReactions = await CareerReaction.find({
                user: req.user.id,
                career: { $in: careerIds },
            });

            const reactionMap = {};
            userReactions.forEach((r) => {
                reactionMap[r.career.toString()] = r.type;
            });

            careers = careers.map((career) => {
                const reactions = career.reactions || {};
                const totalReactions =
                    (reactions.r1 || 0) +
                    (reactions.r2 || 0) +
                    (reactions.r3 || 0) +
                    (reactions.r4 || 0) +
                    (reactions.r5 || 0);

                return {
                    ...career,
                    userReaction: reactionMap[career._id.toString()] || null,
                    totalReactions,
                };
            });
        } else {
            careers = careers.map((career) => {
                const reactions = career.reactions || {};
                const totalReactions =
                    (reactions.r1 || 0) +
                    (reactions.r2 || 0) +
                    (reactions.r3 || 0) +
                    (reactions.r4 || 0) +
                    (reactions.r5 || 0);

                return {
                    ...career,
                    userReaction: null,
                    totalReactions,
                };
            });
        }

        res.json({
            data: careers,
            totalPages: Math.ceil(count / limit),
            currentPage: Number(page),
            totalItems: count,
            status: "success",
            statusCode: 200,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// GET single career by ID
exports.getCareerById = async (req, res) => {
    try {
        const { id } = req.params;
        const career = await Career.findOne({ _id: id, isDeleted: false }).lean();

        if (!career) {
            return res.status(404).json({ message: "Career not found" });
        }

        const reactions = career.reactions || {};
        const totalReactions =
            (reactions.r1 || 0) +
            (reactions.r2 || 0) +
            (reactions.r3 || 0) +
            (reactions.r4 || 0) +
            (reactions.r5 || 0);

        let userReaction = null;
        if (req.user && req.user.id) {
            const reaction = await CareerReaction.findOne({
                user: req.user.id,
                career: id,
            });
            userReaction = reaction ? reaction.type : null;
        }

        res.json({
            ...career,
            totalReactions,
            userReaction,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


exports.updateCareer = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = { ...req.body };

        if (req.file) {
            updateData.imageUrl = await optimizeImage(req.file.buffer, req.file.originalname);
        }

        const updated = await Career.findByIdAndUpdate(id, updateData, { new: true });
        res.json({
            data: updated,
            status: "success",
            statusCode: 200
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

exports.deleteCareer = async (req, res) => {
    try {
        const { id } = req.params;
        await Career.findByIdAndUpdate(id, { isDeleted: true });
        res.json({ message: "Career deleted successfully (Soft)", status: "success", statusCode: 200 });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}




// UPDATE REACTION
exports.updateReaction = async (req, res) => {
    try {
        const { id } = req.params; // Career ID
        const { reactionType } = req.body; // "r1", "r2", "r3", "r4", "r5"
        const userId = req.user.id; // From authMiddleware

        const validReactions = ["r1", "r2", "r3", "r4", "r5"];
        if (!validReactions.includes(reactionType)) {
            return res.status(400).json({ message: "Invalid reaction type" });
        }

        // 1. Check if user already reacted
        const existingReaction = await CareerReaction.findOne({
            user: userId,
            career: id,
        });
        let updatedCareer;
        let message = "";
        let userReaction = null;

        if (existingReaction) {
            if (existingReaction.type === reactionType) {
                // A. Toggle OFF (Remove reaction)
                await CareerReaction.findByIdAndDelete(existingReaction._id);

                // Atomic Decrement
                updatedCareer = await Career.findByIdAndUpdate(
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
                updatedCareer = await Career.findByIdAndUpdate(
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
                await CareerReaction.create({
                    user: userId,
                    career: id,
                    type: reactionType,
                });

                // Atomic Increment
                updatedCareer = await Career.findByIdAndUpdate(
                    id,
                    { $inc: { [`reactions.${reactionType}`]: 1 } },
                    { new: true },
                );
                message = "Reaction added";
                userReaction = reactionType;
            } catch (err) {
                if (err.code === 11000) {
                    return res
                        .status(409)
                        .json({ message: "You have already reacted to this post." });
                }
                throw err;
            }
        }

        if (!updatedCareer) {
            return res.status(404).json({ message: "Career not found" });
        }

        res.json({
            message,
            reactions: updatedCareer.reactions,
            userReaction,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

// GET REACTIONS Details
exports.getCareerReactions = async (req, res) => {
    try {
        const { id } = req.params;
        const { type, page = 1, limit = 20 } = req.query;

        // Fetch the career post to get total counts for each reaction type
        const career = await Career.findById(id).select("reactions").lean();
        if (!career) {
            return res.status(404).json({ success: false, message: "Career post not found" });
        }

        const query = { career: id };
        if (type) {
            query.type = type;
        }

        const count = await CareerReaction.countDocuments(query);
        const reactions = await CareerReaction.find(query)
            .populate("user", "name email rollNo department collegeName imageUrl")
            .sort("-createdAt")
            .limit(limit * 1)
            .skip((page - 1) * limit);

        res.json({
            success: true,
            data: reactions,
            reactions: career.reactions, // Include the counts for each emoji type for UI tabs
            totalPages: Math.ceil(count / limit),
            currentPage: Number(page),
            totalItems: count,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


