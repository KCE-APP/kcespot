const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sendEmail = require("../service/emailService");
const crypto = require("crypto");

// Helper to generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// REGISTER (Step 1: Create User & Send OTP)
exports.register = async (req, res) => {
  try {
    const {
      name,
      fullName,
      collegeName,
      email,
      password,
      role,
      rollNo,
      department,
    } = req.body;

    const userName = name || fullName;

    // 1. Check for missing fields
    if (
      !userName ||
      !collegeName ||
      !email ||
      !password ||
      !rollNo ||
      !department
    ) {
      return res.status(400).json({
        status: "failed",
        statusCode: 400,
        message:
          "All fields (name, collegeName, email, password, rollNo, department) are required",
      });
    }

    // 2. Validate Email Format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        status: "failed",
        statusCode: 400,
        message: "Invalid email format",
      });
    }

    // 3. Validate Password Strength (Min 6 chars)
    if (password.length < 6) {
      return res.status(400).json({
        status: "failed",
        statusCode: 400,
        message: "Password must be at least 6 characters long",
      });
    }

    let user = await User.findOne({ email });

    // 4. Check if user already exists and is verified
    if (user && user.isVerified) {
      return res.status(409).json({
        status: "failed",
        statusCode: 409,
        message: "User already registered with this email",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOTP();
    const otpExpires = Date.now() + 15 * 60 * 1000; // 15 mins

    if (user) {
      // Update existing unverified user
      user.name = userName;
      user.rollNo = rollNo;
      user.collegeName = collegeName;
      user.password = hashedPassword;
      user.role = role || "user";
      user.department = department;
      user.otp = otp;
      user.otpExpires = otpExpires;
      await user.save();
    } else {
      // Create new user
      user = await User.create({
        name: userName,
        rollNo,
        collegeName,
        email,
        password: hashedPassword,
        role: role || "user",
        department,
        otp,
        otpExpires,
        isVerified: false,
      });
    }

    // Send Email
    const subject = "Verify Your Account - KCE Spot";
    const text = `Your OTP for verification is ${otp}. It expires in 15 minutes.`;
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #004d99;">Verify Your Account</h2>
        <p>Hi ${userName},</p>
        <p>Your OTP for verification is:</p>
        <h1 style="background: #f4f4f4; padding: 10px; display: inline-block; border-radius: 5px;">${otp}</h1>
        <p>This OTP expires in 15 minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
      </div>
    `;

    await sendEmail(email, subject, text, html);

    res.status(200).json({
      status: "success",
      statusCode: 200,
      message: "OTP sent to your email successfully",
    });
  } catch (err) {
    console.error("Register Error:", err);
    res.status(500).json({
      status: "failed",
      statusCode: 500,
      message: "Internal Server Error. Please try again later.",
      error: err.message,
    });
  }
};

// VERIFY REGISTRATION OTP (Step 2: Verify & Activate)
exports.verifyRegistrationOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        status: "failed",
        statusCode: 400,
        message: "Email and OTP are required",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        status: "failed",
        statusCode: 404,
        message: "User not found",
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        status: "failed",
        statusCode: 400,
        message: "User already verified",
      });
    }

    if (user.otp !== otp) {
      return res.status(400).json({
        status: "failed",
        statusCode: 400,
        message: "Invalid OTP",
      });
    }

    if (Date.now() > user.otpExpires) {
      return res.status(400).json({
        status: "failed",
        statusCode: 400,
        message: "OTP has expired. Please request a new one.",
      });
    }

    // Verify User
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    res.status(200).json({
      status: "success",
      statusCode: 200,
      message: "Account verified successfully. You can now login.",
    });
  } catch (err) {
    console.error("Verify Reg OTP Error:", err);
    res.status(500).json({
      status: "failed",
      statusCode: 500,
      message: "Internal Server Error",
      error: err.message,
    });
  }
};

// RESEND REGISTRATION OTP
exports.resendRegistrationOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        status: "failed",
        statusCode: 400,
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        status: "failed",
        statusCode: 404,
        message: "User not found",
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        status: "failed",
        statusCode: 400,
        message: "User already verified",
      });
    }

    const otp = generateOTP();
    user.otp = otp;
    user.otpExpires = Date.now() + 15 * 60 * 1000;
    await user.save();

    const subject = "Resend OTP - Verify Your Account";
    const text = `Your new OTP for verification is ${otp}.`;
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #004d99;">Resend OTP</h2>
        <p>Hi ${user.name},</p>
        <p>Your new OTP for verification is:</p>
        <h1 style="background: #f4f4f4; padding: 10px; display: inline-block; border-radius: 5px;">${otp}</h1>
        <p>This OTP expires in 15 minutes.</p>
      </div>
    `;

    await sendEmail(email, subject, text, html);

    res.status(200).json({
      status: "success",
      statusCode: 200,
      message: "OTP resent successfully",
    });
  } catch (err) {
    res.status(500).json({
      status: "failed",
      statusCode: 500,
      message: "Internal Server Error",
      error: err.message,
    });
  }
};

// LOGIN
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Check for missing email or password
    if (!email || !password) {
      return res.status(400).json({
        status: "failed",
        statusCode: 400,
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    // 2. User not found
    if (!user) {
      return res.status(404).json({
        status: "failed",
        statusCode: 404,
        message: "User not found with this email",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    // 3. Invalid Password
    if (!isMatch) {
      return res.status(401).json({
        status: "failed",
        statusCode: 401,
        message: "Invalid password",
      });
    }

    // 4. Check if user is verified
    if (!user.isVerified) {
      return res.status(401).json({
        status: "failed",
        statusCode: 401,
        message: "Please verify your email address to login",
      });
    }

    const accessToken = jwt.sign(
      { id: user._id, role: user.role, college: user.collegeName },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_ACCESS_EXPIRY || "1hr" },
    );

    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRY || "30d" },
    );

    user.refreshToken = refreshToken;
    await user.save();

    // Save Push Token if provided during login
    const { pushToken, fcmToken } = req.body;
    const tokenToSave = pushToken || fcmToken;

    if (tokenToSave && !user.pushTokens.includes(tokenToSave)) {
      user.pushTokens.push(tokenToSave);
      await user.save();
      console.log(`[Login] Saved new push token for user ${user.email}`);
    }

    res.json({
      status: "success",
      statusCode: 200,
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        college: user.collegeName,
      },
      token: accessToken,
      refreshToken: refreshToken,
    });
  } catch (err) {
    res.status(500).json({
      status: "failed",
      statusCode: 500,
      message: "Internal Server Error",
      error: err.message,
    });
  }
};

// FORGOT PASSWORD (Step 1: Send OTP)
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        status: "failed",
        statusCode: 404,
        message: "User not found",
      });
    }

    const otp = generateOTP();
    user.resetPasswordOtp = otp;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;
    await user.save();

    const subject = "Password Reset OTP - KCE Spot";
    const text = `Your OTP for password reset is ${otp}.`;
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #004d99;">Password Reset</h2>
        <p>Hi ${user.name},</p>
        <p>Your OTP for password reset is:</p>
        <h1 style="background: #f4f4f4; padding: 10px; display: inline-block; border-radius: 5px;">${otp}</h1>
        <p>This OTP expires in 15 minutes.</p>
        <p>If you did not request a password reset, please ignore this email.</p>
      </div>
    `;

    await sendEmail(email, subject, text, html);

    res.status(200).json({
      status: "success",
      statusCode: 200,
      message: "Password reset OTP sent",
    });
  } catch (err) {
    res.status(500).json({
      status: "failed",
      statusCode: 500,
      message: err.message,
    });
  }
};

// VERIFY RESET OTP (Step 2: Check code only)
exports.verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({
      email,
      resetPasswordOtp: otp,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        status: "failed",
        statusCode: 400,
        message: "Invalid or expired OTP",
      });
    }

    res.status(200).json({
      status: "success",
      statusCode: 200,
      message: "OTP verified successfully",
    });
  } catch (err) {
    res.status(500).json({
      status: "failed",
      statusCode: 500,
      message: err.message,
    });
  }
};

// RESET PASSWORD (Step 3: New Password)
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({
      email,
      resetPasswordOtp: otp,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        status: "failed",
        statusCode: 400,
        message: "Invalid or expired OTP",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetPasswordOtp = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({
      status: "success",
      statusCode: 200,
      message: "Password reset successfully",
    });
  } catch (err) {
    res.status(500).json({
      status: "failed",
      statusCode: 500,
      message: err.message,
    });
  }
};

// CHANGE PASSWORD (Authenticated)
exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id; // From protect middleware

    // 1. Check for missing fields
    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        status: "failed",
        statusCode: 400,
        message: "Old password and new password are required",
      });
    }

    // 2. Validate New Password Strength
    if (newPassword.length < 6) {
      return res.status(400).json({
        status: "failed",
        statusCode: 400,
        message: "New password must be at least 6 characters long",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        status: "failed",
        statusCode: 404,
        message: "User not found",
      });
    }

    // 3. Verify Old Password
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({
        status: "failed",
        statusCode: 401,
        message: "Incorrect old password",
      });
    }

    // 4. Check if new password is the same as old password
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({
        status: "failed",
        statusCode: 400,
        message: "New password cannot be the same as the old password",
      });
    }

    // 5. Hash and Update Password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({
      status: "success",
      statusCode: 200,
      message: "Password changed successfully",
    });
  } catch (err) {
    res.status(500).json({
      status: "failed",
      statusCode: 500,
      message: "Internal Server Error",
      error: err.message,
    });
  }
};

// REFRESH TOKEN
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: "Refresh token is required" });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    // Token Rotation: Generate NEW access and NEW refresh tokens
    const newAccessToken = jwt.sign(
      { id: user._id, role: user.role, college: user.collegeName },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_ACCESS_EXPIRY || "1hr" },
    );

    const newRefreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRY || "30d" },
    );

    // Save the new refresh token to database
    user.refreshToken = newRefreshToken;
    await user.save();

    res.json({
      status: "success",
      token: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    res.status(401).json({ message: "Invalid or expired refresh token" });
  }
};

// LOGOUT
exports.logout = async (req, res) => {
  try {
    const userId = req.user.id; // From protect middleware

    const user = await User.findById(userId);
    if (user) {
      user.refreshToken = undefined;
      await user.save();
    }

    res.status(200).json({
      status: "success",
      message: "Logged out successfully",
    });
  } catch (err) {
    res.status(500).json({
      status: "failed",
      message: "Error during logout",
      error: err.message,
    });
  }
};
