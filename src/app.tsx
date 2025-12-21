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
import { Integrity } from "./pages/integrity";
import { Alignment } from "./pages/alignment";
import { Deco } from "./pages/deco";

type Route =
  | { type: "home" }
  | { type: "article"; slug: string }
  | { type: "commitment" }
  | { type: "integrity" }
  | { type: "alignment" }
  | { type: "deco" }
  | { type: "not-found" };

function parseRoute(pathname: string): Route {
  if (pathname === "/" || pathname === "") {
    return { type: "home" };
  }
  if (pathname === "/commitment") {
    return { type: "commitment" };
  }
  if (pathname === "/integrity") {
    return { type: "integrity" };
  }
  if (pathname === "/alignment") {
    return { type: "alignment" };
  }
  if (pathname === "/deco") {
    return { type: "deco" };
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
  const [route, setRoute] = useState<Route>(() =>
    parseRoute(window.location.pathname),
  );

  useEffect(() => {
    const handlePopState = () => {
      setRoute(parseRoute(window.location.pathname));
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
    case "integrity":
      return <Integrity />;
    case "alignment":
      return <Alignment />;
    case "deco":
      return <Deco />;
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
        <p>Built with MCP · Served by Cloudflare · Made in Brazil 🇧🇷</p>
      </footer>
    </div>
  );
}
