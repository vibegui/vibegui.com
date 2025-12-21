/**
 * Image Constraint Tests
 *
 * Verifies CONSTRAINTS.md Section 1.2: Image Optimization
 * - Maximum file size per image: 250KB
 * - All images should be optimized
 */

import { describe, test, expect } from "bun:test";
import { readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const PUBLIC_DIR = join(import.meta.dir, "../../public");
const CONTENT_DIR = join(import.meta.dir, "../../content");
const DIST_DIR = join(import.meta.dir, "../../dist");

// Constraint from CONSTRAINTS.md
const MAX_IMAGE_SIZE = 250 * 1024; // 250KB

const IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".avif",
  ".svg",
];

function getAllImages(dir: string, images: string[] = []): string[] {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        getAllImages(fullPath, images);
      } else if (IMAGE_EXTENSIONS.includes(extname(entry.name).toLowerCase())) {
        images.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist
  }
  return images;
}

describe("Image Constraints", () => {
  test("all images in public/ < 250KB", () => {
    const images = getAllImages(PUBLIC_DIR);

    for (const imagePath of images) {
      const stats = statSync(imagePath);
      const relativePath = imagePath.replace(PUBLIC_DIR, "public");

      console.log(`${relativePath}: ${(stats.size / 1024).toFixed(2)}KB`);

      expect(stats.size).toBeLessThan(MAX_IMAGE_SIZE);
    }
  });

  test("all images in content/ < 250KB", () => {
    const images = getAllImages(CONTENT_DIR);

    for (const imagePath of images) {
      const stats = statSync(imagePath);
      const relativePath = imagePath.replace(CONTENT_DIR, "content");

      console.log(`${relativePath}: ${(stats.size / 1024).toFixed(2)}KB`);

      expect(stats.size).toBeLessThan(MAX_IMAGE_SIZE);
    }
  });

  test("all images in dist/ < 250KB", () => {
    const images = getAllImages(DIST_DIR);

    for (const imagePath of images) {
      const stats = statSync(imagePath);
      const relativePath = imagePath.replace(DIST_DIR, "dist");

      console.log(`${relativePath}: ${(stats.size / 1024).toFixed(2)}KB`);

      expect(stats.size).toBeLessThan(MAX_IMAGE_SIZE);
    }
  });
});
