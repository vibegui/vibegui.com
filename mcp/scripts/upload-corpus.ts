#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ARTICLES_DIR = join(import.meta.dir, "..", "..", "blog", "articles");
const BUCKET = "vibegui-corpus";
const PREFIX = "articles";
const MANIFEST_KEY = "_meta/published-articles.json";
const remote = process.argv.includes("--remote");
const locationFlag = remote ? "--remote" : "--local";

const files = (await readdir(ARTICLES_DIR))
  .filter((file) => file.endsWith(".md") && file !== "README.md")
  .sort();

const published: Array<{ file: string; path: string; hash: string }> = [];
for (const file of files) {
  const path = join(ARTICLES_DIR, file);
  const body = await readFile(path, "utf8");
  const status = body.match(/^status:\s*['"]?([^'"\r\n]+)['"]?\s*$/m)?.[1];
  if (status?.trim() !== "published") continue;
  published.push({
    file,
    path,
    hash: createHash("sha256").update(body).digest("hex").slice(0, 12),
  });
}

console.log(
  `Uploading ${published.length} published Markdown articles to r2://${BUCKET}/${PREFIX}/`,
);

const temporaryDirectory = await mkdtemp(join(tmpdir(), "vibegui-corpus-"));
const manifestPath = join(temporaryDirectory, "published-articles.json");

try {
  const previousManifest = await readPreviousManifest(manifestPath);
  const currentFiles = new Set(published.map((article) => article.file));
  const staleFiles = previousManifest.files.filter(
    (file) => !currentFiles.has(file),
  );

  for (const file of staleFiles) {
    runWrangler([
      "r2",
      "object",
      "delete",
      `${BUCKET}/${PREFIX}/${file}`,
      locationFlag,
    ]);
    console.log(`  − ${file} (removed from public corpus)`);
  }

  for (const article of published) {
    if (previousManifest.hashes[article.file] === article.hash) {
      console.log(`  = ${article.file} (unchanged)`);
      continue;
    }
    runWrangler([
      "r2",
      "object",
      "put",
      `${BUCKET}/${PREFIX}/${article.file}`,
      "--file",
      article.path,
      "--content-type",
      "text/markdown; charset=utf-8",
      "--force",
      locationFlag,
    ]);
    console.log(`  ✓ ${article.file} (${article.hash})`);
  }

  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        files: published.map((article) => article.file),
        hashes: Object.fromEntries(
          published.map((article) => [article.file, article.hash]),
        ),
      },
      null,
      2,
    )}\n`,
  );
  runWrangler([
    "r2",
    "object",
    "put",
    `${BUCKET}/${MANIFEST_KEY}`,
    "--file",
    manifestPath,
    "--content-type",
    "application/json",
    "--force",
    locationFlag,
  ]);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

console.log(
  remote
    ? "Published corpus uploaded. AI Search will index the articles/ prefix on its next sync."
    : "Local corpus uploaded.",
);

async function readPreviousManifest(
  destination: string,
): Promise<{ files: string[]; hashes: Record<string, string> }> {
  const result = spawnSync(
    "bunx",
    [
      "wrangler",
      "r2",
      "object",
      "get",
      `${BUCKET}/${MANIFEST_KEY}`,
      "--file",
      destination,
      locationFlag,
    ],
    { stdio: "ignore" },
  );
  if (result.status !== 0) return { files: [], hashes: {} };

  try {
    const parsed = JSON.parse(await readFile(destination, "utf8")) as {
      files?: unknown;
      hashes?: unknown;
    };
    const files = Array.isArray(parsed.files)
      ? parsed.files.filter((file): file is string => typeof file === "string")
      : [];
    const hashes =
      parsed.hashes &&
      typeof parsed.hashes === "object" &&
      !Array.isArray(parsed.hashes)
        ? Object.fromEntries(
            Object.entries(parsed.hashes).filter(
              (entry): entry is [string, string] =>
                typeof entry[1] === "string",
            ),
          )
        : {};
    return { files, hashes };
  } catch {
    return { files: [], hashes: {} };
  }
}

function runWrangler(args: string[]): void {
  const result = spawnSync("bunx", ["wrangler", ...args], {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`wrangler ${args.join(" ")} failed`);
  }
}
