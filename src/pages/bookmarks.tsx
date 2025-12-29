/**
 * Bookmarks - Public Read-Only View
 *
 * Lightweight table-based viewer for curated links.
 * Enrichment workflow is at /bookmarks/edit
 *
 * Data source: Supabase (read-only via anon key)
 */

import React, { useState, useRef } from "react";
import { PageHeader } from "../components/page-header";
import {
  BookmarkModal,
  clearBookmarkCache,
  type ModalType,
} from "../components/bookmark-modal";
import {
  getAllBookmarksLight,
  searchBookmarks,
  type BookmarkLight,
  type SearchResult,
} from "../../lib/supabase";

type Bookmark = BookmarkLight;

// Tag type helpers
function hasTag(tags: string[] | undefined, tag: string): boolean {
  return tags?.includes(tag) ?? false;
}

// Extract platform from URL for filtering
const PLATFORM_PATTERNS: Record<string, RegExp> = {
  github: /github\.com/i,
  linkedin: /linkedin\.com/i,
  twitter: /twitter\.com|x\.com/i,
  youtube: /youtube\.com|youtu\.be/i,
  instagram: /instagram\.com/i,
  medium: /medium\.com/i,
  substack: /substack\.com/i,
  reddit: /reddit\.com/i,
  hackernews: /news\.ycombinator\.com/i,
  discord: /discord\.com|discord\.gg/i,
};

function getPlatform(url: string): string | null {
  for (const [platform, pattern] of Object.entries(PLATFORM_PATTERNS)) {
    if (pattern.test(url)) return platform;
  }
  return null;
}

const TRACK_CONFIG = {
  mcp: { label: "MCP Developer", color: "#8b5cf6", icon: "🔌" },
  founder: { label: "Startup Founder", color: "#f59300", icon: "🚀" },
  investor: { label: "VC Investor", color: "#10b981", icon: "💰" },
};

// Check if running in development mode (localhost)
const isDev =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

function StarRating({ stars }: { stars?: number | null }) {
  if (!stars) return <span className="text-gray-400">—</span>;
  return (
    <span title={`${stars}/5`}>
      {"⭐".repeat(stars)}
      <span className="opacity-30">{"☆".repeat(5 - stars)}</span>
    </span>
  );
}

