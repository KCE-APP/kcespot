const mongoose = require("mongoose");

const assignmentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    instructions: { type: String },
    department: { type: String, required: true },
    batch: { type: String, required: true },
    type: {
      type: String,
      enum: ["assignment", "certification"],
      required: true,
    },
    resourceLink: { type: String },
    certificateLink: { type: String },
    submissionType: {
      type: String,
      enum: ["link", "file", "none"],
      default: "none",
    },
    submissionRequired: { type: Boolean, default: false },
    certificateRequired: { type: Boolean, default: false },
    dueDate: { type: Date },
    status: {
      type: String,
      enum: ["active", "expired", "archived"],
      default: "active",
    },
    assignedStudents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
    },
  },
  { timestamps: true }
);

// Add index for performance in student queries
assignmentSchema.index({ assignedStudents: 1 });
assignmentSchema.index({ department: 1, batch: 1 });

module.exports = mongoose.model("Assignment", assignmentSchema);
