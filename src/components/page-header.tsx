/**
 * Page Header Component
 *
 * Shared header component for the Content (home) page.
 * Two-line introduction with author info and content description.
 */

export function PageHeader() {
  return (
    <div className="mb-6">
      <div
        className="inline-block px-4 py-3 rounded-2xl text-sm"
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
    </div>
  );
}
