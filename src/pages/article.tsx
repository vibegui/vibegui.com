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
import {
  applyAmbition,
  applyGrowthTarget,
  computeAmbition,
  parseAmbitionHash,
  writeAmbitionHash,
} from "../lib/story-ambition";

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
    const ambitionSlider = root.querySelector<HTMLInputElement>(
      "[data-ambition-slider]",
    );
    const numberLocale = locale === "en" ? "en-US" : "pt-BR";
    const money = new Intl.NumberFormat(numberLocale, {
      style: "currency",
      currency: locale === "en" ? "USD" : "BRL",
      maximumFractionDigits: 0,
    });

    let ambition = computeAmbition(
      parseAmbitionHash(window.location.hash),
      locale,
    );

    const customerWord = (count: number) =>
      locale === "en"
        ? count === 1
          ? "customer"
          : "customers"
        : count === 1
          ? "cliente"
          : "clientes";

    const updateCalculator = () => {
      if (!input || !contractOutput || !customerOutput) return;
      const contract = Number(input.value);
      const customers = Math.ceil(ambition.mrrLocal / contract);
      const entContract = Number(input.max);
      const entCustomers = Math.ceil(ambition.mrrLocal / entContract);
      const customersLabel = customers.toLocaleString(numberLocale);
      const entCustomersLabel = entCustomers.toLocaleString(numberLocale);
      const contractLabel = money.format(contract);
      const entContractLabel = money.format(entContract);

      contractOutput.value = contractLabel;
      customerOutput.value = customersLabel;
      if (customerNoun) customerNoun.textContent = customerWord(customers);

      for (const el of root.querySelectorAll<HTMLElement>(
        "[data-calc-contract]",
      )) {
        el.textContent = contractLabel;
      }
      for (const el of root.querySelectorAll<HTMLElement>(
        "[data-calc-customers]",
      )) {
        el.textContent = customersLabel;
      }
      for (const el of root.querySelectorAll<HTMLElement>(
        "[data-calc-customers-noun]",
      )) {
        el.textContent = customerWord(customers);
      }
      for (const el of root.querySelectorAll<HTMLElement>(
        "[data-calc-ent-contract]",
      )) {
        el.textContent = entContractLabel;
      }
      for (const el of root.querySelectorAll<HTMLElement>(
        "[data-calc-ent-customers]",
      )) {
        el.textContent = entCustomersLabel;
      }
      for (const el of root.querySelectorAll<HTMLElement>(
        "[data-calc-ent-customers-noun]",
      )) {
        el.textContent = customerWord(entCustomers);
      }

      applyGrowthTarget(root, customers, locale);
    };

    const setAmbition = (v: number, writeHash: boolean) => {
      ambition = computeAmbition(v, locale);
      applyAmbition(root, ambition);
      updateCalculator();
      if (writeHash) writeAmbitionHash(ambition.v);
    };

    setAmbition(ambition.v, false);
    if (window.location.hash.includes("v=")) {
      writeAmbitionHash(ambition.v);
    }

    const onAmbitionInput = () => {
      if (!ambitionSlider) return;
      setAmbition(Number(ambitionSlider.value), true);
    };
    ambitionSlider?.addEventListener("input", onAmbitionInput);

    const onHashChange = () => {
      setAmbition(parseAmbitionHash(window.location.hash), false);
    };
    window.addEventListener("hashchange", onHashChange);

    input?.addEventListener("input", updateCalculator);

    const animated = root.querySelectorAll<HTMLElement>("[data-story-animate]");
    let observer: IntersectionObserver | undefined;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (animated.length > 0 && !reduceMotion) {
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

    const flywheel = root.querySelector<HTMLElement>(".story-flywheel-orbit");
    const comet = flywheel?.querySelector<HTMLElement>(".story-flywheel-comet");
    const nodes = flywheel
      ? [...flywheel.querySelectorAll<HTMLElement>(".story-flywheel-node")]
      : [];
    let frame = 0;

    const updateFlywheelHighlights = () => {
      if (!flywheel || !comet || nodes.length === 0) return;

      const anim = comet.getAnimations()[0];
      const progress =
        (
          anim?.effect?.getComputedTiming() as
            | { progress?: number | null }
            | undefined
        )?.progress ?? 0;
      const angle = progress * Math.PI * 2;
      const orbit = flywheel.getBoundingClientRect();
      const radius = orbit.width * 0.38;
      const ballX = orbit.left + orbit.width / 2 + Math.sin(angle) * radius;
      const ballY = orbit.top + orbit.height / 2 - Math.cos(angle) * radius;
      const pad = 8;

      for (const node of nodes) {
        const box = node.getBoundingClientRect();
        const hit =
          ballX >= box.left - pad &&
          ballX <= box.right + pad &&
          ballY >= box.top - pad &&
          ballY <= box.bottom + pad;
        node.classList.toggle("is-active", hit);
      }
    };

    const tickFlywheel = () => {
      updateFlywheelHighlights();
      frame = window.requestAnimationFrame(tickFlywheel);
    };

    if (flywheel && comet && nodes.length > 0 && !reduceMotion) {
      frame = window.requestAnimationFrame(tickFlywheel);
    } else if (nodes[0]) {
      nodes[0].classList.add("is-active");
    }

    return () => {
      input?.removeEventListener("input", updateCalculator);
      ambitionSlider?.removeEventListener("input", onAmbitionInput);
      window.removeEventListener("hashchange", onHashChange);
      observer?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      for (const node of nodes) node.classList.remove("is-active");
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
