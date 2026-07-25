import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

type JsonRecord = Record<string, unknown>;
type CallTool = <T>(name: string, args?: Record<string, unknown>) => Promise<T>;

interface BookmarksViewProps {
  activeTool?: string;
  result: JsonRecord;
  loading: boolean;
  error?: string;
  callTool: CallTool;
}

type DetailTab = "overview" | "research" | "content" | "personas";
type Operation = "creating" | "searching" | "loading" | "deleting" | null;

const PERSONAS = [
  {
    tag: "persona:mcp_developer",
    label: "MCP Developer",
    field: "insight_dev",
  },
  {
    tag: "persona:startup_founder",
    label: "Startup Founder",
    field: "insight_founder",
  },
  {
    tag: "persona:vc_investor",
    label: "VC Investor",
    field: "insight_investor",
  },
] as const;

const BOOKMARK_TOOL_NAMES = new Set([
  "LIST_BOOKMARKS",
  "LIST_ALL_BOOKMARKS",
  "SEARCH_BOOKMARKS",
  "SEARCH_ALL_BOOKMARKS",
  "GET_BOOKMARK",
  "GET_BOOKMARK_ADMIN",
  "CREATE_BOOKMARK",
  "UPDATE_BOOKMARK",
  "DELETE_BOOKMARK",
  "ENRICH_BOOKMARK",
]);

export function isBookmarkTool(name?: string): boolean {
  return Boolean(name && BOOKMARK_TOOL_NAMES.has(name));
}

