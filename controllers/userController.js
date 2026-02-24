const User = require("../models/User");

exports.createUser = async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, college } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    // Filter by College
    if (college) {
      query.collegeName = college;
    }

    const count = await User.countDocuments(query);

    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    res.json({
      users,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      totalUsers: count,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const userId = req.params.id;

    // Check if the requester is the user themselves or an admin
    // req.user is set by the protect middleware
    if (req.user.id !== userId && req.user.role !== "admin") {
      return res.status(403).json({
        status: "failed",
        statusCode: 403,
        message: "You are not authorized to update this profile",
      });
    }

    // Prevent updating sensitive fields via this endpoint if needed
    // const { password, role, ...updateData } = req.body;

    // Find and update
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: req.body },
      { new: true, runValidators: true },
    ).select(
      "-password -otp -otpExpires -resetPasswordOtp -resetPasswordExpires",
    );

    if (!updatedUser) {
      return res.status(404).json({
        status: "failed",
        statusCode: 404,
        message: "User not found",
      });
    }

    res.status(200).json({
      status: "success",
      statusCode: 200,
      message: "Profile updated successfully",
      data: updatedUser,
    });
  } catch (err) {
    console.error("Update User Error:", err);
    res.status(500).json({
      status: "failed",
      statusCode: 500,
      message: "Internal Server Error",
      error: err.message,
    });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getUser = async (req, res) => {
  try {
    // Identify user from token (set by protect middleware)
    const userId = req.user.id;
    
    const user = await User.findById(userId).select(
      "-password -otp -otpExpires -resetPasswordOtp -resetPasswordExpires",
    );
    
    if (!user) {
      return res.status(404).json({
        status: "failed",
        statusCode: 404,
        message: "User not found",
      });
    }
    
    return res.status(200).json({
      status: "success",
      statusCode: 200,
      message: "User info found",
      user,
    });
  } catch (error) {
    console.error("Get User Error:", error);
    return res.status(500).json({
      status: "failed",
      statusCode: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
