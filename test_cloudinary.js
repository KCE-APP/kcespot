require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { optimizeImage } = require("./service/imageService");

async function testUpload() {
  try {
    console.log("Starting Cloudinary upload test...");
    
    // Check if .env has placeholders or real keys
    if (process.env.CLOUDINARY_CLOUD_NAME === "your_cloud_name") {
      console.warn("WARNING: You are using placeholder values in .env. Please update them with real Cloudinary credentials.");
      return;
    }

    const testImagePath = path.join(__dirname, "assests", "ki_logo.png");
    
    if (!fs.existsSync(testImagePath)) {
      console.error(`Test image not found at ${testImagePath}`);
      return;
    }

    const buffer = fs.readFileSync(testImagePath);
    const resultUrl = await optimizeImage(buffer, "ki_logo.png");

    console.log("Success! Image uploaded to Cloudinary.");
    console.log(`URL: ${resultUrl}`);
  } catch (error) {
    console.error("Test failed:", error);
  }
}

testUpload();