export function BookmarksView({
  activeTool,
  result,
  loading,
  error,
  callTool,
}: BookmarksViewProps) {
  const [bookmarks, setBookmarks] = useState<JsonRecord[]>([]);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<JsonRecord | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [personaFilter, setPersonaFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [ratingFilter, setRatingFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [operation, setOperation] = useState<Operation>(null);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const detailRequest = useRef(0);

  useEffect(() => {
    if (
      activeTool === "LIST_ALL_BOOKMARKS" &&
      Array.isArray(result.bookmarks)
    ) {
      const next = asRecords(result.bookmarks).map(normalizeBookmark);
      setBookmarks(next);
      setSearchMode(false);
      setSelectedUrl((current) =>
        current && next.some((bookmark) => urlOf(bookmark) === current)
          ? current
          : null,
      );
    }

    if (
      activeTool === "SEARCH_ALL_BOOKMARKS" &&
      Array.isArray(result.results)
    ) {
      setBookmarks(
        asRecords(result.results)
          .map((entry) => normalizeBookmark(entry.bookmark))
          .filter((bookmark) => Boolean(urlOf(bookmark))),
      );
      setSearchMode(true);
    }

    if (
      (activeTool === "GET_BOOKMARK_ADMIN" ||
        activeTool === "CREATE_BOOKMARK" ||
        activeTool === "UPDATE_BOOKMARK" ||
        activeTool === "ENRICH_BOOKMARK") &&
      isRecord(result.bookmark)
    ) {
      const bookmark = normalizeBookmark(result.bookmark);
      const url = urlOf(bookmark);
      if (url) {
        setSelectedUrl(url);
        setSelectedDetail(bookmark);
        setBookmarks((current) => upsertBookmark(current, bookmark));
      }
    }
  }, [activeTool, result]);

  const filterData = useMemo(() => {
    const tags = new Set<string>();
    const statuses = new Set<string>();
    for (const bookmark of bookmarks) {
      for (const tag of tagsOf(bookmark)) {
        if (!tag.startsWith("persona:")) tags.add(tag);
      }
      statuses.add(statusOf(bookmark));
    }
    return {
      tags: [...tags].sort(),
      statuses: [...statuses].sort(),
    };
  }, [bookmarks]);

  const filtered = useMemo(
    () =>
      bookmarks.filter((bookmark) => {
        const tags = tagsOf(bookmark);
        if (statusFilter && statusOf(bookmark) !== statusFilter) return false;
        if (personaFilter && !tags.includes(personaFilter)) return false;
        if (tagFilter && !tags.includes(tagFilter)) return false;
        if (
          ratingFilter &&
          ratingOf(bookmark) < Number.parseInt(ratingFilter, 10)
        ) {
          return false;
        }
        return true;
      }),
    [bookmarks, personaFilter, ratingFilter, statusFilter, tagFilter],
  );

  const selected =
    selectedDetail && urlOf(selectedDetail) === selectedUrl
      ? selectedDetail
      : (bookmarks.find((bookmark) => urlOf(bookmark) === selectedUrl) ?? null);

  const activeFilterCount = [
    statusFilter,
    personaFilter,
    tagFilter,
    ratingFilter,
  ].filter(Boolean).length;

  const clearMessages = () => {
    setActionError("");
    setNotice("");
  };

  const loadList = async () => {
    clearMessages();
    setOperation("loading");
    try {
      const response = await callTool<{ bookmarks?: unknown[] }>(
        "LIST_ALL_BOOKMARKS",
      );
      const next = asRecords(response.bookmarks).map(normalizeBookmark);
      setBookmarks(next);
      setSearchMode(false);
      setQuery("");
      setSelectedUrl((current) =>
        current && next.some((bookmark) => urlOf(bookmark) === current)
          ? current
          : null,
      );
    } catch (requestError) {
      setActionError(messageOf(requestError));
    } finally {
      setOperation(null);
    }
  };

  const search = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      await loadList();
      return;
    }

    clearMessages();
    setOperation("searching");
    try {
      const response = await callTool<{ results?: unknown[] }>(
        "SEARCH_ALL_BOOKMARKS",
        { query: trimmed },
      );
      const next = asRecords(response.results)
        .map((entry) => normalizeBookmark(entry.bookmark))
        .filter((bookmark) => Boolean(urlOf(bookmark)));
      setBookmarks(next);
      setSearchMode(true);
      setSelectedUrl(null);
      setSelectedDetail(null);
      setNotice(
        `${next.length} result${next.length === 1 ? "" : "s"} for “${trimmed}”.`,
      );
    } catch (requestError) {
      setActionError(messageOf(requestError));
    } finally {
      setOperation(null);
    }
  };

  const openBookmark = async (bookmark: JsonRecord) => {
    const url = urlOf(bookmark);
    if (!url) return;
    const requestId = detailRequest.current + 1;
    detailRequest.current = requestId;
    clearMessages();
    setSelectedUrl(url);
    setSelectedDetail(null);
    setActiveTab("overview");
    setOperation("loading");
    try {
      const response = await callTool<{ bookmark?: unknown }>(
        "GET_BOOKMARK_ADMIN",
        { url },
      );
      if (requestId !== detailRequest.current) return;
      const detail = normalizeBookmark(response.bookmark);
      if (urlOf(detail)) {
        setSelectedDetail(detail);
        setBookmarks((current) => upsertBookmark(current, detail));
      }
    } catch (requestError) {
      if (requestId === detailRequest.current) {
        setActionError(messageOf(requestError));
      }
    } finally {
      if (requestId === detailRequest.current) setOperation(null);
    }
  };

  const createBookmark = async (event: FormEvent) => {
    event.preventDefault();
    clearMessages();
    const url = validHttpUrl(newUrl);
    if (!url) {
      setActionError("Enter a complete http or https URL.");
      return;
    }

    setOperation("creating");
    try {
      const response = await callTool<{ bookmark?: unknown }>(
        "CREATE_BOOKMARK",
        { url },
      );
      const created = normalizeBookmark(response.bookmark);
      if (urlOf(created)) {
        setBookmarks((current) => upsertBookmark(current, created, true));
        setSelectedUrl(urlOf(created));
        setSelectedDetail(created);
        setActiveTab("overview");
      }
      setNewUrl("");
      setCreateOpen(false);
      setNotice("Bookmark saved. Enrichment runs only when you request it.");
    } catch (requestError) {
      setActionError(messageOf(requestError));
    } finally {
      setOperation(null);
    }
  };

  const saveBookmark = async (url: string, fields: Record<string, unknown>) => {
    clearMessages();
    try {
      const response = await callTool<{ bookmark?: unknown }>(
        "UPDATE_BOOKMARK",
        { url, ...fields },
      );
      const updated = normalizeBookmark(response.bookmark);
      if (urlOf(updated)) {
        setBookmarks((current) => upsertBookmark(current, updated));
        setSelectedDetail(updated);
      }
      setNotice("Changes saved.");
    } catch (requestError) {
      setActionError(messageOf(requestError));
      throw requestError;
    }
  };

  const deleteBookmark = async (url: string) => {
    clearMessages();
    setOperation("deleting");
    try {
      await callTool("DELETE_BOOKMARK", { url });
      setBookmarks((current) =>
        current.filter((bookmark) => urlOf(bookmark) !== url),
      );
      setSelectedUrl(null);
      setSelectedDetail(null);
      setNotice("Bookmark deleted.");
    } catch (requestError) {
      setActionError(messageOf(requestError));
    } finally {
      setOperation(null);
    }
  };

  const enrichBookmark = async (
    url: string,
    steps: { research: boolean; content: boolean; analysis: boolean },
  ) => {
    clearMessages();
    try {
      const response = await callTool<{ bookmark?: unknown }>(
        "ENRICH_BOOKMARK",
        {
          url,
          run_research: steps.research,
          run_content: steps.content,
          run_analysis: steps.analysis,
        },
      );
      const enriched = normalizeBookmark(response.bookmark);
      if (urlOf(enriched)) {
        setBookmarks((current) => upsertBookmark(current, enriched));
        setSelectedDetail(enriched);
      }
      setNotice("Selected enrichment steps completed.");
    } catch (requestError) {
      setActionError(messageOf(requestError));
      throw requestError;
    }
  };

  const resetFilters = () => {
    setStatusFilter("");
    setPersonaFilter("");
    setTagFilter("");
    setRatingFilter("");
  };

  const busy = loading || operation !== null;
  const visibleError = actionError || error || "";

  return (
    <section className="bookmarks-view" aria-labelledby="bookmarks-title">
      <header className="bookmarks-header">
        <div>
          <h1 id="bookmarks-title">Bookmarks</h1>
          <p>Search, review, and enrich your private reading library.</p>
        </div>
        <button
          type="button"
          className="bookmark-primary"
          aria-expanded={createOpen}
          onClick={() => {
            clearMessages();
            setCreateOpen((current) => !current);
          }}
        >
          {createOpen ? "Cancel" : "Add bookmark"}
        </button>
      </header>

      {createOpen && (
        <form className="bookmark-create" onSubmit={createBookmark}>
          <label htmlFor="bookmark-new-url">Bookmark URL</label>
          <div>
            <input
              id="bookmark-new-url"
              type="url"
              inputMode="url"
              autoComplete="url"
              placeholder="https://example.com/article"
              value={newUrl}
              onChange={(event) => setNewUrl(event.target.value)}
              disabled={operation === "creating"}
              required
            />
            <button type="submit" disabled={operation === "creating"}>
              {operation === "creating" ? "Saving…" : "Save URL"}
            </button>
          </div>
          <p>Content and analysis are added separately from the inspector.</p>
        </form>
      )}

      <div className="bookmark-toolbar">
        <form className="bookmark-search" onSubmit={search}>
          <label className="sr-only" htmlFor="bookmark-search">
            Search bookmarks
          </label>
          <input
            id="bookmark-search"
            type="search"
            placeholder="Search title, URL, research, and insights"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="submit" disabled={operation === "searching"}>
            {operation === "searching" ? "Searching…" : "Search"}
          </button>
          {searchMode && (
            <button
              type="button"
              className="bookmark-quiet"
              onClick={() => void loadList()}
            >
              Clear
            </button>
          )}
        </form>
        <button
          type="button"
          className={`bookmark-filter-toggle ${
            activeFilterCount > 0 ? "active" : ""
          }`}
          aria-expanded={filtersOpen}
          aria-controls="bookmark-filters"
          onClick={() => setFiltersOpen((current) => !current)}
        >
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </button>
      </div>

      {filtersOpen && (
        <div className="bookmark-filters" id="bookmark-filters">
          <label>
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">Any status</option>
              {filterData.statuses.map((status) => (
                <option key={status} value={status}>
                  {titleCase(status)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Persona</span>
            <select
              value={personaFilter}
              onChange={(event) => setPersonaFilter(event.target.value)}
            >
              <option value="">Any persona</option>
              {PERSONAS.map((persona) => (
                <option key={persona.tag} value={persona.tag}>
                  {persona.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Tag or type</span>
            <select
              value={tagFilter}
              onChange={(event) => setTagFilter(event.target.value)}
            >
              <option value="">Any tag or type</option>
              {filterData.tags.map((tag) => (
                <option key={tag} value={tag}>
                  {tagLabel(tag)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Minimum rating</span>
            <select
              value={ratingFilter}
              onChange={(event) => setRatingFilter(event.target.value)}
            >
              <option value="">Any rating</option>
              {[1, 2, 3, 4, 5].map((rating) => (
                <option key={rating} value={rating}>
                  {rating} and up
                </option>
              ))}
            </select>
          </label>
          {activeFilterCount > 0 && (
            <button
              type="button"
              className="bookmark-quiet"
              onClick={resetFilters}
            >
              Reset filters
            </button>
          )}
        </div>
      )}

      <div className="bookmark-feedback" aria-live="polite">
        <span>
          {bookmarks.length === 0
            ? "No bookmarks loaded"
            : `${filtered.length} of ${bookmarks.length} bookmark${
                bookmarks.length === 1 ? "" : "s"
              }`}
        </span>
        {busy && <span className="bookmark-working">Working…</span>}
        {notice && <span className="bookmark-notice">{notice}</span>}
      </div>

      {visibleError && (
        <div className="bookmark-error" role="alert">
          <strong>Couldn’t complete that request.</strong>
          <span>{stripErrorPrefix(visibleError)}</span>
        </div>
      )}

      {bookmarks.length === 0 && loading ? (
        <BookmarkSkeleton />
      ) : (
        <div className="bookmark-workspace">
          <div className="bookmark-list-pane">
            {filtered.length === 0 ? (
              <div className="bookmark-empty">
                <strong>
                  {searchMode ? "No search results" : "No bookmarks match"}
                </strong>
                <p>
                  {searchMode
                    ? "Try a broader query or return to the full library."
                    : activeFilterCount > 0
                      ? "Reset filters to see the full library."
                      : "Add a URL to begin your private library."}
                </p>
                {(searchMode || activeFilterCount > 0) && (
                  <button
                    type="button"
                    onClick={() =>
                      searchMode ? void loadList() : resetFilters()
                    }
                  >
                    {searchMode ? "Show all bookmarks" : "Reset filters"}
                  </button>
                )}
              </div>
            ) : (
              <ol className="bookmark-list" aria-label="Bookmarks">
                {filtered.map((bookmark) => {
                  const url = urlOf(bookmark);
                  const selectedRow = selectedUrl === url;
                  const matches = matchSummary(bookmark);
                  return (
                    <li key={url}>
                      <button
                        type="button"
                        className={selectedRow ? "selected" : ""}
                        aria-current={selectedRow ? "true" : undefined}
                        onClick={() => void openBookmark(bookmark)}
                      >
                        <span className="bookmark-row-main">
                          <strong>
                            {text(bookmark.title) || hostname(url)}
                          </strong>
                          <span>{text(bookmark.description) || url}</span>
                        </span>
                        <span className="bookmark-row-meta">
                          <span
                            className={`bookmark-status ${statusOf(bookmark)}`}
                          >
                            {titleCase(statusOf(bookmark))}
                          </span>
                          <span>
                            {ratingOf(bookmark)
                              ? `${ratingOf(bookmark)}/5`
                              : "Unrated"}
                          </span>
                        </span>
                        {tagsOf(bookmark).length > 0 && (
                          <span className="bookmark-row-tags">
                            {tagsOf(bookmark)
                              .slice(0, 3)
                              .map((tag) => (
                                <span key={tag}>{tagLabel(tag)}</span>
                              ))}
                            {tagsOf(bookmark).length > 3 && (
                              <span>+{tagsOf(bookmark).length - 3}</span>
                            )}
                          </span>
                        )}
                        {matches && (
                          <span className="bookmark-match">{matches}</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          <div className="bookmark-inspector-pane">
            {selected ? (
              <BookmarkInspector
                bookmark={selected}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                loadingDetail={operation === "loading" && loading}
                deleting={operation === "deleting"}
                onSave={saveBookmark}
                onDelete={deleteBookmark}
                onEnrich={enrichBookmark}
              />
            ) : (
              <div className="bookmark-inspector-empty">
                <strong>Select a bookmark</strong>
                <p>
                  Its metadata, source content, research, and persona insights
                  will appear here.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function BookmarkInspector({
  bookmark,
  activeTab,
  setActiveTab,
  loadingDetail,
  deleting,
  onSave,
  onDelete,
  onEnrich,
}: {
  bookmark: JsonRecord;
  activeTab: DetailTab;
  setActiveTab: (tab: DetailTab) => void;
  loadingDetail: boolean;
  deleting: boolean;
  onSave: (url: string, fields: Record<string, unknown>) => Promise<void>;
  onDelete: (url: string) => Promise<void>;
  onEnrich: (
    url: string,
    steps: { research: boolean; content: boolean; analysis: boolean },
  ) => Promise<void>;
}) {
  const url = urlOf(bookmark);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const [rating, setRating] = useState("");
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [enrichOpen, setEnrichOpen] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState("");
  const [steps, setSteps] = useState({
    research: true,
    content: true,
    analysis: true,
  });

  useEffect(() => {
    setTitle(text(bookmark.title));
    setDescription(text(bookmark.description));
    setNotes(text(bookmark.notes));
    setTags(tagsOf(bookmark).join(", "));
    setRating(ratingOf(bookmark) ? String(ratingOf(bookmark)) : "");
    setSaveState((current) => (current === "saving" ? current : "idle"));
    setDeleteConfirm(false);
    setEnrichOpen(false);
    setEnrichError("");
  }, [bookmark]);

  const markEdited = () => setSaveState("idle");

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaveState("saving");
    try {
      await onSave(url, {
        title: title.trim() || null,
        description: description.trim() || null,
        notes: notes.trim() || null,
        stars: rating ? Number.parseInt(rating, 10) : null,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      });
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };

  const enrich = async () => {
    if (!steps.research && !steps.content && !steps.analysis) {
      setEnrichError("Select at least one enrichment step.");
      return;
    }
    setEnrichError("");
    setEnriching(true);
    try {
      await onEnrich(url, steps);
      setEnrichOpen(false);
    } catch (requestError) {
      setEnrichError(stripErrorPrefix(messageOf(requestError)));
    } finally {
      setEnriching(false);
    }
  };

  const tabs: Array<{ id: DetailTab; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "research", label: "Research" },
    { id: "content", label: "Content" },
    { id: "personas", label: "Personas" },
  ];

  return (
    <article
      className="bookmark-inspector"
      aria-labelledby="bookmark-detail-title"
    >
      <header className="bookmark-detail-header">
        <div>
          <span className={`bookmark-status ${statusOf(bookmark)}`}>
            {titleCase(statusOf(bookmark))}
          </span>
          <h2 id="bookmark-detail-title">
            {text(bookmark.title) || hostname(url)}
          </h2>
          <a href={url} target="_blank" rel="noopener noreferrer" title={url}>
            {url} <span aria-hidden="true">↗</span>
          </a>
        </div>
        <button
          type="button"
          className="bookmark-enrich-button"
          aria-expanded={enrichOpen}
          onClick={() => {
            setEnrichOpen((current) => !current);
            setEnrichError("");
          }}
        >
          {enrichOpen ? "Close enrich" : "Enrich"}
        </button>
      </header>

      {loadingDetail && (
        <output className="bookmark-detail-loading">
          Loading complete bookmark…
        </output>
      )}

      {enrichOpen && (
        <section className="bookmark-enrich" aria-label="Enrich bookmark">
          <div>
            <strong>Choose enrichment steps</strong>
            <p>Runs only the steps selected below for this bookmark.</p>
          </div>
          <fieldset disabled={enriching}>
            <legend className="sr-only">Enrichment steps</legend>
            {(
              [
                ["research", "Research"],
                ["content", "Page content"],
                ["analysis", "Persona analysis"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={steps[key]}
                  onChange={(event) =>
                    setSteps((current) => ({
                      ...current,
                      [key]: event.target.checked,
                    }))
                  }
                />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
          {enriching && (
            <div className="bookmark-enrich-progress">
              <progress aria-label="Running selected enrichment steps" />
              <p>
                Running{" "}
                {Object.entries(steps)
                  .filter(([, enabled]) => enabled)
                  .map(([step]) => step)
                  .join(" → ")}
                …
              </p>
            </div>
          )}
          {enrichError && (
            <p className="bookmark-inline-error" role="alert">
              {enrichError}
            </p>
          )}
          <button
            type="button"
            className="bookmark-primary"
            onClick={() => void enrich()}
            disabled={enriching}
          >
            {enriching ? "Enriching…" : "Run selected steps"}
          </button>
        </section>
      )}

      <div
        className="bookmark-tabs"
        role="tablist"
        aria-label="Bookmark detail"
      >
        {tabs.map((tab) => (
          <button
            type="button"
            role="tab"
            id={`bookmark-tab-${tab.id}`}
            aria-controls={`bookmark-panel-${tab.id}`}
            aria-selected={activeTab === tab.id}
            tabIndex={activeTab === tab.id ? 0 : -1}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`bookmark-panel-${activeTab}`}
        aria-labelledby={`bookmark-tab-${activeTab}`}
        className="bookmark-tab-panel"
      >
        {activeTab === "overview" && (
          <form className="bookmark-edit-form" onSubmit={save}>
            <label>
              <span>Title</span>
              <input
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  markEdited();
                }}
              />
            </label>
            <label>
              <span>URL</span>
              <input value={url} readOnly aria-readonly="true" />
            </label>
            <label>
              <span>Description</span>
              <textarea
                rows={4}
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                  markEdited();
                }}
              />
            </label>
            <div className="bookmark-form-row">
              <label>
                <span>Rating</span>
                <select
                  value={rating}
                  onChange={(event) => {
                    setRating(event.target.value);
                    markEdited();
                  }}
                >
                  <option value="">Unrated</option>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <option key={value} value={value}>
                      {value} / 5
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Tags</span>
                <input
                  value={tags}
                  onChange={(event) => {
                    setTags(event.target.value);
                    markEdited();
                  }}
                  placeholder="tech:mcp, type:article"
                />
              </label>
            </div>
            <label>
              <span>Private notes</span>
              <textarea
                rows={3}
                value={notes}
                onChange={(event) => {
                  setNotes(event.target.value);
                  markEdited();
                }}
              />
            </label>
            <div className="bookmark-form-actions">
              <button
                type="submit"
                className="bookmark-primary"
                disabled={saveState === "saving"}
              >
                {saveState === "saving" ? "Saving…" : "Save changes"}
              </button>
              <span
                className={`bookmark-save-state ${saveState}`}
                aria-live="polite"
              >
                {saveState === "saved"
                  ? "Saved"
                  : saveState === "error"
                    ? "Save failed"
                    : ""}
              </span>
            </div>

            <div className="bookmark-danger-zone">
              {!deleteConfirm ? (
                <button
                  type="button"
                  className="bookmark-danger-link"
                  onClick={() => setDeleteConfirm(true)}
                >
                  Delete bookmark
                </button>
              ) : (
                <div className="bookmark-delete-confirm" role="alert">
                  <p>Delete this bookmark and its enrichment permanently?</p>
                  <div>
                    <button
                      type="button"
                      className="bookmark-quiet"
                      onClick={() => setDeleteConfirm(false)}
                      disabled={deleting}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="bookmark-danger"
                      disabled={deleting}
                      onClick={() => void onDelete(url)}
                    >
                      {deleting ? "Deleting…" : "Delete permanently"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </form>
        )}

        {activeTab === "research" && (
          <BookmarkTextSection
            title="Research"
            value={
              text(bookmark.perplexity_research) || text(bookmark.research)
            }
            empty="No research has been saved for this bookmark."
          />
        )}

        {activeTab === "content" && (
          <BookmarkTextSection
            title="Page content"
            value={text(bookmark.firecrawl_content) || text(bookmark.content)}
            empty="No extracted page content has been saved."
          />
        )}

        {activeTab === "personas" && (
          <div className="bookmark-personas">
            {PERSONAS.map((persona) => (
              <BookmarkTextSection
                key={persona.field}
                title={persona.label}
                value={personaInsight(bookmark, persona.field)}
                empty={`No ${persona.label.toLowerCase()} insight has been saved.`}
              />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function BookmarkTextSection({
  title,
  value,
  empty,
}: {
  title: string;
  value: string;
  empty: string;
}) {
  return (
    <section className="bookmark-text-section">
      <h3>{title}</h3>
      {value ? (
        <div className="bookmark-rich-text">{value}</div>
      ) : (
        <p className="bookmark-section-empty">{empty}</p>
      )}
    </section>
  );
}

function BookmarkSkeleton() {
  return (
    <output className="bookmark-skeleton" aria-label="Loading bookmarks">
      <div>
        <span />
        <span />
        <span />
      </div>
      <div>
        <span />
        <span />
        <span />
        <span />
      </div>
    </output>
  );
}

function normalizeBookmark(value: unknown): JsonRecord {
  const record = asRecord(value);
  if (isRecord(record.bookmark)) {
    return {
      ...asRecord(record.bookmark),
      _matches: asRecord(record.matches),
    };
  }
  return record;
}

function upsertBookmark(
  current: JsonRecord[],
  bookmark: JsonRecord,
  prepend = false,
): JsonRecord[] {
  const url = urlOf(bookmark);
  const index = current.findIndex((item) => urlOf(item) === url);
  if (index < 0)
    return prepend ? [bookmark, ...current] : [...current, bookmark];
  return current.map((item, itemIndex) =>
    itemIndex === index ? { ...item, ...bookmark } : item,
  );
}

function statusOf(bookmark: JsonRecord): string {
  const explicit = text(bookmark.status);
  if (explicit) return explicit.toLowerCase().replace(/\s+/g, "-");
  if (
    bookmark.classified_at ||
    text(bookmark.insight_dev) ||
    text(bookmark.insight_founder) ||
    text(bookmark.insight_investor)
  ) {
    return "enriched";
  }
  if (
    bookmark.researched_at ||
    text(bookmark.perplexity_research) ||
    text(bookmark.firecrawl_content)
  ) {
    return "researched";
  }
  return "saved";
}

function tagsOf(bookmark: JsonRecord): string[] {
  return Array.isArray(bookmark.tags)
    ? bookmark.tags.filter(
        (tag): tag is string => typeof tag === "string" && Boolean(tag),
      )
    : [];
}

function ratingOf(bookmark: JsonRecord): number {
  const value = bookmark.stars ?? bookmark.rating;
  return typeof value === "number"
    ? value
    : typeof value === "string"
      ? Number.parseInt(value, 10) || 0
      : 0;
}

function personaInsight(bookmark: JsonRecord, field: string): string {
  const direct = text(bookmark[field]);
  if (direct) return direct;
  const insights = asRecord(bookmark.persona_insights);
  const aliases: Record<string, string[]> = {
    insight_dev: ["dev", "developer", "mcp_developer"],
    insight_founder: ["founder", "startup_founder"],
    insight_investor: ["investor", "vc_investor"],
  };
  for (const alias of aliases[field] ?? []) {
    const value = text(insights[alias]);
    if (value) return value;
  }
  return "";
}

function matchSummary(bookmark: JsonRecord): string {
  const matches = asRecord(bookmark._matches);
  const labels = [
    matches.content ? "content" : "",
    matches.research ? "research" : "",
    matches.insight ? "insights" : "",
  ].filter(Boolean);
  return labels.length > 0 ? `Matched in ${labels.join(", ")}` : "";
}

function tagLabel(tag: string): string {
  const [first, ...rest] = tag.split(":");
  const namespace = first ?? tag;
  const value = rest.length > 0 ? rest.join(":") : namespace;
  const label = value.replace(/[_-]+/g, " ");
  return rest.length > 0
    ? `${titleCase(namespace)} · ${titleCase(label)}`
    : titleCase(label);
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url || "Untitled bookmark";
  }
}

function validHttpUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function urlOf(bookmark: JsonRecord): string {
  return text(bookmark.url);
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asRecord(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function asRecords(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function stripErrorPrefix(value: string): string {
  return value.replace(/^Error:\s*/i, "");
}
