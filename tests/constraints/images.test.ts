/**
 * Image Constraint Tests
 *
 * Verifies CONSTRAINTS.md Section 1.2: Image Optimization
 * - Maximum file size per image: 250KB
 * - All images should be optimized
 */

import { describe, test, expect } from "bun:test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { readAllArticles } from "../../lib/articles-reader";

const PUBLIC_DIR = join(import.meta.dir, "../../public");
const CONTENT_DIR = join(import.meta.dir, "../../content");
const DIST_DIR = join(import.meta.dir, "../../dist");
const ARTICLES_DIR = join(import.meta.dir, "../../blog/articles");
const OG_MANIFEST_PATH = join(PUBLIC_DIR, "images/og/manifest.json");

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

interface OgManifest {
  version: number;
  width: number;
  height: number;
  images: Record<string, string>;
}

function pngDimensions(path: string): { width: number; height: number } {
  const png = readFileSync(path);
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
  };
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

  test("every published article has a generated 1200x630 OG image", () => {
    const ogManifest = JSON.parse(
      readFileSync(OG_MANIFEST_PATH, "utf-8"),
    ) as OgManifest;
    const articles = readAllArticles(ARTICLES_DIR, true).filter(
      (article) => article.status === "published",
    );

    expect(ogManifest.version).toBe(1);
    expect(ogManifest.width).toBe(1200);
    expect(ogManifest.height).toBe(630);
    expect(Object.keys(ogManifest.images)).toHaveLength(articles.length);

    for (const article of articles) {
      const imagePath =
        ogManifest.images[`${article.locale}:${article.slug}`] ?? "";
      expect(imagePath).toMatch(
        /^\/images\/og\/(?:pt|en)\/[a-z0-9-]+\.[a-f0-9]{8}\.png$/,
      );

      const publicPath = join(PUBLIC_DIR, imagePath);
      const distPath = join(DIST_DIR, imagePath);
      expect(existsSync(publicPath)).toBe(true);
      expect(existsSync(distPath)).toBe(true);
      expect(pngDimensions(publicPath)).toEqual({
        width: 1200,
        height: 630,
      });
      expect(statSync(publicPath).size).toBeLessThan(MAX_IMAGE_SIZE);
    }
  });

  test("PT and EN translations use distinct OG paths", () => {
    const ogManifest = JSON.parse(
      readFileSync(OG_MANIFEST_PATH, "utf-8"),
    ) as OgManifest;
    const articles = readAllArticles(ARTICLES_DIR, true).filter(
      (article) => article.status === "published",
    );

    for (const article of articles.filter(
      (candidate) => candidate.locale === "pt-BR",
    )) {
      const translation = articles.find(
        (candidate) =>
          candidate.locale === "en" &&
          candidate.translationKey === article.translationKey,
      );
      if (!translation) continue;

      expect(ogManifest.images[`pt-BR:${article.slug}`]).not.toBe(
        ogManifest.images[`en:${translation.slug}`],
      );
    }
  });
});
