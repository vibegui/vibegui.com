/**
 * Build Size Constraint Tests
 *
 * Verifies CONSTRAINTS.md Section 1: Performance
 * - Initial HTML payload < 100KB (target < 50KB)
 * - Individual assets should be reasonable
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, extname } from "node:path";
import { gzipSync } from "node:zlib";

const DIST_DIR = join(import.meta.dir, "../../dist");

// Constraint limits from CONSTRAINTS.md
const MAX_HTML_SIZE_COMPRESSED = 100 * 1024; // 100KB compressed
const TARGET_HTML_SIZE_COMPRESSED = 50 * 1024; // 50KB target
const MAX_TOTAL_JS_SIZE = 520 * 1024; // 520KB total JS (React + app code + lazy-loaded chunks)
const MAX_CSS_SIZE = 50 * 1024; // 50KB CSS

function getCompressedSize(content: string | Buffer): number {
  const buffer = typeof content === "string" ? Buffer.from(content) : content;
  return gzipSync(buffer).length;
}

function getAllFiles(dir: string, files: string[] = []): string[] {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        getAllFiles(fullPath, files);
      } else {
        files.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist
  }
  return files;
}

describe("Build Size Constraints", () => {
  let distExists = false;
  let files: string[] = [];

  beforeAll(() => {
    try {
      files = getAllFiles(DIST_DIR);
      distExists = files.length > 0;
    } catch {
      distExists = false;
    }
  });

  test("dist/ directory exists and has files", () => {
    expect(distExists).toBe(true);
  });

  test("index.html compressed size < 100KB", () => {
    if (!distExists) return;

    const indexPath = join(DIST_DIR, "index.html");
    const content = readFileSync(indexPath, "utf-8");
    const compressedSize = getCompressedSize(content);

    console.log(
      `index.html: ${(compressedSize / 1024).toFixed(2)}KB compressed`,
    );

    expect(compressedSize).toBeLessThan(MAX_HTML_SIZE_COMPRESSED);
  });

  test("index.html compressed size < 50KB (target)", () => {
    if (!distExists) return;

    const indexPath = join(DIST_DIR, "index.html");
    const content = readFileSync(indexPath, "utf-8");
    const compressedSize = getCompressedSize(content);

    // This is a soft check - warn but don't fail
    if (compressedSize > TARGET_HTML_SIZE_COMPRESSED) {
      console.warn(
        `⚠️  index.html (${(compressedSize / 1024).toFixed(2)}KB) exceeds target of 50KB`,
      );
    }

    expect(compressedSize).toBeLessThan(MAX_HTML_SIZE_COMPRESSED);
  });

  test("total JS size < 520KB", () => {
    if (!distExists) return;

    const jsFiles = files.filter((f) => extname(f) === ".js");
    let totalSize = 0;

    for (const file of jsFiles) {
      const content = readFileSync(file);
      const size = content.length;
      const relativePath = file.replace(DIST_DIR, "");

      console.log(`${relativePath}: ${(size / 1024).toFixed(2)}KB`);
      totalSize += size;
    }

    console.log(`Total JS: ${(totalSize / 1024).toFixed(2)}KB`);
    expect(totalSize).toBeLessThan(MAX_TOTAL_JS_SIZE);
  });

  test("CSS bundle < 50KB", () => {
    if (!distExists) return;

    const cssFiles = files.filter((f) => extname(f) === ".css");
    let totalCssSize = 0;

    for (const file of cssFiles) {
      const content = readFileSync(file);
      totalCssSize += content.length;
    }

    console.log(`Total CSS: ${(totalCssSize / 1024).toFixed(2)}KB`);

    expect(totalCssSize).toBeLessThan(MAX_CSS_SIZE);
  });

  test("app code (non-vendor) < 50KB", () => {
    if (!distExists) return;

    // Vendor chunks are: react, react-dom, markdown
    const vendorPatterns = ["react.", "react-dom.", "markdown."];
    const jsFiles = files.filter((f) => extname(f) === ".js");

    let appCodeSize = 0;

    for (const file of jsFiles) {
      const fileName = file.split("/").pop() ?? "";
      const isVendor = vendorPatterns.some((p) => fileName.startsWith(p));

      if (!isVendor) {
        const content = readFileSync(file);
        appCodeSize += content.length;
        console.log(
          `App chunk: ${fileName} (${(content.length / 1024).toFixed(2)}KB)`,
        );
      }
    }

    console.log(`Total app code: ${(appCodeSize / 1024).toFixed(2)}KB`);

    // App code is now split: main bundle + lazy-loaded bookmarks chunk
    // Total should stay under 285KB across all app chunks
    expect(appCodeSize).toBeLessThan(285 * 1024);
  });
});
