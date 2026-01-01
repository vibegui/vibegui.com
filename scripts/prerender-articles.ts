/**
 * Pre-render HTML files for each article with proper SEO meta tags
 *
 * This script runs after Vite build and generates:
 * - dist/article/{slug}/index.html for each published article
 *
 * Each HTML file has the correct <title>, <meta og:*>, <meta twitter:*>
 * for social sharing, while still loading the same React SPA.
 *
 * Note: Reads from exported JSON files (dist/content/manifest.json) instead
 * of SQLite, so it works in zero-deps environments like Cloudflare Pages.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const DIST_DIR = join(PROJECT_ROOT, "dist");
const BASE_URL = "https://vibegui.com";
const DEFAULT_OG_IMAGE = `${BASE_URL}/images/og-default.png`;

interface ArticleMeta {
  slug: string;
  title: string;
  description?: string;
  date: string;
  status: "draft" | "published";
  coverImage?: string;
}

// Read articles from the exported manifest JSON (no SQLite dependency)
function getPublishedArticles(): ArticleMeta[] {
  const manifestPath = join(DIST_DIR, "content", "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(
      "dist/content/manifest.json not found. Run export-content.ts first.",
    );
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  return (manifest.articles || []).filter(
    (a: ArticleMeta) => a.status === "published",
  );
}

// Read the built index.html to extract asset references
function getBuiltIndexHtml(): string {
  const indexPath = join(DIST_DIR, "index.html");
  if (!existsSync(indexPath)) {
    throw new Error(
      "dist/index.html not found. Run `bun run build:client` first.",
    );
  }
  return readFileSync(indexPath, "utf-8");
}

// Extract script and link tags from built HTML
function extractAssets(html: string): { scripts: string; styles: string } {
  // Get script tags with src (exclude inline theme script which we add ourselves)
  const scriptWithSrc = html.match(/<script[^>]*src="[^"]*"[^>]*><\/script>/g);
  // Only get stylesheet links that point to /assets/ (exclude Google Fonts which we add ourselves)
  const styleMatches = html.match(
    /<link[^>]*stylesheet[^>]*href="\/assets\/[^"]*"[^>]*>/g,
  );
  const preloadMatches = html.match(/<link[^>]*modulepreload[^>]*>/g);
  const manifestMatch = html.match(
    /<script>window\.__MANIFEST_PATH__="[^"]*";<\/script>/,
  );

  const scripts = [...(scriptWithSrc || []), manifestMatch?.[0] || ""].join(
    "\n    ",
  );

  const styles = [...(preloadMatches || []), ...(styleMatches || [])].join(
    "\n    ",
  );

  return { scripts, styles };
}

// Generate HTML for a specific article
function generateArticleHtml(
  article: {
    slug: string;
    title: string;
    description?: string;
    date: string;
    coverImage?: string;
  },
  assets: { scripts: string; styles: string },
): string {
  const title = `${article.title} | vibegui`;
  const description =
    article.description ||
    "Personal blog of Guilherme Rodrigues - technology, entrepreneurship, and Brazil's tech future";
  const url = `${BASE_URL}/article/${article.slug}`;
  const image = article.coverImage || DEFAULT_OG_IMAGE;
  const publishedTime = article.date;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    
    <!-- SEO -->
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${url}" />
    
    <!-- Open Graph -->
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${escapeHtml(article.title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:site_name" content="vibegui.com" />
    <meta property="article:published_time" content="${publishedTime}" />
    <meta property="article:author" content="Guilherme Rodrigues" />
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@vibegui" />
    <meta name="twitter:creator" content="@vibegui" />
    <meta name="twitter:title" content="${escapeHtml(article.title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${image}" />

    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
      rel="stylesheet"
    />

    <!-- Theme initialization -->
    <script>
      (function () {
        const stored = localStorage.getItem("theme");
        const theme = stored === "dark" || stored === "light" ? stored : "dark";
        document.documentElement.setAttribute("data-theme", theme);
      })();
    </script>

    <!-- Assets from Vite build -->
    ${assets.styles}
    ${assets.scripts}
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Main
function main() {
  const startTime = performance.now();
  console.log("🖨️  Pre-rendering article HTML files for SEO...\n");

  // Get all published articles from exported manifest
  const publishedArticles = getPublishedArticles();

  // Read built index.html and extract assets
  const builtHtml = getBuiltIndexHtml();
  const assets = extractAssets(builtHtml);

  let count = 0;

  for (const article of publishedArticles) {
    // Create directory: dist/article/{slug}/
    const articleDir = join(DIST_DIR, "article", article.slug);
    if (!existsSync(articleDir)) {
      mkdirSync(articleDir, { recursive: true });
    }

    // Generate and write HTML
    const html = generateArticleHtml(article, assets);
    const outputPath = join(articleDir, "index.html");
    writeFileSync(outputPath, html);

    count++;
  }

  const elapsed = (performance.now() - startTime).toFixed(0);
  console.log(`✅ Pre-rendered ${count} article pages (${elapsed}ms)`);
  console.log(`   Output: dist/article/{slug}/index.html`);
}

main();
