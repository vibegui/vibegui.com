/**
 * Content Manifest Utilities
 *
 * Handles loading content from JSON files generated from SQLite.
 * Articles have a status field (draft/published) - no separate drafts array.
 */

export interface ArticleMeta {
  slug: string;
  title: string;
  description?: string;
  date: string;
  status: "draft" | "published";
  tags?: string[];
}

export interface ActionItem {
  id?: number;
  task: string;
  owner: string;
  dueDate?: string;
  completed?: boolean;
  sortOrder?: number;
}

export interface Project {
  id: string;
  title: string;
  tagline: string;
  description: string;
  status: "completed" | "ongoing" | "future";
  icon?: string;
  coverImage?: string;
  coverGradient?: string;
  url?: string;
  startDate?: string;
  targetDate?: string;
  completedDate?: string;
  sortOrder?: number;
  tags?: string[];
  actionPlan?: ActionItem[];
}

export interface ContextFile {
  original: string;
  path: string;
  hash: string;
}

export interface ContentManifest {
  articles: ArticleMeta[];
  projects?: Project[];
  context?: ContextFile[];
}

let cachedContentManifest: ContentManifest | null = null;
let cachedHashedManifest: ContentManifest | null = null;

/**
 * Get the manifest path - uses hashed manifest in production
 */
function getManifestPath(): string {
  // In production, index.html has window.__MANIFEST_PATH__ injected
  if (
    typeof window !== "undefined" &&
    (window as unknown as { __MANIFEST_PATH__?: string }).__MANIFEST_PATH__
  ) {
    return (window as unknown as { __MANIFEST_PATH__: string })
      .__MANIFEST_PATH__;
  }
  return "/content/manifest.json";
}

/**
 * Load the hashed manifest (includes context files in production)
 */
async function loadHashedManifest(): Promise<ContentManifest | null> {
  if (cachedHashedManifest) {
    return cachedHashedManifest;
  }

  try {
    const manifestPath = getManifestPath();
    const response = await fetch(manifestPath);
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    cachedHashedManifest = data;
    return cachedHashedManifest;
  } catch {
    return null;
  }
}

/**
 * Load the content manifest (articles with status field)
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

    // Articles array with status field (draft/published)
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

    const projects: Project[] = data.projects || [];

    cachedContentManifest = {
      articles,
      projects,
      context: data.context,
    };
    return cachedContentManifest;
  } catch (error) {
    console.error("Error loading content manifest:", error);
    return null;
  }
}

/**
 * Get an article's content path by slug
 * Searches all articles (both published and drafts)
 */
export async function getArticlePath(slug: string): Promise<string | null> {
  const manifest = await loadManifest();
  if (!manifest) return null;

  const article = manifest.articles.find((a) => a.slug === slug);
  if (!article) return null;

  return `/content/${article.slug}.json`;
}

/**
 * Get a context file's content path
 * Uses hashed paths in production, direct paths in development
 */
export async function getContextPath(originalPath: string): Promise<string> {
  // Try to get hashed path from manifest (production)
  const manifest = await loadHashedManifest();
  if (manifest?.context) {
    const contextFile = manifest.context.find(
      (c) => c.original === originalPath,
    );
    if (contextFile) {
      return `/context/${contextFile.path}`;
    }
  }

  // Fallback to direct path (development)
  return `/context/${originalPath}.md`;
}

/**
 * Load projects from the manifest
 */
export async function loadProjects(): Promise<Project[]> {
  const manifest = await loadManifest();
  return manifest?.projects || [];
}

/**
 * Clear the cached manifests (useful for development)
 */
export function clearManifestCache(): void {
  cachedContentManifest = null;
}
