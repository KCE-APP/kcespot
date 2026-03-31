const mongoose = require("mongoose");

const submissionSchema = new mongoose.Schema(
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
    submissionLink: { type: String },
    fileUrl: { type: String },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Add indices for common queries
submissionSchema.index({ studentId: 1 });
submissionSchema.index({ assignmentId: 1 });
submissionSchema.index({ studentId: 1, assignmentId: 1 }, { unique: true });

module.exports = mongoose.model("Submission", submissionSchema);
