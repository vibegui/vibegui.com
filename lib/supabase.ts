/**
 * Supabase client for bookmarks
 *
 * Production: Uses anon key for read-only access (public via RLS)
 * Development: Can use service key for full access
 *
 * Environment variables:
 * - VITE_SUPABASE_URL: Supabase project URL
 * - VITE_SUPABASE_ANON_KEY: Anon key for public reads
 */

import { createClient } from "@supabase/supabase-js";

// These are loaded at build time via Vite
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://juzhkuutiuqkyuwbcivk.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

if (!SUPABASE_ANON_KEY) {
  console.warn("VITE_SUPABASE_ANON_KEY not set - Supabase client may not work");
}

// Create client - in production this is read-only via RLS
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Types for bookmarks
export interface Bookmark {
  id: number;
  url: string;
  title: string | null;
  description: string | null;
  perplexity_research: string | null;
  firecrawl_content: string | null;
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
  notes: string | null;
  created_at: string;
  updated_at: string;
  tags?: string[];
}

export interface BookmarkTag {
  id: number;
  bookmark_id: number;
  tag: string;
}

/**
 * Fetch all bookmarks with their tags
 */
export async function getAllBookmarks(): Promise<Bookmark[]> {
  const { data: bookmarks, error: bookmarksError } = await supabase
    .from("bookmarks")
    .select("*")
    .order("id", { ascending: true });

  if (bookmarksError) throw bookmarksError;
  if (!bookmarks) return [];

  // Fetch all tags
  const { data: tags, error: tagsError } = await supabase
    .from("bookmark_tags")
    .select("*");

  if (tagsError) throw tagsError;

  // Group tags by bookmark_id
  const tagsByBookmark = new Map<number, string[]>();
  for (const tag of tags || []) {
    const existing = tagsByBookmark.get(tag.bookmark_id) || [];
    existing.push(tag.tag);
    tagsByBookmark.set(tag.bookmark_id, existing);
  }

  // Attach tags to bookmarks
  return bookmarks.map((b) => ({
    ...b,
    tags: tagsByBookmark.get(b.id) || [],
  }));
}

/**
 * Fetch a single bookmark by URL
 */
export async function getBookmarkByUrl(url: string): Promise<Bookmark | null> {
  const { data, error } = await supabase
    .from("bookmarks")
    .select("*")
    .eq("url", url)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    throw error;
  }

  // Fetch tags
  const { data: tags } = await supabase
    .from("bookmark_tags")
    .select("tag")
    .eq("bookmark_id", data.id);

  return {
    ...data,
    tags: tags?.map((t) => t.tag) || [],
  };
}

/**
 * Get bookmark stats
 */
export async function getBookmarkStats() {
  const { count: total } = await supabase
    .from("bookmarks")
    .select("*", { count: "exact", head: true });

  const { count: enriched } = await supabase
    .from("bookmarks")
    .select("*", { count: "exact", head: true })
    .not("classified_at", "is", null);

  const { data: tagCounts } = await supabase
    .from("bookmark_tags")
    .select("tag")
    .limit(1000);

  // Count tags manually
  const tagCountMap = new Map<string, number>();
  for (const t of tagCounts || []) {
    tagCountMap.set(t.tag, (tagCountMap.get(t.tag) || 0) + 1);
  }

  const tagCountsArray = Array.from(tagCountMap.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);

  return {
    total: total || 0,
    enriched: enriched || 0,
    pending: (total || 0) - (enriched || 0),
    tagCounts: tagCountsArray,
  };
}
