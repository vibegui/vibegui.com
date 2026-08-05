/**
 * Guards against SPA HTML being immutable-cached under /assets/*.
 * Regression: vibegui.com blank while *.pages.dev worked (2026-08).
 */

import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { onRequest } from "../../functions/_middleware";

const PUBLIC_DIR = join(import.meta.dir, "../../public");

function middleware(
  request: Request,
  assetsFetch: (req: Request) => Promise<Response>,
) {
  return onRequest({
    request,
    env: {
      ASSETS: { fetch: assetsFetch },
      ANALYTICS_BEACON_URL: "data:application/json,{}",
    },
    next: async () => new Response("next", { status: 418 }),
    waitUntil: () => {},
  });
}

describe("Asset MIME poison guard", () => {
  test("_routes.json keeps /assets/* on the middleware (not excluded)", () => {
    const routes = JSON.parse(
      readFileSync(join(PUBLIC_DIR, "_routes.json"), "utf-8"),
    ) as { exclude: string[] };
    expect(routes.exclude.some((p) => p.startsWith("/assets"))).toBe(false);
  });

  test("SPA HTML under /assets/*.js becomes 404 no-store", async () => {
    const poisoned = await middleware(
      new Request("https://vibegui.com/assets/index.missinghash.js"),
      async () =>
        new Response("<!doctype html><title>spa</title>", {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
    );
    expect(poisoned.status).toBe(404);
    expect(poisoned.headers.get("cache-control")).toBe("no-store");
    expect(poisoned.headers.get("cdn-cache-control")).toBe("no-store");
  });

  test("missing asset (404 HTML) becomes 404 no-store", async () => {
    const missing = await middleware(
      new Request("https://vibegui.com/assets/gone.abc123.js"),
      async () =>
        new Response("<!doctype html>", {
          status: 404,
          headers: { "content-type": "text/html" },
        }),
    );
    expect(missing.status).toBe(404);
    expect(missing.headers.get("cache-control")).toBe("no-store");
  });

  test("real JS passes through with immutable cache", async () => {
    const realJs = await middleware(
      new Request("https://vibegui.com/assets/index.abc123.js"),
      async () =>
        new Response("console.log(1)", {
          status: 200,
          headers: { "content-type": "application/javascript" },
        }),
    );
    expect(realJs.status).toBe(200);
    expect(realJs.headers.get("cache-control")).toContain("immutable");
    expect(await realJs.text()).toBe("console.log(1)");
  });

  test("JS path with wrong MIME (text/plain) is rejected", async () => {
    const wrong = await middleware(
      new Request("https://vibegui.com/assets/index.abc123.js"),
      async () =>
        new Response("console.log(1)", {
          status: 200,
          headers: { "content-type": "text/plain" },
        }),
    );
    expect(wrong.status).toBe(404);
    expect(wrong.headers.get("cache-control")).toBe("no-store");
  });
});
