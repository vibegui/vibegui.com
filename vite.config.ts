import { defineConfig, type Connect, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";

// Load .env file for server-side use
const env = loadEnv("development", process.cwd(), "");
const MESH_GATEWAY_URL = env.MESH_GATEWAY_URL;
const MESH_API_KEY = env.MESH_API_KEY;

/**
 * API plugin for bookmark operations using SQLite
 */
function bookmarksApiPlugin() {
  // Lazy-load the database module to avoid issues during build
  let dbModule: typeof import("./lib/db/index.ts") | null = null;
  const getDb = async () => {
    if (!dbModule) {
      dbModule = await import("./lib/db/index.ts");
    }
    return dbModule;
  };

  // Regenerate the static JSON after database updates
  const regenerateJson = async () => {
    const db = await getDb();
    const bookmarks = db.getAllBookmarks();
    const minimal = bookmarks.map((b) => {
      const obj: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(b)) {
        if (v !== undefined && v !== null && v !== "") {
          obj[k] = v;
        }
      }
      return obj;
    });
    const outputPath = resolve(__dirname, "public/bookmarks/data.json");
    writeFileSync(outputPath, JSON.stringify(minimal));
  };

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
          // GET all bookmarks
          if (req.url === "/api/bookmarks" && req.method === "GET") {
            getDb()
              .then((db) => {
                const bookmarks = db.getAllBookmarks();
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify(bookmarks));
              })
              .catch((err) => {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: (err as Error).message }));
              });
            return;
          }

          // GET bookmark stats
          if (req.url === "/api/bookmarks/stats" && req.method === "GET") {
            getDb()
              .then((db) => {
                const stats = db.getBookmarkStats();
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify(stats));
              })
              .catch((err) => {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: (err as Error).message }));
              });
            return;
          }

          // DELETE a bookmark
          if (req.url === "/api/bookmarks/delete" && req.method === "POST") {
            let body = "";
            req.on("data", (chunk: Buffer) => {
              body += chunk.toString();
            });
            req.on("end", () => {
              getDb()
                .then(async (db) => {
                  const { url } = JSON.parse(body);
                  if (!url) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: "URL required" }));
                    return;
                  }

                  const deleted = db.deleteBookmark(url);
                  if (!deleted) {
                    res.statusCode = 404;
                    res.end(JSON.stringify({ error: "Bookmark not found" }));
                    return;
                  }

                  // Regenerate JSON after delete
                  await regenerateJson();

                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ success: true }));
                })
                .catch((err) => {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: (err as Error).message }));
                });
            });
            return;
          }

          // UPDATE a bookmark (for enrichment)
          if (req.url === "/api/bookmarks/update" && req.method === "POST") {
            console.log("[API] /api/bookmarks/update called");
            let body = "";
            req.on("data", (chunk: Buffer) => {
              body += chunk.toString();
            });
            req.on("end", () => {
              console.log("[API] Update body received, length:", body.length);
              getDb()
                .then(async (db) => {
                  try {
                    const { url, ...updates } = JSON.parse(body);
                    console.log(
                      "[API] Updating bookmark:",
                      url,
                      "fields:",
                      Object.keys(updates),
                    );
                    if (!url) {
                      res.statusCode = 400;
                      res.end(JSON.stringify({ error: "URL required" }));
                      return;
                    }

                    // Check if bookmark exists first
                    const existing = db.getBookmarkByUrl(url);
                    console.log(
                      "[API] Existing bookmark:",
                      existing?.id,
                      existing?.title,
                    );

                    const updated = db.updateBookmark(url, updates);
                    if (!updated) {
                      console.log(
                        "[API] Bookmark not found or update failed:",
                        url,
                      );
                      res.statusCode = 404;
                      res.end(JSON.stringify({ error: "Bookmark not found" }));
                      return;
                    }

                    console.log("[API] Bookmark updated successfully:", url);
                    console.log(
                      "[API] Updated fields:",
                      updated.stars,
                      updated.icon,
                      updated.insight_dev?.slice(0, 30),
                    );

                    // Regenerate JSON after update
                    await regenerateJson();
                    console.log("[API] JSON regenerated");

                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify(updated));
                  } catch (innerErr) {
                    console.error("[API] Error in update:", innerErr);
                    res.statusCode = 500;
                    res.end(
                      JSON.stringify({ error: (innerErr as Error).message }),
                    );
                  }
                })
                .catch((err) => {
                  console.error("[API] Error loading db:", err);
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: (err as Error).message }));
                });
            });
            return;
          }

          // DELETE a bookmark
          if (req.url === "/api/bookmarks/delete" && req.method === "POST") {
            let body = "";
            req.on("data", (chunk: Buffer) => {
              body += chunk.toString();
            });
            req.on("end", () => {
              getDb()
                .then(async (db) => {
                  try {
                    const { url } = JSON.parse(body);
                    if (!url) {
                      res.statusCode = 400;
                      res.end(JSON.stringify({ error: "URL required" }));
                      return;
                    }

                    const deleted = db.deleteBookmark(url);
                    if (!deleted) {
                      res.statusCode = 404;
                      res.end(JSON.stringify({ error: "Bookmark not found" }));
                      return;
                    }

                    // Regenerate JSON after delete
                    await regenerateJson();

                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify({ success: true }));
                  } catch (innerErr) {
                    res.statusCode = 500;
                    res.end(
                      JSON.stringify({ error: (innerErr as Error).message }),
                    );
                  }
                })
                .catch((err) => {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: (err as Error).message }));
                });
            });
            return;
          }

          // CREATE a bookmark
          if (req.url === "/api/bookmarks/create" && req.method === "POST") {
            let body = "";
            req.on("data", (chunk: Buffer) => {
              body += chunk.toString();
            });
            req.on("end", () => {
              getDb()
                .then((db) => {
                  const bookmark = JSON.parse(body);
                  if (!bookmark.url) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: "URL required" }));
                    return;
                  }

                  const created = db.createBookmark(bookmark);
                  res.setHeader("Content-Type", "application/json");
                  res.statusCode = 201;
                  res.end(JSON.stringify(created));
                })
                .catch((err) => {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: (err as Error).message }));
                });
            });
            return;
          }

          // Mesh proxy endpoint - forwards requests to mesh with authentication
          if (req.url === "/api/mesh/call" && req.method === "POST") {
            let body = "";
            req.on("data", (chunk: Buffer) => {
              body += chunk.toString();
            });
            req.on("end", async () => {
              try {
                const { toolName, args } = JSON.parse(body);

                if (!MESH_GATEWAY_URL || !MESH_API_KEY) {
                  res.statusCode = 500;
                  res.end(
                    JSON.stringify({
                      error:
                        "MESH_GATEWAY_URL and MESH_API_KEY env vars required in .env",
                    }),
                  );
                  return;
                }

                console.log("[Mesh Proxy] Calling:", MESH_GATEWAY_URL);
                console.log("[Mesh Proxy] Tool:", toolName);
                console.log(
                  "[Mesh Proxy] API Key prefix:",
                  `${MESH_API_KEY?.slice(0, 10)}...`,
                );

                const meshResponse = await fetch(MESH_GATEWAY_URL, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json, text/event-stream",
                    Authorization: `Bearer ${MESH_API_KEY}`,
                  },
                  body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: Date.now(),
                    method: "tools/call",
                    params: { name: toolName, arguments: args },
                  }),
                });

                const rawText = await meshResponse.text();
                console.log(
                  "[Mesh Proxy] Response status:",
                  meshResponse.status,
                );
                console.log("[Mesh Proxy] Response:", rawText.slice(0, 200));

                res.setHeader("Content-Type", "application/json");
                res.statusCode = meshResponse.status;

                // Try to parse and re-stringify to ensure valid JSON
                try {
                  const parsed = JSON.parse(rawText);
                  res.end(JSON.stringify(parsed));
                } catch {
                  // If parsing fails, wrap the raw text in an error response
                  res.statusCode = 500;
                  res.end(
                    JSON.stringify({
                      error: `Invalid JSON from mesh: ${rawText.slice(0, 500)}`,
                    }),
                  );
                }
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
  plugins: [react(), tailwindcss(), bookmarksApiPlugin()],

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
    // Don't trigger HMR for CSV files (we update them programmatically)
    watch: {
      ignored: ["**/public/bookmarks/**"],
    },
  },

  // Make content directory accessible as /content
  publicDir: "public",

  preview: {
    port: 4001,
  },
});
