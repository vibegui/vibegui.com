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
  coverImage?: string | null;
  featured?: boolean;
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
  coverImage,
  featured = false,
}: ArticleCardProps) {
  return (
    <article
      className={`group ${featured ? "pb-5 border-[var(--color-border)]" : "py-3"}`}
    >
      {/* Full page load ensures SSG HTML with embedded data */}
      <a href={`/article/${slug}`} className="block hover:no-underline">
        {coverImage && (
          <div className="mb-3 overflow-hidden rounded-lg">
            <img
              src={coverImage}
              alt=""
              className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              style={{ aspectRatio: "1200 / 630" }}
            />
          </div>
        )}
        <time
          dateTime={date}
          className="text-sm"
          style={{ color: "var(--color-fg-muted)" }}
        >
          {formatDate(date)}
        </time>
        <h2
          className={`mt-1 font-semibold transition-colors ${featured ? "text-xl" : "text-lg"}`}
          style={{ color: "var(--color-fg)" }}
        >
          {title}
        </h2>
        {description && (
          <p
            className="mt-2 text-sm line-clamp-2"
            style={{ color: "var(--color-fg-muted)" }}
          >
            {description}
          </p>
        )}
        <span
          className="mt-3 inline-block text-sm"
          style={{ color: "var(--color-accent)" }}
        >
          Read more →
        </span>
      </a>
    </article>
  );
}
