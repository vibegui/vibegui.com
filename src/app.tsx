/**
 * Root Application Component
 *
 * Handles routing and layout. Uses a simple client-side router
 * without external dependencies.
 */

import { useState, useEffect } from "react";
import { Header } from "./components/header";
import { Home } from "./pages/home";
import { Article } from "./pages/article";
import { Commitment } from "./pages/commitment";
import { Content } from "./pages/content";
import { Context, ContextDoc } from "./pages/context";
import { updateCanonical } from "./hooks/use-canonical";

type Route =
  | { type: "home" }
  | { type: "article"; slug: string }
  | { type: "commitment" }
  | { type: "content" }
  | { type: "context" }
  | { type: "context-doc"; path: string }
  | { type: "not-found" };

function parseRoute(pathname: string): Route {
  if (pathname === "/" || pathname === "") {
    return { type: "home" };
  }
  if (pathname === "/commitment") {
    return { type: "commitment" };
  }
  if (pathname === "/content") {
    return { type: "content" };
  }
  if (pathname === "/context") {
    return { type: "context" };
  }
  if (pathname.startsWith("/context/")) {
    const path = pathname.slice("/context/".length);
    if (path) {
      return { type: "context-doc", path };
    }
  }
  if (pathname.startsWith("/article/")) {
    const slug = pathname.slice("/article/".length);
    if (slug) {
      return { type: "article", slug };
    }
  }
  return { type: "not-found" };
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
  updateCanonical(to);
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

function RouteContent({ route }: { route: Route }) {
  switch (route.type) {
    case "home":
      return <Home />;
    case "article":
      return <Article slug={route.slug} />;
    case "commitment":
      return <Commitment />;
    case "content":
      return <Content />;
    case "context":
      return <Context />;
    case "context-doc":
      return <ContextDoc path={route.path} />;
    case "not-found":
      return (
        <div className="container py-16 text-center">
          <h1 className="text-4xl font-bold mb-4">404</h1>
          <p style={{ color: "var(--color-fg-muted)" }}>Page not found</p>
          <Link href="/" className="mt-4 inline-block">
            ← Back to home
          </Link>
        </div>
      );
  }
}

export function App() {
  const route = useRoute();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <RouteContent route={route} />
      </main>
      <footer
        className="container py-8 text-center text-sm"
        style={{ color: "var(--color-fg-muted)" }}
      >
        <p>
          Built with{" "}
          <a
            href="https://decocms.com/?utm_source=vibegui.com&utm_campaign=footer"
            target="_blank"
            rel="noopener noreferrer"
          >
            decoCMS
          </a>{" "}
          · Made in Brazil 🇧🇷
        </p>
      </footer>
    </div>
  );
}
