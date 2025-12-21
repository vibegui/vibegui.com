/**
 * Article Card Component
 *
 * Displays article preview with title, date, and excerpt.
 */

import { Link } from "../app";

interface ArticleCardProps {
  slug: string;
  title: string;
  date: string;
  description?: string | null;
  featured?: boolean;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function ArticleCard({
  slug,
  title,
  date,
  description,
  featured = false,
}: ArticleCardProps) {
  return (
    <article
      className={`group ${featured ? "pb-5 border-[var(--color-border)]" : "py-3"}`}
    >
      <Link href={`/article/${slug}`} className="block hover:no-underline">
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
      </Link>
    </article>
  );
}
