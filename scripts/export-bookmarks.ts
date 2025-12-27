/**
 * Export Bookmarks from SQLite to JSON
 * Outputs to public/bookmarks/data.json (Vite copies to dist automatically)
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getAllBookmarks } from "../lib/db/index.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "public", "bookmarks");
const OUTPUT_PATH = join(OUTPUT_DIR, "data.json");

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

const bookmarks = getAllBookmarks();

// Strip undefined/null fields for smaller JSON
const minimal = bookmarks.map((b) => {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(b)) {
    if (v !== undefined && v !== null && v !== "") {
      obj[k] = v;
    }
  }
  return obj;
});

writeFileSync(OUTPUT_PATH, JSON.stringify(minimal));

const enriched = bookmarks.filter((b) => b.classified_at).length;
console.log(`📦 ${bookmarks.length} bookmarks (${enriched} enriched)`);
