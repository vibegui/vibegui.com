import React, { useId, useRef, useState } from "react";
import { marked } from "marked";
import {
  getBookmarkContent,
  type BookmarkContent,
  type BookmarkLight,
} from "../../lib/bookmarks-api";

export const MODAL_TYPES = [
  "dev",
  "founder",
  "investor",
  "research",
  "exa",
] as const;
export type ModalType = (typeof MODAL_TYPES)[number];

interface BookmarkModalProps {
  bookmark: BookmarkLight;
  initialTab: ModalType;
  onClose: () => void;
  onNavigateBookmark: (direction: "prev" | "next") => void;
  canNavigatePrev: boolean;
  canNavigateNext: boolean;
}

type CacheEntry = {
  content: BookmarkContent;
  timestamp: number;
};

type CacheStore = {
  version: number;
  entries: Record<string, CacheEntry>;
};

const CACHE_KEY = "bookmark-content-cache";
const CACHE_VERSION = 2;
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

const TAB_CONFIG: Record<
  ModalType,
  { label: string; field: keyof BookmarkContent }
> = {
  dev: { label: "Developer", field: "insight_dev" },
  founder: { label: "Founder", field: "insight_founder" },
  investor: { label: "Investor", field: "insight_investor" },
  research: { label: "Research", field: "perplexity_research" },
  exa: { label: "Page content", field: "firecrawl_content" },
};

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
  const entry = getCache().entries[url];
  if (!entry || Date.now() - entry.timestamp > CACHE_TTL) return null;
  return entry.content;
}

function setCachedContent(url: string, content: BookmarkContent): void {
  const cache = getCache();
  cache.entries[url] = { content, timestamp: Date.now() };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // The modal remains usable when storage is unavailable or full.
  }
}

function formatBullets(text: string): string {
  return text
    .replace(/\s*\|\s*-\s*/g, "\n\n- ")
    .replace(/\.,\s*-\s*/g, ".\n\n- ")
    .replace(/,\s*-\s+/g, "\n\n- ");
}

