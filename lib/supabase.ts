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

// Types for bookmarks - minimal version for list view
export interface BookmarkLight {
  id: number;
  url: string;
  title: string | null;
  description: string | null;
  icon: string | null;
  stars: number | null;
  classified_at: string | null;
  published_at: string | null;
  tags?: string[];
}

// Full bookmark with all content (for modal view)
export interface Bookmark extends BookmarkLight {
  researched_at: string | null;
  reading_time_min: number | null;
  language: string | null;
  created_at: string;
  updated_at: string;
  perplexity_research: string | null;
  firecrawl_content: string | null;
  insight_dev: string | null;
  insight_founder: string | null;
  insight_investor: string | null;
  notes: string | null;
}

// Minimal fields for list view - only what's displayed
const LIST_FIELDS =
  "id, url, title, description, icon, stars, classified_at, published_at";

export interface BookmarkTag {
  id: number;
  bookmark_id: number;
  tag: string;
}

/**
 * Fetch all bookmarks with minimal fields only (for list view)
 */
export async function getAllBookmarksLight(): Promise<BookmarkLight[]> {
  // Select only minimal fields needed for list display
  const { data: bookmarks, error: bookmarksError } = await supabase
    .from("bookmarks")
    .select(LIST_FIELDS)
    .order("id", { ascending: true });

  if (bookmarksError) throw bookmarksError;
  if (!bookmarks) return [];

  // Fetch all tags
  const { data: tags, error: tagsError } = await supabase
    .from("bookmark_tags")
    .select("bookmark_id, tag");

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
 * Fetch full bookmark content by URL (for modal view)
 */
export async function getBookmarkContent(url: string): Promise<{
  perplexity_research: string | null;
  firecrawl_content: string | null;
  insight_dev: string | null;
  insight_founder: string | null;
  insight_investor: string | null;
} | null> {
  const { data, error } = await supabase
    .from("bookmarks")
    .select(
      "perplexity_research, firecrawl_content, insight_dev, insight_founder, insight_investor",
    )
    .eq("url", url)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  return data;
}

/**
 * Full-text search across bookmarks (server-side)
 */
export interface SearchResult {
  bookmark: BookmarkLight;
  matches: {
    content: boolean;
    research: boolean;
    insight: boolean;
  };
}

export async function searchBookmarks(query: string): Promise<SearchResult[]> {
  const searchTerm = query.toLowerCase().trim();
  if (!searchTerm) return [];

  // Search across all text fields server-side, return minimal data + match locations
  // We fetch content fields only to determine WHERE the match occurred
  const orFilter = [
    `title.ilike.%${searchTerm}%`,
    `description.ilike.%${searchTerm}%`,
    `url.ilike.%${searchTerm}%`,
    `perplexity_research.ilike.%${searchTerm}%`,
    `firecrawl_content.ilike.%${searchTerm}%`,
    `insight_dev.ilike.%${searchTerm}%`,
    `insight_founder.ilike.%${searchTerm}%`,
    `insight_investor.ilike.%${searchTerm}%`,
  ].join(",");

  const { data: bookmarks, error } = await supabase
    .from("bookmarks")
    .select(
      `${LIST_FIELDS},perplexity_research,firecrawl_content,insight_dev,insight_founder,insight_investor`,
    )
    .or(orFilter)
    .order("id", { ascending: true });

  if (error) throw error;
  if (!bookmarks) return [];

  // Fetch tags for matching bookmarks
  const bookmarkIds = bookmarks.map((b) => b.id);
  const { data: tags } = await supabase
    .from("bookmark_tags")
    .select("bookmark_id, tag")
    .in("bookmark_id", bookmarkIds);

  const tagsByBookmark = new Map<number, string[]>();
  for (const tag of tags || []) {
    const existing = tagsByBookmark.get(tag.bookmark_id) || [];
    existing.push(tag.tag);
    tagsByBookmark.set(tag.bookmark_id, existing);
  }

  // Determine where matches occurred and return light bookmark + match info
  return bookmarks.map((b) => {
    const s = searchTerm;
    return {
      bookmark: {
        id: b.id,
        url: b.url,
        title: b.title,
        description: b.description,
        icon: b.icon,
        stars: b.stars,
        classified_at: b.classified_at,
        published_at: b.published_at,
        tags: tagsByBookmark.get(b.id) || [],
      },
      matches: {
        content: b.firecrawl_content?.toLowerCase().includes(s) ?? false,
        research: b.perplexity_research?.toLowerCase().includes(s) ?? false,
        insight:
          (b.insight_dev?.toLowerCase().includes(s) ?? false) ||
          (b.insight_founder?.toLowerCase().includes(s) ?? false) ||
          (b.insight_investor?.toLowerCase().includes(s) ?? false),
      },
    };
  });
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
