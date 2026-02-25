const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    collegeName: { type: String, required: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    rollNo: { type: String, required: true },
    batch: { type: String, required: false },
    department: { type: String, required: false },
    // 🔑 ROLE
    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
    },
    pointsBalance: { type: Number, default: 0 },
    lifetimePoints: { type: Number, default: 0 },
    lastPointsResetDate: { type: Date, default: Date.now },
    badges: { type: [String], default: [] },

    status: { type: Boolean, default: true },

    isVerified: { type: Boolean, default: false },
    otp: { type: String },
    otpExpires: { type: Date },
    resetPasswordOtp: { type: String },
    resetPasswordExpires: { type: Date },
    pushTokens: {
      type: [String],
      default: [],
    },
    refreshToken: { type: String },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
