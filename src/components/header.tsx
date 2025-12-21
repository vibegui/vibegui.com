/**
 * Header Component
 *
 * Contains:
 * - Logo/site name
 * - Navigation (hamburger on mobile, inline on desktop)
 * - Theme toggle
 */

import { useState, useEffect } from "react";
import { Link } from "../app";
import { ThemeToggle } from "./theme-toggle";

const NAV_LINKS = [
  { href: "/", label: "Content" },
  { href: "/context", label: "Context" },
  { href: "/commitment", label: "Commitment" },
];

function useCurrentPath() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return path;
}

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const currentPath = useCurrentPath();

  const isActive = (href: string) => {
    if (href === "/") return currentPath === "/" || currentPath === "";
    return currentPath === href || currentPath.startsWith(href + "/");
  };

  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{
        backgroundColor: "var(--color-bg)",
        borderColor: "var(--color-border)",
      }}
    >
      <div className="container flex items-center justify-between h-14">
        {/* Logo */}
        <Link
          href="/"
          className="font-semibold text-lg tracking-tight hover:no-underline"
          style={{ color: "var(--color-accent)" }}
        >
          vibegui
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm transition-colors ${isActive(link.href) ? "font-medium" : ""}`}
              style={{
                color: isActive(link.href)
                  ? "var(--color-fg)"
                  : "var(--color-fg-muted)",
                textDecoration: isActive(link.href) ? "underline" : "none",
                textUnderlineOffset: "4px",
              }}
            >
              {link.label}
            </Link>
          ))}
          <ThemeToggle />
        </nav>

        {/* Mobile Menu Button */}
        <div className="flex md:hidden items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            style={{ color: "var(--color-fg)" }}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {menuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <nav
          className="md:hidden border-t"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div className="container py-4 flex flex-col gap-3">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm py-2 ${isActive(link.href) ? "font-medium" : ""}`}
                style={{
                  color: isActive(link.href)
                    ? "var(--color-fg)"
                    : "var(--color-fg-muted)",
                }}
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
