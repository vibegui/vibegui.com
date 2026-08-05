/**
 * Cache Headers Constraint Tests
 *
 * Verifies CONSTRAINTS.md Section 1.3 & 1.4: Asset Caching Strategy
 * - Content-hash based asset naming
 * - Proper _headers file configuration
 * - SPA HTML must never be immutable-cached under /assets/*
 */

import { describe, test, expect } from "bun:test";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, extname, basename } from "node:path";

const DIST_DIR = join(import.meta.dir, "../../dist");
const PUBLIC_DIR = join(import.meta.dir, "../../public");

// Pattern for content-hash filenames: name.[hash].ext
// Hash can contain alphanumeric, hyphen, underscore
const HASH_PATTERN = /^.+\.[a-zA-Z0-9_-]{6,}\.(js|css|woff2?)$/;

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

/** Strip comments so we don't match `/assets/*` mentioned only in prose. */
function headersRules(content: string): string {
  return content
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("#"))
    .join("\n");
}

describe("Cache Strategy Constraints", () => {
  test("_headers file exists in public/", () => {
    const headersPath = join(PUBLIC_DIR, "_headers");
    expect(existsSync(headersPath)).toBe(true);
  });

  test("_headers immutable rules are extension-scoped (not /assets/*)", () => {
    const headersPath = join(PUBLIC_DIR, "_headers");
    const rules = headersRules(readFileSync(headersPath, "utf-8"));

    // Broad /assets/* + immutable is what poisoned vibegui.com: SPA HTML
    // returned for a missing hashed URL got pinned for a year.
    expect(rules).not.toMatch(
      /\/assets\/\*\s*\n\s*Cache-Control:[^\n]*immutable/,
    );

    expect(rules).toContain("/assets/*.js");
    expect(rules).toContain("/assets/*.css");
    expect(rules).toContain("immutable");
    expect(rules).toContain("stale-while-revalidate");
  });

  test("public/assets/404.html exists so Pages returns real 404s under /assets", () => {
    expect(existsSync(join(PUBLIC_DIR, "assets", "404.html"))).toBe(true);
    expect(existsSync(join(DIST_DIR, "assets", "404.html"))).toBe(true);
  });

  test("JS/CSS assets use content-hash naming", () => {
    const files = getAllFiles(DIST_DIR);
    const assetFiles = files.filter((f) => {
      const ext = extname(f);
      const name = basename(f);
      if (name === "404.html") return false;
      return [".js", ".css"].includes(ext) && f.includes("/assets/");
    });

    expect(assetFiles.length).toBeGreaterThan(0);

    for (const file of assetFiles) {
      const filename = basename(file);
      if (filename.endsWith(".map")) continue;
      expect(HASH_PATTERN.test(filename)).toBe(true);
    }
  });
});
