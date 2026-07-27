/**
 * Content Manifest Utilities
 *
 * Handles loading content from JSON manifest files generated at build time.
 * Articles have a status field (draft/published) - no separate drafts array.
 */

export type Locale = "pt-BR" | "en";

export const DEFAULT_LOCALE: Locale = "pt-BR";

export const localeText = {
  "pt-BR": {
    nav: {
      writing: "Textos",
      bookmarks: "Favoritos",
      library: "Biblioteca",
      about: "Sobre",
      menu: "Abrir menu",
    },
    home: {
      title: "Ideias que eu gostaria de ter tido antes.",
      introBefore: "Eu construo software e empresas, hoje como cofundador da ",
      introAfter:
        ". Este é o lugar onde elaboro as distinções que moldam como eu lidero, construo e imagino futuros possíveis — para a tecnologia, para o Brasil e para mim.",
      loading: "Carregando textos...",
      empty: "Ainda não há textos por aqui. Volte em breve!",
      drafts: "Rascunhos",
      draft: "Rascunho",
      localOnly: "(apenas local)",
      hideDrafts: "Ocultar rascunhos",
      showDrafts: "Mostrar rascunhos",
      preview: "Prévia",
      published: "Publicados",
    },
    article: {
      read: "Ler texto →",
      notFound: "Texto não encontrado",
      loadError: "Não foi possível carregar o texto. Tente ",
      refresh: "atualizar a página",
      back: "← Voltar aos textos",
      draft: "📝 Rascunho — apenas prévia local",
      alternate: "Read in English",
    },
    notFound: {
      message: "Página não encontrada",
      back: "← Voltar aos textos",
    },
    footer: "Feito no Brasil 🇧🇷",
  },
  en: {
    nav: {
      writing: "Writing",
      bookmarks: "Bookmarks",
      library: "Library",
      about: "About",
      menu: "Toggle menu",
    },
    home: {
      title: "Ideas I wish I had earlier.",
      introBefore:
        "I build software and companies, currently as co-founder of ",
      introAfter:
        ". This is where I work through the distinctions that shape how I lead, build, and imagine possible futures—for technology, Brazil, and myself.",
      loading: "Loading articles...",
      empty: "No articles yet. Check back soon!",
      drafts: "Drafts",
      draft: "Draft",
      localOnly: "(local only)",
      hideDrafts: "Hide Drafts",
      showDrafts: "Show Drafts",
      preview: "Preview",
      published: "Published",
    },
    article: {
      read: "Read essay →",
      notFound: "Article not found",
      loadError: "Could not load article data. Try ",
      refresh: "refreshing the page",
      back: "← Back to writing",
      draft: "📝 Draft — local preview only",
      alternate: "Ler em português",
    },
    notFound: {
      message: "Page not found",
      back: "← Back to writing",
    },
    footer: "Made in Brazil 🇧🇷",
  },
} as const satisfies Record<Locale, object>;

export function homePath(locale: Locale): "/" | "/en/" {
  return locale === "en" ? "/en/" : "/";
}

export function articlePath(locale: Locale, slug: string): string {
  return `${locale === "en" ? "/en" : ""}/article/${slug}/`;
}

export interface ArticleMeta {
  slug: string;
  locale: Locale;
  path: string;
  alternatePath?: string | null;
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
        locale: a.locale,
        path: a.path,
        alternatePath: a.alternatePath,
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
