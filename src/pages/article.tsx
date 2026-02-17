/**
 * Article Page
 *
 * SSG: Article data is embedded in the HTML at build time.
 * Reads from <script id="article-data"> - no fetch needed on initial load.
 * Falls back to page redirect for SPA navigation (forces SSG page load).
 */

import { Link } from "../app";
import { marked } from "marked";

interface ArticleData {
  slug: string;
  title: string;
  date: string;
  description?: string;
  content: string;
  tags?: string[];
  status: "draft" | "published";
  coverImage?: string;
}

// Read embedded article data from SSG HTML
function getEmbeddedArticle(): ArticleData | null {
  if (typeof document === "undefined") return null;
  const script = document.getElementById("article-data");
  if (!script) return null;
  try {
    return JSON.parse(script.textContent || "");
  } catch {
    return null;
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function Article({ slug }: { slug: string }) {
  // Read embedded data from SSG HTML
  const article = getEmbeddedArticle();

  // No embedded data - article not found or wrong slug
  if (!article || article.slug !== slug) {
    return (
      <div className="container py-12">
        <h1 className="text-2xl font-bold mb-4">Article not found</h1>
        <p className="text-[var(--color-fg-muted)] mb-4">
          Could not load article data. Try{" "}
          <a href={`/article/${slug}`} className="underline">
            refreshing the page
          </a>
          .
        </p>
        <Link href="/">← Back to home</Link>
      </div>
    );
  }

  // Render markdown to HTML, removing the first H1 if it matches the title
  let bodyContent = article.content.trim();
  // Remove leading H1 that duplicates the frontmatter title
  bodyContent = bodyContent.replace(/^#\s+.+\n+/, "");
  const htmlContent = marked(bodyContent, { async: false }) as string;

  return (
    <article className="container py-4">
      {/* Draft badge */}
      {article.status === "draft" && (
        <div
          className="inline-block mb-4 px-3 py-1 rounded-md text-sm font-medium"
          style={{
            backgroundColor: "var(--color-warning, #f59e0b)",
            color: "#000",
          }}
        >
          📝 Draft - Local Preview Only
        </div>
      )}

      {/* Cover image */}
      {article.coverImage && (
        <div className="mb-6 -mx-4 md:mx-0 overflow-hidden md:rounded-lg">
          <img src={article.coverImage} alt="" className="w-full h-auto" />
        </div>
      )}

      {/* Constrain all content to prose width */}
      <div className="prose">
        <header className="mt-4 mb-8">
          <time
            dateTime={article.date}
            className="text-sm"
            style={{ color: "var(--color-fg-muted)" }}
          >
            {formatDate(article.date)}
          </time>
          <h1
            className="mt-6 text-3xl md:text-4xl font-bold"
            style={{ marginBlock: "0.5em" }}
          >
            {article.title}
          </h1>
          {article.description && (
            <p
              className="mt-4 text-xl"
              style={{ color: "var(--color-fg-muted)" }}
            >
              {article.description}
            </p>
          )}
          {article.tags && article.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-1 rounded-full"
                  style={{
                    backgroundColor: "var(--color-bg-tertiary)",
                    color: "var(--color-fg-muted)",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </header>

        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: trusted markdown content */}
        <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
      </div>
    </article>
  );
}
