const mongoose = require("mongoose");

const careerReactionSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        career: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Career",
            required: true,
        },
        type: {
            type: String,
            enum: ["r1", "r2", "r3", "r4", "r5"],
            required: true,
        },
    },
    { timestamps: true },
);

// Compound index to ensure one reaction per user per career post
careerReactionSchema.index({ user: 1, career: 1 }, { unique: true });

module.exports = mongoose.model("CareerReaction", careerReactionSchema);
