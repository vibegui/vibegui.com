/**
 * Content Page
 *
 * Displays a list of all published articles.
 */

import { useState, useEffect } from "react";
import { Link } from "../app";
import { ArticleCard } from "../components/article-card";

interface ArticleMeta {
  id: string;
  title: string;
  date: string;
  description?: string | null;
  tags?: string[];
}

export function Content() {
  const [articles, setArticles] = useState<ArticleMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadArticles = async () => {
      try {
        const response = await fetch("/content/manifest.json");
        if (response.ok) {
          const data = await response.json();
          setArticles(data.articles ?? []);
        } else {
          setArticles([]);
        }
      } catch {
        setArticles([]);
      }
      setLoading(false);
    };

    loadArticles();
  }, []);

  return (
    <div className="container py-8 md:py-12">
      <div className="prose">
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold">Content</h1>
          <p className="mt-4" style={{ color: "var(--color-fg-muted)" }}>
            Articles, essays, and thoughts on technology, leadership, and
            building in Brazil.
          </p>
        </header>

        {loading ? (
          <p style={{ color: "var(--color-fg-muted)" }}>Loading articles...</p>
        ) : articles.length === 0 ? (
          <div
            className="p-6 rounded-lg text-center"
            style={{ backgroundColor: "var(--color-bg-secondary)" }}
          >
            <p style={{ color: "var(--color-fg-muted)" }}>
              No articles yet. Check back soon!
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {articles.map((article) => (
              <ArticleCard
                key={article.id}
                slug={article.id}
                title={article.title}
                date={article.date}
                description={article.description}
              />
            ))}
          </div>
        )}

        <div className="mt-12">
          <Link
            href="/"
            className="text-sm"
            style={{ color: "var(--color-fg-muted)" }}
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
