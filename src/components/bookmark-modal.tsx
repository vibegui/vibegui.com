/**
 * Bookmark Modal Component
 *
 * Manages its own tab state to avoid re-rendering the parent component
 * when switching between insight tabs.
 *
 * Content is cached in localStorage for persistence across page refreshes.
 */

import React, { useState, useRef } from "react";
import { marked } from "marked";
import { getBookmarkContent } from "../../lib/supabase";

export const MODAL_TYPES = [
  "dev",
  "founder",
  "investor",
  "research",
  "exa",
] as const;
export type ModalType = (typeof MODAL_TYPES)[number];

interface BookmarkModalProps {
  bookmark: {
    url: string;
    title: string | null;
    icon: string | null;
    published_at: string | null;
    classified_at: string | null;
    tags?: string[];
  };
  initialTab: ModalType;
  onClose: () => void;
  onNavigateBookmark: (direction: "prev" | "next") => void;
  canNavigatePrev: boolean;
  canNavigateNext: boolean;
}

type BookmarkContent = {
  perplexity_research: string | null;
  firecrawl_content: string | null;
  insight_dev: string | null;
  insight_founder: string | null;
  insight_investor: string | null;
};

const CACHE_KEY = "bookmark-content-cache";
const CACHE_VERSION = 1;

type CacheEntry = {
  content: BookmarkContent;
  timestamp: number;
};

type CacheStore = {
  version: number;
  entries: Record<string, CacheEntry>;
};

// Cache expires after 7 days
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

function getCache(): CacheStore {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return { version: CACHE_VERSION, entries: {} };
    const parsed = JSON.parse(raw) as CacheStore;
    if (parsed.version !== CACHE_VERSION) {
      return { version: CACHE_VERSION, entries: {} };
    }
    return parsed;
  } catch {
    return { version: CACHE_VERSION, entries: {} };
  }
}

function getCachedContent(url: string): BookmarkContent | null {
  const cache = getCache();
  const entry = cache.entries[url];
  if (!entry) return null;
  // Check if expired
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    return null;
  }
  return entry.content;
}

// Check if content looks like an error message
function isErrorContent(text: string | null): boolean {
  if (!text) return false;
  const errorPatterns = [
    /authorization failed/i,
    /mcp error/i,
    /request timed out/i,
    /connection refused/i,
    /network error/i,
    /failed to fetch/i,
    /internal server error/i,
    /^error:/i,
  ];
  return errorPatterns.some((pattern) => pattern.test(text));
}

// Check if any content field contains an error
function hasErrorInContent(content: BookmarkContent): boolean {
  return (
    isErrorContent(content.perplexity_research) ||
    isErrorContent(content.firecrawl_content) ||
    isErrorContent(content.insight_dev) ||
    isErrorContent(content.insight_founder) ||
    isErrorContent(content.insight_investor)
  );
}

function setCachedContent(url: string, content: BookmarkContent): void {
  // Don't cache content that contains error messages
  if (hasErrorInContent(content)) {
    console.warn("Not caching content with errors for:", url);
    return;
  }

  const cache = getCache();
  cache.entries[url] = {
    content,
    timestamp: Date.now(),
  };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage full or unavailable, ignore
  }
}

export function clearBookmarkCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // Ignore
  }
}

