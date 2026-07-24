import { accessForRequest } from "./auth.ts";
import type { Env } from "./env.ts";
import { refreshGitHub } from "./github.ts";
import { handleMcpRequest } from "./mcp.ts";
import { markBriefDue } from "./state.ts";
import { EVENT_NAME_RE, pruneEvents, track } from "./track.ts";

const worker: ExportedHandler<Env> = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const access = accessForRequest(request, env);

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
