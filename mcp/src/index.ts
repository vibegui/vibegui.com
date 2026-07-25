import { accessForRequest } from "./auth.ts";
import {
  BookmarkError,
  getBookmarkFacets,
  getPublicBookmark,
  listBookmarks,
  searchBookmarks,
} from "./bookmarks.ts";
import type { Env } from "./env.ts";
import { refreshGitHub } from "./github.ts";
import { handleMcpRequest } from "./mcp.ts";
import { markBriefDue } from "./state.ts";
import { EVENT_NAME_RE, pruneEvents, track } from "./track.ts";

const worker: ExportedHandler<Env> = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const access = accessForRequest(request, env);

    if (
      request.method === "OPTIONS" &&
      (url.pathname === "/bookmarks" ||
        url.pathname === "/bookmarks/search" ||
        url.pathname === "/bookmarks/facets" ||
        url.pathname === "/bookmarks/content")
    ) {
      return new Response(null, {
        status: 204,
        headers: bookmarkCorsHeaders(env),
      });
    }

    if (
      request.method === "GET" &&
      (url.pathname === "/bookmarks" ||
        url.pathname === "/bookmarks/search" ||
        url.pathname === "/bookmarks/facets" ||
        url.pathname === "/bookmarks/content")
    ) {
      try {
        if (url.pathname === "/bookmarks") {
          const result = await listBookmarks(env, {
            limit: queryNumber(url, "limit"),
            offset: queryNumber(url, "offset"),
            tags: url.searchParams.getAll("tag"),
            platform: url.searchParams.get("platform") ?? undefined,
            minStars: queryNumber(url, "min_stars"),
            sort: querySort(url.searchParams.get("sort")),
            publicOnly: true,
          });
          return bookmarkJson(result, env, 200, 300);
        }
        if (url.pathname === "/bookmarks/facets") {
          return bookmarkJson(await getBookmarkFacets(env), env, 200, 300);
        }
        if (url.pathname === "/bookmarks/search") {
          const query = url.searchParams.get("q")?.trim() ?? "";
          if (!query) {
            throw new BookmarkError("q is required", 400, "BAD_QUERY");
          }
          const result = await searchBookmarks(env, query, {
            limit: queryNumber(url, "limit"),
            offset: queryNumber(url, "offset"),
            tags: url.searchParams.getAll("tag"),
            platform: url.searchParams.get("platform") ?? undefined,
            minStars: queryNumber(url, "min_stars"),
            publicOnly: true,
          });
          return bookmarkJson(result, env, 200, 60);
        }
        const bookmarkUrl = url.searchParams.get("url")?.trim() ?? "";
        if (!bookmarkUrl) {
          throw new BookmarkError("url is required", 400, "BAD_URL");
        }
        const bookmark = await getPublicBookmark(env, bookmarkUrl);
        if (!bookmark) {
          throw new BookmarkError(
            "Bookmark not found",
            404,
            "BOOKMARK_NOT_FOUND",
          );
        }
        return bookmarkJson({ bookmark }, env, 200, 300);
      } catch (error) {
        const status = error instanceof BookmarkError ? error.status : 500;
        const code =
          error instanceof BookmarkError ? error.code : "INTERNAL_ERROR";
        console.error(
          JSON.stringify({
            message: "bookmark request failed",
            path: url.pathname,
            error: error instanceof Error ? error.message : "Unknown error",
          }),
        );
        return bookmarkJson(
          {
            error: {
              code,
              message:
                status >= 500
                  ? "Bookmark service failed"
                  : error instanceof Error
                    ? error.message
                    : "Request failed",
            },
          },
          env,
          status,
          0,
        );
      }
    }

    // Public popularity ranking (feeds the "mais vistas" sort on the sites).
    // Aggregated pageview counts only — no visitor data leaves the worker.
    if (request.method === "GET" && url.pathname === "/popular") {
      const site = url.searchParams.get("site") ?? "";
      const days = Math.min(
        Math.max(Number(url.searchParams.get("days")) || 90, 1),
        90,
      );
      const since = Date.now() - days * 24 * 60 * 60 * 1000;
      const { results } = await env.DB.prepare(
        `SELECT path, COUNT(*) AS views
         FROM events
         WHERE name = 'pageview' AND ts >= ? AND site = ?
         GROUP BY path ORDER BY views DESC LIMIT 2000`,
      )
        .bind(since, site)
        .all();
      return new Response(JSON.stringify({ site, days, items: results }), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "access-control-allow-origin": "*",
          "cache-control": "public, max-age=300",
        },
      });
    }

    // Public analytics beacon (first-party, fire-and-forget). The vibegui.com
    // Pages middleware posts server-side pageviews here for the three sites.
    if (request.method === "POST" && url.pathname === "/e") {
      const body = (await request.json().catch(() => null)) as Record<
        string,
        unknown
      > | null;
      const name = typeof body?.name === "string" ? body.name : "";
      if (!body || !EVENT_NAME_RE.test(name)) {
        return json({ error: "invalid event" }, 400);
      }
      const str = (v: unknown) => (typeof v === "string" ? v : undefined);
      ctx.waitUntil(
        track(env, name, {
          value: typeof body.value === "number" ? body.value : undefined,
          site: str(body.site),
          path: str(body.path),
          ref: str(body.ref),
          country:
            str(body.country) ??
            request.headers.get("cf-ipcountry") ??
            undefined,
          dims:
            body.dims && typeof body.dims === "object"
              ? (body.dims as Record<string, unknown>)
              : undefined,
          ip: str(body.ip) ?? request.headers.get("cf-connecting-ip") ?? "",
          ua: str(body.ua) ?? request.headers.get("user-agent") ?? "",
        }),
      );
      return new Response(null, { status: 204 });
    }

    if (request.method === "GET" && url.pathname === "/") {
      return json({
        name: "vibegui-personal-ai-os",
        ok: true,
        publicMcp: `${url.origin}/mcp`,
        privateMode: access === "private",
      });
    }

    if (request.method === "GET" && url.pathname === "/mcp") {
      return json({
        jsonrpc: "2.0",
        server: {
          name: "vibegui-personal-ai-os",
          version: "0.1.0",
        },
        mode: access,
        hint: "POST MCP JSON-RPC requests here.",
      });
    }

    if (request.method === "POST" && url.pathname === "/mcp") {
      return handleMcpRequest(request, env, access);
    }

    return json({ error: "not found", path: url.pathname }, 404);
  },

  async scheduled(_controller, env, context) {
    context.waitUntil(
      Promise.all([
        markBriefDue(env),
        pruneEvents(env),
        env.GITHUB_TOKEN
          ? refreshGitHub(env).catch((error) => {
              console.warn("Scheduled GitHub refresh failed", error);
            })
          : Promise.resolve(),
      ]).then(() => undefined),
    );
  },
};

export default worker;

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function bookmarkJson(
  value: unknown,
  env: Env,
  status: number,
  maxAgeSeconds: number,
): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      ...bookmarkCorsHeaders(env),
      "content-type": "application/json; charset=utf-8",
      "cache-control":
        maxAgeSeconds > 0
          ? `public, max-age=${maxAgeSeconds}, s-maxage=${maxAgeSeconds}, stale-while-revalidate=86400`
          : "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function bookmarkCorsHeaders(env: Env): Record<string, string> {
  void env;
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type",
  };
}

function queryNumber(url: URL, key: string): number | undefined {
  const raw = url.searchParams.get(key);
  if (raw === null || raw.trim() === "") return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new BookmarkError(`${key} must be a number`, 400, "BAD_QUERY");
  }
  return value;
}

function querySort(
  value: string | null,
): "recent" | "published" | "rating" | "title" | undefined {
  if (value === null || value === "") return undefined;
  if (
    value === "recent" ||
    value === "published" ||
    value === "rating" ||
    value === "title"
  ) {
    return value;
  }
  throw new BookmarkError(
    "sort must be recent, rating, or title",
    400,
    "BAD_QUERY",
  );
}
