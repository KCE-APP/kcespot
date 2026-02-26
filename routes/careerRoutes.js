const express=require("express");
const router=express.Router();
const {protect,adminOnly,staffOnly}=require("../middleware/authMiddleware");
const upload=require("../middleware/upload");
const {createCareer,getCareers,getCareersforAdmin,updateCareer,deleteCareer}=require("../controllers/careerController");

router.post("/create-career",protect,adminOnly,staffOnly,upload.single("careerImage"),createCareer);
router.get("/get-career",protect,getCareers);
router.get("/get-career/admin",protect,adminOnly,staffOnly,getCareersforAdmin);
router.put("/update-career/:id",protect,adminOnly,staffOnly,upload.single("careerImage"),updateCareer);
router.delete("/delete-career/:id",protect,adminOnly,staffOnly,deleteCareer);

module.exports=router;
