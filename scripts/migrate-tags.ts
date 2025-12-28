#!/usr/bin/env bun
/**
 * Migrate tags from SQLite to Supabase
 * Run after migrate-to-supabase.ts
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load environment
const envPath = join(__dirname, "..", ".env");
const envContent = readFileSync(envPath, "utf-8");
const env: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

interface SQLiteBookmark {
  id: number;
  url: string;
}

interface SQLiteTag {
  bookmark_id: number;
  tag: string;
}

async function main() {
  console.log("🏷️  Migrating tags...\n");

  // Read SQLite exports
  const bookmarks: SQLiteBookmark[] = JSON.parse(
    readFileSync(
      join(__dirname, "..", "temp", "bookmarks_export.json"),
      "utf-8",
    ),
  );
  const tags: SQLiteTag[] = JSON.parse(
    readFileSync(join(__dirname, "..", "temp", "tags_export.json"), "utf-8"),
  );

  // Build old ID -> URL mapping from SQLite
  const oldIdToUrl = new Map<number, string>();
  for (const b of bookmarks) {
    oldIdToUrl.set(b.id, b.url);
  }

  // Get all bookmarks from Supabase to build URL -> new ID mapping
  const { data: supabaseBookmarks, error } = await supabase
    .from("bookmarks")
    .select("id, url");

  if (error) throw error;

  const urlToNewId = new Map<string, number>();
  for (const b of supabaseBookmarks || []) {
    urlToNewId.set(b.url, b.id);
  }

  console.log(`📚 SQLite bookmarks: ${bookmarks.length}`);
  console.log(`📚 Supabase bookmarks: ${supabaseBookmarks?.length || 0}`);
  console.log(`🏷️  Tags to migrate: ${tags.length}\n`);

  // Insert tags
  let success = 0;
  let skipped = 0;
  let errors = 0;

  for (const t of tags) {
    const url = oldIdToUrl.get(t.bookmark_id);
    if (!url) {
      skipped++;
      continue;
    }

    const newId = urlToNewId.get(url);
    if (!newId) {
      skipped++;
      continue;
    }

    const { error } = await supabase.from("bookmark_tags").insert({
      bookmark_id: newId,
      tag: t.tag,
    });

    if (error) {
      if (error.code === "23505") {
        // Duplicate - already exists
        skipped++;
      } else {
        errors++;
        console.error(`❌ ${t.tag}: ${error.message}`);
      }
    } else {
      success++;
    }
  }

  // Get final count
  const { count } = await supabase
    .from("bookmark_tags")
    .select("*", { count: "exact", head: true });

  console.log("\n" + "=".repeat(40));
  console.log(`✅ Tags inserted: ${success}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`❌ Errors: ${errors}`);
  console.log(`📊 Total tags in Supabase: ${count}`);
}

main().catch(console.error);
