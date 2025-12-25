/**
 * Content Page (Home)
 *
 * The main landing page displaying published articles.
 * In dev mode, shows a toggle to preview drafts (local-only).
 */

import { useState, useEffect } from "react";
import { ArticleCard } from "../components/article-card";
import { PageHeader } from "../components/page-header";
import { loadManifest, type ArticleMeta } from "../lib/manifest";

export function Content() {
  const [articles, setArticles] = useState<ArticleMeta[]>([]);
  const [drafts, setDrafts] = useState<ArticleMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDrafts, setShowDrafts] = useState(true);

  useEffect(() => {
    const loadArticles = async () => {
      const manifest = await loadManifest();
      setArticles(manifest?.articles ?? []);
      setDrafts(manifest?.drafts ?? []);
      setLoading(false);
    };

    loadArticles();
  }, []);

  const hasDrafts = drafts.length > 0;

  return (
    <div className="container py-6">
      <PageHeader />

      {loading ? (
        <p style={{ color: "var(--color-fg-muted)" }}>Loading articles...</p>
      ) : (
        <>
          {/* Draft toggle - only shown when drafts exist (dev mode) */}
          {hasDrafts && (
            <div
              className="mb-6 p-4 rounded-lg flex items-center justify-between"
              style={{
                backgroundColor: "var(--color-bg-tertiary)",
                border: "1px dashed var(--color-border)",
              }}
            >
              <div className="flex items-center gap-3">
                <span style={{ fontSize: "1.25rem" }}>📝</span>
                <div>
                  <span
                    style={{
                      color: "var(--color-fg)",
                      fontWeight: 500,
                    }}
                  >
                    {drafts.length} Draft{drafts.length !== 1 ? "s" : ""}
                  </span>
                  <span
                    style={{
                      color: "var(--color-fg-muted)",
                      marginLeft: "0.5rem",
                      fontSize: "0.875rem",
                    }}
                  >
                    (local only)
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowDrafts(!showDrafts)}
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                style={{
                  backgroundColor: showDrafts
                    ? "var(--color-accent)"
                    : "var(--color-bg-secondary)",
                  color: showDrafts
                    ? "var(--color-bg)"
                    : "var(--color-fg-muted)",
                  border: showDrafts ? "none" : "1px solid var(--color-border)",
                }}
              >
                {showDrafts ? "Hide Drafts" : "Show Drafts"}
              </button>
            </div>
          )}

          {/* Drafts section */}
          {hasDrafts && showDrafts && (
            <div className="mb-8">
              <h2
                className="text-lg font-semibold mb-4 flex items-center gap-2"
                style={{ color: "var(--color-fg-muted)" }}
              >
                <span>Drafts</span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: "var(--color-warning, #f59e0b)",
                    color: "#000",
                  }}
                >
                  Preview
                </span>
              </h2>
              {drafts.map((article) => (
                <div
                  key={article.id}
                  style={{
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: "0.75rem",
                      right: "0.75rem",
                      backgroundColor: "var(--color-warning, #f59e0b)",
                      color: "#000",
                      fontSize: "0.625rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      padding: "0.25rem 0.5rem",
                      borderRadius: "0.25rem",
                      zIndex: 10,
                    }}
                  >
                    Draft
                  </div>
                  <ArticleCard
                    slug={article.id}
                    title={article.title}
                    date={article.date}
                    description={article.description}
                    featured={false}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Published articles */}
          {articles.length === 0 && !hasDrafts ? (
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
              {hasDrafts && showDrafts && articles.length > 0 && (
                <h2
                  className="text-lg font-semibold mb-4"
                  style={{ color: "var(--color-fg-muted)" }}
                >
                  Published
                </h2>
              )}
              {articles.map((article, index) => (
                <ArticleCard
                  key={article.id}
                  slug={article.id}
                  title={article.title}
                  date={article.date}
                  description={article.description}
                  featured={index === 0 && !hasDrafts}
                />
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
