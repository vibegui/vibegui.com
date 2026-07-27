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
import { homePath, localeText, type Locale } from "../lib/manifest";
import { ThemeToggle } from "./theme-toggle";

function useCurrentPath() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return path;
}

function LanguageSwitch({ locale }: { locale: Locale }) {
  return (
    <nav
      className="language-switch"
      aria-label={locale === "en" ? "Language" : "Idioma"}
    >
      <a
        href="/?lang=pt"
        className={locale === "pt-BR" ? "is-active" : undefined}
        aria-current={locale === "pt-BR" ? "page" : undefined}
      >
        PT
      </a>
      <span aria-hidden="true">/</span>
      <a
        href="/en?lang=en"
        className={locale === "en" ? "is-active" : undefined}
        aria-current={locale === "en" ? "page" : undefined}
      >
        EN
      </a>
    </nav>
  );
}

export function Header({ locale }: { locale: Locale }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const currentPath = useCurrentPath();
  const text = localeText[locale];
  const writingPath = homePath(locale);
  const navLinks = [
    { href: writingPath, label: text.nav.writing },
    { href: "/bookmarks", label: text.nav.bookmarks },
    { href: "/context", label: text.nav.library },
    { href: "/commitment", label: text.nav.about },
  ];

  const isActive = (href: string) => {
    if (href === writingPath) {
      return (
        currentPath === writingPath ||
        (locale === "en"
          ? currentPath.startsWith("/en/article/")
          : currentPath.startsWith("/article/"))
      );
    }
    return currentPath === href || currentPath.startsWith(`${href}/`);
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
          href={writingPath}
          className="text-lg tracking-tight hover:no-underline"
          style={{
            color: "var(--color-fg)",
            fontFamily: "var(--font-serif)",
          }}
        >
          vibegui
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm transition-colors ${isActive(link.href) ? "font-medium" : ""}`}
              style={{
                color: isActive(link.href)
                  ? "var(--color-fg)"
                  : "var(--color-fg-muted)",
                textDecoration: "none",
              }}
            >
              {link.label}
            </Link>
          ))}
          <LanguageSwitch locale={locale} />
          <ThemeToggle />
        </nav>

        {/* Mobile Menu Button */}
        <div className="flex md:hidden items-center gap-2">
          <LanguageSwitch locale={locale} />
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2"
            aria-label={text.nav.menu}
            aria-expanded={menuOpen}
            style={{ color: "var(--color-fg)" }}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <title>{text.nav.menu}</title>
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
            {navLinks.map((link) => (
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
