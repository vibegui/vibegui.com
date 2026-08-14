/**
 * Generate Content (Step 1 of build)
 *
 * Generates all static content:
 * - public/content/manifest.json (article list for homepage)
 * - .build/article/{slug}/index.html (SSG article pages)
 * - .build/context/{path}/index.html (SSG context pages)
 *
 * Reads articles from blog/articles/*.md (markdown with YAML frontmatter).
 */

import {
  writeFileSync,
  readFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";
import { getAllContent, type Article } from "../lib/articles-reader.ts";
import { renderMdx } from "../lib/mdx-renderer.ts";
import { generateIrene } from "./generate-irene.ts";
import { generateMalvados } from "./generate-malvados.ts";
import { generateImprescindivel } from "./generate-imprescindivel.ts";

const startTime = performance.now();

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const PUBLIC_DIR = join(PROJECT_ROOT, "public");
const CONTENT_DIR = join(PUBLIC_DIR, "content");
const CONTEXT_SRC_DIR = join(PROJECT_ROOT, "context");
const BASE_URL = "https://vibegui.com";
const DEFAULT_OG_IMAGE = `${BASE_URL}/images/og-default.png`;
const OG_MANIFEST_PATH = join(PUBLIC_DIR, "images/og/manifest.json");
// HTML goes to .build/ (not public/) to avoid Vite static file conflicts
const BUILD_DIR = join(PROJECT_ROOT, ".build");
const ARTICLE_DIR = join(BUILD_DIR, "article");
const EN_ARTICLE_DIR = join(BUILD_DIR, "en", "article");
const CONTEXT_DIR = join(BUILD_DIR, "context");

// Cloudflare Pages sets CF_PAGES_BRANCH on every build, including previews, and
// sets CI=true on all of them. Without this check a branch preview would hide
// drafts exactly like production and there would be no way to share one.
const PRODUCTION_BRANCH = "main";
const pagesBranch = process.env.CF_PAGES_BRANCH;
const isPagesPreview =
  pagesBranch !== undefined && pagesBranch !== PRODUCTION_BRANCH;

// In CI or production build, don't include drafts
const isProduction =
  !isPagesPreview &&
  (process.env.CI === "true" ||
    process.env.NODE_ENV === "production" ||
    process.env.VIBEGUI_BUILD_MODE === "production");

// Ensure directories exist. Article output is rebuilt to avoid stale locale paths.
mkdirSync(CONTENT_DIR, { recursive: true });
rmSync(ARTICLE_DIR, { recursive: true, force: true });
rmSync(EN_ARTICLE_DIR, { recursive: true, force: true });
mkdirSync(ARTICLE_DIR, { recursive: true });
mkdirSync(EN_ARTICLE_DIR, { recursive: true });
mkdirSync(CONTEXT_DIR, { recursive: true });

const ARTICLES_DIR = join(PROJECT_ROOT, "blog/articles");
const STORY_CSS = readFileSync(
  join(PROJECT_ROOT, "src/styles/story.css"),
  "utf-8",
);
const allArticles = getAllContent(ARTICLES_DIR, true);

function validateArticles(content: Article[]): void {
  const slugs = new Set<string>();
  const translations = new Set<string>();

  for (const article of content) {
    const slugKey = `${article.locale}:${article.slug}`;
    if (slugs.has(slugKey)) {
      throw new Error(
        `Duplicate article slug "${article.slug}" for locale ${article.locale}`,
      );
    }
    slugs.add(slugKey);

    const translationKey = `${article.locale}:${article.translationKey}`;
    if (translations.has(translationKey)) {
      throw new Error(
        `Duplicate translationKey "${article.translationKey}" for locale ${article.locale}`,
      );
    }
    translations.add(translationKey);
  }
}

validateArticles(allArticles);

// Filter drafts in production
const articles = isProduction
  ? allArticles.filter((c) => c.status === "published")
  : allArticles;

// Drafts may get a page, but they never get advertised. The sitemap, the feeds
// and the redirect table are built from this list only, so a draft is reachable
// by its URL and by nothing else — no crawler, no reader, no RSS client.
const publishedArticles = allArticles.filter((c) => c.status === "published");

interface OgManifest {
  version: number;
  width: number;
  height: number;
  images: Record<string, string>;
}

function readOgManifest(): OgManifest {
  if (!existsSync(OG_MANIFEST_PATH)) {
    throw new Error(
      `Missing OG manifest. Run "bun run og:generate" before generating content.`,
    );
  }
  const parsed = JSON.parse(
    readFileSync(OG_MANIFEST_PATH, "utf-8"),
  ) as OgManifest;
  if (
    parsed.version !== 1 ||
    parsed.width !== 1200 ||
    parsed.height !== 630 ||
    !parsed.images
  ) {
    throw new Error(`Invalid OG manifest: ${OG_MANIFEST_PATH}`);
  }
  return parsed;
}

const ogManifest = readOgManifest();

function articleOgImage(article: Article): string {
  const path = ogManifest.images[`${article.locale}:${article.slug}`];
  if (!path) {
    if (article.status === "published") {
      throw new Error(
        `Missing OG image for ${article.locale}:${article.slug}. Run "bun run og:generate".`,
      );
    }
    return DEFAULT_OG_IMAGE;
  }
  if (!/^\/images\/og\/(?:pt|en)\/[a-z0-9-]+\.[a-f0-9]{8}\.png$/.test(path)) {
    throw new Error(
      `Invalid OG image path for ${article.locale}:${article.slug}`,
    );
  }
  return `${BASE_URL}${path}`;
}

const articlesByTranslation = new Map<
  string,
  Map<Article["locale"], Article>
>();
for (const article of articles) {
  const group =
    articlesByTranslation.get(article.translationKey) ??
    new Map<Article["locale"], Article>();
  group.set(article.locale, article);
  articlesByTranslation.set(article.translationKey, group);
}

function articlePath(article: Article): string {
  return article.locale === "en"
    ? `/en/article/${article.slug}/`
    : `/article/${article.slug}/`;
}

function alternateArticle(article: Article): Article | undefined {
  const alternateLocale = article.locale === "en" ? "pt-BR" : "en";
  return articlesByTranslation
    .get(article.translationKey)
    ?.get(alternateLocale);
}

// Write manifest.json (for index page article list)
const manifest = {
  articles: articles.map((article) => {
    const alternate = alternateArticle(article);
    return {
      slug: article.slug,
      locale: article.locale,
      translationKey: article.translationKey,
      title: article.title,
      description: article.description,
      date: article.date,
      status: article.status,
      tags: article.tags,
      coverImage: article.coverImage,
      layout: article.layout,
      path: articlePath(article),
      ...(alternate ? { alternatePath: articlePath(alternate) } : {}),
      ...(article.originalUrl ? { originalUrl: article.originalUrl } : {}),
      ...(article.sourceLocale ? { sourceLocale: article.sourceLocale } : {}),
      ...(article.translationKind
        ? { translationKind: article.translationKind }
        : {}),
      ...(article.titleGenerated !== undefined
        ? { titleGenerated: article.titleGenerated }
        : {}),
    };
  }),
  projects: [], // Projects removed - can be added back if needed
};
writeFileSync(join(CONTENT_DIR, "manifest.json"), JSON.stringify(manifest));

// Generate article HTML files
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeXml(str: string): string {
  return escapeHtml(str);
}

function absoluteUrl(path: string): string {
  return `${BASE_URL}${path}`;
}

function articleBody(article: Article): string {
  return article.content.trim().replace(/^#\s+.+\n+/, "");
}

async function renderArticle(article: Article): Promise<string> {
  const body = articleBody(article);
  const html =
    article.format === "mdx"
      ? await renderMdx(body)
      : (marked(body, { async: false }) as string);
  return article.layout === "story"
    ? `<style>${STORY_CSS}</style>${html}`
    : html;
}

function generateArticleHtml(article: Article, html: string): string {
  const title = `${article.title} | vibegui`;
  const description =
    article.description ||
    (article.locale === "pt-BR"
      ? "Blog pessoal de Guilherme Rodrigues sobre liderança, IA, software, Brasil e futuros possíveis."
      : "Guilherme Rodrigues' personal blog about leadership, AI, software, Brazil, and possible futures.");
  const path = articlePath(article);
  const url = absoluteUrl(path);
  const image = articleOgImage(article);
  const alternate = alternateArticle(article);
  const translations = articlesByTranslation.get(article.translationKey);
  const ptArticle = translations?.get("pt-BR");
  const enArticle = translations?.get("en");
  const alternateLinks =
    ptArticle && enArticle
      ? [
          `<link rel="alternate" hreflang="pt-BR" href="${absoluteUrl(articlePath(ptArticle))}" />`,
          `<link rel="alternate" hreflang="en" href="${absoluteUrl(articlePath(enArticle))}" />`,
          `<link rel="alternate" hreflang="x-default" href="${absoluteUrl(articlePath(ptArticle))}" />`,
        ].join("\n    ")
      : "";
  const ogLocale = article.locale === "pt-BR" ? "pt_BR" : "en_US";
  const alternateOgLocale = article.locale === "pt-BR" ? "en_US" : "pt_BR";

  // Embed article data as JSON
  // Escape </script> to prevent premature tag closing
  const articleData = JSON.stringify({
    slug: article.slug,
    locale: article.locale,
    translationKey: article.translationKey,
    path,
    ...(alternate ? { alternatePath: articlePath(alternate) } : {}),
    title: article.title,
    description: article.description,
    html,
    layout: article.layout,
    date: article.date,
    status: article.status,
    tags: article.tags,
    coverImage: article.coverImage,
  }).replace(/<\/script>/gi, "<\\/script>");
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description,
    datePublished: article.date,
    inLanguage: article.locale,
    mainEntityOfPage: url,
    image: {
      "@type": "ImageObject",
      url: image,
      width: 1200,
      height: 630,
      encodingFormat: "image/png",
    },
    author: {
      "@type": "Person",
      name: "Guilherme Rodrigues",
      url: BASE_URL,
    },
  }).replace(/<\/script>/gi, "<\\/script>");

  return `<!doctype html>
<html lang="${article.locale}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    
    <!-- SEO -->
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${url}" />${
      article.status === "draft"
        ? `\n    <meta name="robots" content="noindex, nofollow" />`
        : ""
    }
    ${alternateLinks}
    
    <!-- Open Graph -->
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${escapeHtml(article.title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:site_name" content="vibegui.com" />
    <meta property="og:locale" content="${ogLocale}" />
    ${alternate ? `<meta property="og:locale:alternate" content="${alternateOgLocale}" />` : ""}
    <meta property="article:published_time" content="${article.date}" />
    <meta property="article:author" content="Guilherme Rodrigues" />
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@vibegui" />
    <meta name="twitter:creator" content="@vibegui" />
    <meta name="twitter:title" content="${escapeHtml(article.title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${image}" />
    <meta name="twitter:image:alt" content="${escapeHtml(article.title)}" />
    <script type="application/ld+json">${jsonLd}</script>

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
  const articleDir = join(
    article.locale === "en" ? EN_ARTICLE_DIR : ARTICLE_DIR,
    article.slug,
  );
  mkdirSync(articleDir, { recursive: true });
  const html = await renderArticle(article);
  writeFileSync(
    join(articleDir, "index.html"),
    generateArticleHtml(article, html),
  );
}

function sitemapAlternates(article: Article): string {
  const alternate = alternateArticle(article);
  if (!alternate) return "";
  const translations = articlesByTranslation.get(article.translationKey);
  const pt = translations?.get("pt-BR");
  const en = translations?.get("en");
  if (!pt || !en) return "";

  return `
    <xhtml:link rel="alternate" hreflang="pt-BR" href="${absoluteUrl(articlePath(pt))}" />
    <xhtml:link rel="alternate" hreflang="en" href="${absoluteUrl(articlePath(en))}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${absoluteUrl(articlePath(pt))}" />`;
}

function generateSitemap(): void {
  const urls = [
    `<url>
    <loc>${BASE_URL}/</loc>
    <xhtml:link rel="alternate" hreflang="pt-BR" href="${BASE_URL}/" />
    <xhtml:link rel="alternate" hreflang="en" href="${BASE_URL}/en/" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}/" />
  </url>`,
    `<url>
    <loc>${BASE_URL}/en/</loc>
    <xhtml:link rel="alternate" hreflang="pt-BR" href="${BASE_URL}/" />
    <xhtml:link rel="alternate" hreflang="en" href="${BASE_URL}/en/" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}/" />
  </url>`,
    `<url>
    <loc>${BASE_URL}/compromisso</loc>
    <xhtml:link rel="alternate" hreflang="pt-BR" href="${BASE_URL}/compromisso" />
    <xhtml:link rel="alternate" hreflang="en" href="${BASE_URL}/commitment" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}/compromisso" />
  </url>`,
    `<url>
    <loc>${BASE_URL}/commitment</loc>
    <xhtml:link rel="alternate" hreflang="pt-BR" href="${BASE_URL}/compromisso" />
    <xhtml:link rel="alternate" hreflang="en" href="${BASE_URL}/commitment" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}/compromisso" />
  </url>`,
    ...publishedArticles.map(
      (article) => `<url>
    <loc>${absoluteUrl(articlePath(article))}</loc>${sitemapAlternates(article)}
    <lastmod>${article.date}</lastmod>
  </url>`,
    ),
  ];

  writeFileSync(
    join(PUBLIC_DIR, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  ${urls.join("\n  ")}
</urlset>
`,
  );
  writeFileSync(
    join(PUBLIC_DIR, "robots.txt"),
    `User-agent: *
Allow: /

Sitemap: ${BASE_URL}/sitemap.xml
`,
  );
}

