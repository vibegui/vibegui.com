#!/usr/bin/env bun
/**
 * Sync Articles from Supabase to Markdown
 *
 * Exports all published articles from Supabase to blog/articles/*.md
 * with SHA-256 hash-based diffing to skip unchanged files.
 *
 * Usage:
 *   bun run scripts/sync-articles.ts --dry-run   # Preview without file writes
 *   bun run scripts/sync-articles.ts              # Live sync
 *
 * Idempotent: Hash-based diffing ensures no unnecessary writes.
 */

import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  mkdirSync,
} from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { stringifyArticle, type ArticleFrontmatter } from "../lib/articles.ts";

// -- Environment Setup --

async function loadEnv() {
  try {
    const envFile = await readFile(".env", "utf-8");
    for (const line of envFile.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [key, ...valueParts] = trimmed.split("=");
      const value = valueParts.join("=").replace(/^["']|["']$/g, "");
      if (key && value && !process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env file not found, rely on environment variables
  }
}

// -- Slugify --

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// -- Hash Helpers --

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

// -- Main Sync Logic --

async function main() {
  await loadEnv();

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error(
      "ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env",
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const dryRun = process.argv.includes("--dry-run");
  const articlesDir = "blog/articles";

  if (dryRun) {
    console.log("=== DRY RUN MODE (no file writes) ===\n");
  } else {
    console.log("=== LIVE SYNC MODE ===\n");
  }

  // Fetch all published articles with tags
  const { data: rows, error } = await supabase
    .from("articles")
    .select(
      "slug, title, description, content, status, date, cover_image, article_tags(tags(name))",
    )
    .eq("status", "published");

  if (error) {
    console.error(`ERROR: Failed to fetch articles: ${error.message}`);
    process.exit(1);
  }

  console.log(`Fetched ${rows.length} published articles from Supabase\n`);

  // Ensure output directory exists
  mkdirSync(articlesDir, { recursive: true });

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let errorCount = 0;
  const errors: { slug: string; error: string }[] = [];
  const dbSlugs = new Set<string>();

  for (const row of rows) {
    let slug = "";
    try {
      // Transform row to article
      slug = row.slug || slugify(row.title);
      dbSlugs.add(slug);

      const tags = (row.article_tags ?? [])
        .map((at: { tags: { name: string } }) => at.tags.name)
        .sort();

      const frontmatter: ArticleFrontmatter = {
        slug,
        title: row.title,
        description: row.description,
        date: row.date,
        status: row.status as "published" | "draft",
        coverImage: row.cover_image,
        tags: tags.length > 0 ? tags : null,
      };

      const content = (row.content ?? "").trim();
      const markdown = stringifyArticle(frontmatter, content);
      const newHash = sha256(markdown);

      const filePath = join(articlesDir, `${slug}.md`);
      const fileExists = existsSync(filePath);

      if (fileExists) {
        const existingContent = readFileSync(filePath, "utf-8");
        const existingHash = sha256(existingContent);

        if (newHash === existingHash) {
          if (dryRun) {
            console.log(`SKIP: ${slug}.md (unchanged)`);
          }
          unchanged++;
          continue;
        }

        // Content changed
        if (dryRun) {
          console.log(`WRITE: ${slug}.md (content changed)`);
        } else {
          writeFileSync(filePath, markdown, "utf-8");
          console.log(`Updated: ${slug}.md`);
        }
        updated++;
      } else {
        // New file
        if (dryRun) {
          console.log(`WRITE: ${slug}.md (new file)`);
        } else {
          writeFileSync(filePath, markdown, "utf-8");
          console.log(`Created: ${slug}.md`);
        }
        created++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`ERROR: ${slug || "unknown"} — ${message}`);
      errors.push({ slug: slug || "unknown", error: message });
      errorCount++;
    }
  }

  // Orphan detection
  let orphanCount = 0;
  if (existsSync(articlesDir)) {
    const localFiles = readdirSync(articlesDir).filter((f) =>
      f.endsWith(".md"),
    );
    for (const file of localFiles) {
      const localSlug = file.replace(/\.md$/, "");
      if (!dbSlugs.has(localSlug)) {
        console.log(`ORPHAN: ${file} (exists locally but not in database)`);
        orphanCount++;
      }
    }
  }

  // Summary line
  const total = rows.length;
  const prefix = dryRun ? "Dry run" : "Synced";
  const parts: string[] = [];

  if (created > 0) parts.push(`${created} created`);
  if (updated > 0) parts.push(`${updated} updated`);
  parts.push(`${unchanged} unchanged`);
  if (orphanCount > 0) parts.push(`${orphanCount} orphaned`);
  if (errorCount > 0) parts.push(`${errorCount} errors`);

  console.log(`\n${prefix} ${total} articles: ${parts.join(", ")}`);

  if (errors.length > 0) {
    console.log("\nErrors:");
    for (const e of errors) {
      console.log(`  ${e.slug}: ${e.error}`);
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
