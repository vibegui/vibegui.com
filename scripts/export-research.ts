/**
 * Export Research from SQLite to JSON
 * Outputs to public/research/ (Vite copies to dist automatically)
 *
 * In production (CI), only published research is exported.
 * In development, drafts are included for preview.
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getResearchByStatus } from "../lib/db/research.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "public", "research");

// In CI or production build, don't include drafts
const isProduction =
  process.env.CI === "true" || process.env.NODE_ENV === "production";

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

const published = getResearchByStatus("published");
const drafts = isProduction ? [] : getResearchByStatus("draft");
const allResearch = [...published, ...drafts];

// Manifest with metadata only
const manifest = allResearch.map((r) => ({
  slug: r.slug,
  title: r.title,
  description: r.description,
  date: r.date,
  status: r.status,
  tags: r.tags,
}));

writeFileSync(join(OUTPUT_DIR, "manifest.json"), JSON.stringify(manifest));

// Individual research files with full content
for (const item of allResearch) {
  const minimal: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(item)) {
    if (v !== undefined && v !== null && v !== "") {
      minimal[k] = v;
    }
  }
  writeFileSync(join(OUTPUT_DIR, `${item.slug}.json`), JSON.stringify(minimal));
}

const draftInfo = isProduction
  ? "(production - no drafts)"
  : `${drafts.length} drafts`;
console.log(`🔬 ${published.length} research, ${draftInfo}`);
