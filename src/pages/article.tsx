/**
 * Article Page
 *
 * Loads and renders a single article by slug.
 * Fetches markdown content and renders client-side.
 */

import { useState, useEffect } from "react";
import { Link } from "../app";
import { marked } from "marked";

interface ArticleData {
  title: string;
  date: string;
  description?: string;
  content: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Parse frontmatter from markdown
 */
function parseFrontmatter(content: string): {
  frontmatter: Record<string, string>;
  body: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const [, yamlStr, body] = match;
  const frontmatter: Record<string, string> = {};

  for (const line of (yamlStr ?? "").split("\n")) {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      frontmatter[key] = value;
    }
  }

  return { frontmatter, body: body ?? "" };
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
        const response = await fetch(`/content/articles/${slug}.md`);
        if (!response.ok) {
          throw new Error("Article not found");
        }

        const raw = await response.text();
        const { frontmatter, body } = parseFrontmatter(raw);

        setArticle({
          title: frontmatter.title ?? slug,
          date: frontmatter.date ?? new Date().toISOString().split("T")[0]!,
          description: frontmatter.description,
          content: body,
        });
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
      {/* Constrain content to prose width for consistent alignment */}
      <div>
        <header className="mt-4 mb-8">
          <time
            dateTime={article.date}
            className="text-sm"
            style={{ color: "var(--color-fg-muted)" }}
          >
            {formatDate(article.date)}
          </time>
          <h1 className="mt-4 text-3xl md:text-4xl font-bold">
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
        </header>

        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: trusted markdown content */}
        <div
          className="prose"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      </div>
    </article>
  );
}
