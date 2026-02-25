const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const router = express.Router();

const {
  register,
  verifyRegistrationOtp,
  resendRegistrationOtp,
  login,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  changePassword,
  refreshToken,
} = require("../controllers/authController");
const { loginStaff, refreshStaffToken } = require("../controllers/staffController");

// Registration Flow
router.post("/register", register);
router.post("/verify-registration-otp", verifyRegistrationOtp);
router.post("/resend-registration-otp", resendRegistrationOtp);

// Login
router.post("/login", login);
router.post("/staff-login", loginStaff);
router.post("/refresh-token", refreshToken);
router.post("/staff-refresh-token", refreshStaffToken);

// Password Reset Flow
router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-otp", verifyResetOtp);
router.post("/reset-password", resetPassword);

// Change Password (Authenticated)
router.post("/change-password", protect, changePassword);

module.exports = router;
