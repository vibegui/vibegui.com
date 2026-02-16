/**
 * Content Manifest Utilities
 *
 * Handles loading content from JSON manifest files generated at build time.
 * Articles have a status field (draft/published) - no separate drafts array.
 */

export interface ArticleMeta {
  slug: string;
  title: string;
  description?: string;
  date: string;
  status: "draft" | "published";
  tags?: string[];
  coverImage?: string;
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

export interface ContentManifest {
  articles: ArticleMeta[];
  projects?: Project[];
}

let cachedContentManifest: ContentManifest | null = null;

/**
 * Read embedded manifest data from HTML (SSG)
 * Falls back to fetch for dev mode without embedded data
 */
function getEmbeddedManifest(): ContentManifest | null {
  if (typeof document === "undefined") return null;
  const script = document.getElementById("manifest-data");
  if (!script) return null;
  try {
    return JSON.parse(script.textContent || "");
  } catch {
    return null;
  }
}

/**
 * Load the content manifest
 * Reads from embedded data in HTML (no fetch needed)
 * Falls back to fetch for dev mode
 */
export async function loadManifest(): Promise<ContentManifest | null> {
  if (cachedContentManifest) {
    return cachedContentManifest;
  }

  // Try embedded data first (SSG - no fetch needed)
  const embedded = getEmbeddedManifest();
  if (embedded) {
    cachedContentManifest = embedded;
    return cachedContentManifest;
  }

  // Fallback to fetch (dev mode)
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
        coverImage: a.coverImage,
      }),
    );

    const projects: Project[] = data.projects || [];

    cachedContentManifest = {
      articles,
      projects,
    };
    return cachedContentManifest;
  } catch (error) {
    console.error("Error loading content manifest:", error);
    return null;
  }
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
