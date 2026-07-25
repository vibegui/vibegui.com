const DEFAULT_BOOKMARKS_API_ORIGIN = "https://mcp.vibegui.com";

export const BOOKMARKS_API_ORIGIN = (
  import.meta.env.VITE_BOOKMARKS_API_ORIGIN || DEFAULT_BOOKMARKS_API_ORIGIN
).replace(/\/$/, "");

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

export interface SearchResult {
  bookmark: BookmarkLight;
  matches: {
    metadata: boolean;
    tags: boolean;
    content: boolean;
    research: boolean;
    insight: boolean;
  };
  rank: number;
}

export interface BookmarkContent {
  perplexity_research: string | null;
  firecrawl_content: string | null;
  insight_dev: string | null;
  insight_founder: string | null;
  insight_investor: string | null;
}

type RequestOptions = {
  signal?: AbortSignal;
};

export interface BookmarkPage {
  bookmarks: BookmarkLight[];
  total: number;
  limit: number;
  offset: number;
}

export interface SearchPage {
  results: SearchResult[];
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

export interface BookmarkQuery extends RequestOptions {
  limit?: number;
  offset?: number;
  tags?: string[];
  platform?: string | null;
  minStars?: number | null;
  sort?: "recent" | "published" | "rating" | "title";
}

async function requestJson<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${BOOKMARKS_API_ORIGIN}${path}`, {
      headers: { Accept: "application/json" },
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new Error("The bookmarks service could not be reached.");
  }

  if (!response.ok) {
    let message = `The bookmarks service returned ${response.status}.`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // Keep the status-based message when the response is not JSON.
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

function normalizeBookmark(bookmark: BookmarkLight): BookmarkLight {
  return {
    ...bookmark,
    tags: Array.isArray(bookmark.tags) ? bookmark.tags : [],
  };
}

export async function getBookmarksPage(
  options: BookmarkQuery = {},
): Promise<BookmarkPage> {
  const params = queryParams(options);
  const data = await requestJson<BookmarkPage>(
    `/bookmarks?${params.toString()}`,
    options,
  );
  return {
    ...data,
    bookmarks: (data.bookmarks || []).map(normalizeBookmark),
  };
}

export async function searchBookmarksPage(
  query: string,
  options: BookmarkQuery = {},
): Promise<SearchPage> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return {
      results: [],
      total: 0,
      limit: options.limit ?? 10,
      offset: options.offset ?? 0,
    };
  }

  const params = queryParams(options);
  params.set("q", normalizedQuery);
  const data = await requestJson<SearchPage>(
    `/bookmarks/search?${params.toString()}`,
    options,
  );

  return {
    ...data,
    results: (data.results || []).map((result) => ({
      ...result,
      bookmark: normalizeBookmark(result.bookmark),
    })),
  };
}

export async function getBookmarkFacets(
  options: RequestOptions = {},
): Promise<BookmarkFacets> {
  return requestJson<BookmarkFacets>("/bookmarks/facets", options);
}

export async function getBookmarkContent(
  url: string,
  options: RequestOptions = {},
): Promise<BookmarkContent | null> {
  const data = await requestJson<
    | BookmarkContent
    | {
        content?: BookmarkContent | null;
        detail?: BookmarkContent | null;
        bookmark?: BookmarkContent | null;
      }
  >(`/bookmarks/content?url=${encodeURIComponent(url)}`, options);

  if ("content" in data || "detail" in data || "bookmark" in data) {
    return data.content ?? data.detail ?? data.bookmark ?? null;
  }
  return data as BookmarkContent;
}

function queryParams(options: BookmarkQuery): URLSearchParams {
  const params = new URLSearchParams({
    limit: String(options.limit ?? 10),
    offset: String(options.offset ?? 0),
  });
  for (const tag of options.tags ?? []) {
    if (tag) params.append("tag", tag);
  }
  if (options.platform) params.set("platform", options.platform);
  if (options.minStars) params.set("min_stars", String(options.minStars));
  if (options.sort) params.set("sort", options.sort);
  return params;
}
