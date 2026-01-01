/**
 * Build Content: Generate manifest and article HTML files
 *
 * Single pipeline for dev and prod:
 * 1. Read articles from SQLite
 * 2. Write manifest.json to public/content/ (for index page)
 * 3. Write article HTML files to public/article/{slug}/index.html
 *
 * In dev, Vite serves public/ directly.
 * In prod, Vite copies public/ to dist/, then we hash the manifest.
 */

import {
  writeFileSync,
  readFileSync,
  mkdirSync,
  existsSync,
  rmSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getAllContent,
  getAllProjects,
  type Content,
} from "../lib/db/content.ts";

const startTime = performance.now();

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const PUBLIC_DIR = join(PROJECT_ROOT, "public");
const CONTENT_DIR = join(PUBLIC_DIR, "content");
// Article HTML goes to .build/ (not public/) to avoid Vite static file conflicts
const ARTICLE_DIR = join(PROJECT_ROOT, ".build", "article");

// In CI or production build, don't include drafts
const isProduction =
  process.env.CI === "true" || process.env.NODE_ENV === "production";

// Ensure directories exist
mkdirSync(CONTENT_DIR, { recursive: true });

// Clean and recreate article directory
if (existsSync(ARTICLE_DIR)) {
  rmSync(ARTICLE_DIR, { recursive: true });
}
mkdirSync(ARTICLE_DIR, { recursive: true });

const allArticles = getAllContent();
const projects = getAllProjects();

// Filter drafts in production
const articles = isProduction
  ? allArticles.filter((c) => c.status === "published")
  : allArticles;

// Write manifest.json (for index page article list)
const manifest = {
  articles: articles.map((c) => ({
    slug: c.slug,
    title: c.title,
    description: c.description,
    date: c.date,
    status: c.status,
    tags: c.tags,
  })),
  projects: projects,
};
writeFileSync(join(CONTENT_DIR, "manifest.json"), JSON.stringify(manifest));

// Generate article HTML files
const BASE_URL = "https://vibegui.com";
const DEFAULT_OG_IMAGE = `${BASE_URL}/images/og-default.png`;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function generateArticleHtml(article: Content): string {
  const title = `${article.title} | vibegui`;
  const description =
    article.description ||
    "Personal blog of Guilherme Rodrigues - technology, entrepreneurship, and Brazil's tech future";
  const url = `${BASE_URL}/article/${article.slug}`;
  const image = article.coverImage || DEFAULT_OG_IMAGE;

  // Embed article data as JSON
  // Escape </script> to prevent premature tag closing
  const articleData = JSON.stringify({
    slug: article.slug,
    title: article.title,
    description: article.description,
    content: article.content,
    date: article.date,
    status: article.status,
    tags: article.tags,
  }).replace(/<\/script>/gi, "<\\/script>");

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
    <meta property="article:published_time" content="${article.date}" />
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
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

    <!-- Theme initialization -->
    <script>
      (function () {
        var stored = localStorage.getItem("theme");
        var theme = stored === "dark" || stored === "light" ? stored : "dark";
        document.documentElement.setAttribute("data-theme", theme);
      })();
    </script>

    <!-- Dev: Vite injects scripts. Prod: replaced by hash-content.ts -->
    <script type="module" src="/@vite/client"></script>
    <script type="module" src="/src/main.tsx"></script>
  </head>
  <body>
    <div id="root"></div>
    <!-- Embedded article data (after root so DOM is ready when React reads it) -->
    <script id="article-data" type="application/json">${articleData}</script>
  </body>
</html>
`;
}

// Write article HTML files
for (const article of articles) {
  const articleDir = join(ARTICLE_DIR, article.slug);
  mkdirSync(articleDir, { recursive: true });
  writeFileSync(join(articleDir, "index.html"), generateArticleHtml(article));
}

const draftCount = allArticles.filter((c) => c.status === "draft").length;
const publishedCount = allArticles.filter(
  (c) => c.status === "published",
).length;
const exportInfo = isProduction
  ? `${publishedCount} published (${draftCount} drafts hidden)`
  : `${publishedCount} published + ${draftCount} drafts`;

const elapsed = (performance.now() - startTime).toFixed(0);
console.log(
  `📚 Built: ${exportInfo}, ${projects.length} projects (${elapsed}ms)`,
);