export function BookmarkModal({
  bookmark,
  initialTab,
  onClose,
  onNavigateBookmark,
  canNavigatePrev,
  canNavigateNext,
}: BookmarkModalProps) {
  const [activeTab, setActiveTab] = useState<ModalType>(initialTab);
  const [content, setContent] = useState<BookmarkContent | null>(() =>
    getCachedContent(bookmark.url),
  );
  const [loading, setLoading] = useState(!getCachedContent(bookmark.url));

  // Track current bookmark URL to detect changes
  const currentUrlRef = useRef(bookmark.url);
  const initialTabRef = useRef(initialTab);
  const fetchingRef = useRef(false);

  // Reset tab when initialTab prop changes (e.g., clicking different insight button)
  if (initialTabRef.current !== initialTab) {
    initialTabRef.current = initialTab;
    setActiveTab(initialTab);
  }

  // Fetch content when bookmark changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: bookmark.url is the key dependency
  React.useEffect(() => {
    const url = bookmark.url;

    // Check if URL changed
    if (currentUrlRef.current !== url) {
      currentUrlRef.current = url;
      fetchingRef.current = false;

      // Check localStorage cache first
      const cached = getCachedContent(url);
      if (cached) {
        setContent(cached);
        setLoading(false);
        return;
      }

      // Need to fetch
      setContent(null);
      setLoading(true);
    }

    // Fetch if we don't have content and not already fetching
    const cached = getCachedContent(url);
    if (cached && !content) {
      setContent(cached);
      setLoading(false);
      return;
    }

    if (!cached && !fetchingRef.current) {
      fetchingRef.current = true;
      setLoading(true);

      getBookmarkContent(url)
        .then((data) => {
          if (data && currentUrlRef.current === url) {
            setContent(data);
            setCachedContent(url, data);
          }
        })
        .catch((err) => {
          console.error("Failed to fetch content:", err);
        })
        .finally(() => {
          if (currentUrlRef.current === url) {
            setLoading(false);
            fetchingRef.current = false;
          }
        });
    }
  }, [bookmark.url, content]);

  // Get available tabs based on content
  const availableTabs: ModalType[] = content
    ? ([
        content.insight_dev && "dev",
        content.insight_founder && "founder",
        content.insight_investor && "investor",
        content.perplexity_research && "research",
        content.firecrawl_content && "exa",
      ].filter(Boolean) as ModalType[])
    : MODAL_TYPES.slice(); // Show all while loading

  const currentTabIndex = availableTabs.indexOf(activeTab);

  // Keyboard navigation - stable handler
  const stateRef = useRef({ activeTab, availableTabs, currentTabIndex });
  stateRef.current = { activeTab, availableTabs, currentTabIndex };

  // biome-ignore lint/correctness/useExhaustiveDependencies: using ref for stable handler
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const { availableTabs: tabs, currentTabIndex: idx } = stateRef.current;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        const newIdx = (idx + 1) % tabs.length;
        const newTab = tabs[newIdx];
        if (newTab) setActiveTab(newTab);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const newIdx = (idx - 1 + tabs.length) % tabs.length;
        const newTab = tabs[newIdx];
        if (newTab) setActiveTab(newTab);
      } else if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        onNavigateBookmark("next");
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        onNavigateBookmark("prev");
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onNavigateBookmark]);

  // Format bullet points from various separator formats used in the database
  const formatBullets = (text: string | null | undefined): string => {
    if (!text) return "";
    return (
      text
        // Convert various separator patterns to proper markdown bullets
        .replace(/\s*\|\s*-\s*/g, "\n\n- ") // " | - " format
        .replace(/\.,\s*-\s*/g, ".\n\n- ") // ".,- " format
        .replace(/,\s*-\s+/g, "\n\n- ")
    ); // ",- " format
  };

  const configs: Record<
    ModalType,
    { icon: string; title: string; content: string; color: string }
  > = {
    research: {
      icon: "🔬",
      title: "Research",
      content:
        content?.perplexity_research ||
        (loading ? "Loading..." : "No research available."),
      color: "#3b82f6",
    },
    exa: {
      icon: "🌐",
      title: "Page Content",
      content:
        content?.firecrawl_content ||
        (loading ? "Loading..." : "No page content available."),
      color: "#06b6d4",
    },
    dev: {
      icon: "🔌",
      title: "Developer Insight",
      content: content?.insight_dev
        ? formatBullets(content.insight_dev)
        : loading
          ? "Loading..."
          : "No developer insight available.",
      color: "#8b5cf6",
    },
    founder: {
      icon: "🚀",
      title: "Founder Insight",
      content: content?.insight_founder
        ? formatBullets(content.insight_founder)
        : loading
          ? "Loading..."
          : "No founder insight available.",
      color: "#f59300",
    },
    investor: {
      icon: "💰",
      title: "Investor Insight",
      content: content?.insight_investor
        ? formatBullets(content.insight_investor)
        : loading
          ? "Loading..."
          : "No investor insight available.",
      color: "#10b981",
    },
  };

  const config = configs[activeTab];

  const tabConfigs: Record<
    ModalType,
    { icon: string; label: string; color: string }
  > = {
    dev: { icon: "🔌", label: "Developer", color: "#8b5cf6" },
    founder: { icon: "🚀", label: "Founder", color: "#f59300" },
    investor: { icon: "💰", label: "Investor", color: "#10b981" },
    research: { icon: "🔬", label: "Research", color: "#3b82f6" },
    exa: { icon: "🌐", label: "Content", color: "#06b6d4" },
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      style={{ backgroundColor: "rgba(0,0,0,0.8)" }}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <dialog
        ref={(el) => el?.focus()}
        open
        tabIndex={-1}
        className="max-w-4xl w-full h-[92vh] sm:h-[88vh] rounded-xl sm:rounded-2xl p-0 m-0 flex flex-col outline-none shadow-2xl"
        style={{
          backgroundColor: "var(--color-bg)",
          border: `1px solid ${config.color}30`,
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Compact title bar */}
        <div
          className="flex items-center justify-between px-5 sm:px-6 py-4 sm:py-5 border-b shrink-0"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div className="flex-1 min-w-0 pr-4">
            <h3
              className="text-xl sm:text-2xl font-semibold truncate mb-1.5"
              style={{ color: "var(--color-fg)" }}
            >
              {bookmark.icon && <span className="mr-2">{bookmark.icon}</span>}
              {bookmark.title}
            </h3>
            <div className="flex items-center gap-3 text-sm">
              <a
                href={bookmark.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline truncate opacity-70 hover:opacity-100 transition-opacity"
                style={{ color: "var(--color-accent)" }}
                onClick={(e) => e.stopPropagation()}
              >
                {bookmark.url}
              </a>
              {bookmark.published_at && (
                <span
                  className="opacity-50 shrink-0"
                  style={{ color: "var(--color-fg-muted)" }}
                >
                  {new Date(bookmark.published_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              )}
            </div>
          </div>

          {/* Tags + Close */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex flex-wrap gap-1.5 max-w-[180px] justify-end">
              {bookmark.tags?.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: tag.startsWith("tech:")
                      ? "#3b82f618"
                      : tag.startsWith("persona:")
                        ? "#8b5cf618"
                        : "#6b728018",
                    color: tag.startsWith("tech:")
                      ? "#60a5fa"
                      : tag.startsWith("persona:")
                        ? "#a78bfa"
                        : "var(--color-fg-muted)",
                  }}
                >
                  {tag.replace(/^(tech:|persona:|type:|category:)/, "")}
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:opacity-80 transition-opacity"
              style={{
                backgroundColor: "var(--color-bg-secondary)",
                color: "var(--color-fg-muted)",
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div
          className="flex gap-2 px-5 sm:px-6 py-3 border-b overflow-x-auto shrink-0"
          style={{ borderColor: "var(--color-border)" }}
        >
          {availableTabs.map((modalType) => {
            const tab = tabConfigs[modalType];
            const isActive = activeTab === modalType;
            return (
              <button
                key={modalType}
                type="button"
                onClick={() => setActiveTab(modalType)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap"
                style={{
                  backgroundColor: isActive ? `${tab.color}20` : "transparent",
                  color: isActive ? tab.color : "var(--color-fg-muted)",
                  border: isActive
                    ? `1px solid ${tab.color}50`
                    : "1px solid transparent",
                  transform: isActive ? "scale(1.02)" : "scale(1)",
                }}
              >
                <span className="mr-1.5">{tab.icon}</span>
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content - Full height scrollable */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6">
          <article
            className="prose prose-lg"
            style={{
              color: "var(--color-fg)",
              lineHeight: 1.8,
              fontSize: "1rem",
              maxWidth: "none",
            }}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: markdown rendering
            dangerouslySetInnerHTML={{
              __html: marked(config.content, { async: false }) as string,
            }}
          />
        </div>

        {/* Footer - Navigation controls */}
        <div
          className="px-5 sm:px-6 py-3 sm:py-4 border-t flex items-center justify-between shrink-0"
          style={{
            borderColor: "var(--color-border)",
            backgroundColor: "var(--color-bg)",
          }}
        >
          {/* Prev/Next bookmark */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigateBookmark("prev")}
              disabled={!canNavigatePrev}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-medium transition-all disabled:opacity-30 hover:scale-105 disabled:hover:scale-100"
              style={{
                backgroundColor: "var(--color-bg-secondary)",
                color: "var(--color-fg)",
                border: "1px solid var(--color-border)",
              }}
              title="Previous bookmark (↑/k)"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => onNavigateBookmark("next")}
              disabled={!canNavigateNext}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-medium transition-all disabled:opacity-30 hover:scale-105 disabled:hover:scale-100"
              style={{
                backgroundColor: "var(--color-bg-secondary)",
                color: "var(--color-fg)",
                border: "1px solid var(--color-border)",
              }}
              title="Next bookmark (↓/j)"
            >
              ↓
            </button>
            <span
              className="text-xs ml-2 hidden sm:inline"
              style={{ color: "var(--color-fg-muted)", opacity: 0.6 }}
            >
              ← → switch tabs
            </span>
          </div>

          {/* Last enriched - center */}
          {bookmark.classified_at && (
            <span
              className="text-xs hidden sm:inline"
              style={{ color: "var(--color-fg-muted)", opacity: 0.5 }}
            >
              analyzed{" "}
              {new Date(bookmark.classified_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
              })}
            </span>
          )}

          {/* Copy */}
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(config.content);
            }}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105"
            style={{
              backgroundColor: `${config.color}20`,
              color: config.color,
              border: `1px solid ${config.color}40`,
            }}
            title="Copy to clipboard"
          >
            📋 Copy
          </button>
        </div>
      </dialog>
    </div>
  );
}
