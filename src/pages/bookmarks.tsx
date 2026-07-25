import React, { useState } from "react";
import {
  getBookmarkFacets,
  getBookmarksPage,
  searchBookmarksPage,
  type BookmarkFacets,
  type BookmarkLight,
  type SearchResult,
} from "../../lib/bookmarks-api";
import { BookmarkModal, type ModalType } from "../components/bookmark-modal";

type SortOption = "analyzed" | "published" | "rating" | "alpha";
type Audience = "mcp" | "founder" | "investor";

const PAGE_SIZE = 10;

const AUDIENCES: Record<Audience, { label: string; tag: string }> = {
  mcp: { label: "MCP developers", tag: "persona:mcp_developer" },
  founder: { label: "Founders", tag: "persona:startup_founder" },
  investor: { label: "Investors", tag: "persona:vc_investor" },
};

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    year: "numeric",
  }).format(date);
}

function displayTag(tag: string): string {
  return tag
    .replace(/^(tech:|type:|category:|persona:)/, "")
    .replaceAll("_", " ");
}

function Rating({ value }: { value: number | null }) {
  if (!value) return <span className="bookmark-rating-empty">Not rated</span>;
  return (
    <span className="bookmark-rating" aria-label={`${value} out of 5 stars`}>
      <span aria-hidden="true">{"★".repeat(value)}</span>
      <span className="bookmark-rating-max" aria-hidden="true">
        {"★".repeat(5 - value)}
      </span>
    </span>
  );
}

function FilterGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? options : options.slice(0, 8);

  if (options.length === 0) return null;

  return (
    <fieldset className="bookmark-filter-group">
      <legend>{label}</legend>
      <div className="bookmark-filter-options">
        {visible.map((option) => {
          const active = option === value;
          return (
            <button
              key={option}
              type="button"
              className="bookmark-filter-option"
              aria-pressed={active}
              onClick={() => onChange(active ? null : option)}
            >
              {displayTag(option)}
            </button>
          );
        })}
        {options.length > 8 && (
          <button
            type="button"
            className="bookmark-filter-more"
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? "Show fewer" : `Show ${options.length - 8} more`}
          </button>
        )}
      </div>
    </fieldset>
  );
}

