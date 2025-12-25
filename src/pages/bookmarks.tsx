/**
 * Bookmarks Dashboard
 *
 * A gallery viewer for curated links from the dev WhatsApp group.
 * Hidden page at /bookmarks/ - not linked from main navigation.
 */

import { useState, useEffect } from "react";
import { PageHeader } from "../components/page-header";

interface Bookmark {
  url: string;
  category: string;
  domain: string;
  content_type: string;
  relevance: string;
  title: string;
  description: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  reference: "#3b82f6", // blue
  tool: "#10b981", // emerald
  x: "#a1a1a6", // gray (readable in dark mode)
  linkedin: "#0a66c2", // linkedin blue
  instagram: "#e1306c", // instagram pink
  social: "#ec4899", // pink (fallback)
  media: "#f43f5e", // rose
};

const CATEGORY_ICONS: Record<string, string> = {
  reference: "📚",
  tool: "🔧",
  x: "𝕏",
  linkedin: "💼",
  instagram: "📸",
  social: "💬",
  media: "🎬",
};

const RELEVANCE_LABELS: Record<string, string> = {
  learning: "📖 Learning",
  "core-product": "⚡ Core Product",
  "customer-site": "🏪 Customer",
  ops: "🔧 Operations",
  competitor: "🎯 Competitor",
  hiring: "👤 Hiring",
  community: "👥 Community",
  internal: "🔒 Internal",
  misc: "📌 Misc",
  debug: "🐛 Debug",
};

function parseCSV(text: string): Bookmark[] {
  const lines = text.trim().split("\n");
  if (lines.length === 0 || !lines[0]) return [];
  const headers = lines[0].split(",");

  return lines.slice(1).map((line) => {
    // Handle CSV with potential commas in values
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current);

    const obj: Record<string, string> = {};
    headers.forEach((header, i) => {
      obj[header] = values[i] || "";
    });

    return obj as unknown as Bookmark;
  });
}

function getFavicon(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return "";
  }
}