function generateFeed(locale: Article["locale"]): void {
  const isEnglish = locale === "en";
  const localeArticles = publishedArticles.filter(
    (article) => article.locale === locale,
  );
  const feedPath = isEnglish ? "/en/feed.xml" : "/feed.xml";
  const homePath = isEnglish ? "/en/" : "/";
  const title = isEnglish
    ? "vibegui — Guilherme Rodrigues on AI, leadership, and software"
    : "vibegui — Guilherme Rodrigues sobre IA, liderança e software";
  const description = isEnglish
    ? "Writing on leadership, AI, software, Brazil, and possible futures."
    : "Textos sobre liderança, IA, software, Brasil e futuros possíveis.";
  const items = localeArticles
    .map(
      (article) => `    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${absoluteUrl(articlePath(article))}</link>
      <guid isPermaLink="true">${absoluteUrl(articlePath(article))}</guid>
      <pubDate>${new Date(`${article.date}T00:00:00Z`).toUTCString()}</pubDate>
      <description>${escapeXml(article.description)}</description>
    </item>`,
    )
    .join("\n");

  const outputPath = join(PUBLIC_DIR, feedPath);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(
    outputPath,
    `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${absoluteUrl(homePath)}</link>
    <description>${escapeXml(description)}</description>
    <language>${locale}</language>
    <atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${absoluteUrl(feedPath)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`,
  );
}

