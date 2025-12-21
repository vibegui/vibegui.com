/**
 * Updates the canonical URL meta tag based on current pathname.
 * Always uses the naked domain (no www).
 */
export function updateCanonical(pathname: string): void {
  const canonicalUrl = `https://vibegui.com${pathname}`;

  // Update the canonical link element
  let link = document.querySelector(
    'link[rel="canonical"]',
  ) as HTMLLinkElement | null;

  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }

  link.href = canonicalUrl;
}
