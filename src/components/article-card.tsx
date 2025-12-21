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
      className={`group ${featured ? "py-8 border-b border-[var(--color-border)] dark:border-[var(--color-dark-border)]" : "py-6"}`}
    >
      <Link
        href={`/article/${slug}`}
        className="block hover:no-underline"
      >
        <time
          dateTime={date}
          className="text-sm text-[var(--color-fg-muted)] dark:text-[var(--color-dark-fg-muted)]"
        >
          {formatDate(date)}
        </time>
        <h2
          className={`mt-1 font-semibold group-hover:text-[var(--color-accent)] dark:group-hover:text-[var(--color-dark-accent)] transition-colors ${featured ? "text-2xl" : "text-xl"}`}
        >
          {title}
        </h2>
        {description && (
          <p className="mt-2 text-[var(--color-fg-muted)] dark:text-[var(--color-dark-fg-muted)] line-clamp-2">
            {description}
          </p>
        )}
        <span className="mt-3 inline-block text-sm text-[var(--color-accent)] dark:text-[var(--color-dark-accent)]">
          Read more →
        </span>
      </Link>
    </article>
  );
}

