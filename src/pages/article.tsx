/**
 * Article Page
 *
 * Loads and renders a single article by slug.
 * Fetches JSON content from the exported content files.
 */

import { useState, useEffect } from "react";
import { Link } from "../app";
import { marked } from "marked";
import { getArticlePath } from "../lib/manifest";

interface ArticleData {
  slug: string;
  title: string;
  date: string;
  description?: string;
  content: string;
  tags?: string[];
  status: "draft" | "published";
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function Article({ slug }: { slug: string }) {
  const [article, setArticle] = useState<ArticleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadArticle = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get the path from manifest
        const articlePath = await getArticlePath(slug);
        if (!articlePath) {
          throw new Error("Article not found");
        }

        const response = await fetch(articlePath);
        if (!response.ok) {
          throw new Error("Article not found");
        }

        const data = await response.json();
        setArticle(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load article");
      }

      setLoading(false);
    };

    loadArticle();
  }, [slug]);

  if (loading) {
    return (
      <div className="container py-12">
        <p className="text-[var(--color-fg-muted)] dark:text-[var(--color-dark-fg-muted)]">
          Loading...
        </p>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="container py-12">
        <h1 className="text-2xl font-bold mb-4">Article not found</h1>
        <p className="text-[var(--color-fg-muted)] dark:text-[var(--color-dark-fg-muted)] mb-4">
          {error}
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
