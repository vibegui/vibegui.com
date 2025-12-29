/**
 * Export Content from SQLite to JSON
 * Outputs to public/content/ (Vite copies to dist automatically)
 *
 * All articles are exported with their status field (draft/published).
 * In production, drafts are filtered out. In development, all are included.
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getAllContent, getAllProjects } from "../lib/db/content.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "public", "content");

// In CI or production build, don't include drafts
const isProduction =
  process.env.CI === "true" || process.env.NODE_ENV === "production";

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

const allArticles = getAllContent();
const projects = getAllProjects();

// Filter drafts in production
const articles = isProduction
  ? allArticles.filter((c) => c.status === "published")
  : allArticles;

// Manifest with metadata only
const manifest = {
  articles: articles.map((c) => ({
    slug: c.slug,
    title: c.title,
    description: c.description,
    date: c.date,
    status: c.status,
    tags: c.tags,
  })),
  projects: projects,
};

writeFileSync(join(OUTPUT_DIR, "manifest.json"), JSON.stringify(manifest));

// Individual article files with full content
for (const item of articles) {
  const minimal: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(item)) {
    if (v !== undefined && v !== null && v !== "") {
      minimal[k] = v;
    }
  }
  writeFileSync(join(OUTPUT_DIR, `${item.slug}.json`), JSON.stringify(minimal));
}

const draftCount = allArticles.filter((c) => c.status === "draft").length;
const publishedCount = allArticles.filter(
  (c) => c.status === "published",
).length;
const exportInfo = isProduction
  ? `${publishedCount} published (${draftCount} drafts hidden)`
  : `${publishedCount} published + ${draftCount} drafts`;
console.log(`📚 ${exportInfo}, ${projects.length} projects`);
