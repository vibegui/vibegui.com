/**
 * Image Optimization Script
 *
 * Compresses and optimizes images in public/images/ to meet the 250KB constraint.
 * Uses sharp for high-quality compression + pngquant for lossy PNG compression.
 *
 * Usage:
 *   bun run optimize:images              # Optimize all images over 250KB
 *   bun run optimize:images --all        # Optimize all images regardless of size
 *   bun run optimize:images <file>       # Optimize specific file
 */

import sharp from "sharp";
import {
  readdirSync,
  statSync,
  mkdirSync,
  existsSync,
  unlinkSync,
} from "node:fs";
import { join, extname, basename } from "node:path";
import { $ } from "bun";

const IMAGES_DIR = "./public/images";
const MAX_SIZE_KB = 250; // Must match tests/constraints/images.test.ts
const MAX_DIMENSION = 1200; // Max width for cover images
const PNG_QUALITY = "50-70"; // pngquant quality range

interface OptimizeResult {
  file: string;
  originalSize: number;
  newSize: number;
  saved: number;
}

async function hasPngquant(): Promise<boolean> {
  try {
    await $`which pngquant`.quiet();
    return true;
  } catch {
    return false;
  }
}

async function optimizeWithPngquant(filePath: string): Promise<boolean> {
  try {
    const tempFile = `/tmp/${basename(filePath)}-pngquant.png`;
    await $`pngquant --quality=${PNG_QUALITY} --force --output ${tempFile} ${filePath}`.quiet();

    // Check if result is smaller
    const originalSize = statSync(filePath).size;
    const newSize = statSync(tempFile).size;

    if (newSize < originalSize) {
      await Bun.write(filePath, Bun.file(tempFile));
      unlinkSync(tempFile);
      return true;
    }

    unlinkSync(tempFile);
    return false;
  } catch {
    return false;
  }
}

async function optimizeImage(
  filePath: string,
  force = false,
): Promise<OptimizeResult | null> {
  const ext = extname(filePath).toLowerCase();
  const originalStats = statSync(filePath);
  const originalSize = originalStats.size;

  // Skip if already under limit (unless forced)
  if (!force && originalSize < MAX_SIZE_KB * 1024) {
    console.log(
      `✓ ${basename(filePath)} already under ${MAX_SIZE_KB}KB (${(originalSize / 1024).toFixed(1)}KB)`,
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
  let resized = false;
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    pipeline = pipeline.resize(MAX_DIMENSION, MAX_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    });
    resized = true;
    console.log(`  Resizing from ${width}x${height} to max ${MAX_DIMENSION}px`);
  }

  // Apply format-specific optimization
  if (ext === ".png") {
    // First pass: resize with sharp
    if (resized) {
      const buffer = await pipeline.png({ compressionLevel: 9 }).toBuffer();
      await Bun.write(filePath, buffer);
    }

    // Second pass: lossy compression with pngquant (if available)
    if (await hasPngquant()) {
      console.log("  Applying pngquant lossy compression...");
      await optimizeWithPngquant(filePath);
    } else {
      console.log(
        "  ⚠️  pngquant not found. Install with: brew install pngquant",
      );
      // Fallback: more aggressive sharp compression
      const buffer = await sharp(filePath)
        .png({ quality: 60, compressionLevel: 9, palette: true })
        .toBuffer();
      await Bun.write(filePath, buffer);
    }
  } else if (ext === ".jpg" || ext === ".jpeg") {
    // Progressive JPEG with mozjpeg for best compression
    let quality = 80;
    let buffer = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();

    // If still too large, reduce quality progressively
    while (buffer.length > MAX_SIZE_KB * 1024 && quality > 40) {
      quality -= 10;
      console.log(`  Reducing quality to ${quality}...`);
      buffer = await sharp(filePath)
        .resize(MAX_DIMENSION, MAX_DIMENSION, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
    }

    await Bun.write(filePath, buffer);
  } else if (ext === ".webp") {
    let quality = 80;
    let buffer = await pipeline.webp({ quality }).toBuffer();

    while (buffer.length > MAX_SIZE_KB * 1024 && quality > 40) {
      quality -= 10;
      buffer = await sharp(filePath)
        .resize(MAX_DIMENSION, MAX_DIMENSION, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality })
        .toBuffer();
    }

    await Bun.write(filePath, buffer);
  } else {
    console.log(`  Skipping unsupported format: ${ext}`);
    return null;
  }

  const newStats = statSync(filePath);
  const newSize = newStats.size;
  const saved = originalSize - newSize;

  if (newSize > MAX_SIZE_KB * 1024) {
    console.log(
      `  ⚠️  Still over limit: ${(newSize / 1024).toFixed(1)}KB > ${MAX_SIZE_KB}KB`,
    );
    console.log(
      `     Try: pngquant or manual resize smaller than ${MAX_DIMENSION}px`,
    );
  } else {
    console.log(
      `  ✓ Compressed: ${(originalSize / 1024).toFixed(1)}KB → ${(newSize / 1024).toFixed(1)}KB (saved ${(saved / 1024).toFixed(1)}KB)`,
    );
  }

  return {
    file: basename(filePath),
    originalSize,
    newSize,
    saved,
  };
}

async function main() {
  console.log("🖼️  Image Optimization Script\n");
  console.log(
    `   Max size: ${MAX_SIZE_KB}KB | Max dimension: ${MAX_DIMENSION}px\n`,
  );

  const args = process.argv.slice(2);
  const forceAll = args.includes("--all");
  const specificFile = args.find((a) => !a.startsWith("--"));

  // Check for pngquant
  if (await hasPngquant()) {
    console.log("✓ pngquant available for lossy PNG compression\n");
  } else {
    console.log("⚠️  pngquant not found. Install with: brew install pngquant\n");
  }

  // Handle specific file
  if (specificFile) {
    const filePath = specificFile.startsWith("/")
      ? specificFile
      : join(IMAGES_DIR, specificFile);

    if (!existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }

    await optimizeImage(filePath, true);
    return;
  }

  // Handle all images in directory
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
    const result = await optimizeImage(join(IMAGES_DIR, file), forceAll);
    if (result) {
      results.push(result);
    }
  }

  // Summary
  const stillOverLimit = results.filter((r) => r.newSize > MAX_SIZE_KB * 1024);

  if (results.length > 0) {
    const totalSaved = results.reduce((sum, r) => sum + r.saved, 0);
    console.log(
      `\n✅ Processed ${results.length} image(s), saved ${(totalSaved / 1024).toFixed(1)}KB total`,
    );

    if (stillOverLimit.length > 0) {
      console.log(
        `\n⚠️  ${stillOverLimit.length} image(s) still over ${MAX_SIZE_KB}KB:`,
      );
      for (const r of stillOverLimit) {
        console.log(`   - ${r.file}: ${(r.newSize / 1024).toFixed(1)}KB`);
      }
    }
  } else {
    console.log("\n✅ All images already optimized!");
  }
}

main().catch(console.error);