export function Bookmarks() {
  const [bookmarks, setBookmarks] = useState<BookmarkLight[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [facets, setFacets] = useState<BookmarkFacets>({
    total: 0,
    average_rating: 0,
    tags: [],
    platforms: [],
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(
    null,
  );
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [audience, setAudience] = useState<Audience | null>(null);
  const [tech, setTech] = useState<string | null>(null);
  const [contentType, setContentType] = useState<string | null>(null);
  const [platform, setPlatform] = useState<string | null>(null);
  const [minimumRating, setMinimumRating] = useState<number | null>(null);
  const [sort, setSort] = useState<SortOption>("analyzed");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [modalState, setModalState] = useState<{
    url: string;
    tab: ModalType;
  } | null>(null);

  const selectedTags = [
    audience ? AUDIENCES[audience].tag : null,
    tech,
    contentType,
  ].filter((tag): tag is string => Boolean(tag));
  const selectedTagsKey = selectedTags.join("\u0000");
  const technologyFacets = facets.tags.filter((tag) => tag.startsWith("tech:"));
  const typeFacets = facets.tags.filter((tag) => tag.startsWith("type:"));
  const apiSort = {
    analyzed: "recent",
    published: "published",
    rating: "rating",
    alpha: "title",
  }[sort] as "recent" | "published" | "rating" | "title";

  React.useEffect(() => {
    void loadAttempt;
    const controller = new AbortController();
    getBookmarkFacets({ signal: controller.signal })
      .then(setFacets)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error("Bookmark facets failed", error);
        }
      });
    return () => controller.abort();
  }, [loadAttempt]);

  React.useEffect(() => {
    setPage(0);
  }, [audience, contentType, minimumRating, platform, query, sort, tech]);

  React.useEffect(() => {
    const trimmedQuery = query.trim();
    const controller = new AbortController();
    const delay = trimmedQuery.length >= 3 ? 250 : 0;
    setLoading(page === 0);
    setSearching(trimmedQuery.length >= 3);
    setLoadError(null);
    setSearchError(null);

    const timeout = window.setTimeout(() => {
      const options = {
        signal: controller.signal,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        tags: selectedTagsKey ? selectedTagsKey.split("\u0000") : [],
        platform,
        minStars: minimumRating,
        sort: apiSort,
      };
      const request =
        trimmedQuery.length >= 3
          ? searchBookmarksPage(trimmedQuery, options)
          : getBookmarksPage(options);

      request
        .then((result) => {
          if ("results" in result) {
            setSearchResults(result.results);
            setBookmarks(result.results.map((entry) => entry.bookmark));
          } else {
            setSearchResults(null);
            setBookmarks(result.bookmarks);
          }
          setTotal(result.total);
          setSelectedIndex(null);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError")
            return;
          const message =
            error instanceof Error
              ? error.message
              : "Bookmarks could not be loaded.";
          if (trimmedQuery.length >= 3) setSearchError(message);
          else setLoadError(message);
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false);
            setSearching(false);
          }
        });
    }, delay);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [
    apiSort,
    loadAttempt,
    minimumRating,
    page,
    platform,
    query,
    selectedTagsKey,
  ]);

  const filtered = bookmarks;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstVisible = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const lastVisible = Math.min(total, page * PAGE_SIZE + filtered.length);

  React.useEffect(() => {
    setSelectedIndex((current) => {
      if (filtered.length === 0) return null;
      if (current === null) return null;
      return Math.min(current, filtered.length - 1);
    });
  }, [filtered.length]);

  const activeFilterCount = [
    audience,
    tech,
    contentType,
    platform,
    minimumRating,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setAudience(null);
    setTech(null);
    setContentType(null);
    setPlatform(null);
    setMinimumRating(null);
  };

  const removeFilter = (filter: string) => {
    if (filter === "audience") setAudience(null);
    if (filter === "tech") setTech(null);
    if (filter === "contentType") setContentType(null);
    if (filter === "platform") setPlatform(null);
    if (filter === "minimumRating") setMinimumRating(null);
  };

  const openModal = (bookmark: BookmarkLight, tab: ModalType = "dev") => {
    setModalState({ url: bookmark.url, tab });
  };

  const modalBookmark = modalState
    ? bookmarks.find((bookmark) => bookmark.url === modalState.url) ||
      filtered.find((bookmark) => bookmark.url === modalState.url)
    : null;

  const moveSelection = (nextIndex: number) => {
    if (filtered.length === 0) return;
    const boundedIndex = Math.max(0, Math.min(nextIndex, filtered.length - 1));
    setSelectedIndex(boundedIndex);
    document
      .getElementById(`bookmark-row-${boundedIndex}`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  const handleListKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const key = event.key.toLowerCase();
    const current = selectedIndex ?? -1;
    if (key === "arrowdown" || key === "j") {
      event.preventDefault();
      moveSelection(current + 1);
    } else if (key === "arrowup" || key === "k") {
      event.preventDefault();
      moveSelection(current <= 0 ? 0 : current - 1);
    } else if (key === "enter" && selectedIndex !== null) {
      event.preventDefault();
      const bookmark = filtered[selectedIndex];
      if (bookmark) openModal(bookmark);
    } else if (key === "escape") {
      setSelectedIndex(null);
    }
  };

  if (loading) {
    return (
      <main className="container bookmarks-page" aria-busy="true">
        <div className="bookmarks-loading-heading" />
        <div className="bookmarks-loading-search" />
        <div className="bookmarks-loading-rows">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="bookmarks-loading-row" />
          ))}
        </div>
        <span className="sr-only">Loading bookmarks</span>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="container bookmarks-page">
        <section className="bookmarks-state" role="alert">
          <h1>Bookmarks are unavailable</h1>
          <p>{loadError}</p>
          <button
            type="button"
            onClick={() => setLoadAttempt((value) => value + 1)}
          >
            Try again
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="container bookmarks-page">
      <header className="bookmarks-intro">
        <h1>Bookmarks</h1>
        <p>
          A researched library of useful writing, tools, and ideas for building
          with AI.
        </p>
        <div className="bookmarks-stats" aria-label="Library statistics">
          <span>{facets.total} links</span>
          <span>{technologyFacets.length} technologies</span>
          {facets.average_rating > 0 && (
            <span>{facets.average_rating.toFixed(1)} average rating</span>
          )}
        </div>
      </header>

      <section className="bookmarks-discovery" aria-label="Find bookmarks">
        <label className="bookmark-search">
          <span className="sr-only">Search bookmarks</span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m16 16 4 4" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search titles, topics, research, and notes"
            autoComplete="off"
          />
          {searching && (
            <span className="bookmark-search-status">Searching…</span>
          )}
        </label>

        <div className="bookmarks-toolbar">
          <details className="bookmark-filters">
            <summary>
              Filters
              {activeFilterCount > 0 && (
                <span aria-label={`${activeFilterCount} active filters`}>
                  {activeFilterCount}
                </span>
              )}
            </summary>
            <div className="bookmark-filter-panel">
              <fieldset className="bookmark-filter-group">
                <legend>Audience</legend>
                <div className="bookmark-filter-options">
                  {(
                    Object.entries(AUDIENCES) as [
                      Audience,
                      (typeof AUDIENCES)[Audience],
                    ][]
                  ).map(([key, item]) => (
                    <button
                      key={key}
                      type="button"
                      className="bookmark-filter-option"
                      aria-pressed={audience === key}
                      onClick={() => setAudience(audience === key ? null : key)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <FilterGroup
                label="Technology"
                options={technologyFacets}
                value={tech}
                onChange={setTech}
              />
              <FilterGroup
                label="Format"
                options={typeFacets}
                value={contentType}
                onChange={setContentType}
              />
              <FilterGroup
                label="Source"
                options={facets.platforms}
                value={platform}
                onChange={setPlatform}
              />
              <fieldset className="bookmark-filter-group">
                <legend>Minimum rating</legend>
                <div className="bookmark-filter-options">
                  {[3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      className="bookmark-filter-option"
                      aria-pressed={minimumRating === rating}
                      onClick={() =>
                        setMinimumRating(
                          minimumRating === rating ? null : rating,
                        )
                      }
                    >
                      {rating}+ stars
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          </details>

          <label className="bookmark-sort">
            <span>Sort by</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortOption)}
            >
              <option value="analyzed">Recently analyzed</option>
              <option value="published">Recently published</option>
              <option value="rating">Highest rated</option>
              <option value="alpha">Title A–Z</option>
            </select>
          </label>
        </div>

        {activeFilterCount > 0 && (
          <div className="bookmark-active-filters" aria-label="Active filters">
            <span>Filtered by</span>
            {audience && (
              <button type="button" onClick={() => removeFilter("audience")}>
                {AUDIENCES[audience].label} <span aria-hidden="true">×</span>
              </button>
            )}
            {tech && (
              <button type="button" onClick={() => removeFilter("tech")}>
                {displayTag(tech)} <span aria-hidden="true">×</span>
              </button>
            )}
            {contentType && (
              <button type="button" onClick={() => removeFilter("contentType")}>
                {displayTag(contentType)} <span aria-hidden="true">×</span>
              </button>
            )}
            {platform && (
              <button type="button" onClick={() => removeFilter("platform")}>
                {platform} <span aria-hidden="true">×</span>
              </button>
            )}
            {minimumRating && (
              <button
                type="button"
                onClick={() => removeFilter("minimumRating")}
              >
                {minimumRating}+ stars <span aria-hidden="true">×</span>
              </button>
            )}
            <button
              type="button"
              className="bookmark-clear"
              onClick={clearFilters}
            >
              Clear all
            </button>
          </div>
        )}

        <div className="bookmark-results-meta" aria-live="polite">
          <span>
            Showing {firstVisible}–{lastVisible} of {total} bookmarks
            {query.trim() ? ` for “${query.trim()}”` : ""}
          </span>
          <button
            type="button"
            className="bookmark-keyboard-hint"
            onKeyDown={handleListKeyDown}
            onFocus={() => {
              if (selectedIndex === null && filtered.length > 0)
                setSelectedIndex(0);
            }}
          >
            Keyboard: ↑ ↓ or J K; Enter opens notes
          </button>
        </div>
        {searchError && (
          <output className="bookmark-inline-error">
            Full-text search is temporarily unavailable. Try again shortly.
          </output>
        )}
      </section>

      {filtered.length > 0 ? (
        <>
          <ul className="bookmark-list" aria-label="Bookmarks">
            {filtered.map((bookmark, index) => {
              const selected = index === selectedIndex;
              const published = formatDate(bookmark.published_at);
              const analyzed = formatDate(bookmark.classified_at);
              const result = searchResults?.find(
                (candidate) => candidate.bookmark.url === bookmark.url,
              );

              return (
                <li
                  id={`bookmark-row-${index}`}
                  key={bookmark.url}
                  className="bookmark-row"
                  data-selected={selected}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <button
                    type="button"
                    className="bookmark-row-main"
                    onClick={() => openModal(bookmark)}
                    aria-label={`Open notes for ${bookmark.title || bookmark.url}`}
                  >
                    <span className="bookmark-row-source">
                      {getHostname(bookmark.url)}
                    </span>
                    <span className="bookmark-row-title">
                      {bookmark.title || bookmark.url}
                    </span>
                    {bookmark.description && (
                      <span className="bookmark-row-description">
                        {bookmark.description}
                      </span>
                    )}
                    <span className="bookmark-row-tags">
                      {bookmark.tags
                        .filter(
                          (tag) =>
                            tag.startsWith("tech:") || tag.startsWith("type:"),
                        )
                        .slice(0, 3)
                        .map((tag) => (
                          <span key={tag}>{displayTag(tag)}</span>
                        ))}
                      {result && (
                        <>
                          {result.matches.research && (
                            <span>research match</span>
                          )}
                          {result.matches.insight && <span>notes match</span>}
                          {result.matches.content && <span>content match</span>}
                        </>
                      )}
                    </span>
                  </button>
                  <div className="bookmark-row-aside">
                    <Rating value={bookmark.stars} />
                    <span className="bookmark-row-date">
                      {published
                        ? `Published ${published}`
                        : analyzed
                          ? `Analyzed ${analyzed}`
                          : ""}
                    </span>
                    <a
                      href={bookmark.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open ${bookmark.title || bookmark.url} in a new tab`}
                    >
                      Visit source <span aria-hidden="true">↗</span>
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
          <nav className="bookmark-pagination" aria-label="Bookmark pages">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              ← Previous
            </button>
            <span>
              Page {page + 1} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page + 1 >= totalPages}
              onClick={() =>
                setPage((current) => Math.min(totalPages - 1, current + 1))
              }
            >
              Next →
            </button>
          </nav>
        </>
      ) : (
        <section className="bookmarks-state bookmarks-empty">
          <h2>No bookmarks found</h2>
          <p>Try a broader search or remove one of the active filters.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              clearFilters();
            }}
          >
            Reset search and filters
          </button>
        </section>
      )}

      {modalBookmark && modalState && (
        <BookmarkModal
          bookmark={modalBookmark}
          initialTab={modalState.tab}
          onClose={() => setModalState(null)}
          onNavigateBookmark={(direction) => {
            const currentIndex = filtered.findIndex(
              (bookmark) => bookmark.url === modalBookmark.url,
            );
            const nextIndex =
              direction === "next" ? currentIndex + 1 : currentIndex - 1;
            const nextBookmark = filtered[nextIndex];
            if (!nextBookmark) return;
            setSelectedIndex(nextIndex);
            setModalState({ url: nextBookmark.url, tab: modalState.tab });
          }}
          canNavigatePrev={
            filtered.findIndex(
              (bookmark) => bookmark.url === modalBookmark.url,
            ) > 0
          }
          canNavigateNext={
            filtered.findIndex(
              (bookmark) => bookmark.url === modalBookmark.url,
            ) <
            filtered.length - 1
          }
        />
      )}
    </main>
  );
}
