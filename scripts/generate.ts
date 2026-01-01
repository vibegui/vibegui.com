/**
 * Generate Content (Step 1 of build)
 *
 * Generates all static content:
 * - public/content/manifest.json (article list for homepage)
 * - .build/article/{slug}/index.html (SSG article pages)
 * - .build/context/{path}/index.html (SSG context pages)
 *
 * Runs BEFORE Vite build. Requires SQLite access.
 */

import {
  writeFileSync,
  readFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
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
const CONTEXT_SRC_DIR = join(PROJECT_ROOT, "context");
// HTML goes to .build/ (not public/) to avoid Vite static file conflicts
const BUILD_DIR = join(PROJECT_ROOT, ".build");
const ARTICLE_DIR = join(BUILD_DIR, "article");
const CONTEXT_DIR = join(BUILD_DIR, "context");

// In CI or production build, don't include drafts
const isProduction =
  process.env.CI === "true" || process.env.NODE_ENV === "production";

// Ensure directories exist (don't wipe - update in place for dev server compatibility)
mkdirSync(CONTENT_DIR, { recursive: true });
mkdirSync(ARTICLE_DIR, { recursive: true });
mkdirSync(CONTEXT_DIR, { recursive: true });

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

// Extract first meaningful paragraph from markdown for SEO description
function extractDescription(content: string, maxLength = 160): string {
  // Remove the title (first H1)
  const withoutTitle = content.replace(/^#\s+.+\n+/, "");

  // Find first paragraph (non-heading, non-list, non-empty line)
  const lines = withoutTitle.split("\n");
  let paragraph = "";
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip headings, lists, blockquotes, empty lines
    if (
      !trimmed ||
      trimmed.startsWith("#") ||
      trimmed.startsWith("-") ||
      trimmed.startsWith("*") ||
      trimmed.startsWith(">") ||
      trimmed.startsWith("|")
    ) {
      if (paragraph) break; // End of first paragraph
      continue;
    }
    paragraph += (paragraph ? " " : "") + trimmed;
    if (paragraph.length > maxLength) break;
  }

  // Clean markdown formatting
  paragraph = paragraph
    .replace(/\*\*([^*]+)\*\*/g, "$1") // bold
    .replace(/\*([^*]+)\*/g, "$1") // italic
    .replace(/`([^`]+)`/g, "$1") // code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"); // links

  // Truncate at word boundary
  if (paragraph.length > maxLength) {
    paragraph =
      paragraph.slice(0, maxLength - 3).replace(/\s+\S*$/, "") + "...";
  }

  return paragraph || `Notes on ${title}`;
}

// Generate context HTML files
function generateContextHtml(
  path: string,
  content: string,
  title: string,
): string {
  const url = `${BASE_URL}/context/${path}`;
  const description = extractDescription(content);

  // Embed content as JSON (same pattern as articles)
  const contextData = JSON.stringify({
    path,
    title,
    content,
  }).replace(/<\/script>/gi, "<\\/script>");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    
    <!-- SEO -->
    <title>${escapeHtml(title)} | vibegui</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${url}" />
    
    <!-- Open Graph -->
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${DEFAULT_OG_IMAGE}" />
    <meta property="og:site_name" content="vibegui.com" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:site" content="@vibegui_" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />

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

    <!-- Dev: Vite injects scripts. Prod: replaced by finalize.ts -->
    <script type="module" src="/@vite/client"></script>
    <script type="module" src="/src/main.tsx"></script>
  </head>
  <body>
    <div id="root"></div>
    <script id="context-data" type="application/json">${contextData}</script>
  </body>
</html>
`;
}

// Process context files recursively
function processContextDir(srcDir: string, basePath = ""): number {
  let count = 0;
  if (!existsSync(srcDir)) return count;

  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = join(srcDir, entry.name);
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      count += processContextDir(srcPath, relativePath);
    } else if (entry.name.endsWith(".md")) {
      const content = readFileSync(srcPath, "utf-8");

      // Extract title from first H1 or filename
      const titleMatch = content.match(/^#\s+(.+)/m);
      const title = titleMatch?.[1] || entry.name.replace(".md", "");

      // Path without .md extension
      const pathWithoutExt = relativePath.replace(/\.md$/, "");
      const destDir = join(CONTEXT_DIR, pathWithoutExt);
      mkdirSync(destDir, { recursive: true });
      writeFileSync(
        join(destDir, "index.html"),
        generateContextHtml(pathWithoutExt, content, title),
      );
      count++;
    }
  }
  return count;
}

const contextCount = processContextDir(CONTEXT_SRC_DIR);

const draftCount = allArticles.filter((c) => c.status === "draft").length;
const publishedCount = allArticles.filter(
  (c) => c.status === "published",
).length;
const exportInfo = isProduction
  ? `${publishedCount} published (${draftCount} drafts hidden)`
  : `${publishedCount} published + ${draftCount} drafts`;

const elapsed = (performance.now() - startTime).toFixed(0);
console.log(
  `📚 Built: ${exportInfo}, ${projects.length} projects, ${contextCount} context (${elapsed}ms)`,
);
