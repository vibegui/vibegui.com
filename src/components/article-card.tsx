/**
 * Article Card Component
 *
 * Displays article preview with title, date, and excerpt.
 * Uses regular <a> tags instead of Link to force full page load,
 * ensuring the SSG HTML with embedded article data is served.
 */

interface ArticleCardProps {
  slug: string;
  title: string;
  date: string;
  description?: string | null;
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

export function ArticleCard({
  slug,
  title,
  date,
  description,
}: ArticleCardProps) {
  return (
    <article
      data-testid="article-card"
      className="group py-8 md:py-10 border-b"
      style={{ borderColor: "var(--color-border)" }}
    >
      {/* Full page load ensures SSG HTML with embedded data */}
      <a href={`/article/${slug}`} className="block hover:no-underline">
        <time
          dateTime={date}
          className="text-xs tracking-wide"
          style={{ color: "var(--color-fg-muted)" }}
        >
          {formatDate(date)}
        </time>
        <h2
          className="mt-3 text-2xl md:text-3xl transition-colors group-hover:text-[var(--color-accent)]"
          style={{ color: "var(--color-fg)" }}
        >
          {title}
        </h2>
        {description && (
          <p
            className="mt-3 text-base leading-relaxed max-w-2xl"
            style={{ color: "var(--color-fg-muted)" }}
          >
            {description}
          </p>
        )}
        <span
          className="mt-5 inline-block text-sm"
          style={{ color: "var(--color-accent)" }}
        >
          Read essay →
        </span>
      </a>
    </article>
  );
}
