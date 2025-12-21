import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";

/**
 * Generate content manifest from markdown files
 * This runs at dev server start and build time
 */
function generateManifest() {
  const articlesDir = resolve(__dirname, "content/articles");
  const publicContentDir = resolve(__dirname, "public/content");

  if (!existsSync(articlesDir)) {
    return;
  }

  // Ensure public/content exists
  if (!existsSync(publicContentDir)) {
    mkdirSync(publicContentDir, { recursive: true });
  }

  const files = readdirSync(articlesDir).filter(
    (f) => f.endsWith(".md") && !f.startsWith("."),
  );

  const articles = files
    .map((file) => {
      const content = readFileSync(resolve(articlesDir, file), "utf-8");

      // Parse frontmatter
      const match = content.match(/^---\n([\s\S]*?)\n---/);
      const frontmatter: Record<string, string | string[]> = {};

      if (match?.[1]) {
        for (const line of match[1].split("\n")) {
          const [key, ...rest] = line.split(": ");
          if (key && rest.length) {
            let value = rest.join(": ").trim();
            // Handle arrays like tags
            if (value.startsWith("[") && value.endsWith("]")) {
              frontmatter[key] = JSON.parse(value.replace(/'/g, '"'));
            } else {
              // Remove quotes if present
              if (
                (value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))
              ) {
                value = value.slice(1, -1);
              }
              frontmatter[key] = value;
            }
          }
        }
      }

      const dateVal = frontmatter.date;
      const dateStr =
        typeof dateVal === "string"
          ? dateVal
          : new Date().toISOString().slice(0, 10);

      return {
        id: file.replace(".md", ""),
        title:
          typeof frontmatter.title === "string"
            ? frontmatter.title
            : file.replace(".md", ""),
        description: frontmatter.description ?? null,
        date: dateStr,
        tags: frontmatter.tags ?? [],
        status: frontmatter.status ?? "draft",
      };
    })
    // Sort by date descending (newest first)
    .sort((a, b) => b.date.localeCompare(a.date))
    // Only include published articles
    .filter((a) => a.status === "published");

  const manifest = { articles, generatedAt: new Date().toISOString() };
  writeFileSync(
    resolve(publicContentDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );
  console.log(`📝 Generated manifest with ${articles.length} articles`);
}

/**
 * Vite plugin to generate manifest on startup and file changes
 */
function contentManifestPlugin() {
  return {
    name: "content-manifest",
    buildStart() {
      generateManifest();
    },
    configureServer(server: {
      watcher: { on: (event: string, cb: (path: string) => void) => void };
    }) {
      // Regenerate manifest when content changes
      server.watcher.on("change", (path: string) => {
        if (path.includes("content/articles")) {
          generateManifest();
        }
      });
      server.watcher.on("add", (path: string) => {
        if (path.includes("content/articles")) {
          generateManifest();
        }
      });
    },
  };
}

/**
 * Vite Configuration for vibegui.com
 *
 * Key features:
 * - Content-hash based asset naming for cache efficiency
 * - Tailwind CSS v4 integration
 * - Image optimization (configured separately)
 * - Path aliases for clean imports
 * - Auto-generated content manifest
 */
export default defineConfig({
  plugins: [react(), tailwindcss(), contentManifestPlugin()],

  resolve: {
    alias: {
      "~": resolve(__dirname, "./src"),
    },
  },

  build: {
    outDir: "dist",
    // Generate manifest for cache busting verification
    manifest: true,
    rollupOptions: {
      output: {
        // Content-hash based naming - URLs only change when content changes
        entryFileNames: "assets/[name].[hash].js",
        chunkFileNames: "assets/[name].[hash].js",
        assetFileNames: "assets/[name].[hash].[ext]",
      },
    },
    // Target modern browsers only
    target: "esnext",
    // Keep chunks reasonable for caching
    chunkSizeWarningLimit: 100,
  },

  server: {
    port: 4001,
    strictPort: true,
    // Serve content files during development
    fs: {
      allow: [".", "content"],
    },
  },

  // Make content directory accessible as /content
  publicDir: "public",

  preview: {
    port: 4001,
  },
});
