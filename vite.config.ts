import { defineConfig, type Connect, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

// Load .env file for server-side use
const env = loadEnv("development", process.cwd(), "");
const MESH_GATEWAY_URL = env.MESH_GATEWAY_URL;
const MESH_API_KEY = env.MESH_API_KEY;

/**
 * Helper to call MCP tools via Mesh gateway
 */
async function callMcpTool(toolName: string, args: Record<string, unknown>) {
  if (!MESH_GATEWAY_URL || !MESH_API_KEY) {
    throw new Error("MESH_GATEWAY_URL and MESH_API_KEY required");
  }

  const response = await fetch(MESH_GATEWAY_URL, {
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

  const result = await response.json();
  if (result.error) {
    throw new Error(result.error.message || JSON.stringify(result.error));
  }
  return result.result;
}

/**
 * Execute SQL via Supabase MCP
 */
async function executeSupabaseSql(query: string) {
  const result = await callMcpTool("execute_sql", { query });
  // Parse the result - MCP returns content array
  if (result?.content?.[0]?.text) {
    const text = result.content[0].text;

    // Supabase MCP wraps results in <untrusted-data-xxx> tags
    const untrustedMatch = text.match(
      /<untrusted-data[^>]*>([\s\S]*?)<\/untrusted-data/,
    );
    const dataText = untrustedMatch ? untrustedMatch[1].trim() : text;

    // Find JSON array or object in the text
    const jsonMatch = dataText.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (jsonMatch) {
      let jsonStr = jsonMatch[1];

      // First attempt: parse directly
      try {
        return JSON.parse(jsonStr);
      } catch {
        // Second attempt: unescape if double-escaped
        try {
          jsonStr = jsonStr.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
          return JSON.parse(jsonStr);
        } catch (e) {
          console.error("[Supabase MCP] JSON parse failed:", e);
        }
      }
    }

    return dataText;
  }
  return result;
}

/**
 * API plugin for bookmark operations using Supabase via MCP
 */
function bookmarksApiPlugin() {
  // Helper to escape SQL strings safely
  const escapeSQL = (str: string | null | undefined): string => {
    if (str === null || str === undefined) return "NULL";
    // Double single quotes for PostgreSQL escaping
    return `'${str.replace(/'/g, "''")}'`;
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
          // GET all bookmarks (via Supabase MCP)
          if (req.url === "/api/bookmarks" && req.method === "GET") {
            executeSupabaseSql(`
              SELECT b.*, array_agg(t.tag) FILTER (WHERE t.tag IS NOT NULL) as tags
              FROM bookmarks b
              LEFT JOIN bookmark_tags t ON b.id = t.bookmark_id
              GROUP BY b.id
              ORDER BY b.id
            `)
              .then((bookmarks) => {
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify(bookmarks || []));
              })
              .catch((err) => {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: (err as Error).message }));
              });
            return;
          }

          // GET bookmark stats (via Supabase MCP)
          if (req.url === "/api/bookmarks/stats" && req.method === "GET") {
            Promise.all([
              executeSupabaseSql("SELECT COUNT(*) as total FROM bookmarks"),
              executeSupabaseSql(
                "SELECT COUNT(*) as enriched FROM bookmarks WHERE classified_at IS NOT NULL",
              ),
              executeSupabaseSql(
                "SELECT tag, COUNT(*) as count FROM bookmark_tags GROUP BY tag ORDER BY count DESC LIMIT 50",
              ),
            ])
              .then(([totalRes, enrichedRes, tagsRes]) => {
                const total = totalRes?.[0]?.total || 0;
                const enriched = enrichedRes?.[0]?.enriched || 0;
                res.setHeader("Content-Type", "application/json");
                res.end(
                  JSON.stringify({
                    total: Number(total),
                    enriched: Number(enriched),
                    pending: Number(total) - Number(enriched),
                    tagCounts: tagsRes || [],
                  }),
                );
              })
              .catch((err) => {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: (err as Error).message }));
              });
            return;
          }

          // UPDATE a bookmark (for enrichment) via Supabase MCP
          if (req.url === "/api/bookmarks/update" && req.method === "POST") {
            console.log("[API] /api/bookmarks/update called");
            let body = "";
            req.on("data", (chunk: Buffer) => {
              body += chunk.toString();
            });
            req.on("end", async () => {
              try {
                const { url, tags, ...updates } = JSON.parse(body);
                console.log("[API] Updating bookmark:", url);

                if (!url) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: "URL required" }));
                  return;
                }

                // Build SET clause for update (exclude generated/system columns)
                const excludeFields = new Set([
                  "id",
                  "created_at",
                  "updated_at",
                  "search_vector", // generated column
                  "embedding", // vector column, updated separately
                ]);
                const setClauses: string[] = [];
                for (const [key, value] of Object.entries(updates)) {
                  if (value === undefined || excludeFields.has(key)) continue;
                  if (value === null) {
                    setClauses.push(`${key} = NULL`);
                  } else if (typeof value === "number") {
                    setClauses.push(`${key} = ${value}`);
                  } else {
                    setClauses.push(`${key} = ${escapeSQL(String(value))}`);
                  }
                }
                setClauses.push("updated_at = NOW()");

                // Update bookmark
                const updateQuery = `
                  UPDATE bookmarks 
                  SET ${setClauses.join(", ")}
                  WHERE url = ${escapeSQL(url)}
                  RETURNING *
                `;
                console.log("[API] Update query:", updateQuery.slice(0, 200));

                const result = await executeSupabaseSql(updateQuery);
                console.log(
                  "[API] Update result type:",
                  typeof result,
                  Array.isArray(result),
                );
                console.log(
                  "[API] Update result:",
                  JSON.stringify(result)?.slice(0, 300),
                );

                const updated = Array.isArray(result) ? result[0] : result;

                if (!updated || !updated.id) {
                  console.log("[API] No bookmark returned from update");
                  res.statusCode = 404;
                  res.end(JSON.stringify({ error: "Bookmark not found" }));
                  return;
                }

                // Handle tags if provided
                if (tags && Array.isArray(tags) && updated.id) {
                  // Delete existing tags
                  await executeSupabaseSql(
                    `DELETE FROM bookmark_tags WHERE bookmark_id = ${updated.id}`,
                  );

                  // Insert new tags
                  if (tags.length > 0) {
                    const tagValues = tags
                      .map((t: string) => `(${updated.id}, ${escapeSQL(t)})`)
                      .join(", ");
                    await executeSupabaseSql(
                      `INSERT INTO bookmark_tags (bookmark_id, tag) VALUES ${tagValues}`,
                    );
                  }
                  updated.tags = tags;
                }

                console.log("[API] Bookmark updated:", updated.id);
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify(updated));
              } catch (err) {
                console.error("[API] Error in update:", err);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: (err as Error).message }));
              }
            });
            return;
          }

          // DELETE a bookmark via Supabase MCP
          if (req.url === "/api/bookmarks/delete" && req.method === "POST") {
            let body = "";
            req.on("data", (chunk: Buffer) => {
              body += chunk.toString();
            });
            req.on("end", async () => {
              try {
                const { url } = JSON.parse(body);
                if (!url) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: "URL required" }));
                  return;
                }

                // First get the bookmark ID for tag deletion
                const bookmark = await executeSupabaseSql(
                  `SELECT id FROM bookmarks WHERE url = ${escapeSQL(url)}`,
                );
                const id = bookmark?.[0]?.id;

                if (!id) {
                  res.statusCode = 404;
                  res.end(JSON.stringify({ error: "Bookmark not found" }));
                  return;
                }

                // Delete tags first (foreign key)
                await executeSupabaseSql(
                  `DELETE FROM bookmark_tags WHERE bookmark_id = ${id}`,
                );

                // Delete bookmark
                await executeSupabaseSql(
                  `DELETE FROM bookmarks WHERE id = ${id}`,
                );

                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: true }));
              } catch (err) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: (err as Error).message }));
              }
            });
            return;
          }

          // CREATE a bookmark via Supabase MCP
          if (req.url === "/api/bookmarks/create" && req.method === "POST") {
            let body = "";
            req.on("data", (chunk: Buffer) => {
              body += chunk.toString();
            });
            req.on("end", async () => {
              try {
                const { url, title, description, tags } = JSON.parse(body);
                if (!url) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: "URL required" }));
                  return;
                }

                const insertQuery = `
                  INSERT INTO bookmarks (url, title, description)
                  VALUES (${escapeSQL(url)}, ${escapeSQL(title)}, ${escapeSQL(description)})
                  ON CONFLICT (url) DO NOTHING
                  RETURNING *
                `;

                const result = await executeSupabaseSql(insertQuery);
                const created = Array.isArray(result) ? result[0] : result;

                if (!created) {
                  // Bookmark already exists, fetch it
                  const existing = await executeSupabaseSql(
                    `SELECT * FROM bookmarks WHERE url = ${escapeSQL(url)}`,
                  );
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify(existing?.[0] || { url }));
                  return;
                }

                // Handle tags if provided
                if (tags && Array.isArray(tags) && created.id) {
                  const tagValues = tags
                    .map((t: string) => `(${created.id}, ${escapeSQL(t)})`)
                    .join(", ");
                  await executeSupabaseSql(
                    `INSERT INTO bookmark_tags (bookmark_id, tag) VALUES ${tagValues}`,
                  );
                  created.tags = tags;
                }

                res.setHeader("Content-Type", "application/json");
                res.statusCode = 201;
                res.end(JSON.stringify(created));
              } catch (err) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: (err as Error).message }));
              }
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
