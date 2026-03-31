const mongoose = require("mongoose");

const certificateSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assignment",
      required: true,
    },
    certificateUrl: { type: String, required: true },
    issuedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Add index for common queries
certificateSchema.index({ studentId: 1 });
certificateSchema.index({ assignmentId: 1 });

module.exports = mongoose.model("Certificate", certificateSchema);