function generateRedirects(): void {
  const redirectsPath = join(PUBLIC_DIR, "_redirects");
  const markerStart = "# BEGIN GENERATED EN ARTICLE REDIRECTS";
  const markerEnd = "# END GENERATED EN ARTICLE REDIRECTS";
  const existing = existsSync(redirectsPath)
    ? readFileSync(redirectsPath, "utf-8")
    : "";
  const preserved = existing
    .replace(new RegExp(`${markerStart}[\\s\\S]*?${markerEnd}\\s*`, "g"), "")
    .trimEnd();
  const ptSlugs = new Set(
    publishedArticles
      .filter((article) => article.locale === "pt-BR")
      .map((article) => article.slug),
  );
  const generated = publishedArticles
    .filter((article) => article.locale === "en" && !ptSlugs.has(article.slug))
    .flatMap((article) => [
      `/article/${article.slug} /en/article/${article.slug}/ 301`,
      `/article/${article.slug}/ /en/article/${article.slug}/ 301`,
    ])
    .join("\n");

  writeFileSync(
    redirectsPath,
    `${preserved ? `${preserved}\n\n` : ""}${markerStart}\n${generated}\n${markerEnd}\n`,
  );
}

generateSitemap();
generateFeed("pt-BR");
generateFeed("en");
generateRedirects();

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
    paragraph = `${paragraph.slice(0, maxLength - 3).replace(/\s+\S*$/, "")}...`;
  }

  return paragraph || "Notes";
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

// Standalone static mini-sites (self-contained HTML, no SPA hydration)
const CONTENT_SRC_DIR = join(PROJECT_ROOT, "content");
const ireneCount = generateIrene(CONTENT_SRC_DIR, BUILD_DIR);
const malvadosCount = generateMalvados(CONTENT_SRC_DIR, BUILD_DIR);
const imprescindivelCount = generateImprescindivel(CONTENT_SRC_DIR, BUILD_DIR);

const draftCount = allArticles.filter((c) => c.status === "draft").length;
const publishedCount = allArticles.filter(
  (c) => c.status === "published",
).length;
const exportInfo = isProduction
  ? `${publishedCount} published (${draftCount} drafts hidden)`
  : `${publishedCount} published + ${draftCount} drafts`;

const elapsed = (performance.now() - startTime).toFixed(0);
console.log(
  `📚 Built: ${exportInfo}, ${contextCount} context pages, ` +
    `${ireneCount} poesias (/irene), ${malvadosCount} tirinhas (/malvados), ` +
    `${imprescindivelCount} seções (/imprescindivel) (${elapsed}ms)`,
);
