/**
 * Root Application Component
 *
 * Handles routing and layout. Uses a simple client-side router
 * without external dependencies.
 */

import React, { useState, useEffect, Suspense } from "react";
import { Header } from "./components/header";
import { Article } from "./pages/article";
import { Commitment } from "./pages/commitment";
import { Content } from "./pages/content";
import { Context, ContextDoc } from "./pages/context";
import { updateCanonical } from "./hooks/use-canonical";
import {
  DEFAULT_LOCALE,
  homePath,
  localeText,
  type Locale,
} from "./lib/manifest";

// Lazy load heavy pages
const Bookmarks = React.lazy(() =>
  import("./pages/bookmarks").then((m) => ({ default: m.Bookmarks })),
);
const Roadmap = React.lazy(() =>
  import("./pages/roadmap").then((m) => ({ default: m.Roadmap })),
);
const TransformationDemo = React.lazy(() =>
  import("./pages/transformation-demo").then((m) => ({
    default: m.TransformationDemo,
  })),
);

type Route =
  | { type: "content"; locale: Locale }
  | { type: "article"; locale: Locale; slug: string }
  | { type: "bookmarks" }
  | { type: "roadmap" }
  | { type: "commitment" }
  | { type: "context" }
  | { type: "context-doc"; path: string }
  | { type: "transformation" }
  | { type: "not-found"; locale: Locale };

function parseRoute(pathname: string): Route {
  if (pathname === "/" || pathname === "" || pathname === "/content") {
    return { type: "content", locale: "pt-BR" };
  }
  if (pathname === "/en" || pathname === "/en/") {
    return { type: "content", locale: "en" };
  }
  if (pathname === "/bookmarks" || pathname === "/bookmarks/") {
    return { type: "bookmarks" };
  }
  if (pathname === "/roadmap" || pathname === "/roadmap/") {
    return { type: "roadmap" };
  }
  if (
    pathname === "/demos/transformation" ||
    pathname === "/demos/transformation/"
  ) {
    return { type: "transformation" };
  }
  if (pathname === "/commitment") {
    return { type: "commitment" };
  }
  if (pathname === "/context") {
    return { type: "context" };
  }
  if (pathname.startsWith("/context/")) {
    // Strip trailing slash for consistent comparison with embedded data
    const path = pathname.slice("/context/".length).replace(/\/$/, "");
    if (path) {
      return { type: "context-doc", path };
    }
  }
  const articleRoute = pathname.match(/^\/(en\/)?article\/([^/]+)\/?$/);
  if (articleRoute?.[2]) {
    // Strip trailing slash for consistent comparison with embedded data
    return {
      type: "article",
      locale: articleRoute[1] ? "en" : "pt-BR",
      slug: articleRoute[2],
    };
  }
  return {
    type: "not-found",
    locale: pathname === "/en" || pathname.startsWith("/en/") ? "en" : "pt-BR",
  };
}

function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => {
    // Update canonical on initial load
    updateCanonical(window.location.pathname);
    return parseRoute(window.location.pathname);
  });

  useEffect(() => {
    const handlePopState = () => {
      const pathname = window.location.pathname;
      updateCanonical(pathname);
      setRoute(parseRoute(pathname));
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return route;
}

/**
 * Navigate programmatically (for link clicks)
 */
export function navigate(to: string): void {
  updateCanonical(new URL(to, window.location.origin).pathname);
  window.history.pushState({}, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/**
 * Link component that uses our router
 */
export function Link({
  href,
  children,
  className,
  style,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}) {
  const handleClick = (e: React.MouseEvent) => {
    // Let external links and modified clicks go through
    if (
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      href.startsWith("http")
    ) {
      return;
    }
    e.preventDefault();
    onClick?.();
    navigate(href);
  };

  return (
    <a href={href} onClick={handleClick} className={className} style={style}>
      {children}
    </a>
  );
}

function RouteContent({ route, locale }: { route: Route; locale: Locale }) {
  const text = localeText[locale];

  switch (route.type) {
    case "content":
      return <Content locale={route.locale} />;
    case "article":
      return <Article slug={route.slug} locale={route.locale} />;
    case "bookmarks":
      return (
        <Suspense
          fallback={
            <div className="container py-16 text-center">
              {locale === "en" ? "Loading..." : "Carregando..."}
            </div>
          }
        >
          <Bookmarks />
        </Suspense>
      );
    case "roadmap":
      return (
        <Suspense
          fallback={
            <div className="container py-16 text-center">
              {locale === "en" ? "Loading..." : "Carregando..."}
            </div>
          }
        >
          <Roadmap />
        </Suspense>
      );
    case "commitment":
      return <Commitment />;
    case "context":
      return <Context />;
    case "context-doc":
      return <ContextDoc path={route.path} />;
    case "transformation":
      return (
        <Suspense fallback={<div className="transformation-demo" />}>
          <TransformationDemo />
        </Suspense>
      );
    case "not-found":
      return (
        <div className="container py-16 text-center">
          <h1 className="text-4xl font-bold mb-4">404</h1>
          <p style={{ color: "var(--color-fg-muted)" }}>
            {text.notFound.message}
          </p>
          <Link href={homePath(locale)} className="mt-4 inline-block">
            {text.notFound.back}
          </Link>
        </div>
      );
  }
}

export function App() {
  const route = useRoute();
  const locale =
    "locale" in route && route.locale ? route.locale : DEFAULT_LOCALE;
  const isStandaloneDemo = route.type === "transformation";

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <div className="min-h-screen flex flex-col">
      {!isStandaloneDemo && <Header locale={locale} />}
      <main className="flex-1">
        <RouteContent route={route} locale={locale} />
      </main>
      {!isStandaloneDemo && (
        <footer
          className="container py-8 text-center text-sm"
          style={{ color: "var(--color-fg-muted)" }}
        >
          <p>
            {locale === "en" ? "Built with" : "Feito com"}{" "}
            <a
              href="https://decocms.com/?utm_source=vibegui.com&utm_campaign=footer"
              target="_blank"
              rel="noopener noreferrer"
            >
              decoCMS
            </a>{" "}
            · {localeText[locale].footer}
          </p>
        </footer>
      )}
    </div>
  );
}
