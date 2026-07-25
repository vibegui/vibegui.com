import type { Env } from "./env.ts";

const MAX_PAGE_SIZE = 100;
const CONTENT_EXCERPT_CHARS = 32_000;
const MAX_CONTENT_RESPONSE_BYTES = 8 * 1024 * 1024;

/**
 * Stable repository/API contracts:
 * - list: { bookmarks: BookmarkLight[], total, limit, offset }
 * - search: { query, results: { bookmark, matches, rank }[], total }
 * - detail: BookmarkDetail (R2 Markdown is returned as firecrawl_content)
 * - stats: { total, enriched, pending, with_content, tagCounts }
 * - writes: { bookmark } or { deleted, url }
 */
export interface BookmarkLight {
  id: number;
  url: string;
  title: string | null;
  description: string | null;
  icon: string | null;
  stars: number | null;
  language: string | null;
  reading_time_min: number | null;
  classified_at: string | null;
  published_at: string | null;
  tags: string[];
}

export interface BookmarkDetail extends BookmarkLight {
  perplexity_research: string | null;
  insight_dev: string | null;
  insight_founder: string | null;
  insight_investor: string | null;
  notes: string | null;
  researched_at: string | null;
  created_at: string;
  updated_at: string;
  firecrawl_key: string | null;
  firecrawl_sha256: string | null;
  firecrawl_bytes: number | null;
  firecrawl_content: string | null;
}

export interface PublicBookmarkDetail
  extends Omit<BookmarkDetail, "notes" | "firecrawl_key"> {}

export interface BookmarkInput {
  url: string;
  title?: string | null;
  description?: string | null;
  icon?: string | null;
  stars?: number | null;
  language?: string | null;
  reading_time_min?: number | null;
  perplexity_research?: string | null;
  insight_dev?: string | null;
  insight_founder?: string | null;
  insight_investor?: string | null;
  notes?: string | null;
  researched_at?: string | null;
  classified_at?: string | null;
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
  tags?: string[];
  firecrawl_content?: string | null;
}

export interface ListBookmarksOptions {
  limit?: number;
  offset?: number;
  tags?: string[];
  platform?: string;
  minStars?: number;
  publicOnly?: boolean;
  sort?: "recent" | "published" | "rating" | "title";
}

export interface ListBookmarksResponse {
  bookmarks: BookmarkLight[];
  total: number;
  limit: number;
  offset: number;
}

export interface BookmarkMatchFlags {
  metadata: boolean;
  tags: boolean;
  research: boolean;
  insight: boolean;
  content: boolean;
}

export interface SearchBookmarksResponse {
  query: string;
  results: Array<{
    bookmark: BookmarkLight;
    matches: BookmarkMatchFlags;
    rank: number;
  }>;
  total: number;
  limit: number;
  offset: number;
}

export interface BookmarkFacets {
  total: number;
  average_rating: number;
  tags: string[];
  platforms: string[];
}

export interface BookmarkStats {
  total: number;
  enriched: number;
  pending: number;
  with_content: number;
  tags_total: number;
  tagCounts: Array<{ tag: string; count: number }>;
}

interface BookmarkRow {
  id: number;
  url: string;
  title: string | null;
  description: string | null;
  icon: string | null;
  stars: number | null;
  language: string | null;
  reading_time_min: number | null;
  perplexity_research: string | null;
  insight_dev: string | null;
  insight_founder: string | null;
  insight_investor: string | null;
  notes: string | null;
  researched_at: string | null;
  classified_at: string | null;
  published_at: string | null;
  firecrawl_key: string | null;
  firecrawl_sha256: string | null;
  firecrawl_bytes: number | null;
  content_excerpt: string;
  search_tags: string;
  insights_search: string;
  created_at: string;
  updated_at: string;
  tags_json: string;
}

interface SearchRow extends BookmarkRow {
  rank: number;
}

type SearchableBookmark = Pick<
  BookmarkRow,
  | "title"
  | "description"
  | "url"
  | "search_tags"
  | "perplexity_research"
  | "insight_dev"
  | "insight_founder"
  | "insight_investor"
  | "content_excerpt"
>;

const ROW_COLUMNS = `
  b.*,
  COALESCE(
    (SELECT json_group_array(bt.tag)
     FROM bookmark_tags bt
     WHERE bt.bookmark_id = b.id),
    '[]'
  ) AS tags_json
`;

