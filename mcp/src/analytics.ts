/**
 * Query helpers over the first-party events table (see track.ts).
 * Exposed through the private MCP tools SITES_OVERVIEW and SITE_METRICS.
 */

import type { Env } from "./env.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const GROUPS = {
  day: "date(ts / 1000, 'unixepoch')",
  site: "coalesce(site, '(sem site)')",
  path: "coalesce(path, '(sem path)')",
  country: "coalesce(country, '(?)')",
  ref: "coalesce(nullif(ref, ''), '(direto)')",
  name: "name",
} as const;

export type MetricsGroup = keyof typeof GROUPS;

export interface MetricsQuery {
  days?: number;
  groupBy?: MetricsGroup;
  site?: string;
  name?: string;
  limit?: number;
}

export async function metricsQuery(env: Env, q: MetricsQuery) {
  const days = Math.min(Math.max(q.days ?? 7, 1), 90);
  const groupBy: MetricsGroup = q.groupBy ?? "day";
  const groupExpr = GROUPS[groupBy];
  const since = Date.now() - days * DAY_MS;
  const limit = Math.min(Math.max(q.limit ?? 20, 1), 100);

  const filters = ["ts >= ?"];
  const binds: unknown[] = [since];
  if (q.site) {
    filters.push("site = ?");
    binds.push(q.site);
  }
  if (q.name) {
    filters.push("name = ?");
    binds.push(q.name);
  }

  const { results } = await env.DB.prepare(
    `SELECT ${groupExpr} AS key,
            COUNT(*) AS events,
            SUM(value) AS value,
            COUNT(DISTINCT visitor) AS uniques
     FROM events
     WHERE ${filters.join(" AND ")}
     GROUP BY key
     ORDER BY ${groupBy === "day" ? "key ASC" : "events DESC"}
     LIMIT ?`,
  )
    .bind(...binds, limit)
    .all();

  return {
    days,
    groupBy,
    site: q.site ?? null,
    name: q.name ?? null,
    rows: results,
  };
}

/** Compact multi-site summary: totals + top pages/referrers per site. */
export async function sitesOverview(env: Env, days = 7) {
  const window = Math.min(Math.max(days, 1), 90);
  const since = Date.now() - window * DAY_MS;

  const totals = await env.DB.prepare(
    `SELECT coalesce(site, '(sem site)') AS site,
            COUNT(*) AS pageviews,
            COUNT(DISTINCT visitor) AS visitors
     FROM events
     WHERE name = 'pageview' AND ts >= ?
     GROUP BY site
     ORDER BY pageviews DESC`,
  )
    .bind(since)
    .all();

  const topPaths = await env.DB.prepare(
    `SELECT coalesce(site, '(sem site)') AS site, path,
            COUNT(*) AS pageviews
     FROM events
     WHERE name = 'pageview' AND ts >= ?
     GROUP BY site, path
     ORDER BY pageviews DESC
     LIMIT 30`,
  )
    .bind(since)
    .all();

  const topRefs = await env.DB.prepare(
    `SELECT coalesce(nullif(ref, ''), '(direto)') AS ref,
            COUNT(*) AS pageviews
     FROM events
     WHERE name = 'pageview' AND ts >= ?
     GROUP BY ref
     ORDER BY pageviews DESC
     LIMIT 15`,
  )
    .bind(since)
    .all();

  return {
    days: window,
    sites: totals.results,
    topPages: topPaths.results,
    topReferrers: topRefs.results,
  };
}
