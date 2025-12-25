import { defineConfig, type Connect } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";

/**
 * Compute content hash (8 chars)
 */
function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 8);
}

/**
 * Generate content manifest from markdown files with content hashes.
 * The hashes are used by the post-build script to rename files.
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

  const allArticles = files
    .map((file) => {
      const content = readFileSync(resolve(articlesDir, file), "utf-8");
      const contentHash = hashContent(content);

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

      const id = file.replace(".md", "");

      return {
        id,
        hash: contentHash,
        // In dev, path is unhashed; post-build script updates to hashed path
        path: `articles/${file}`,
        title: typeof frontmatter.title === "string" ? frontmatter.title : id,
        description: frontmatter.description ?? null,
        date: dateStr,
        tags: frontmatter.tags ?? [],
        status: frontmatter.status ?? "draft",
      };
    })
    // Sort by date descending (newest first)
    .sort((a, b) => b.date.localeCompare(a.date));

  // Published articles for public manifest
  const articles = allArticles.filter((a) => a.status === "published");

  // Drafts only included in dev mode (detected by NODE_ENV or absence of build)
  const isDev = process.env.NODE_ENV !== "production";
  const drafts = isDev ? allArticles.filter((a) => a.status === "draft") : [];

  const manifest = {
    version: 1,
    articles,
    // Only include drafts in dev mode for local preview
    ...(drafts.length > 0 && { drafts }),
  };
  writeFileSync(
    resolve(publicContentDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );
  console.log(
    `📝 Generated manifest with ${articles.length} articles${drafts.length > 0 ? ` + ${drafts.length} drafts (dev only)` : ""}`,
  );
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
 * API plugin for localhost-only operations like deleting bookmarks
 */
function bookmarksApiPlugin() {
  const CSV_PATH = resolve(__dirname, "public/bookmarks/links.csv");

  return {
    name: "bookmarks-api",
    configureServer(server: {
      middlewares: { use: (middleware: Connect.HandleFunction) => void };
    }) {
      server.middlewares.use(
        (
          req: Connect.IncomingMessage,
          res: import("http").ServerResponse,
          next: Connect.NextFunction,
        ) => {
          if (req.url === "/api/bookmarks/delete" && req.method === "POST") {
            let body = "";
            req.on("data", (chunk: Buffer) => {
              body += chunk.toString();
            });
            req.on("end", () => {
              try {
                const { url } = JSON.parse(body);
                if (!url) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: "URL required" }));
                  return;
                }

                // Read CSV
                const content = readFileSync(CSV_PATH, "utf-8");
                const lines = content.split("\n");
                const header = lines[0];
                const dataLines = lines.slice(1);

                // Filter out the URL
                const newLines = dataLines.filter(
                  (line) => !line.startsWith(url + ","),
                );

                if (newLines.length === dataLines.length) {
                  res.statusCode = 404;
                  res.end(JSON.stringify({ error: "URL not found" }));
                  return;
                }

                // Write back
                const newContent = [header, ...newLines].join("\n");
                writeFileSync(CSV_PATH, newContent);

                res.setHeader("Content-Type", "application/json");
                res.end(
                  JSON.stringify({ success: true, remaining: newLines.length }),
                );
              } catch (err) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: (err as Error).message }));
              }
            });
            return;
          }
          next();
        },
      );
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
  plugins: [
    react(),
    tailwindcss(),
    contentManifestPlugin(),
    bookmarksApiPlugin(),
  ],

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
        // Split vendor chunks for better caching
        manualChunks(id) {
          // React ecosystem - changes rarely
          if (id.includes("node_modules/react-dom")) {
            return "react-dom";
          }
          if (id.includes("node_modules/react")) {
            return "react";
          }
          // Markdown rendering
          if (id.includes("node_modules/marked")) {
            return "markdown";
          }
        },
      },
      // Suppress chunk size warnings for known large vendor chunks
      onwarn(warning, warn) {
        if (
          warning.code === "CHUNK_SIZE_WARNING" &&
          warning.message?.includes("react-dom")
        ) {
          return; // Ignore react-dom size warning - it's expected
        }
        warn(warning);
      },
    },
    // Target modern browsers only
    target: "esnext",
    // react-dom is ~185KB minified, so set limit above that
    // Our constraint tests enforce actual limits
    chunkSizeWarningLimit: 200,
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
