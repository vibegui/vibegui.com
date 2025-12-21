/**
 * Image Optimization Script
 *
 * Compresses and optimizes images in public/images/ to meet the 100KB constraint.
 * Uses sharp for high-quality compression.
 *
 * Usage:
 *   bun run optimize:images
 */

import sharp from "sharp";
import { readdirSync, statSync, mkdirSync, existsSync } from "node:fs";
import { join, extname, basename } from "node:path";

const IMAGES_DIR = "./public/images";
const MAX_SIZE_KB = 100;
const MAX_DIMENSION = 800; // Max width/height for profile images

interface OptimizeResult {
  file: string;
  originalSize: number;
  newSize: number;
  saved: number;
}

async function optimizeImage(filePath: string): Promise<OptimizeResult | null> {
  const ext = extname(filePath).toLowerCase();
  const originalStats = statSync(filePath);
  const originalSize = originalStats.size;

  // Skip if already under limit
  if (originalSize < MAX_SIZE_KB * 1024) {
    console.log(
      `✓ ${basename(filePath)} already optimized (${(originalSize / 1024).toFixed(1)}KB)`,
    );
    return null;
  }

  console.log(
    `Optimizing ${basename(filePath)} (${(originalSize / 1024).toFixed(1)}KB)...`,
  );

  let pipeline = sharp(filePath);

  // Get metadata to check dimensions
  const metadata = await pipeline.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  // Resize if larger than max dimension
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    pipeline = pipeline.resize(MAX_DIMENSION, MAX_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    });
    console.log(`  Resizing from ${width}x${height} to max ${MAX_DIMENSION}px`);
  }

  // Apply format-specific optimization
  if (ext === ".png") {
    pipeline = pipeline.png({ quality: 80, compressionLevel: 9 });
  } else if (ext === ".jpg" || ext === ".jpeg") {
    pipeline = pipeline.jpeg({ quality: 80, mozjpeg: true });
  } else if (ext === ".webp") {
    pipeline = pipeline.webp({ quality: 80 });
  } else {
    console.log(`  Skipping unsupported format: ${ext}`);
    return null;
  }

  // Write back to same file
  const buffer = await pipeline.toBuffer();
  await Bun.write(filePath, buffer);

  const newStats = statSync(filePath);
  const newSize = newStats.size;
  const saved = originalSize - newSize;

  console.log(
    `  ✓ Compressed: ${(originalSize / 1024).toFixed(1)}KB → ${(newSize / 1024).toFixed(1)}KB (saved ${(saved / 1024).toFixed(1)}KB)`,
  );

  return {
    file: basename(filePath),
    originalSize,
    newSize,
    saved,
  };
}

async function main() {
  console.log("🖼️  Image Optimization Script\n");

  if (!existsSync(IMAGES_DIR)) {
    console.log(`Creating ${IMAGES_DIR}...`);
    mkdirSync(IMAGES_DIR, { recursive: true });
  }

  const files = readdirSync(IMAGES_DIR);
  const imageFiles = files.filter((f) => {
    const ext = extname(f).toLowerCase();
    return [".png", ".jpg", ".jpeg", ".webp"].includes(ext);
  });

  if (imageFiles.length === 0) {
    console.log("No images found to optimize.");
    return;
  }

  console.log(`Found ${imageFiles.length} image(s) to check.\n`);

  const results: OptimizeResult[] = [];

  for (const file of imageFiles) {
    const result = await optimizeImage(join(IMAGES_DIR, file));
    if (result) {
      results.push(result);
    }
  }

  if (results.length > 0) {
    const totalSaved = results.reduce((sum, r) => sum + r.saved, 0);
    console.log(
      `\n✅ Optimized ${results.length} image(s), saved ${(totalSaved / 1024).toFixed(1)}KB total`,
    );
  } else {
    console.log("\n✅ All images already optimized!");
  }
}

main().catch(console.error);
