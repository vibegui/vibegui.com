#!/usr/bin/env bun
/**
 * Migrate bookmarks from SQLite to Supabase
 *
 * Uses Supabase JS client which handles escaping properly.
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_KEY in .env
 * Get these from: Supabase Dashboard → Project Settings → API
 *
 * Usage: bun run scripts/migrate-to-supabase.ts
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load environment from .env
const envPath = join(__dirname, "..", ".env");
const envContent = readFileSync(envPath, "utf-8");
const env: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ SUPABASE_URL and SUPABASE_SERVICE_KEY required in .env");
  console.error(
    "   Get these from: Supabase Dashboard → Project Settings → API",
  );
  console.error("   SUPABASE_URL = Project URL");
  console.error("   SUPABASE_SERVICE_KEY = service_role key (NOT anon key)");
  process.exit(1);
}

console.log(`🔌 Using Supabase: ${SUPABASE_URL}`);

// Create Supabase client with service key (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface SQLiteBookmark {
  id: number;
  url: string;
  title: string | null;
  description: string | null;
  research_raw: string | null;
  exa_content: string | null;
  researched_at: string | null;
  stars: number | null;
  reading_time_min: number | null;
  language: string | null;
  icon: string | null;
  insight_dev: string | null;
  insight_founder: string | null;
  insight_investor: string | null;
  classified_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

interface SQLiteTag {
  id: number;
  bookmark_id: number;
  tag: string;
}

async function main() {
  console.log("\n🚀 Starting SQLite → Supabase migration...\n");

  // Read exported JSON files
  const bookmarksPath = join(__dirname, "..", "temp", "bookmarks_export.json");
  const tagsPath = join(__dirname, "..", "temp", "tags_export.json");

  const bookmarks: SQLiteBookmark[] = JSON.parse(
    readFileSync(bookmarksPath, "utf-8"),
  );
  const tags: SQLiteTag[] = JSON.parse(readFileSync(tagsPath, "utf-8"));

  console.log(`📚 Found ${bookmarks.length} bookmarks`);
  console.log(`🏷️  Found ${tags.length} tags\n`);

  // Create a map of old bookmark IDs to new IDs
  const idMap = new Map<number, number>();

  // Insert bookmarks
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < bookmarks.length; i++) {
    const b = bookmarks[i];
    const progress = `[${String(i + 1).padStart(3)}/${bookmarks.length}]`;

    try {
      const { data, error } = await supabase
        .from("bookmarks")
        .insert({
          url: b.url,
          title: b.title,
          description: b.description,
          perplexity_research: b.research_raw,
          firecrawl_content: b.exa_content,
          researched_at: b.researched_at,
          stars: b.stars,
          reading_time_min: b.reading_time_min,
          language: b.language,
          icon: b.icon,
          insight_dev: b.insight_dev,
          insight_founder: b.insight_founder,
          insight_investor: b.insight_investor,
          classified_at: b.classified_at,
          published_at: b.published_at,
          created_at: b.created_at,
          updated_at: b.updated_at,
        })
        .select("id")
        .single();

      if (error) {
        if (error.code === "23505") {
          // Duplicate key - skip
          console.log(
            `${progress} ⏭️  Skipped (duplicate): ${b.url.slice(0, 40)}...`,
          );
        } else {
          throw error;
        }
      } else if (data) {
        idMap.set(b.id, data.id);
        successCount++;
        console.log(
          `${progress} ✅ ${b.title?.slice(0, 50) || b.url.slice(0, 50)}...`,
        );
      }
    } catch (error) {
      errorCount++;
      const msg = error instanceof Error ? error.message : String(error);
      console.error(
        `${progress} ❌ ${b.url.slice(0, 40)}: ${msg.slice(0, 50)}`,
      );
    }
  }

  console.log(
    `\n📊 Bookmarks: ${successCount} inserted, ${errorCount} errors\n`,
  );

  // Now insert tags
  console.log("🏷️  Inserting tags...\n");
  let tagSuccess = 0;
  let tagSkipped = 0;

  for (const t of tags) {
    const newBookmarkId = idMap.get(t.bookmark_id);
    if (!newBookmarkId) {
      tagSkipped++;
      continue;
    }

    try {
      const { error } = await supabase.from("bookmark_tags").insert({
        bookmark_id: newBookmarkId,
        tag: t.tag,
      });

      if (error && error.code !== "23505") {
        throw error;
      }
      tagSuccess++;
    } catch {
      // Silently skip tag errors
    }
  }

  console.log(`🏷️  Tags: ${tagSuccess} inserted, ${tagSkipped} skipped\n`);

  // Verify final counts
  const { count: bookmarkCount } = await supabase
    .from("bookmarks")
    .select("*", { count: "exact", head: true });
  const { count: tagCount } = await supabase
    .from("bookmark_tags")
    .select("*", { count: "exact", head: true });

  console.log("=".repeat(60));
  console.log("✅ Migration complete!");
  console.log(`   Bookmarks in Supabase: ${bookmarkCount}`);
  console.log(`   Tags in Supabase: ${tagCount}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
