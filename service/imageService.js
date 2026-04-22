const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const cloudinary = require("cloudinary").v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Optimizes an image: resizes to max width 1080px, converts to WebP (quality 75),
 * applies a watermark logo, and uploads to Cloudinary.
 * 
 * @param {Buffer} buffer - The image data buffer.
 * @param {string} originalName - Original filename to extract extension or just for logging.
 * @returns {Promise<string>} - The secure URL of the uploaded image on Cloudinary.
 */
exports.optimizeImage = async (buffer, originalName) => {
  try {
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

      const finalWatermark = await sharp(logoPath)
        .resize({ width: logoSize })
        .toBuffer();

      pipeline = pipeline.composite([
        {
          input: finalWatermark,
          gravity: "southeast", // Bottom-Right
          blend: "over",
        },
      ]);
    }

    // Convert to WebP buffer
    const processedBuffer = await pipeline
      .webp({ quality: 75 })
      .toBuffer();

    // Upload to Cloudinary
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "spotlight_uploads",
          public_id: `img-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
          format: "webp"
        },
        (error, result) => {
          if (error) {
            console.error("Cloudinary upload error:", error);
            return reject(new Error("Cloudinary upload failed."));
          }
          console.log(`Image uploaded to Cloudinary: ${result.secure_url}`);
          resolve(result.secure_url);
        }
      );

      uploadStream.end(processedBuffer);
    });

  } catch (error) {
    console.error("Error optimizing and uploading image:", error);
    throw new Error("Failed to process and upload image.");
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
