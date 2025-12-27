/**
 * Export Content from SQLite to JSON
 * Outputs to public/content/ (Vite copies to dist automatically)
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getArticles, getDrafts } from "../lib/db/content.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "public", "content");

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

const articles = getArticles();
const drafts = getDrafts();
const allContent = [...articles, ...drafts];

// Manifest with metadata only
const manifest = allContent.map((c) => ({
  slug: c.slug,
  title: c.title,
  description: c.description,
  date: c.date,
  status: c.status,
  tags: c.tags,
}));

writeFileSync(join(OUTPUT_DIR, "manifest.json"), JSON.stringify(manifest));

// Individual article files with full content
for (const item of allContent) {
  const minimal: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(item)) {
    if (v !== undefined && v !== null && v !== "") {
      minimal[k] = v;
    }
  }
  writeFileSync(join(OUTPUT_DIR, `${item.slug}.json`), JSON.stringify(minimal));
}

console.log(`📚 ${articles.length} articles, ${drafts.length} drafts`);
