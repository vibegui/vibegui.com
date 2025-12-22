/**
 * Content Manifest Utilities
 *
 * Handles loading the content manifest with hashed file paths.
 * In production, the manifest path is injected into index.html.
 * In development, we fall back to the unhashed path.
 */

declare global {
  interface Window {
    __MANIFEST_PATH__?: string;
  }
}

export interface ArticleMeta {
  id: string;
  path: string; // Hashed path like "articles/hello-world.A1B2C3D4.md"
  hash: string;
  title: string;
  description: string | null;
  date: string;
  tags: string[];
  status: string;
}

export interface ContextFile {
  original: string;
  path: string; // Hashed path
  hash: string;
}

export interface ContentManifest {
  version: number;
  generatedAt: string;
  articles: ArticleMeta[];
  context: ContextFile[];
}

let cachedManifest: ContentManifest | null = null;

/**
 * Get the manifest path - injected in production, fallback in dev
 */
function getManifestPath(): string {
  if (typeof window !== "undefined" && window.__MANIFEST_PATH__) {
    return window.__MANIFEST_PATH__;
  }
  // Fallback for development
  return "/content/manifest.json";
}

/**
 * Load the content manifest (cached after first load)
 */
export async function loadManifest(): Promise<ContentManifest | null> {
  if (cachedManifest) {
    return cachedManifest;
  }

  try {
    const response = await fetch(getManifestPath());
    if (!response.ok) {
      console.error("Failed to load manifest:", response.status);
      return null;
    }

    const manifest = await response.json();

    // Handle both old format (no path field) and new format
    if (manifest.articles) {
      manifest.articles = manifest.articles.map(
        (article: ArticleMeta & { path?: string }) => ({
          ...article,
          // If no path field, construct from id (dev mode / old format)
          path: article.path ?? `articles/${article.id}.md`,
        }),
      );
    }

    cachedManifest = manifest;
    return manifest;
  } catch (error) {
    console.error("Error loading manifest:", error);
    return null;
  }
}

/**
 * Get an article's content path by slug
 */
export async function getArticlePath(slug: string): Promise<string | null> {
  const manifest = await loadManifest();
  if (!manifest) return null;

  const article = manifest.articles.find((a) => a.id === slug);
  if (!article) return null;

  return `/content/${article.path}`;
}

/**
 * Get a context file's content path
 */
export async function getContextPath(
  originalPath: string,
): Promise<string | null> {
  const manifest = await loadManifest();
  if (!manifest) return null;

  // In dev mode, manifest.context may not exist
  const file = manifest.context?.find((c) => c.original === originalPath);
  if (!file) {
    // Fallback for dev mode - try the original path
    return `/context/${originalPath}.md`;
  }

  return `/context/${file.path}`;
}

/**
 * Clear the cached manifest (useful for development)
 */
export function clearManifestCache(): void {
  cachedManifest = null;
}
