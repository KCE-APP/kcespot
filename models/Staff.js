const mongoose = require("mongoose");
const { ACHIEVEMENT_CATEGORIES } = require("../config/constants");

const staffSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["admin", "instructor"],
      default: "instructor",
    },
    collegeName: { type: String, enum: ["KCE", "KIT", "KAHE"], required: true },
    department: { type: String, required: true },
    assignedCategory: { type: String, enum: ACHIEVEMENT_CATEGORIES }, // For filtering submissions
    isDeleted: { type: Boolean, default: false },
    refreshToken: { type: String },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Staff", staffSchema);
