#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

interface ExportFile {
  sha256?: string;
  counts?: {
    bookmarks?: number;
    tags?: number;
    with_content?: number;
  };
  bookmarks?: unknown[];
}

interface ImportResult {
  received: number;
  succeeded: number;
  failed: number;
  results: Array<{ url: string; ok: boolean; error?: string }>;
  source_sha256?: string | null;
  destination?: {
    total: number;
    enriched: number;
    pending: number;
    with_content: number;
    tags_total: number;
    tagCounts: Array<{ tag: string; count: number }>;
  };
}

const projectRoot = resolve(import.meta.dir, "..", "..");
await loadEnvironment(join(projectRoot, ".env"));

const inputPath = resolve(
  argumentValue("--input") ??
    join(projectRoot, "temp", "bookmarks-export.json"),
);
const endpoint =
  argumentValue("--url") ??
  process.env.BOOKMARKS_MCP_URL ??
  (process.argv.includes("--remote") ? undefined : "http://127.0.0.1:8787/mcp");
if (!endpoint) {
  throw new Error("Set BOOKMARKS_MCP_URL or pass --url when using --remote");
}
const token = process.env.MCP_PRIVATE_TOKEN;
if (!token && !new URL(endpoint).searchParams.has("token")) {
  throw new Error(
    "MCP_PRIVATE_TOKEN is required unless the endpoint URL contains a token",
  );
}
const batchSize = clamp(Number(argumentValue("--batch-size") ?? 5), 1, 100);
const source = JSON.parse(await readFile(inputPath, "utf8")) as ExportFile;
if (!Array.isArray(source.bookmarks)) {
  throw new Error("Import file must contain a bookmarks array");
}
const calculatedSha = sha256(JSON.stringify(source.bookmarks));
if (source.sha256 && source.sha256 !== calculatedSha) {
  throw new Error(
    `Import SHA-256 mismatch: expected ${source.sha256}, calculated ${calculatedSha}`,
  );
}

let received = 0;
let succeeded = 0;
let failed = 0;
let destination: ImportResult["destination"];
const failures: Array<{ url: string; error: string }> = [];
for (let offset = 0; offset < source.bookmarks.length; offset += batchSize) {
  const batch = source.bookmarks.slice(offset, offset + batchSize);
  const result = await callImport(batch, calculatedSha, offset / batchSize + 1);
  received += result.received;
  succeeded += result.succeeded;
  failed += result.failed;
  destination = result.destination ?? destination;
  failures.push(
    ...result.results
      .filter(
        (item): item is { url: string; ok: false; error: string } =>
          !item.ok && typeof item.error === "string",
      )
      .map((item) => ({ url: item.url, error: item.error })),
  );
  console.log(
    JSON.stringify({
      batch: offset / batchSize + 1,
      received: result.received,
      succeeded: result.succeeded,
      failed: result.failed,
    }),
  );
}

const expected = {
  bookmarks: source.counts?.bookmarks ?? source.bookmarks.length,
  tags:
    source.counts?.tags ??
    source.bookmarks.reduce<number>(
      (sum, bookmark) =>
        sum +
        (isRecord(bookmark) && Array.isArray(bookmark.tags)
          ? bookmark.tags.length
          : 0),
      0,
    ),
  with_content:
    source.counts?.with_content ??
    source.bookmarks.filter(
      (bookmark) =>
        isRecord(bookmark) &&
        typeof bookmark.firecrawl_content === "string" &&
        bookmark.firecrawl_content.length > 0,
    ).length,
};
console.log(
  JSON.stringify({
    complete: failed === 0 && succeeded === expected.bookmarks,
    sha256: calculatedSha,
    expected,
    imported: { received, succeeded, failed },
    destination: destination
      ? {
          ...destination,
          tags: destination.tags_total,
        }
      : null,
    failures,
  }),
);
if (failed > 0) process.exitCode = 1;

async function callImport(
  bookmarks: unknown[],
  sourceSha256: string,
  batch: number,
): Promise<ImportResult> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
  };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(endpoint!, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: `bookmark-import-${batch}`,
      method: "tools/call",
      params: {
        name: "IMPORT_BOOKMARKS",
        arguments: { bookmarks, source_sha256: sourceSha256 },
      },
    }),
  });
  const envelope = (await response.json()) as {
    error?: { message?: string };
    result?: {
      structuredContent?: ImportResult;
      content?: Array<{ type?: string; text?: string }>;
    };
  };
  if (!response.ok || envelope.error) {
    throw new Error(
      `MCP import batch ${batch} failed: ${
        envelope.error?.message ?? `HTTP ${response.status}`
      }`,
    );
  }
  if (envelope.result?.structuredContent) {
    return envelope.result.structuredContent;
  }
  const text = envelope.result?.content?.find(
    (item) => item.type === "text",
  )?.text;
  if (!text) throw new Error(`MCP import batch ${batch} returned no result`);
  return JSON.parse(text) as ImportResult;
}

async function loadEnvironment(path: string): Promise<void> {
  let body: string;
  try {
    body = await readFile(path, "utf8");
  } catch {
    return;
  }
  for (const line of body.split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match?.[1] || process.env[match[1]] !== undefined) continue;
    const raw = match[2] ?? "";
    process.env[match[1]] = raw.replace(/^(['"])([\s\S]*)\1$/, "$2");
  }
}

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.trunc(value)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
