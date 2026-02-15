const express = require("express");
const router = express.Router();
const {
  submitAchievement,
  verifyAchievement,
  redeemReward,
  getMyStats,
  getCatalog,
  addRewardItem,
  upsertPointRule,
  getPointRules,
  deletePointRule,
  updatePointRule,
  getAllBadges,
  getSubmissions,
  getSubmissionDetails,
  getStudentAchievements,
  getCategories,
  updateAchievement,
  deleteAchievement,
  updateRewardItem,
  deleteRewardItem,
  getAllRedemptions,
  updateRedemptionStatus,
  exportSubmissionsToExcel,
  exportPointRulesToExcel,
  exportCatalogToExcel,
  exportRedemptionsToExcel,
} = require("../controllers/rewardController");
const {
  protect,
  adminOnly,
  staffOnly,
  userOnly,
} = require("../middleware/authMiddleware");

const upload = require("../middleware/upload");

// Student Routes
router.post(
  "/submit",
  protect,
  upload.single("evidenceImage"),
  submitAchievement,
);

router.get("/my-stats", protect, getMyStats);
router.get("/catalog", protect, getCatalog);
router.get("/my-submissions", protect, getStudentAchievements);
router.post("/redeem", protect, redeemReward);
router.get("/badges", protect, getAllBadges);
router.get("/categories", protect, getCategories);

router.put(
  "/submission/:id",
  protect,
  upload.single("evidenceImage"),
  updateAchievement,
);
router.delete("/submission/:id", protect, deleteAchievement);

// History Routes (Paginated)
router.get(
  "/history/points",
  protect,
  require("../controllers/rewardController").getPointHistory,
);
router.get(
  "/history/redemptions",
  protect,
  require("../controllers/rewardController").getRedemptionHistory,
);

// Staff/Admin Routes
router.get("/submissions", protect, staffOnly, getSubmissions);
router.patch("/verify/:id", protect, staffOnly, verifyAchievement);
router.get(
  "/submission/:id",
  protect,
  staffOnly,
  getSubmissionDetails,
);

router.post(
  "/catalog",
  protect,
  adminOnly,
  upload.single("image"),
  addRewardItem,
);
router.patch(
  "/catalog/:id",
  protect,
  adminOnly,
  upload.single("image"),
  updateRewardItem,
);
router.delete("/catalog/:id", protect, adminOnly, deleteRewardItem);
router.get(
  "/admin/redemptions",
  protect,
  staffOnly,
  getAllRedemptions,
);
router.patch(
  "/admin/redemptions/:id",
  protect,
  staffOnly,
  updateRedemptionStatus,
);

router.post("/rules", protect, adminOnly, upsertPointRule);
router.get("/rules", getPointRules);
router.delete("/rules/:id", protect, adminOnly, deletePointRule);
router.patch("/rules/:id", protect, adminOnly, updatePointRule);

// Export Routes
router.get(
  "/export/submissions",
  protect,
  staffOnly,
  exportSubmissionsToExcel,
);
router.get("/export/rules", protect, adminOnly, exportPointRulesToExcel);
router.get("/export/catalog", protect, adminOnly, exportCatalogToExcel);
router.get(
  "/export/redemptions",
  protect,
  staffOnly,
  exportRedemptionsToExcel,
);

module.exports = router;
