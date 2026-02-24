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
    const logoPath = path.join(__dirname, "..", "assests", "KI_LOGO3.png");

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
      const circleSize = Math.round(targetWidth * 0.18); // Circle diameter
      const logoSize = Math.round(circleSize * 0.7); // Logo width inside circle

      // 1. Create the logo buffer
      const logoBuffer = await sharp(logoPath)
        .resize({ width: logoSize })
        .toBuffer();

      // 2. Create the white circle background
      const circleBackground = Buffer.from(
        `<svg width="${circleSize}" height="${circleSize}">
          <circle cx="${circleSize / 2}" cy="${circleSize / 2}" r="${circleSize / 2}" fill="white" />
        </svg>`
      );

      // 3. Composite logo onto the circle
      const finalWatermark = await sharp(circleBackground)
        .composite([{ input: logoBuffer, gravity: "center" }])
        .png()
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

