/**
 * Article Page
 *
 * SSG: Article data is embedded in the HTML at build time.
 * Reads from <script id="article-data"> - no fetch needed on initial load.
 * Falls back to page redirect for SPA navigation (forces SSG page load).
 */

import { Link } from "../app";
import { useEffect, useRef } from "react";
import {
  articlePath,
  homePath,
  localeText,
  type Locale,
} from "../lib/manifest";

interface ArticleData {
  slug: string;
  locale: Locale;
  path: string;
  alternatePath?: string | null;
  title: string;
  date: string;
  description?: string;
  html: string;
  layout?: "prose" | "story";
  tags?: string[];
  status: "draft" | "published";
  coverImage?: string;
}

// Read embedded article data from SSG HTML
function getEmbeddedArticle(): ArticleData | null {
  if (typeof document === "undefined") return null;
  const script = document.getElementById("article-data");
  if (!script) return null;
  try {
    return JSON.parse(script.textContent || "");
  } catch {
    return null;
  }
}

function formatDate(dateStr: string, locale: Locale): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale === "en" ? "en-US" : "pt-BR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function isAlternatePath(path: string, locale: Locale): boolean {
  return locale === "en"
    ? /^\/article\/[^/]+\/?$/.test(path)
    : /^\/en\/article\/[^/]+\/?$/.test(path);
}

export function Article({ slug, locale }: { slug: string; locale: Locale }) {
  // Read embedded data from SSG HTML
  const article = getEmbeddedArticle();
  const contentRef = useRef<HTMLDivElement>(null);
  const text = localeText[locale].article;
  const expectedPath = articlePath(locale, slug);

  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;

    const input = root.querySelector<HTMLInputElement>("[data-contract-value]");
    const contractOutput = root.querySelector<HTMLOutputElement>(
      "[data-contract-output]",
    );
    const customerOutput = root.querySelector<HTMLOutputElement>(
      "[data-customer-output]",
    );
    const customerNoun = root.querySelector<HTMLElement>(
      "[data-customer-noun]",
    );
    const targetMrr = (locale === "en" ? 18_000_000 : 90_000_000) / 12;
    const numberLocale = locale === "en" ? "en-US" : "pt-BR";
    const money = new Intl.NumberFormat(numberLocale, {
      style: "currency",
      currency: locale === "en" ? "USD" : "BRL",
      maximumFractionDigits: 0,
    });

    const updateCalculator = () => {
      if (!input || !contractOutput || !customerOutput) return;
      const contract = Number(input.value);
      const customers = Math.ceil(targetMrr / contract);
      contractOutput.value = money.format(contract);
      customerOutput.value = customers.toLocaleString(numberLocale);
      if (customerNoun) {
        customerNoun.textContent =
          locale === "en"
            ? customers === 1
              ? "customer"
              : "customers"
            : customers === 1
              ? "cliente"
              : "clientes";
      }
    };

    updateCalculator();
    input?.addEventListener("input", updateCalculator);

    const animated = root.querySelectorAll<HTMLElement>("[data-story-animate]");
    let observer: IntersectionObserver | undefined;
    if (
      animated.length > 0 &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      root.classList.add("story-enhanced");
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            (entry.target as HTMLElement).classList.add("is-visible");
            observer?.unobserve(entry.target);
          }
        },
        { threshold: 0.2 },
      );
      for (const element of animated) observer.observe(element);
    }

    return () => {
      input?.removeEventListener("input", updateCalculator);
      observer?.disconnect();
    };
  }, [article?.slug, locale]);

  // No embedded data - article not found or wrong slug
  if (
    !article ||
    article.slug !== slug ||
    article.locale !== locale ||
    article.path !== expectedPath
  ) {
    return (
      <div className="container py-12">
        <h1 className="text-2xl font-bold mb-4">{text.notFound}</h1>
        <p className="text-[var(--color-fg-muted)] mb-4">
          {text.loadError}
          <a href={expectedPath} className="underline">
            {text.refresh}
          </a>
          .
        </p>
        <Link href={homePath(locale)}>{text.back}</Link>
      </div>
    );
  }

  const isStory = article.layout === "story";
  const alternatePath =
    article.alternatePath && isAlternatePath(article.alternatePath, locale)
      ? article.alternatePath
      : null;
  const alternateLocale = locale === "en" ? "pt" : "en";

  return (
    <article className={`container py-4${isStory ? " story-article" : ""}`}>
      {/* Draft badge */}
      {article.status === "draft" && (
        <div
          className="inline-block mb-4 px-3 py-1 rounded-md text-sm font-medium"
          style={{
            backgroundColor: "var(--color-warning, #f59e0b)",
            color: "#000",
          }}
        >
          {text.draft}
        </div>
      )}

      {/* Cover image */}
      {article.coverImage && (
        <div className="mb-6 -mx-4 md:mx-0 overflow-hidden md:rounded-lg">
          <img src={article.coverImage} alt="" className="w-full h-auto" />
        </div>
      )}

      {/* Constrain all content to prose width */}
      <div className={`prose${isStory ? " story-prose" : ""}`}>
        <nav
          className="mt-4 mb-6 flex flex-wrap items-center justify-between gap-3 text-sm"
          aria-label={
            locale === "en" ? "Article navigation" : "Navegação do texto"
          }
        >
          <Link href={homePath(locale)}>{text.back}</Link>
          {alternatePath && (
            <a href={`${alternatePath}?lang=${alternateLocale}`}>
              {text.alternate}
            </a>
          )}
        </nav>
        <header className="mt-4 mb-8">
          <time
            dateTime={article.date}
            className="text-sm"
            style={{ color: "var(--color-fg-muted)" }}
          >
            {formatDate(article.date, locale)}
          </time>
          <h1
            className={`mt-6 text-3xl md:text-4xl ${isStory ? "font-medium" : "font-bold"}`}
            style={{ marginBlock: isStory ? "0.35em 0.5em" : "0.5em" }}
          >
            {article.title}
          </h1>
          {article.description && (
            <p
              className="mt-4 text-xl"
              style={{ color: "var(--color-fg-muted)" }}
            >
              {article.description}
            </p>
          )}
          {article.tags && article.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-1 rounded-full"
                  style={{
                    backgroundColor: "var(--color-bg-secondary)",
                    color: "var(--color-fg-muted)",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </header>

        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: trusted repository content compiled at build time */}
        <div
          ref={contentRef}
          dangerouslySetInnerHTML={{ __html: article.html }}
        />
      </div>
    </article>
  );
}
