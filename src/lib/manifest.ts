/**
 * Content Manifest Utilities
 *
 * Handles loading content from JSON files generated from SQLite.
 * Content is fetched from /content/manifest.json (articles/drafts)
 * and /research/manifest.json (research).
 */

export interface ArticleMeta {
  slug: string;
  title: string;
  description?: string;
  date: string;
  status: "draft" | "published";
  tags?: string[];
}

export interface ContentManifest {
  articles: ArticleMeta[];
  drafts: ArticleMeta[];
}

export interface ResearchMeta {
  slug: string;
  title: string;
  description?: string;
  date: string;
  status: "draft" | "published";
  tags?: string[];
}

let cachedContentManifest: ContentManifest | null = null;
let cachedResearchManifest: ResearchMeta[] | null = null;

/**
 * Load the content manifest (articles and drafts)
 * Handles both legacy format (object with articles/drafts) and new format (array)
 */
export async function loadManifest(): Promise<ContentManifest | null> {
  if (cachedContentManifest) {
    return cachedContentManifest;
  }

  try {
    const response = await fetch("/content/manifest.json");
    if (!response.ok) {
      console.error("Failed to load content manifest:", response.status);
      return null;
    }

    const data = await response.json();

    // Handle legacy format (object with articles/drafts arrays)
    if (data.articles || data.drafts) {
      const articles: ArticleMeta[] = (data.articles || []).map(
        (a: Record<string, unknown>) => ({
          slug: a.slug || a.id,
          title: a.title,
          description: a.description,
          date: a.date,
          status: a.status || "published",
          tags: a.tags,
        }),
      );
      const drafts: ArticleMeta[] = (data.drafts || []).map(
        (a: Record<string, unknown>) => ({
          slug: a.slug || a.id,
          title: a.title,
          description: a.description,
          date: a.date,
          status: a.status || "draft",
          tags: a.tags,
        }),
      );
      cachedContentManifest = { articles, drafts };
      return cachedContentManifest;
    }

    // Handle new format (simple array)
    const items: ArticleMeta[] = Array.isArray(data) ? data : [];
    const articles = items.filter((item) => item.status === "published");
    const drafts = items.filter((item) => item.status === "draft");

    cachedContentManifest = { articles, drafts };
    return cachedContentManifest;
  } catch (error) {
    console.error("Error loading content manifest:", error);
    return null;
  }
}

/**
 * Load the research manifest
 */
export async function loadResearchManifest(): Promise<ResearchMeta[] | null> {
  if (cachedResearchManifest) {
    return cachedResearchManifest;
  }

  try {
    const response = await fetch("/research/manifest.json");
    if (!response.ok) {
      console.error("Failed to load research manifest:", response.status);
      return null;
    }

    cachedResearchManifest = await response.json();
    return cachedResearchManifest;
  } catch (error) {
    console.error("Error loading research manifest:", error);
    return null;
  }
}

/**
 * Get an article's content path by slug
 * Searches both published articles and drafts (dev mode)
 * Returns path to JSON file (new format) or markdown file (legacy)
 */
export async function getArticlePath(slug: string): Promise<string | null> {
  const manifest = await loadManifest();
  if (!manifest) return null;

  // Search in published articles first
  let article = manifest.articles.find((a) => a.slug === slug);

  // If not found, search in drafts (dev mode)
  if (!article) {
    article = manifest.drafts.find((a) => a.slug === slug);
  }

  if (!article) return null;

  // Try JSON first (new SQLite export format), fallback to legacy markdown
  return `/content/${article.slug}.json`;
}

/**
 * Get a research item's content path by slug
 */
export async function getResearchPath(slug: string): Promise<string | null> {
  const manifest = await loadResearchManifest();
  if (!manifest) return null;

  const item = manifest.find((r) => r.slug === slug);
  if (!item) return null;

  return `/research/${item.slug}.json`;
}

/**
 * Get a context file's content path (legacy - context is still markdown)
 */
export async function getContextPath(originalPath: string): Promise<string> {
  // Context files are still served as markdown from /context/
  return `/context/${originalPath}.md`;
}

/**
 * Clear the cached manifests (useful for development)
 */
export function clearManifestCache(): void {
  cachedContentManifest = null;
  cachedResearchManifest = null;
}
