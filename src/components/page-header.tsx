/**
 * Page Header Component
 *
 * Shared header component for pages.
 * When no props are passed, shows the default author/blog introduction.
 * When title/subtitle are passed, shows a custom page header.
 */

interface PageHeaderProps {
  title?: string;
  subtitle?: string;
}

export function PageHeader({ title, subtitle }: PageHeaderProps = {}) {
  // Custom header for specific pages
  if (title) {
    return (
      <div className="mb-6">
        <h1
          className="text-2xl font-bold mb-2"
          style={{ color: "var(--color-fg)" }}
        >
          {title}
        </h1>
        {subtitle && (
          <p style={{ color: "var(--color-fg-muted)" }}>{subtitle}</p>
        )}
      </div>
    );
  }

  // Default header for blog home
  return (
    <div className="mb-6 flex flex-wrap gap-3">
      <div
        className="px-4 py-3 rounded-2xl text-sm"
        style={{
          backgroundColor: "var(--color-bg-secondary)",
          color: "var(--color-fg)",
        }}
      >
        <div>
          Personal blog of{" "}
          <strong>
            <a
              href="https://www.linkedin.com/in/vibegui/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Guilherme Rodrigues
            </a>
          </strong>
          , co-founder of{" "}
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
        <div style={{ color: "var(--color-fg-muted)" }} className="mt-1">
          Articles, essays, and thoughts on technology, leadership, and building
          in Brazil.
        </div>
      </div>

      <a
        href="/bookmarks"
        className="px-4 py-3 rounded-2xl text-sm block hover:scale-[1.02] transition-transform"
        style={{
          backgroundColor: "var(--color-bg-secondary)",
          color: "var(--color-fg)",
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-semibold px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: "var(--color-accent)",
              color: "var(--color-bg)",
            }}
          >
            new
          </span>
          <span className="font-semibold">vibegui Bookmarks</span>
        </div>
        <div style={{ color: "var(--color-fg-muted)" }} className="mt-1">
          An AI-curated list of relevant articles and projects.
        </div>
      </a>
    </div>
  );
}