function renderSafeMarkdown(markdown: string): string {
  const html = marked(markdown, { async: false }) as string;
  const documentFragment = new DOMParser().parseFromString(html, "text/html");
  const allowedTags = new Set([
    "A",
    "BLOCKQUOTE",
    "BR",
    "CODE",
    "DEL",
    "EM",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "HR",
    "LI",
    "OL",
    "P",
    "PRE",
    "STRONG",
    "TABLE",
    "TBODY",
    "TD",
    "TH",
    "THEAD",
    "TR",
    "UL",
  ]);

  for (const element of documentFragment.querySelectorAll(
    "script, style, iframe, object, embed, form, input",
  )) {
    element.remove();
  }

  for (const element of documentFragment.body.querySelectorAll("*")) {
    if (!allowedTags.has(element.tagName)) {
      element.replaceWith(...element.childNodes);
      continue;
    }

    const href = element.tagName === "A" ? element.getAttribute("href") : null;
    while (element.attributes.length > 0) {
      const attribute = element.attributes[0];
      if (!attribute) break;
      element.removeAttribute(attribute.name);
    }
    if (
      element instanceof HTMLAnchorElement &&
      href &&
      /^(https?:|mailto:|\/|#)/i.test(href)
    ) {
      element.setAttribute("href", href);
      element.setAttribute("rel", "noopener noreferrer");
      if (/^https?:/i.test(href)) element.setAttribute("target", "_blank");
    }
  }

  return documentFragment.body.innerHTML;
}

function displayTag(tag: string): string {
  return tag
    .replace(/^(tech:|type:|category:|persona:)/, "")
    .replaceAll("_", " ");
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(date);
}

export function BookmarkModal({
  bookmark,
  initialTab,
  onClose,
  onNavigateBookmark,
  canNavigatePrev,
  canNavigateNext,
}: BookmarkModalProps) {
  const titleId = useId();
  const panelId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [activeTab, setActiveTab] = useState<ModalType>(initialTab);
  const [content, setContent] = useState<BookmarkContent | null>(() =>
    getCachedContent(bookmark.url),
  );
  const [loading, setLoading] = useState(!getCachedContent(bookmark.url));
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [copied, setCopied] = useState(false);

  React.useEffect(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, []);

  React.useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  React.useEffect(() => {
    setCopied(false);
    const cached = getCachedContent(bookmark.url);
    if (cached && retryCount === 0) {
      setContent(cached);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setContent(null);
    setError(null);
    setLoading(true);

    getBookmarkContent(bookmark.url, { signal: controller.signal })
      .then((result) => {
        if (!result) {
          throw new Error("No notes are available for this bookmark yet.");
        }
        setContent(result);
        setCachedContent(bookmark.url, result);
      })
      .catch((requestError: unknown) => {
        if (
          requestError instanceof DOMException &&
          requestError.name === "AbortError"
        ) {
          return;
        }
        setError(
          requestError instanceof Error
            ? requestError.message
            : "The bookmark notes could not be loaded.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [bookmark.url, retryCount]);

  const availableTabs = content
    ? MODAL_TYPES.filter((type) => Boolean(content[TAB_CONFIG[type].field]))
    : MODAL_TYPES.slice();

  React.useEffect(() => {
    if (
      !loading &&
      availableTabs.length > 0 &&
      !availableTabs.includes(activeTab)
    ) {
      const firstTab = availableTabs[0];
      if (firstTab) setActiveTab(firstTab);
    }
  }, [activeTab, availableTabs, loading]);

  const tabConfig = TAB_CONFIG[activeTab];
  const rawContent = content?.[tabConfig.field] || "";
  const renderedContent = rawContent
    ? renderSafeMarkdown(
        activeTab === "dev" ||
          activeTab === "founder" ||
          activeTab === "investor"
          ? formatBullets(rawContent)
          : rawContent,
      )
    : "";

  const selectAdjacentTab = (direction: 1 | -1) => {
    if (availableTabs.length === 0) return;
    const currentIndex = Math.max(0, availableTabs.indexOf(activeTab));
    const nextIndex =
      (currentIndex + direction + availableTabs.length) % availableTabs.length;
    const nextTab = availableTabs[nextIndex];
    if (nextTab) setActiveTab(nextTab);
  };

  const handleDialogKeyDown = (
    event: React.KeyboardEvent<HTMLDialogElement>,
  ) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key === "Tab") {
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), select, textarea, input, [tabindex]:not([tabindex="-1"])',
        ) || [],
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    const target = event.target as HTMLElement;
    const isTyping =
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT";
    if (isTyping) return;

    if (event.key.toLowerCase() === "j" || event.key === "ArrowDown") {
      event.preventDefault();
      if (canNavigateNext) onNavigateBookmark("next");
    } else if (event.key.toLowerCase() === "k" || event.key === "ArrowUp") {
      event.preventDefault();
      if (canNavigatePrev) onNavigateBookmark("prev");
    }
  };

  const published = formatDate(bookmark.published_at);
  const analyzed = formatDate(bookmark.classified_at);

  return (
    <div
      className="bookmark-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <dialog
        ref={dialogRef}
        open
        aria-modal="true"
        aria-labelledby={titleId}
        className="bookmark-modal"
        onKeyDown={handleDialogKeyDown}
      >
        <header className="bookmark-modal-header">
          <div className="bookmark-modal-heading">
            <span className="bookmark-modal-source">
              {(() => {
                try {
                  return new URL(bookmark.url).hostname.replace(/^www\./, "");
                } catch {
                  return bookmark.url;
                }
              })()}
            </span>
            <h2 id={titleId}>{bookmark.title || bookmark.url}</h2>
            {bookmark.description && <p>{bookmark.description}</p>}
            <div className="bookmark-modal-meta">
              {bookmark.stars ? (
                <span aria-label={`${bookmark.stars} out of 5 stars`}>
                  <span aria-hidden="true">{"★".repeat(bookmark.stars)}</span>{" "}
                  {bookmark.stars}/5
                </span>
              ) : (
                <span>Not rated</span>
              )}
              {published && <span>Published {published}</span>}
              {analyzed && <span>Analyzed {analyzed}</span>}
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="bookmark-modal-close"
            onClick={onClose}
            aria-label="Close bookmark details"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
          {bookmark.tags.length > 0 && (
            <div className="bookmark-modal-tags" aria-label="Bookmark tags">
              {bookmark.tags.slice(0, 8).map((tag) => (
                <span key={tag}>{displayTag(tag)}</span>
              ))}
            </div>
          )}
        </header>

        {!error && (
          <div
            className="bookmark-modal-tabs"
            role="tablist"
            aria-label="Bookmark note sections"
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") {
                event.preventDefault();
                selectAdjacentTab(1);
              } else if (event.key === "ArrowLeft") {
                event.preventDefault();
                selectAdjacentTab(-1);
              }
            }}
          >
            {availableTabs.map((type) => (
              <button
                key={type}
                type="button"
                role="tab"
                id={`${panelId}-${type}-tab`}
                aria-controls={panelId}
                aria-selected={activeTab === type}
                tabIndex={activeTab === type ? 0 : -1}
                onClick={() => setActiveTab(type)}
              >
                {TAB_CONFIG[type].label}
              </button>
            ))}
          </div>
        )}

        <div
          id={panelId}
          className="bookmark-modal-body"
          role="tabpanel"
          aria-labelledby={`${panelId}-${activeTab}-tab`}
          aria-live="polite"
          aria-busy={loading}
        >
          {loading ? (
            <div className="bookmark-modal-loading">
              <div />
              <div />
              <div />
              <span className="sr-only">Loading bookmark notes</span>
            </div>
          ) : error ? (
            <section className="bookmark-modal-error" role="alert">
              <h3>Notes could not be loaded</h3>
              <p>{error}</p>
              <button
                type="button"
                onClick={() => setRetryCount((count) => count + 1)}
              >
                Try again
              </button>
            </section>
          ) : rawContent ? (
            <article
              className="prose bookmark-modal-prose"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted curated markdown from the public Worker
              dangerouslySetInnerHTML={{ __html: renderedContent }}
            />
          ) : (
            <section className="bookmark-modal-error">
              <h3>No notes in this section</h3>
              <p>Choose another section or visit the original source.</p>
            </section>
          )}
        </div>

        <footer className="bookmark-modal-footer">
          <div className="bookmark-modal-navigation">
            <button
              type="button"
              onClick={() => onNavigateBookmark("prev")}
              disabled={!canNavigatePrev}
              aria-label="Previous bookmark"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => onNavigateBookmark("next")}
              disabled={!canNavigateNext}
              aria-label="Next bookmark"
            >
              Next
            </button>
            <span>↑ ↓ or J K</span>
          </div>
          <div className="bookmark-modal-actions">
            {rawContent && (
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(rawContent);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1600);
                }}
              >
                {copied ? "Copied" : "Copy notes"}
              </button>
            )}
            <a href={bookmark.url} target="_blank" rel="noopener noreferrer">
              Visit source <span aria-hidden="true">↗</span>
            </a>
          </div>
        </footer>
      </dialog>
    </div>
  );
}
