const jwt = require("jsonwebtoken");

// VERIFY TOKEN
exports.protect = (req, res, next) => {
  let token;

  // Check for token in Authorization header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({
      status: "failed",
      statusCode: 401,
      message: "Not authorized, please login",
    });
  }
  const clientHeader = req.headers["x-app-client"];
  if (clientHeader !== process.env.APP_CLIENT_ID) {
    return res.status(401).json({
      status: "failed",
      statusCode: 401,
      message: "API access restricted to application only",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};

// 🔐 ADMIN ONLY
exports.adminOnly = (req, res, next) => {
  if (req.user.role !== "admin" ) {
    return res.status(403).json({ message: "Admin access only" });
  }
  next();
};

// 🔐 STAFF ONLY (Admin or Instructor)
exports.staffOnly = (req, res, next) => {
  const allowedRoles = ["admin", "instructor"];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: "Staff access only" });
  }
  next();
};

exports.userOnly = (req, res, next) => {
  if (req.user.role !== "user" && req.user.role !== "student") {
    return res.status(403).json({ message: "User access only" });
  }
  next();
};
