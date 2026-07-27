#!/usr/bin/env bun

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import sharp from "sharp";
import { readAllArticles } from "../lib/articles-reader";
import {
  OG_HEIGHT,
  OG_WIDTH,
  renderOgSvg,
  type OgLocale,
} from "../lib/og-template";

interface OgManifest {
  version: 1;
  width: number;
  height: number;
  images: Record<string, string>;
}

const ROOT = resolve(import.meta.dirname, "..");
const ARTICLES_DIR = join(ROOT, "blog/articles");
const OG_DIR = join(ROOT, "public/images/og");
const MANIFEST_PATH = join(OG_DIR, "manifest.json");
const MAX_BYTES = 250 * 1024;

function manifestKey(locale: OgLocale, slug: string): string {
  return `${locale}:${slug}`;
}

function readPreviousManifest(): OgManifest | null {
  if (!existsSync(MANIFEST_PATH)) return null;
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, "utf-8")) as OgManifest;
  } catch {
    throw new Error(`Invalid OG manifest: ${MANIFEST_PATH}`);
  }
}

function removeStaleImages(
  previous: OgManifest | null,
  currentPaths: Set<string>,
): number {
  let removed = 0;
  for (const webPath of Object.values(previous?.images ?? {})) {
    if (
      currentPaths.has(webPath) ||
      !/^\/images\/og\/(?:pt|en)\/[a-z0-9-]+\.[a-f0-9]{8}\.png$/.test(webPath)
    ) {
      continue;
    }

    const filePath = resolve(ROOT, "public", webPath.slice(1));
    if (filePath.startsWith(`${OG_DIR}${sep}`) && existsSync(filePath)) {
      rmSync(filePath);
      removed++;
    }
  }
  return removed;
}

async function main(): Promise<void> {
  const articles = readAllArticles(ARTICLES_DIR, true)
    .filter((article) => article.status === "published")
    .sort((a, b) =>
      manifestKey(a.locale, a.slug).localeCompare(
        manifestKey(b.locale, b.slug),
      ),
    );
  const previous = readPreviousManifest();
  const images: Record<string, string> = {};
  const currentPaths = new Set<string>();
  const sizes: number[] = [];

  mkdirSync(OG_DIR, { recursive: true });

  for (const article of articles) {
    if (!/^[a-z0-9-]+$/.test(article.slug)) {
      throw new Error(`Unsafe article slug for OG image: ${article.slug}`);
    }

    const svg = renderOgSvg({
      title: article.title,
      locale: article.locale,
      date: article.date,
      tag: article.tags[0],
    });
    const { data, info } = await sharp(Buffer.from(svg))
      .png({
        compressionLevel: 9,
        palette: true,
        colours: 128,
        dither: 0,
      })
      .toBuffer({ resolveWithObject: true });

    if (info.width !== OG_WIDTH || info.height !== OG_HEIGHT) {
      throw new Error(
        `${article.slug}: expected ${OG_WIDTH}x${OG_HEIGHT}, got ${info.width}x${info.height}`,
      );
    }
    if (data.byteLength >= MAX_BYTES) {
      throw new Error(
        `${article.slug}: ${(data.byteLength / 1024).toFixed(1)}KB exceeds 250KB`,
      );
    }

    const hash = createHash("sha256").update(data).digest("hex").slice(0, 8);
    const localeFolder = article.locale === "pt-BR" ? "pt" : "en";
    const webPath = `/images/og/${localeFolder}/${article.slug}.${hash}.png`;
    const outputPath = join(ROOT, "public", webPath);
    mkdirSync(dirname(outputPath), { recursive: true });
    if (!existsSync(outputPath)) writeFileSync(outputPath, data);

    images[manifestKey(article.locale, article.slug)] = webPath;
    currentPaths.add(webPath);
    sizes.push(data.byteLength);
  }

  const removed = removeStaleImages(previous, currentPaths);
  const manifest: OgManifest = {
    version: 1,
    width: OG_WIDTH,
    height: OG_HEIGHT,
    images,
  };
  const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
  if (
    !existsSync(MANIFEST_PATH) ||
    readFileSync(MANIFEST_PATH, "utf-8") !== manifestJson
  ) {
    writeFileSync(MANIFEST_PATH, manifestJson);
  }

  const ptCount = articles.filter(
    (article) => article.locale === "pt-BR",
  ).length;
  const enCount = articles.length - ptCount;
  const minSize = Math.min(...sizes) / 1024;
  const maxSize = Math.max(...sizes) / 1024;
  console.log(
    `🖼️  Generated ${articles.length} OG images (${ptCount} PT + ${enCount} EN), ` +
      `${minSize.toFixed(1)}–${maxSize.toFixed(1)}KB${removed ? `, removed ${removed} stale` : ""}`,
  );
}

main().catch((error) => {
  console.error("❌ OG generation failed:", error);
  process.exit(1);
});