const PLATFORM_SQL = `
  CASE
    WHEN lower(b.url) LIKE '%github.com/%' THEN 'github'
    WHEN lower(b.url) LIKE '%linkedin.com/%' THEN 'linkedin'
    WHEN lower(b.url) LIKE '%twitter.com/%' OR lower(b.url) LIKE '%x.com/%' THEN 'twitter'
    WHEN lower(b.url) LIKE '%youtube.com/%' OR lower(b.url) LIKE '%youtu.be/%' THEN 'youtube'
    WHEN lower(b.url) LIKE '%instagram.com/%' THEN 'instagram'
    WHEN lower(b.url) LIKE '%medium.com/%' THEN 'medium'
    WHEN lower(b.url) LIKE '%substack.com/%' THEN 'substack'
    WHEN lower(b.url) LIKE '%reddit.com/%' THEN 'reddit'
    WHEN lower(b.url) LIKE '%news.ycombinator.com/%' THEN 'hackernews'
    WHEN lower(b.url) LIKE '%discord.com/%' OR lower(b.url) LIKE '%discord.gg/%' THEN 'discord'
    ELSE 'web'
  END
`;

export class BookmarkError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = "BOOKMARK_ERROR",
  ) {
    super(message);
    this.name = "BookmarkError";
  }
}

