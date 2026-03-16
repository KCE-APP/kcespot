const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

/**
 * Optimizes an image: resizes to max width 1080px, converts to WebP (quality 75),
 * and applies a watermark logo.
 * 
 * @param {Buffer} buffer - The image data buffer.
 * @param {string} originalName - Original filename to extract extension or just for logging.
 * @returns {Promise<string>} - The relative path to the saved WebP image.
 */
exports.optimizeImage = async (buffer, originalName) => {
  try {
    const uploadsDir = path.join(__dirname, "..", "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filename = `img-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.webp`;
    const outputPath = path.join(uploadsDir, filename);
    const logoPath = path.join(__dirname, "..", "assests", "ki_logo.png");

    let pipeline = sharp(buffer);
    const metadata = await pipeline.metadata();

    // Resize: max width 1080px, maintain aspect ratio, without enlargement
    pipeline = pipeline.resize({
      width: 1080,
      withoutEnlargement: true,
      fit: "inside"
    });

    // Handle watermarking if logo exists
    if (fs.existsSync(logoPath)) {
      const targetWidth = Math.min(metadata.width, 1080);
      const logoSize = Math.round(targetWidth * 0.12); // Logo width (Increased to 15%)

      // 1. Create the logo buffer
      const finalWatermark = await sharp(logoPath)
        .resize({ width: logoSize })
        .toBuffer();

      // 4. Composite final badge onto the main image (Bottom-Right)
      pipeline = pipeline.composite([
        {
          input: finalWatermark,
          gravity: "southeast", // Bottom-Right
          blend: "over",
        },
      ]);
    }

    await pipeline
      .webp({ quality: 75 })
      .toFile(outputPath);

    console.log(`Optimized WebP image saved: ${outputPath}`);
    return `uploads/${filename}`;
  } catch (error) {
    console.error("Error optimizing image:", error);
    throw new Error("Failed to process and optimize image.");
  }
};

/**
 * Applies a watermark logo to the target image. (Legacy support)
 * 
 * @param {string} inputPath - Path to the original image.
 * @param {string} outputPath - Path to save the watermarked image (can be the same as inputPath).
 * @returns {Promise<void>}
 */
exports.applyWatermark = async (inputPath, outputPath = null) => {
  try {
    const logoPath = path.join(__dirname, "..", "assests", "ki_logo.png");
    
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
    
    // Resize logo to fit the image (Increased to 15% of the image width)
    const logoWidth = Math.round(metadata.width * 0.12);
    const padding = Math.round(logoWidth * 0.1); // 10% padding
    
    // Create the logo buffer
    const logoBuffer = await sharp(logoPath).resize({ width: logoWidth }).toBuffer();
    const logoMetadata = await sharp(logoBuffer).metadata();

    // Composite the logo onto the image
    const watermarkedImage = await image
      .composite([
        {
          input: logoBuffer,
          gravity: "southwest", // Bottom-left corner
          blend: "over",
          bottom: padding,
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
