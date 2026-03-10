const express = require("express");
const router = express.Router();
const { protect, adminOnly, staffOnly } = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");
const {
    createCareer,
    getCareers,
    getCareersforAdmin,
    getCareerById,
    updateCareer,
    deleteCareer,
    updateReaction,
    getCareerReactions,
} = require("../controllers/careerController");

router.post(
    "/create-career",
    protect,
    adminOnly,
    staffOnly,
    upload.single("careerImage"),
    createCareer,
);
router.get("/get-career", protect, getCareers);
router.get("/get-career/:id", protect, getCareerById);
router.get("/get-career/admin", protect, adminOnly, staffOnly, getCareersforAdmin);
router.get("/:id", protect, getCareerById);
router.put(
    "/update-career/:id",
    protect,
    adminOnly,
    staffOnly,
    upload.single("careerImage"),
    updateCareer,
);
router.delete("/delete-career/:id", protect, adminOnly, staffOnly, deleteCareer);

// Reaction Routes
router.patch("/reaction/:id", protect, updateReaction); // Match achiever pattern (PATCH)
router.get("/:id/reactions", protect, getCareerReactions); // Match achiever pattern (/ID/reactions)
router.get("/reactions/:id", protect, getCareerReactions); // Support user's app call (/reactions/ID)

module.exports = router;