function getDomainDisplay(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

const isLocalhost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

function BookmarkCard({
  bookmark,
  onDelete,
}: {
  bookmark: Bookmark;
  onDelete?: (url: string) => void;
}) {
  const [imageError, setImageError] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const categoryColor = CATEGORY_COLORS[bookmark.category] || "#6b7280";
  const icon = CATEGORY_ICONS[bookmark.category] || "🔗";

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${bookmark.title || bookmark.url}"?`)) return;

    setDeleting(true);
    try {
      const res = await fetch("/api/bookmarks/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: bookmark.url }),
      });
      if (res.ok) {
        onDelete?.(bookmark.url);
      } else {
        const data = await res.json();
        alert(`Failed to delete: ${data.error}`);
      }
    } catch (err) {
      alert(`Failed to delete: ${(err as Error).message}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="relative group">
      {/* Delete button - localhost only */}
      {isLocalhost && onDelete && (
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity"
          style={{
            backgroundColor: "#ef4444",
            color: "white",
          }}
          title="Delete bookmark"
        >
          {deleting ? "…" : "×"}
        </button>
      )}
      <a
        href={bookmark.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-lg border transition-all duration-200 hover:scale-[1.02]"
        style={{
          backgroundColor: "var(--color-bg-secondary)",
          borderColor: "var(--color-border)",
        }}
      >
        <div className="p-4">
          {/* Header with favicon and domain */}
          <div className="flex items-center gap-2 mb-2">
            {!imageError ? (
              <img
                src={getFavicon(bookmark.url)}
                alt=""
                className="w-4 h-4 rounded"
                onError={() => setImageError(true)}
              />
            ) : (
              <span className="text-sm">{icon}</span>
            )}
            <span
              className="text-xs truncate"
              style={{ color: "var(--color-fg-muted)" }}
            >
              {getDomainDisplay(bookmark.url)}
            </span>
          </div>

          {/* Title */}
          <h3
            className="font-medium text-sm mb-1 line-clamp-2 group-hover:underline"
            style={{ color: "var(--color-fg)" }}
          >
            {bookmark.title || getDomainDisplay(bookmark.url)}
          </h3>

          {/* Description */}
          {bookmark.description && (
            <p
              className="text-xs line-clamp-2 mb-3"
              style={{ color: "var(--color-fg-muted)" }}
            >
              {bookmark.description}
            </p>
          )}

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 mt-auto">
            <span
              className="px-2 py-0.5 rounded-full text-xs font-medium"
              style={{
                backgroundColor: `${categoryColor}20`,
                color: categoryColor,
              }}
            >
              {icon} {bookmark.category}
            </span>
            {bookmark.relevance && bookmark.relevance !== bookmark.category && (
              <span
                className="px-2 py-0.5 rounded-full text-xs"
                style={{
                  backgroundColor: "var(--color-bg)",
                  color: "var(--color-fg-muted)",
                }}
              >
                {RELEVANCE_LABELS[bookmark.relevance] || bookmark.relevance}
              </span>
            )}
          </div>
        </div>
      </a>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
  count,
  color,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-sm font-medium transition-all"
      style={{
        backgroundColor: active
          ? color
            ? `${color}20`
            : "var(--color-bg-secondary)"
          : "var(--color-bg-secondary)",
        color: active ? color || "var(--color-fg)" : "var(--color-fg-muted)",
        borderWidth: "1px",
        borderColor: active
          ? color || "var(--color-accent)"
          : "var(--color-border)",
      }}
    >
      {children}
      {count !== undefined && (
        <span
          className="ml-1.5 opacity-70"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          ({count})
        </span>
      )}
    </button>
  );
}

export function Bookmarks() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [relevanceFilter, setRelevanceFilter] = useState<string | null>(null);

  useEffect(() => {
    fetch("/bookmarks/links.csv")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load bookmarks");
        return res.text();
      })
      .then((text) => {
        const parsed = parseCSV(text);
        setBookmarks(parsed);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Filter bookmarks
  const filtered = bookmarks.filter((b) => {
    if (categoryFilter && b.category !== categoryFilter) return false;
    if (relevanceFilter && b.relevance !== relevanceFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        b.url.toLowerCase().includes(s) ||
        b.title.toLowerCase().includes(s) ||
        b.description.toLowerCase().includes(s) ||
        b.domain.toLowerCase().includes(s)
      );
    }
    return true;
  });

  // Get category counts
  const categoryCounts = bookmarks.reduce(
    (acc, b) => {
      acc[b.category] = (acc[b.category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  // Get relevance counts for filtered category
  const relevanceCounts = bookmarks
    .filter((b) => !categoryFilter || b.category === categoryFilter)
    .reduce(
      (acc, b) => {
        acc[b.relevance] = (acc[b.relevance] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

  // Sort categories by count
  const sortedCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([cat]) => cat);

  // Sort relevance by count
  const sortedRelevance = Object.entries(relevanceCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([rel]) => rel);

  if (loading) {
    return (
      <div className="container py-16 text-center">
        <div
          className="inline-block animate-spin rounded-full h-8 w-8 border-2"
          style={{
            borderColor: "var(--color-border)",
            borderTopColor: "var(--color-accent)",
          }}
        />
        <p className="mt-4" style={{ color: "var(--color-fg-muted)" }}>
          Loading bookmarks...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-16 text-center">
        <p style={{ color: "#ef4444" }}>Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <PageHeader
        title="Bookmarks"
        subtitle={`${bookmarks.length} links curated from the dev WhatsApp group (Jul–Dec 2025)`}
      />

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search links..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2.5 rounded-lg text-sm"
          style={{
            backgroundColor: "var(--color-bg-secondary)",
            border: "1px solid var(--color-border)",
            color: "var(--color-fg)",
          }}
        />
      </div>

      {/* Category Filters */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-2">
          <FilterButton
            active={categoryFilter === null}
            onClick={() => {
              setCategoryFilter(null);
              setRelevanceFilter(null);
            }}
            count={bookmarks.length}
          >
            All
          </FilterButton>
          {sortedCategories.map((cat) => (
            <FilterButton
              key={cat}
              active={categoryFilter === cat}
              onClick={() => {
                setCategoryFilter(cat === categoryFilter ? null : cat);
                setRelevanceFilter(null);
              }}
              count={categoryCounts[cat]}
              color={CATEGORY_COLORS[cat]}
            >
              {CATEGORY_ICONS[cat]} {cat}
            </FilterButton>
          ))}
        </div>
      </div>

      {/* Relevance Filters (show when category is selected) */}
      {categoryFilter && (
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            <FilterButton
              active={relevanceFilter === null}
              onClick={() => setRelevanceFilter(null)}
              count={
                bookmarks.filter((b) => b.category === categoryFilter).length
              }
            >
              All relevance
            </FilterButton>
            {sortedRelevance.map((rel) => (
              <FilterButton
                key={rel}
                active={relevanceFilter === rel}
                onClick={() =>
                  setRelevanceFilter(rel === relevanceFilter ? null : rel)
                }
                count={relevanceCounts[rel]}
              >
                {RELEVANCE_LABELS[rel] || rel}
              </FilterButton>
            ))}
          </div>
        </div>
      )}

      {/* Results count */}
      <p className="mb-4 text-sm" style={{ color: "var(--color-fg-muted)" }}>
        Showing {filtered.length} of {bookmarks.length} links
      </p>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((bookmark, i) => (
          <BookmarkCard
            key={`${bookmark.url}-${i}`}
            bookmark={bookmark}
            onDelete={(url) =>
              setBookmarks((prev) => prev.filter((b) => b.url !== url))
            }
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <p style={{ color: "var(--color-fg-muted)" }}>
            No bookmarks match your filters
          </p>
          <button
            onClick={() => {
              setSearch("");
              setCategoryFilter(null);
              setRelevanceFilter(null);
            }}
            className="mt-4 px-4 py-2 rounded-lg"
            style={{
              backgroundColor: "var(--color-accent)",
              color: "white",
            }}
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
