/**
 * Home Page
 *
 * Displays:
 * - Banner with personal info
 * - Featured latest article
 * - List of older articles
 */

import { useState, useEffect } from "react";
import { ArticleCard } from "../components/article-card";

interface ArticleMeta {
  id: string;
  title: string;
  date: string;
  description?: string | null;
}

export function Home() {
  const [articles, setArticles] = useState<ArticleMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In production, this would load from /content/manifest.json
    // For now, we'll show placeholder content
    const loadArticles = async () => {
      try {
        // Try to fetch manifest
        const response = await fetch("/content/manifest.json");
        if (response.ok) {
          const data = await response.json();
          setArticles(data.articles ?? []);
        } else {
          // Use placeholder
          setArticles([]);
        }
      } catch {
        setArticles([]);
      }
      setLoading(false);
    };

    loadArticles();
  }, []);

  const [featured, ...rest] = articles;

  return (
    <div className="container py-6 md:py-8">
      {/* Banner */}
      <div
        className="mb-6 inline-block px-4 py-2 rounded-full text-sm"
        style={{
          backgroundColor: "var(--color-bg-secondary)",
          color: "var(--color-fg)",
        }}
      >
        Personal blog of <strong>Guilherme Rodrigues</strong>, co-founder of{" "}
        <a
          href="https://decocms.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium"
        >
          decocms.com
        </a>
        , RJ ↔ NY
      </div>

      {loading ? (
        <div className="py-8" style={{ color: "var(--color-fg-muted)" }}>
          Loading...
        </div>
      ) : articles.length === 0 ? (
        <div className="py-12">
          <p className="mb-4" style={{ color: "var(--color-fg-muted)" }}>
            No articles yet. Create your first one using the MCP tools!
          </p>
          <div
            className="p-6 rounded-lg"
            style={{ backgroundColor: "var(--color-bg-secondary)" }}
          >
            <p
              className="font-mono text-sm mb-2"
              style={{ color: "var(--color-fg-muted)" }}
            >
              # Create an idea
            </p>
            <code style={{ color: "var(--color-accent)" }}>
              COLLECTION_IDEAS_CREATE(&#123; title: "My first idea", content:
              "..." &#125;)
            </code>
          </div>
        </div>
      ) : (
        <>
          {/* Featured Article */}
          {featured && (
            <ArticleCard
              slug={featured.id}
              title={featured.title}
              date={featured.date}
              description={featured.description}
              featured
            />
          )}

          {/* Article List */}
          {rest.length > 0 && (
            <div className="mt-8">
              <h2
                className="text-lg font-semibold mb-4"
                style={{ color: "var(--color-fg-muted)" }}
              >
                More Articles
              </h2>
              <div
                className="divide-y"
                style={{ borderColor: "var(--color-border)" }}
              >
                {rest.map((article) => (
                  <ArticleCard
                    key={article.id}
                    slug={article.id}
                    title={article.title}
                    date={article.date}
                    description={article.description}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
