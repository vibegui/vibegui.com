#!/usr/bin/env bun
/**
 * Import Articles to Supabase
 *
 * Reads all markdown articles from blog/articles/ and upserts them into
 * the Supabase articles table with tag management.
 *
 * Usage:
 *   bun run scripts/import-articles.ts --dry-run   # Preview without DB changes
 *   bun run scripts/import-articles.ts              # Live import
 *
 * Idempotent: Uses upsert on slug, safe to re-run.
 */

import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { readAllArticles, type Article } from "../lib/articles.ts";

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

// -- Main Import Logic --

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

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const dryRun = process.argv.includes("--dry-run");

  if (dryRun) {
    console.log("=== DRY RUN MODE (no database changes) ===\n");
  } else {
    console.log("=== LIVE IMPORT MODE ===\n");
  }

  // Read all articles from markdown files
  const articles = readAllArticles("blog/articles");
  console.log(`Found ${articles.length} articles\n`);

  let success = 0;
  let skipped = 0;
  const errors: { slug: string; error: string }[] = [];

  for (const article of articles) {
    try {
      if (dryRun) {
        const tagCount = article.tags.length;
        console.log(
          `Would upsert: ${article.slug} — "${article.title}" (${tagCount} tags)`,
        );
        success++;
        continue;
      }

      // Map article fields to DB columns
      const row = {
        slug: article.slug,
        title: article.title,
        description: article.description,
        content: article.content,
        status: article.status,
        date: article.date,
        cover_image: article.coverImage,
        created_by: "import-script",
        updated_by: "import-script",
      };

      // Upsert article (match by slug)
      const { data, error } = await supabaseAdmin
        .from("articles")
        .upsert(row, { onConflict: "slug" })
        .select("id, slug")
        .single();

      if (error) {
        throw new Error(`Upsert failed: ${error.message}`);
      }

      const articleId = data.id;

      // Manage tags: delete existing, then re-insert
      const { error: deleteError } = await supabaseAdmin
        .from("article_tags")
        .delete()
        .eq("article_id", articleId);

      if (deleteError) {
        throw new Error(`Tag delete failed: ${deleteError.message}`);
      }

      if (article.tags.length > 0) {
        // Upsert tags into tags table
        const tagRows = article.tags.map((name) => ({ name }));
        const { error: tagUpsertError } = await supabaseAdmin
          .from("tags")
          .upsert(tagRows, { onConflict: "name" });

        if (tagUpsertError) {
          throw new Error(`Tag upsert failed: ${tagUpsertError.message}`);
        }

        // Fetch tag IDs
        const { data: tagData, error: tagFetchError } = await supabaseAdmin
          .from("tags")
          .select("id, name")
          .in("name", article.tags);

        if (tagFetchError) {
          throw new Error(`Tag fetch failed: ${tagFetchError.message}`);
        }

        // Insert junction rows
        const junctionRows = (tagData || []).map((tag) => ({
          article_id: articleId,
          tag_id: tag.id,
        }));

        if (junctionRows.length > 0) {
          const { error: junctionError } = await supabaseAdmin
            .from("article_tags")
            .insert(junctionRows);

          if (junctionError) {
            throw new Error(`Junction insert failed: ${junctionError.message}`);
          }
        }
      }

      console.log(`Imported: ${article.slug} (${article.tags.length} tags)`);
      success++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`SKIPPED: ${article.slug} — ${message}`);
      errors.push({ slug: article.slug, error: message });
      skipped++;
    }
  }

  // Print summary
  console.log(`\n--- Summary ---`);
  console.log(
    `${success} ${dryRun ? "would be imported" : "imported"}, ${skipped} skipped`,
  );

  if (errors.length > 0) {
    console.log("\nErrors:");
    for (const e of errors) {
      console.log(`  ${e.slug}: ${e.error}`);
    }
  }

  // Verify count (live mode only)
  if (!dryRun) {
    const { count, error: countError } = await supabaseAdmin
      .from("articles")
      .select("*", { count: "exact", head: true });

    if (countError) {
      console.error(`\nVerification failed: ${countError.message}`);
    } else {
      console.log(`\nVerification: ${count} articles in database`);
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
