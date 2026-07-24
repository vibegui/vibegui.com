/**
 * First-party event tracking (pattern shared with holocard/awesome-ai-native):
 * one D1 row per event, cookieless daily visitor hash, never throws.
 *
 * Events arrive via the public POST /e beacon — the vibegui.com Pages
 * middleware posts a server-side "pageview" for every page served on
 * vibegui.com, poesiadairene.com and buscamalvados.com.
 */

import type { Env } from "./env.ts";

export interface TrackOptions {
  value?: number;
  site?: string;
  path?: string;
  ref?: string;
  country?: string;
  dims?: Record<string, unknown>;
  /** raw material for the visitor hash; discarded after hashing */
  ip?: string;
  ua?: string;
}

export const EVENT_NAME_RE = /^[a-z0-9_.:-]{1,64}$/i;
const MAX_FIELD = 300;

function clip(value: unknown, max = MAX_FIELD): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  return value.slice(0, max);
}

export async function visitorHash(
  env: Env,
  ip: string,
  ua: string,
): Promise<string | null> {
  if (!ip && !ua) return null;
  const salt = env.ANALYTICS_SALT || env.MCP_PRIVATE_TOKEN || "vibegui";
  const day = new Date().toISOString().slice(0, 10);
  const material = `${salt}:${day}:${ip}:${ua}`;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(material),
  );
  return [...new Uint8Array(digest)]
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function track(
  env: Env,
  name: string,
  options: TrackOptions = {},
): Promise<void> {
  try {
    if (!EVENT_NAME_RE.test(name)) return;
    const visitor = await visitorHash(env, options.ip ?? "", options.ua ?? "");
    const dims = options.dims
      ? JSON.stringify(options.dims).slice(0, 1000)
      : null;
    await env.DB.prepare(
      `INSERT INTO events (name, value, site, path, ref, visitor, country, dims, ts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        name,
        typeof options.value === "number" ? options.value : 1,
        clip(options.site, 100),
        clip(options.path),
        clip(options.ref),
        visitor,
        clip(options.country, 8),
        dims,
        Date.now(),
      )
      .run();
  } catch (error) {
    console.warn("track failed", error);
  }
}

/** Remove events older than `days` (called from the hourly cron). */
export async function pruneEvents(env: Env, days = 90): Promise<void> {
  try {
    await env.DB.prepare("DELETE FROM events WHERE ts < ?")
      .bind(Date.now() - days * 24 * 60 * 60 * 1000)
      .run();
  } catch (error) {
    console.warn("pruneEvents failed", error);
  }
}
