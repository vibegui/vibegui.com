/**
 * Content Page (Home)
 *
 * The main landing page displaying published articles.
 */

import { useState, useEffect } from "react";
import { ArticleCard } from "../components/article-card";
import { PageHeader } from "../components/page-header";

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
    <div className="container py-6">
      <PageHeader />

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
        <>
          {articles.map((article, index) => (
            <ArticleCard
              key={article.id}
              slug={article.id}
              title={article.title}
              date={article.date}
              description={article.description}
              featured={index === 0}
            />
          ))}
        </>
      )}
    </div>
  );
}
