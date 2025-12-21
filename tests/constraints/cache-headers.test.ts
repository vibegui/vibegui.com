/**
 * Cache Headers Constraint Tests
 *
 * Verifies CONSTRAINTS.md Section 1.3 & 1.4: Asset Caching Strategy
 * - Content-hash based asset naming
 * - Proper _headers file configuration
 */

import { describe, test, expect } from "bun:test";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, extname, basename } from "node:path";

const DIST_DIR = join(import.meta.dir, "../../dist");
const PUBLIC_DIR = join(import.meta.dir, "../../public");

// Pattern for content-hash filenames: name.[hash].ext
const HASH_PATTERN = /^.+\.[a-zA-Z0-9]{8,}\.(js|css|woff2?)$/;

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

describe("Cache Strategy Constraints", () => {
  test("_headers file exists in public/", () => {
    const headersPath = join(PUBLIC_DIR, "_headers");
    expect(existsSync(headersPath)).toBe(true);
  });

  test("_headers has correct cache rules", () => {
    const headersPath = join(PUBLIC_DIR, "_headers");
    const content = readFileSync(headersPath, "utf-8");

    // Check for immutable caching on assets
    expect(content).toContain("/assets/*");
    expect(content).toContain("immutable");

    // Check for short cache on index.html
    expect(content).toContain("stale-while-revalidate");
  });

  test("JS/CSS assets use content-hash naming", () => {
    const files = getAllFiles(DIST_DIR);
    const assetFiles = files.filter((f) => {
      const ext = extname(f);
      return [".js", ".css"].includes(ext) && f.includes("/assets/");
    });

    for (const file of assetFiles) {
      const filename = basename(file);

      // Skip source maps
      if (filename.endsWith(".map")) continue;

      console.log(`Checking hash pattern: ${filename}`);
      expect(HASH_PATTERN.test(filename)).toBe(true);
    }
  });
});
