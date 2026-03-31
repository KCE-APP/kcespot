const Certificate = require("../models/Certificate");

// 📜 GET MY CERTIFICATES (Student Only)
exports.getMyCertificates = async (req, res) => {
  try {
    const studentId = req.user.id;
    const certificates = await Certificate.find({ studentId })
      .populate("assignmentId", "title description department")
      .sort({ issuedAt: -1 });

    res.json(certificates);
  } catch (err) {
    console.error("Get my certificates error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
