const Staff = require("../models/Staff");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const ExcelJS = require("exceljs");

// @desc    Add Staff member
// @route   POST /api/staff
exports.createStaff = async (req, res) => {
  try {
    const { name, email, password, role, collegeName, department } = req.body;

    const existing = await Staff.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "Staff already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const staff = await Staff.create({
      name,
      email,
      password: hashedPassword,
      role,
      collegeName,
      department,
    });

    res.status(201).json({ success: true, data: staff });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all staff (Admin Only)
// @route   GET /api/staff
exports.getAllStaff = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      role,
      collegeName,
      department,
      status,
    } = req.query;

    const query = { _id: { $ne: req.user.id }, isDeleted: { $ne: true } };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    if (role) query.role = role;
    if (collegeName) query.collegeName = collegeName;
    if (department) query.department = department;
    if (status !== undefined) query.status = status === "true";

    const count = await Staff.countDocuments(query);
    const staffList = await Staff.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    res.json({
      data: staffList,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      totalItems: count,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Staff Login
// @route   POST /api/auth/staff-login
exports.loginStaff = async (req, res) => {
  try {
    const { email, password } = req.body;
    const staff = await Staff.findOne({ email });

    if (!staff || !(await bcrypt.compare(password, staff.password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const accessToken = jwt.sign(
      { id: staff._id, role: staff.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );

    const refreshToken = jwt.sign(
      { id: staff._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" },
    );

    staff.refreshToken = refreshToken;
    await staff.save();

    res.json({
      success: true,
      token: accessToken,
      refreshToken: refreshToken,
      staff: {
        id: staff._id,
        name: staff.name,
        role: staff.role,
        collegeName: staff.collegeName,
        email: staff.email,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update Staff member (Admin Only)
// @route   PATCH /api/staff/:id
exports.updateStaff = async (req, res) => {
  try {
    const { password, ...updateData } = req.body;

    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const staff = await Staff.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true },
    ).select("-password");

    if (!staff) {
      return res
        .status(404)
        .json({ success: false, message: "Staff not found" });
    }

    res.json({ success: true, data: staff });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete Staff member (Admin Only)
// @route   DELETE /api/staff/:id
exports.deleteStaff = async (req, res) => {
  try {
    const staff = await Staff.findByIdAndUpdate(
      req.params.id,
      { isDeleted: true },
      { new: true },
    );
    if (!staff) {
      return res
        .status(404)
        .json({ success: false, message: "Staff not found" });
    }
    res.json({ success: true, message: "Staff member deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Export Staff to Excel
// @route   GET /api/staff/export
exports.exportStaffToExcel = async (req, res) => {
  try {
    const staffMembers = await Staff.find({ isDeleted: { $ne: true } }).select(
      "-password",
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Staff Members");

    worksheet.columns = [
      { header: "Name", key: "name", width: 20 },
      { header: "Email", key: "email", width: 30 },
      { header: "Role", key: "role", width: 15 },
      { header: "College", key: "collegeName", width: 10 },
      { header: "Department", key: "department", width: 20 },
      { header: "Assigned Category", key: "assignedCategory", width: 25 },
      { header: "Created At", key: "createdAt", width: 20 },
    ];

    staffMembers.forEach((staff) => {
      worksheet.addRow({
        name: staff.name,
        email: staff.email,
        role: staff.role,
        collegeName: staff.collegeName,
        department: staff.department,
        assignedCategory: staff.assignedCategory || "N/A",
        createdAt: staff.createdAt.toLocaleString(),
      });
    });

    worksheet.getRow(1).font = { bold: true };

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=" + "staff_members.xlsx",
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Refresh Staff Token
// @route   POST /api/auth/staff-refresh-token
exports.refreshStaffToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: "Refresh token is required" });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const staff = await Staff.findById(decoded.id);

    if (!staff || staff.refreshToken !== refreshToken) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const accessToken = jwt.sign(
      { id: staff._id, role: staff.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );

    res.json({
      success: true,
      token: accessToken,
    });
  } catch (error) {
    res.status(401).json({ message: "Invalid or expired refresh token" });
  }
};