export async function listBookmarks(
  env: Env,
  options: ListBookmarksOptions = {},
): Promise<ListBookmarksResponse> {
  const limit = clampInteger(options.limit ?? 10, 1, MAX_PAGE_SIZE);
  const offset = Math.max(0, Math.trunc(options.offset ?? 0));
  const tags = [
    ...new Set((options.tags ?? []).map((tag) => tag.trim()).filter(Boolean)),
  ].slice(0, 8);
  const tagsJson = JSON.stringify(tags);
  const platform = options.platform?.trim().toLocaleLowerCase() || null;
  const minStars =
    options.minStars === undefined
      ? null
      : clampInteger(options.minStars, 1, 5);
  const publicOnly = options.publicOnly !== false ? 1 : 0;
  const orderBy = {
    recent: "b.classified_at DESC, b.id DESC",
    published: "b.published_at DESC, b.classified_at DESC, b.id DESC",
    rating: "b.stars DESC, b.classified_at DESC, b.id DESC",
    title: "COALESCE(b.title, b.url) COLLATE NOCASE ASC, b.id ASC",
  }[options.sort ?? "recent"];
  const filter = `
    (? = 0 OR b.classified_at IS NOT NULL)
    AND (? IS NULL OR b.stars >= ?)
    AND (? IS NULL OR ${PLATFORM_SQL} = ?)
    AND NOT EXISTS (
      SELECT 1 FROM json_each(?) requested_tag
      WHERE NOT EXISTS (
        SELECT 1 FROM bookmark_tags filter_tag
        WHERE filter_tag.bookmark_id = b.id
          AND filter_tag.tag = CAST(requested_tag.value AS TEXT)
      )
    )
  `;
  const bindings = [
    publicOnly,
    minStars,
    minStars,
    platform,
    platform,
    tagsJson,
  ];

  const [rowsResult, countRow] = await Promise.all([
    env.DB.prepare(
      `SELECT ${ROW_COLUMNS}
       FROM bookmarks b
       WHERE ${filter}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
    )
      .bind(...bindings, limit, offset)
      .all<BookmarkRow>(),
    env.DB.prepare(
      `SELECT COUNT(*) AS count
       FROM bookmarks b
       WHERE ${filter}`,
    )
      .bind(...bindings)
      .first<{ count: number }>(),
  ]);

  return {
    bookmarks: rowsResult.results.map(toLight),
    total: Number(countRow?.count ?? 0),
    limit,
    offset,
  };
}

export function tokenizeSearch(query: string): string[] {
  const matches = query
    .normalize("NFKC")
    .toLocaleLowerCase()
    .match(/[\p{L}\p{N}_-]+/gu);
  return [...new Set(matches ?? [])].slice(0, 12);
}

export function buildFtsQuery(query: string): string {
  const terms = tokenizeSearch(query);
  if (terms.length === 0) {
    throw new BookmarkError(
      "q must contain a searchable word",
      400,
      "BAD_QUERY",
    );
  }
  return terms.map((term) => `"${term.replaceAll('"', '""')}"*`).join(" AND ");
}

export function computeMatchFlags(
  row: SearchableBookmark,
  terms: string[],
): BookmarkMatchFlags {
  const hasAny = (...values: Array<string | null>) => {
    const text = values.filter(Boolean).join("\n").toLocaleLowerCase();
    return terms.some((term) => text.includes(term));
  };
  return {
    metadata: hasAny(row.title, row.description, row.url),
    tags: hasAny(row.search_tags),
    research: hasAny(row.perplexity_research),
    insight: hasAny(row.insight_dev, row.insight_founder, row.insight_investor),
    content: hasAny(row.content_excerpt),
  };
}

export async function searchBookmarks(
  env: Env,
  query: string,
  options: ListBookmarksOptions = {},
): Promise<SearchBookmarksResponse> {
  const normalizedQuery = query.trim();
  const ftsQuery = buildFtsQuery(normalizedQuery);
  const terms = tokenizeSearch(normalizedQuery);
  const limit = clampInteger(options.limit ?? 10, 1, MAX_PAGE_SIZE);
  const offset = Math.max(0, Math.trunc(options.offset ?? 0));
  const tags = [
    ...new Set((options.tags ?? []).map((tag) => tag.trim()).filter(Boolean)),
  ].slice(0, 8);
  const tagsJson = JSON.stringify(tags);
  const platform = options.platform?.trim().toLocaleLowerCase() || null;
  const minStars =
    options.minStars === undefined
      ? null
      : clampInteger(options.minStars, 1, 5);
  const publicOnly = options.publicOnly !== false ? 1 : 0;
  const filter = `
    bookmarks_fts MATCH ?
    AND (? = 0 OR b.classified_at IS NOT NULL)
    AND (? IS NULL OR b.stars >= ?)
    AND (? IS NULL OR ${PLATFORM_SQL} = ?)
    AND NOT EXISTS (
      SELECT 1 FROM json_each(?) requested_tag
      WHERE NOT EXISTS (
        SELECT 1 FROM bookmark_tags filter_tag
        WHERE filter_tag.bookmark_id = b.id
          AND filter_tag.tag = CAST(requested_tag.value AS TEXT)
      )
    )
  `;
  const bindings = [
    ftsQuery,
    publicOnly,
    minStars,
    minStars,
    platform,
    platform,
    tagsJson,
  ];
  const [{ results }, countRow] = await Promise.all([
    env.DB.prepare(
      `SELECT ${ROW_COLUMNS}, bm25(bookmarks_fts) AS rank
       FROM bookmarks_fts
       JOIN bookmarks b ON b.id = bookmarks_fts.rowid
       WHERE ${filter}
       ORDER BY rank, b.id
       LIMIT ? OFFSET ?`,
    )
      .bind(...bindings, limit, offset)
      .all<SearchRow>(),
    env.DB.prepare(
      `SELECT COUNT(*) AS count
       FROM bookmarks_fts
       JOIN bookmarks b ON b.id = bookmarks_fts.rowid
       WHERE ${filter}`,
    )
      .bind(...bindings)
      .first<{ count: number }>(),
  ]);

  return {
    query: normalizedQuery,
    results: results.map((row) => ({
      bookmark: toLight(row),
      matches: computeMatchFlags(row, terms),
      rank: Number(row.rank),
    })),
    total: Number(countRow?.count ?? 0),
    limit,
    offset,
  };
}

export async function getBookmarkFacets(env: Env): Promise<BookmarkFacets> {
  const [summary, tags, platforms] = await Promise.all([
    env.DB.prepare(
      `SELECT
         COUNT(*) AS total,
         COALESCE(AVG(stars), 0) AS average_rating
       FROM bookmarks
       WHERE classified_at IS NOT NULL`,
    ).first<{ total: number; average_rating: number }>(),
    env.DB.prepare(
      `SELECT DISTINCT bt.tag
       FROM bookmark_tags bt
       JOIN bookmarks b ON b.id = bt.bookmark_id
       WHERE b.classified_at IS NOT NULL
         AND (
           bt.tag LIKE 'tech:%'
           OR bt.tag LIKE 'type:%'
         )
       ORDER BY bt.tag`,
    ).all<{ tag: string }>(),
    env.DB.prepare(
      `SELECT DISTINCT ${PLATFORM_SQL} AS platform
       FROM bookmarks b
       WHERE b.classified_at IS NOT NULL
       ORDER BY platform`,
    ).all<{ platform: string }>(),
  ]);

  return {
    total: Number(summary?.total ?? 0),
    average_rating: Number(summary?.average_rating ?? 0),
    tags: tags.results.map((row) => row.tag),
    platforms: platforms.results.map((row) => row.platform),
  };
}

export async function getBookmark(
  env: Env,
  url: string,
  includeContent = true,
): Promise<BookmarkDetail | null> {
  const row = await getRowByUrl(env, normalizeUrl(url));
  if (!row) return null;
  return toDetail(env, row, includeContent);
}

export async function getPublicBookmark(
  env: Env,
  url: string,
): Promise<PublicBookmarkDetail | null> {
  const detail = await getBookmark(env, url, true);
  if (!detail?.classified_at) return null;
  return toPublicDetail(detail);
}

export async function getBookmarkStats(
  env: Env,
  publicOnly = true,
): Promise<BookmarkStats> {
  const visibility = publicOnly ? "WHERE classified_at IS NOT NULL" : "";
  const tagVisibility = publicOnly
    ? "JOIN bookmarks b ON b.id = bt.bookmark_id WHERE b.classified_at IS NOT NULL"
    : "";
  const [counts, tagTotal, tags] = await Promise.all([
    env.DB.prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN classified_at IS NOT NULL THEN 1 ELSE 0 END) AS enriched,
         SUM(CASE WHEN firecrawl_key IS NOT NULL THEN 1 ELSE 0 END) AS with_content
       FROM bookmarks ${visibility}`,
    ).first<{ total: number; enriched: number; with_content: number }>(),
    env.DB.prepare(
      `SELECT COUNT(*) AS count
       FROM bookmark_tags bt
       ${tagVisibility}`,
    ).first<{ count: number }>(),
    env.DB.prepare(
      `SELECT bt.tag, COUNT(*) AS count
       FROM bookmark_tags bt
       ${tagVisibility}
       GROUP BY bt.tag
       ORDER BY count DESC, bt.tag ASC
       LIMIT 100`,
    ).all<{ tag: string; count: number }>(),
  ]);
  const total = Number(counts?.total ?? 0);
  const enriched = Number(counts?.enriched ?? 0);
  return {
    total,
    enriched,
    pending: total - enriched,
    with_content: Number(counts?.with_content ?? 0),
    tags_total: Number(tagTotal?.count ?? 0),
    tagCounts: tags.results.map((row) => ({
      tag: row.tag,
      count: Number(row.count),
    })),
  };
}

export async function createBookmark(
  env: Env,
  input: BookmarkInput,
): Promise<BookmarkDetail> {
  const url = normalizeUrl(input.url);
  if (await getRowByUrl(env, url)) {
    throw new BookmarkError(
      `Bookmark already exists: ${url}`,
      409,
      "BOOKMARK_EXISTS",
    );
  }
  return upsertBookmark(env, { ...input, url });
}

export async function updateBookmark(
  env: Env,
  input: BookmarkInput,
): Promise<BookmarkDetail> {
  const url = normalizeUrl(input.url);
  if (!(await getRowByUrl(env, url))) {
    throw new BookmarkError(
      `Bookmark not found: ${url}`,
      404,
      "BOOKMARK_NOT_FOUND",
    );
  }
  return upsertBookmark(env, { ...input, url });
}

export async function upsertBookmark(
  env: Env,
  input: BookmarkInput,
): Promise<BookmarkDetail> {
  const url = normalizeUrl(input.url);
  validateBookmarkInput(input);
  const existing = await getRowByUrl(env, url);
  const now = new Date().toISOString();
  const value = <K extends keyof BookmarkInput>(
    key: K,
    fallback: BookmarkInput[K] | null,
  ): BookmarkInput[K] | null =>
    input[key] === undefined ? fallback : input[key];

  const title = value("title", existing?.title ?? null) as string | null;
  const description = value("description", existing?.description ?? null) as
    | string
    | null;
  const icon = value("icon", existing?.icon ?? null) as string | null;
  const stars = value("stars", existing?.stars ?? null) as number | null;
  const language = value("language", existing?.language ?? null) as
    | string
    | null;
  const readingTime = value(
    "reading_time_min",
    existing?.reading_time_min ?? null,
  ) as number | null;
  const research = value(
    "perplexity_research",
    existing?.perplexity_research ?? null,
  ) as string | null;
  const insightDev = value("insight_dev", existing?.insight_dev ?? null) as
    | string
    | null;
  const insightFounder = value(
    "insight_founder",
    existing?.insight_founder ?? null,
  ) as string | null;
  const insightInvestor = value(
    "insight_investor",
    existing?.insight_investor ?? null,
  ) as string | null;
  const notes = value("notes", existing?.notes ?? null) as string | null;
  const researchedAt = value(
    "researched_at",
    existing?.researched_at ?? null,
  ) as string | null;
  const classifiedAt = value(
    "classified_at",
    existing?.classified_at ?? null,
  ) as string | null;
  const publishedAt = value("published_at", existing?.published_at ?? null) as
    | string
    | null;
  const createdAt = input.created_at ?? existing?.created_at ?? now;
  const updatedAt = input.updated_at ?? now;
  const insightsSearch = [insightDev, insightFounder, insightInvestor]
    .filter(Boolean)
    .join("\n");

  const result = await env.DB.prepare(
    `INSERT INTO bookmarks (
       url, title, description, icon, stars, language, reading_time_min,
       perplexity_research, insight_dev, insight_founder, insight_investor,
       notes, researched_at, classified_at, published_at, firecrawl_key,
       firecrawl_sha256, firecrawl_bytes, content_excerpt, search_tags,
       insights_search, created_at, updated_at
     ) VALUES (
       ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
     )
     ON CONFLICT(url) DO UPDATE SET
       title = excluded.title,
       description = excluded.description,
       icon = excluded.icon,
       stars = excluded.stars,
       language = excluded.language,
       reading_time_min = excluded.reading_time_min,
       perplexity_research = excluded.perplexity_research,
       insight_dev = excluded.insight_dev,
       insight_founder = excluded.insight_founder,
       insight_investor = excluded.insight_investor,
       notes = excluded.notes,
       researched_at = excluded.researched_at,
       classified_at = excluded.classified_at,
       published_at = excluded.published_at,
       insights_search = excluded.insights_search,
       updated_at = excluded.updated_at
     RETURNING id`,
  )
    .bind(
      url,
      title,
      description,
      icon,
      stars,
      language,
      readingTime,
      research,
      insightDev,
      insightFounder,
      insightInvestor,
      notes,
      researchedAt,
      classifiedAt,
      publishedAt,
      existing?.firecrawl_key ?? null,
      existing?.firecrawl_sha256 ?? null,
      existing?.firecrawl_bytes ?? null,
      existing?.content_excerpt ?? "",
      existing?.search_tags ?? "",
      insightsSearch,
      createdAt,
      updatedAt,
    )
    .first<{ id: number }>();
  if (!result) {
    throw new BookmarkError("D1 did not return the bookmark id", 500);
  }

  if (input.tags !== undefined) {
    await replaceTags(env, result.id, input.tags);
  }
  if (input.firecrawl_content !== undefined) {
    await replaceFirecrawlContent(
      env,
      result.id,
      existing?.firecrawl_key ?? null,
      input.firecrawl_content,
      updatedAt,
    );
  }

  const saved = await getBookmark(env, url, true);
  if (!saved) {
    throw new BookmarkError("Bookmark disappeared after save", 500);
  }
  return saved;
}

export async function batchUpsertBookmarks(
  env: Env,
  inputs: BookmarkInput[],
): Promise<{
  received: number;
  succeeded: number;
  failed: number;
  results: Array<{ url: string; ok: boolean; id?: number; error?: string }>;
}> {
  if (inputs.length > 100) {
    throw new BookmarkError("A batch may contain at most 100 bookmarks");
  }
  const results: Array<{
    url: string;
    ok: boolean;
    id?: number;
    error?: string;
  }> = [];
  for (const input of inputs) {
    try {
      const bookmark = await upsertBookmark(env, input);
      results.push({ url: bookmark.url, ok: true, id: bookmark.id });
    } catch (error) {
      results.push({
        url: input.url,
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  const succeeded = results.filter((result) => result.ok).length;
  return {
    received: inputs.length,
    succeeded,
    failed: inputs.length - succeeded,
    results,
  };
}

export async function deleteBookmark(
  env: Env,
  urlInput: string,
): Promise<{ deleted: true; url: string }> {
  const url = normalizeUrl(urlInput);
  const existing = await getRowByUrl(env, url);
  if (!existing) {
    throw new BookmarkError(
      `Bookmark not found: ${url}`,
      404,
      "BOOKMARK_NOT_FOUND",
    );
  }
  await env.DB.prepare("DELETE FROM bookmarks WHERE id = ?")
    .bind(existing.id)
    .run();
  if (existing.firecrawl_key) {
    await env.CORPUS.delete(existing.firecrawl_key);
  }
  return { deleted: true, url };
}

export function parseBookmarkInput(
  value: unknown,
  requireUrl = true,
): BookmarkInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BookmarkError("bookmark must be an object");
  }
  const input = value as Record<string, unknown>;
  const urlValue = input.url;
  if (requireUrl && (typeof urlValue !== "string" || !urlValue.trim())) {
    throw new BookmarkError("url is required");
  }
  const result: BookmarkInput = {
    url: typeof urlValue === "string" ? urlValue : "",
  };
  const textFields = [
    "title",
    "description",
    "icon",
    "language",
    "perplexity_research",
    "insight_dev",
    "insight_founder",
    "insight_investor",
    "notes",
    "researched_at",
    "classified_at",
    "published_at",
    "firecrawl_content",
  ] as const;
  for (const field of textFields) {
    const fieldValue = input[field];
    if (fieldValue === undefined) continue;
    if (fieldValue !== null && typeof fieldValue !== "string") {
      throw new BookmarkError(`${field} must be a string or null`);
    }
    result[field] = fieldValue;
  }
  for (const field of ["created_at", "updated_at"] as const) {
    const fieldValue = input[field];
    if (fieldValue === undefined) continue;
    if (typeof fieldValue !== "string") {
      throw new BookmarkError(`${field} must be a string`);
    }
    result[field] = fieldValue;
  }
  for (const field of ["stars", "reading_time_min"] as const) {
    const fieldValue = input[field];
    if (fieldValue === undefined) continue;
    if (
      fieldValue !== null &&
      (typeof fieldValue !== "number" || !Number.isFinite(fieldValue))
    ) {
      throw new BookmarkError(`${field} must be a number or null`);
    }
    result[field] = fieldValue;
  }
  if (input.tags !== undefined) {
    if (
      !Array.isArray(input.tags) ||
      !input.tags.every((tag) => typeof tag === "string")
    ) {
      throw new BookmarkError("tags must be an array of strings");
    }
    result.tags = input.tags;
  }
  validateBookmarkInput(result);
  return result;
}

export function toPublicDetail(detail: BookmarkDetail): PublicBookmarkDetail {
  const { notes: _notes, firecrawl_key: _key, ...publicDetail } = detail;
  return publicDetail;
}

async function getRowByUrl(env: Env, url: string): Promise<BookmarkRow | null> {
  return env.DB.prepare(
    `SELECT ${ROW_COLUMNS}
     FROM bookmarks b
     WHERE b.url = ?
     LIMIT 1`,
  )
    .bind(url)
    .first<BookmarkRow>();
}

async function toDetail(
  env: Env,
  row: BookmarkRow,
  includeContent: boolean,
): Promise<BookmarkDetail> {
  let firecrawlContent: string | null = null;
  if (includeContent && row.firecrawl_key) {
    const object = await env.CORPUS.get(row.firecrawl_key);
    if (object) {
      if (object.size > MAX_CONTENT_RESPONSE_BYTES) {
        throw new BookmarkError(
          `Stored content is ${object.size} bytes; the detail response limit is ${MAX_CONTENT_RESPONSE_BYTES}`,
          413,
          "CONTENT_TOO_LARGE",
        );
      }
      firecrawlContent = await object.text();
    }
  }
  return {
    ...toLight(row),
    perplexity_research: row.perplexity_research,
    insight_dev: row.insight_dev,
    insight_founder: row.insight_founder,
    insight_investor: row.insight_investor,
    notes: row.notes,
    researched_at: row.researched_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    firecrawl_key: row.firecrawl_key,
    firecrawl_sha256: row.firecrawl_sha256,
    firecrawl_bytes: row.firecrawl_bytes,
    firecrawl_content: firecrawlContent,
  };
}

function toLight(row: BookmarkRow): BookmarkLight {
  return {
    id: Number(row.id),
    url: row.url,
    title: row.title,
    description: row.description,
    icon: row.icon,
    stars: row.stars === null ? null : Number(row.stars),
    language: row.language,
    reading_time_min:
      row.reading_time_min === null ? null : Number(row.reading_time_min),
    classified_at: row.classified_at,
    published_at: row.published_at,
    tags: parseTags(row.tags_json),
  };
}

async function replaceTags(
  env: Env,
  bookmarkId: number,
  inputTags: string[],
): Promise<void> {
  const tags = [
    ...new Set(inputTags.map((tag) => tag.trim()).filter(Boolean)),
  ].sort();
  const statements: D1PreparedStatement[] = [
    env.DB.prepare("DELETE FROM bookmark_tags WHERE bookmark_id = ?").bind(
      bookmarkId,
    ),
    ...tags.map((tag) =>
      env.DB.prepare(
        "INSERT INTO bookmark_tags (bookmark_id, tag) VALUES (?, ?)",
      ).bind(bookmarkId, tag),
    ),
    env.DB.prepare("UPDATE bookmarks SET search_tags = ? WHERE id = ?").bind(
      tags.join(" "),
      bookmarkId,
    ),
  ];
  await env.DB.batch(statements);
}

async function replaceFirecrawlContent(
  env: Env,
  bookmarkId: number,
  previousKey: string | null,
  content: string | null,
  updatedAt: string,
): Promise<void> {
  if (!content) {
    await env.DB.prepare(
      `UPDATE bookmarks
       SET firecrawl_key = NULL, firecrawl_sha256 = NULL,
           firecrawl_bytes = NULL, content_excerpt = '', updated_at = ?
       WHERE id = ?`,
    )
      .bind(updatedAt, bookmarkId)
      .run();
    if (previousKey) await env.CORPUS.delete(previousKey);
    return;
  }

  const encoded = new TextEncoder().encode(content);
  const hash = await sha256Hex(encoded.buffer);
  const key = `bookmarks/${bookmarkId}/firecrawl.md`;
  await env.CORPUS.put(key, encoded, {
    httpMetadata: { contentType: "text/markdown; charset=utf-8" },
    customMetadata: { sha256: hash },
  });
  await env.DB.prepare(
    `UPDATE bookmarks
     SET firecrawl_key = ?, firecrawl_sha256 = ?, firecrawl_bytes = ?,
         content_excerpt = ?, updated_at = ?
     WHERE id = ?`,
  )
    .bind(
      key,
      hash,
      encoded.byteLength,
      content.slice(0, CONTENT_EXCERPT_CHARS),
      updatedAt,
      bookmarkId,
    )
    .run();
  if (previousKey && previousKey !== key) {
    await env.CORPUS.delete(previousKey);
  }
}

async function sha256Hex(value: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function parseTags(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === "string")
      : [];
  } catch {
    return [];
  }
}

function normalizeUrl(value: string): string {
  const normalized = value.trim();
  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new BookmarkError("url must be a valid absolute URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new BookmarkError("url must use http or https");
  }
  return normalized;
}

function validateBookmarkInput(input: BookmarkInput): void {
  if (input.url) normalizeUrl(input.url);
  if (
    input.stars !== undefined &&
    input.stars !== null &&
    (!Number.isInteger(input.stars) || input.stars < 1 || input.stars > 5)
  ) {
    throw new BookmarkError("stars must be an integer from 1 to 5");
  }
  if (
    input.reading_time_min !== undefined &&
    input.reading_time_min !== null &&
    (!Number.isInteger(input.reading_time_min) || input.reading_time_min < 0)
  ) {
    throw new BookmarkError("reading_time_min must be a non-negative integer");
  }
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.trunc(value)));
}
