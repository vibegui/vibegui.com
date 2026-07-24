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

/**
 * Dashboard payload: per-site totals (always unfiltered, for the site
 * switcher), plus — scoped to the optional site filter — a zero-filled
 * daily series, top pages, referrer sources aggregated by hostname
 * (self-referrals excluded), and top countries.
 */
const OWN_HOSTS = new Set([
  "vibegui.com",
  "poesiadairene.com",
  "buscamalvados.com",
  "mcp.vibegui.com",
  "localhost",
  "teste.local",
]);

function refHostname(ref: string): string | null {
  try {
    const host = new URL(ref).hostname.replace(/^www\./, "").toLowerCase();
    if (!host) return null;
    if (OWN_HOSTS.has(host) || host.endsWith(".pages.dev")) return null;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;
    return host;
  } catch {
    return null;
  }
}

export interface OverviewQuery {
  days?: number;
  site?: string;
}

export async function sitesOverview(env: Env, q: OverviewQuery = {}) {
  const days = Math.min(Math.max(q.days ?? 7, 1), 90);
  const since = Date.now() - days * DAY_MS;
  const scope = q.site ? " AND site = ?" : "";
  const scopeBinds = q.site ? [q.site] : [];

  const [totals, series, topPaths, rawRefs, countries] = await Promise.all([
    env.DB.prepare(
      `SELECT coalesce(site, '(sem site)') AS site,
              COUNT(*) AS pageviews,
              COUNT(DISTINCT visitor) AS visitors
       FROM events WHERE name = 'pageview' AND ts >= ?
       GROUP BY site ORDER BY pageviews DESC`,
    )
      .bind(since)
      .all(),
    env.DB.prepare(
      `SELECT date(ts / 1000, 'unixepoch') AS day,
              COUNT(*) AS pageviews,
              COUNT(DISTINCT visitor) AS visitors
       FROM events WHERE name = 'pageview' AND ts >= ?${scope}
       GROUP BY day ORDER BY day ASC`,
    )
      .bind(since, ...scopeBinds)
      .all(),
    env.DB.prepare(
      `SELECT coalesce(site, '(sem site)') AS site, path,
              COUNT(*) AS pageviews,
              COUNT(DISTINCT visitor) AS visitors
       FROM events WHERE name = 'pageview' AND ts >= ?${scope}
       GROUP BY site, path ORDER BY pageviews DESC LIMIT 12`,
    )
      .bind(since, ...scopeBinds)
      .all(),
    env.DB.prepare(
      `SELECT ref, COUNT(*) AS pageviews, COUNT(DISTINCT visitor) AS visitors
       FROM events WHERE name = 'pageview' AND ts >= ?${scope}
       GROUP BY ref ORDER BY pageviews DESC LIMIT 300`,
    )
      .bind(since, ...scopeBinds)
      .all(),
    env.DB.prepare(
      `SELECT coalesce(nullif(country, ''), '?') AS country,
              COUNT(*) AS pageviews,
              COUNT(DISTINCT visitor) AS visitors
       FROM events WHERE name = 'pageview' AND ts >= ?${scope}
       GROUP BY country ORDER BY pageviews DESC LIMIT 12`,
    )
      .bind(since, ...scopeBinds)
      .all(),
  ]);

  // fontes: agrega por hostname; auto-referência e vazio viram "(direto)"
  const fontes = new Map<string, { pageviews: number; visitors: number }>();
  for (const row of rawRefs.results as Array<Record<string, unknown>>) {
    const host = refHostname(String(row.ref ?? "")) ?? "(direto)";
    const entry = fontes.get(host) ?? { pageviews: 0, visitors: 0 };
    entry.pageviews += Number(row.pageviews) || 0;
    entry.visitors += Number(row.visitors) || 0;
    fontes.set(host, entry);
  }
  const topReferrers = [...fontes.entries()]
    .map(([ref, v]) => ({ ref, ...v }))
    .sort((a, b) => b.pageviews - a.pageviews)
    .slice(0, 10);

  // série diária com dias zerados preenchidos
  const byDay = new Map(
    (series.results as Array<Record<string, unknown>>).map((r) => [
      String(r.day),
      r,
    ]),
  );
  const filled: Array<{ day: string; pageviews: number; visitors: number }> =
    [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * DAY_MS).toISOString().slice(0, 10);
    const row = byDay.get(day);
    filled.push({
      day,
      pageviews: row ? Number(row.pageviews) || 0 : 0,
      visitors: row ? Number(row.visitors) || 0 : 0,
    });
  }

  return {
    days,
    site: q.site ?? null,
    sites: totals.results,
    series: filled,
    topPages: topPaths.results,
    topReferrers,
    countries: countries.results,
  };
}