export function Bookmarks() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [trackFilter, setTrackFilter] = useState<
    "mcp" | "founder" | "investor" | null
  >(null);
  const [techFilter, setTechFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<
    "none" | "rating" | "alpha" | "published" | "analyzed"
  >("analyzed");
  const [starsFilter, setStarsFilter] = useState<number | null>(null);
  const [platformFilter, setPlatformFilter] = useState<string | null>(null);
  // Tag expansion states
  const [showAllTechTags, setShowAllTechTags] = useState(false);
  const [showAllTypeTags, setShowAllTypeTags] = useState(false);
  const [showAllPlatforms, setShowAllPlatforms] = useState(false);
  // Full-text search match type filter
  const [matchTypeFilter, setMatchTypeFilter] = useState<
    "all" | "content" | "research" | "insight"
  >("all");
  // Modal state
  const [modalState, setModalState] = useState<{
    url: string;
    tab: ModalType;
  } | null>(null);
  // Selected row for keyboard navigation
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const filteredRef = useRef<Bookmark[]>([]);
  // Search results from server-side search
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(
    null,
  );
  const [searching, setSearching] = useState(false);

  const openModal = (url: string, tab: ModalType = "dev") => {
    setModalState({ url, tab });
  };

  // Load bookmarks on mount
  React.useEffect(() => {
    async function loadBookmarks() {
      try {
        // Load from Supabase (lightweight query)
        const data = await getAllBookmarksLight();
        setBookmarks(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    loadBookmarks();
  }, []);

  // Full-text search with debounce
  React.useEffect(() => {
    if (search.length < 3) {
      setSearchResults(null);
      return;
    }

    const debounce = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchBookmarks(search);
        setSearchResults(results);
      } catch (err) {
        console.error("Search failed:", err);
        setSearchResults(null);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [search]);

  // Keyboard navigation
  // biome-ignore lint/correctness/useExhaustiveDependencies: openModal is a stable function reference
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (modalState) return;

      const filtered = filteredRef.current;
      if (filtered.length === 0) return;

      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        setSelectedRowIndex((prev) => {
          if (prev === null) return 0;
          return Math.min(prev + 1, filtered.length - 1);
        });
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        setSelectedRowIndex((prev) => {
          if (prev === null) return 0;
          return Math.max(prev - 1, 0);
        });
      } else if (e.key === "Enter" && selectedRowIndex !== null) {
        const bookmark = filtered[selectedRowIndex];
        if (bookmark) openModal(bookmark.url);
      } else if (e.key === "Escape") {
        setSelectedRowIndex(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalState, selectedRowIndex]);

  // Close modal
  const closeModal = () => {
    setModalState(null);
  };

  // Get modal bookmark
  const modalBookmark = modalState
    ? bookmarks.find((b) => b.url === modalState.url)
    : null;

  // Only show enriched bookmarks in public view
  const enriched = bookmarks.filter((b) => b.classified_at);

  // Collect unique tags for filters
  const allTags = enriched.flatMap((b) => b.tags || []);
  const techTags = [...new Set(allTags.filter((t) => t.startsWith("tech:")))]
    .map((t) => t.replace("tech:", ""))
    .sort();
  const typeTags = [...new Set(allTags.filter((t) => t.startsWith("type:")))]
    .map((t) => t.replace("type:", ""))
    .sort();
  const platforms = [
    ...new Set(enriched.map((b) => getPlatform(b.url)).filter(Boolean)),
  ].sort() as string[];

  // Apply filters and sorting
  const baseList = searchResults
    ? searchResults.map((r) => r.bookmark)
    : enriched;

  const filtered = baseList
    .filter((b) => {
      // Track filter
      if (trackFilter === "mcp" && !hasTag(b.tags, "persona:mcp_developer"))
        return false;
      if (
        trackFilter === "founder" &&
        !hasTag(b.tags, "persona:startup_founder")
      )
        return false;
      if (trackFilter === "investor" && !hasTag(b.tags, "persona:vc_investor"))
        return false;
      // Tech filter
      if (techFilter && !hasTag(b.tags, `tech:${techFilter}`)) return false;
      // Type filter
      if (typeFilter && !hasTag(b.tags, `type:${typeFilter}`)) return false;
      // Stars filter
      if (starsFilter && (b.stars || 0) < starsFilter) return false;
      // Platform filter
      if (platformFilter && getPlatform(b.url) !== platformFilter) return false;
      // Search (basic client-side for non-full-text)
      if (search.length > 0 && search.length < 3) {
        const q = search.toLowerCase();
        if (
          !b.title?.toLowerCase().includes(q) &&
          !b.url.toLowerCase().includes(q) &&
          !b.description?.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      // Match type filter (for full-text search results)
      if (searchResults && matchTypeFilter !== "all") {
        const result = searchResults.find((r) => r.bookmark.url === b.url);
        if (result) {
          if (matchTypeFilter === "content" && !result.matches.content)
            return false;
          if (matchTypeFilter === "research" && !result.matches.research)
            return false;
          if (matchTypeFilter === "insight" && !result.matches.insight)
            return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "alpha") {
        return (a.title || "").localeCompare(b.title || "");
      }
      if (sortBy === "rating") {
        return (b.stars || 0) - (a.stars || 0);
      }
      if (sortBy === "published") {
        const aDate = a.published_at ? new Date(a.published_at).getTime() : 0;
        const bDate = b.published_at ? new Date(b.published_at).getTime() : 0;
        return bDate - aDate;
      }
      if (sortBy === "analyzed") {
        const aDate = a.classified_at ? new Date(a.classified_at).getTime() : 0;
        const bDate = b.classified_at ? new Date(b.classified_at).getTime() : 0;
        return bDate - aDate;
      }
      return 0;
    });

  // Update ref for keyboard navigation
  filteredRef.current = filtered;

  // Limit tags shown in filter
  const VISIBLE_TAG_LIMIT = 8;
  const visibleTechTags = showAllTechTags
    ? techTags
    : techTags.slice(0, VISIBLE_TAG_LIMIT);
  const visibleTypeTags = showAllTypeTags
    ? typeTags
    : typeTags.slice(0, VISIBLE_TAG_LIMIT);
  const visiblePlatforms = showAllPlatforms
    ? platforms
    : platforms.slice(0, VISIBLE_TAG_LIMIT);

  if (loading) {
    return (
      <div className="container py-16">
        <div className="text-center" style={{ color: "var(--color-fg-muted)" }}>
          Loading bookmarks...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-16">
        <div className="text-center text-red-500">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Bookmarks"
          subtitle={`${enriched.length} curated links`}
        />
        {isDev && (
          <a
            href="/bookmarks/edit"
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: "var(--color-accent)",
              color: "#fff",
            }}
          >
            ✏️ Edit
          </a>
        )}
      </div>

      {/* Filters Section */}
      <div
        className="p-4 rounded-xl mb-6"
        style={{
          backgroundColor: "var(--color-bg-secondary)",
          border: "1px solid var(--color-border)",
        }}
      >
        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search bookmarks... (3+ chars for full-text)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2 rounded-lg text-sm"
              style={{
                backgroundColor: "var(--color-bg)",
                border: "1px solid var(--color-border)",
                color: "var(--color-fg)",
              }}
            />
            {searching && (
              <span
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                style={{ color: "var(--color-fg-muted)" }}
              >
                Searching...
              </span>
            )}
          </div>

          {/* Match type filter (only when search results are present) */}
          {searchResults && (
            <div className="flex gap-2 mt-2">
              {(["all", "content", "research", "insight"] as const).map(
                (type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setMatchTypeFilter(type)}
                    className="px-2 py-1 rounded text-xs transition-colors"
                    style={{
                      backgroundColor:
                        matchTypeFilter === type
                          ? "var(--color-accent)"
                          : "var(--color-bg)",
                      color:
                        matchTypeFilter === type
                          ? "#fff"
                          : "var(--color-fg-muted)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    {type === "all"
                      ? "All matches"
                      : type === "content"
                        ? "📄 Content"
                        : type === "research"
                          ? "🔬 Research"
                          : "💡 Insights"}
                  </button>
                ),
              )}
            </div>
          )}
        </div>

        {/* Track filter */}
        <div className="flex flex-wrap gap-2 mb-3">
          <span
            className="text-xs font-medium"
            style={{ color: "var(--color-fg-muted)" }}
          >
            Track:
          </span>
          {(["mcp", "founder", "investor"] as const).map((track) => {
            const config = TRACK_CONFIG[track];
            const isActive = trackFilter === track;
            return (
              <button
                key={track}
                type="button"
                onClick={() => setTrackFilter(isActive ? null : track)}
                className="px-2 py-1 rounded text-xs transition-colors"
                style={{
                  backgroundColor: isActive ? config.color : "var(--color-bg)",
                  color: isActive ? "#fff" : "var(--color-fg-muted)",
                  border: `1px solid ${isActive ? config.color : "var(--color-border)"}`,
                }}
              >
                {config.icon} {config.label}
              </button>
            );
          })}
        </div>

        {/* Tech tags */}
        <div className="flex flex-wrap gap-2 mb-3">
          <span
            className="text-xs font-medium"
            style={{ color: "var(--color-fg-muted)" }}
          >
            Tech:
          </span>
          {visibleTechTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setTechFilter(techFilter === tag ? null : tag)}
              className="px-2 py-0.5 rounded text-xs transition-colors"
              style={{
                backgroundColor:
                  techFilter === tag
                    ? "var(--color-accent)"
                    : "var(--color-bg)",
                color: techFilter === tag ? "#fff" : "var(--color-fg-muted)",
                border: "1px solid var(--color-border)",
              }}
            >
              {tag}
            </button>
          ))}
          {techTags.length > VISIBLE_TAG_LIMIT && (
            <button
              type="button"
              onClick={() => setShowAllTechTags(!showAllTechTags)}
              className="px-2 py-0.5 rounded text-xs"
              style={{ color: "var(--color-accent)" }}
            >
              {showAllTechTags
                ? "Less"
                : `+${techTags.length - VISIBLE_TAG_LIMIT} more`}
            </button>
          )}
        </div>

        {/* Type tags */}
        <div className="flex flex-wrap gap-2 mb-3">
          <span
            className="text-xs font-medium"
            style={{ color: "var(--color-fg-muted)" }}
          >
            Type:
          </span>
          {visibleTypeTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setTypeFilter(typeFilter === tag ? null : tag)}
              className="px-2 py-0.5 rounded text-xs transition-colors"
              style={{
                backgroundColor:
                  typeFilter === tag
                    ? "var(--color-accent)"
                    : "var(--color-bg)",
                color: typeFilter === tag ? "#fff" : "var(--color-fg-muted)",
                border: "1px solid var(--color-border)",
              }}
            >
              {tag}
            </button>
          ))}
          {typeTags.length > VISIBLE_TAG_LIMIT && (
            <button
              type="button"
              onClick={() => setShowAllTypeTags(!showAllTypeTags)}
              className="px-2 py-0.5 rounded text-xs"
              style={{ color: "var(--color-accent)" }}
            >
              {showAllTypeTags
                ? "Less"
                : `+${typeTags.length - VISIBLE_TAG_LIMIT} more`}
            </button>
          )}
        </div>

        {/* Platform filter */}
        <div className="flex flex-wrap gap-2 mb-3">
          <span
            className="text-xs font-medium"
            style={{ color: "var(--color-fg-muted)" }}
          >
            Platform:
          </span>
          {visiblePlatforms.map((platform) => (
            <button
              key={platform}
              type="button"
              onClick={() =>
                setPlatformFilter(platformFilter === platform ? null : platform)
              }
              className="px-2 py-0.5 rounded text-xs transition-colors"
              style={{
                backgroundColor:
                  platformFilter === platform
                    ? "var(--color-accent)"
                    : "var(--color-bg)",
                color:
                  platformFilter === platform
                    ? "#fff"
                    : "var(--color-fg-muted)",
                border: "1px solid var(--color-border)",
              }}
            >
              {platform}
            </button>
          ))}
          {platforms.length > VISIBLE_TAG_LIMIT && (
            <button
              type="button"
              onClick={() => setShowAllPlatforms(!showAllPlatforms)}
              className="px-2 py-0.5 rounded text-xs"
              style={{ color: "var(--color-accent)" }}
            >
              {showAllPlatforms
                ? "Less"
                : `+${platforms.length - VISIBLE_TAG_LIMIT} more`}
            </button>
          )}
        </div>

        {/* Stars filter + Sort */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-medium"
              style={{ color: "var(--color-fg-muted)" }}
            >
              Min Stars:
            </span>
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStarsFilter(starsFilter === s ? null : s)}
                className="transition-opacity"
                style={{ opacity: starsFilter === s ? 1 : 0.4 }}
              >
                {"⭐".repeat(s)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span
              className="text-xs font-medium"
              style={{ color: "var(--color-fg-muted)" }}
            >
              Sort:
            </span>
            {(
              ["analyzed", "published", "rating", "alpha", "none"] as const
            ).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSortBy(s)}
                className="px-2 py-0.5 rounded text-xs transition-colors"
                style={{
                  backgroundColor:
                    sortBy === s ? "var(--color-accent)" : "var(--color-bg)",
                  color: sortBy === s ? "#fff" : "var(--color-fg-muted)",
                  border: "1px solid var(--color-border)",
                }}
                title={
                  {
                    analyzed: "Sort by date analyzed",
                    published: "Sort by publish date",
                    rating: "Sort by rating",
                    alpha: "Sort alphabetically",
                    none: "Default order",
                  }[s]
                }
              >
                {
                  {
                    analyzed: "🔬",
                    published: "📅",
                    rating: "⭐",
                    alpha: "🔤",
                    none: "—",
                  }[s]
                }
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="mb-4 text-sm" style={{ color: "var(--color-fg-muted)" }}>
        Showing {filtered.length} of {enriched.length} bookmarks
        {search && searchResults && ` (search: "${search}")`}
      </div>

      {/* Bookmarks Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          backgroundColor: "var(--color-bg-secondary)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr
                className="text-left text-xs"
                style={{
                  backgroundColor: "var(--color-bg)",
                  color: "var(--color-fg-muted)",
                }}
              >
                <th className="p-3 w-12">Icon</th>
                <th className="p-3">Title</th>
                <th className="p-3 w-24">Rating</th>
                <th className="p-3 w-32">Track</th>
                <th className="p-3 w-28">Published</th>
                <th className="p-3 w-28">Analyzed</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((bookmark, idx) => {
                const isSelected = selectedRowIndex === idx;
                return (
                  <tr
                    key={bookmark.url}
                    className="border-t transition-colors cursor-pointer"
                    style={{
                      borderColor: "var(--color-border)",
                      backgroundColor: isSelected
                        ? "var(--color-bg)"
                        : "transparent",
                    }}
                    onClick={() => openModal(bookmark.url)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") openModal(bookmark.url);
                    }}
                    onMouseEnter={() => setSelectedRowIndex(idx)}
                  >
                    <td className="p-3 text-center text-xl">
                      {bookmark.icon || "🔗"}
                    </td>
                    <td className="p-3">
                      <div
                        className="font-medium truncate max-w-md"
                        style={{ color: "var(--color-fg)" }}
                        title={bookmark.title || bookmark.url}
                      >
                        {bookmark.title || bookmark.url}
                      </div>
                      <div
                        className="text-xs truncate max-w-md"
                        style={{ color: "var(--color-fg-muted)" }}
                      >
                        {bookmark.description || new URL(bookmark.url).hostname}
                      </div>
                    </td>
                    <td className="p-3">
                      <StarRating stars={bookmark.stars} />
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        {hasTag(bookmark.tags, "persona:mcp_developer") && (
                          <span
                            className="px-1.5 py-0.5 rounded text-xs"
                            style={{
                              backgroundColor: `${TRACK_CONFIG.mcp.color}20`,
                              color: TRACK_CONFIG.mcp.color,
                            }}
                          >
                            {TRACK_CONFIG.mcp.icon}
                          </span>
                        )}
                        {hasTag(bookmark.tags, "persona:startup_founder") && (
                          <span
                            className="px-1.5 py-0.5 rounded text-xs"
                            style={{
                              backgroundColor: `${TRACK_CONFIG.founder.color}20`,
                              color: TRACK_CONFIG.founder.color,
                            }}
                          >
                            {TRACK_CONFIG.founder.icon}
                          </span>
                        )}
                        {hasTag(bookmark.tags, "persona:vc_investor") && (
                          <span
                            className="px-1.5 py-0.5 rounded text-xs"
                            style={{
                              backgroundColor: `${TRACK_CONFIG.investor.color}20`,
                              color: TRACK_CONFIG.investor.color,
                            }}
                          >
                            {TRACK_CONFIG.investor.icon}
                          </span>
                        )}
                      </div>
                    </td>
                    <td
                      className="p-3 text-xs"
                      style={{ color: "var(--color-fg-muted)" }}
                    >
                      {bookmark.published_at
                        ? new Date(bookmark.published_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td
                      className="p-3 text-xs"
                      style={{ color: "var(--color-fg-muted)" }}
                    >
                      {bookmark.classified_at
                        ? new Date(bookmark.classified_at).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <p style={{ color: "var(--color-fg-muted)" }}>
            No bookmarks match your filters
          </p>
        </div>
      )}

      {/* Stats */}
      {enriched.length > 0 && (
        <div
          className="mt-6 p-4 rounded-lg grid grid-cols-2 md:grid-cols-4 gap-4"
          style={{
            backgroundColor: "var(--color-bg-secondary)",
            border: "1px solid var(--color-border)",
          }}
        >
          <div>
            <div
              className="text-2xl font-bold"
              style={{ color: "var(--color-fg)" }}
            >
              {(
                enriched.reduce((sum, b) => sum + (b.stars || 0), 0) /
                enriched.length
              ).toFixed(1)}
              ⭐
            </div>
            <div className="text-xs" style={{ color: "var(--color-fg-muted)" }}>
              Avg Rating
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold" style={{ color: "#8b5cf6" }}>
              {
                enriched.filter((b) => hasTag(b.tags, "persona:mcp_developer"))
                  .length
              }
            </div>
            <div className="text-xs" style={{ color: "var(--color-fg-muted)" }}>
              MCP Developer
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold" style={{ color: "#f59300" }}>
              {
                enriched.filter((b) =>
                  hasTag(b.tags, "persona:startup_founder"),
                ).length
              }
            </div>
            <div className="text-xs" style={{ color: "var(--color-fg-muted)" }}>
              Startup Founder
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold" style={{ color: "#10b981" }}>
              {
                enriched.filter((b) => hasTag(b.tags, "persona:vc_investor"))
                  .length
              }
            </div>
            <div className="text-xs" style={{ color: "var(--color-fg-muted)" }}>
              VC Investor
            </div>
          </div>
        </div>
      )}

      {/* Bookmark Modal */}
      {modalBookmark && modalState && (
        <BookmarkModal
          bookmark={{
            url: modalBookmark.url,
            title: modalBookmark.title,
            icon: modalBookmark.icon,
            published_at: modalBookmark.published_at,
            classified_at: modalBookmark.classified_at,
            tags: modalBookmark.tags,
          }}
          initialTab={modalState.tab}
          onClose={closeModal}
          onNavigateBookmark={(direction) => {
            const list = filteredRef.current;
            const currentIdx = list.findIndex(
              (b) => b.url === modalBookmark.url,
            );
            if (direction === "next") {
              const nextIdx = currentIdx + 1;
              const nextBookmark = list[nextIdx];
              if (nextIdx < list.length && nextBookmark) {
                setSelectedRowIndex(nextIdx);
                setModalState({ url: nextBookmark.url, tab: modalState.tab });
              }
            } else {
              const prevIdx = currentIdx - 1;
              const prevBookmark = list[prevIdx];
              if (prevIdx >= 0 && prevBookmark) {
                setSelectedRowIndex(prevIdx);
                setModalState({ url: prevBookmark.url, tab: modalState.tab });
              }
            }
          }}
          canNavigatePrev={
            filteredRef.current.findIndex((b) => b.url === modalBookmark.url) >
            0
          }
          canNavigateNext={
            filteredRef.current.findIndex((b) => b.url === modalBookmark.url) <
            filteredRef.current.length - 1
          }
        />
      )}

      {/* Clear cache link */}
      <div className="text-center py-6 mt-8">
        <button
          type="button"
          onClick={() => {
            clearBookmarkCache();
            window.location.reload();
          }}
          className="text-xs opacity-30 hover:opacity-60 transition-opacity cursor-pointer"
          style={{ color: "var(--color-fg-muted)" }}
        >
          Clear cached bookmarks
        </button>
      </div>
    </div>
  );
}
