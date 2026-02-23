const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

/**
 * Applies a watermark logo to the target image.
 * 
 * @param {string} inputPath - Path to the original image.
 * @param {string} outputPath - Path to save the watermarked image (can be the same as inputPath).
 * @returns {Promise<void>}
 */
exports.applyWatermark = async (inputPath, outputPath = null) => {
  try {
    const logoPath = path.join(__dirname, "..", "assests", "KI_LOGO3.png");
    
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input image not found: ${inputPath}`);
    }
    
    if (!fs.existsSync(logoPath)) {
      console.warn("Watermark logo not found, skipping watermarking.");
      return;
    }

    // Load the input image to get dimensions
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    
    // Resize logo to fit the image (e.g., 15% of the image width)
    const logoWidth = Math.round(metadata.width * 0.15);
    const padding = Math.round(logoWidth * 0.1); // 10% padding
    
    // Create a white background for the logo to ensure visibility on all images
    const logoBuffer = await sharp(logoPath).resize({ width: logoWidth }).toBuffer();
    const logoMetadata = await sharp(logoBuffer).metadata();
    
    const background = await sharp({
      create: {
        width: logoMetadata.width + padding * 2,
        height: logoMetadata.height + padding * 2,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 0.8 } // Semi-transparent white
      }
    })
    .composite([{ input: logoBuffer, gravity: "center" }])
    .png()
    .toBuffer();

    // Composite the logo with background onto the image
    const watermarkedImage = await image
      .composite([
        {
          input: background,
          gravity: "southwest", // Bottom-left corner
          blend: "over",
          top: metadata.height - (logoMetadata.height + padding * 3), // Add some margin from edges
          left: padding,
        },
      ])
      .toBuffer();

    // Save the watermarked image
    await sharp(watermarkedImage).toFile(outputPath || inputPath);
    
    console.log(`Watermark applied to: ${outputPath || inputPath}`);
  } catch (error) {
    console.error("Error applying watermark:", error);
    // We don't want to throw here to avoid breaking the main flow if watermarking fails
  }
};
