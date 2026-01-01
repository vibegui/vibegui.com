import { defineConfig, type Connect, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import { watch } from "node:fs";
import { exec } from "node:child_process";

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
 * Request queue to serialize Supabase calls (prevents 429 rate limiting)
 */
class SupabaseRequestQueue {
  private queue: Array<{
    query: string;
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }> = [];
  private processing = false;
  private lastRequestTime = 0;
  private readonly minDelayMs = 100; // Minimum 100ms between requests

  async execute(query: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      this.queue.push({ query, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) continue;

      // Ensure minimum delay between requests
      const timeSinceLastRequest = Date.now() - this.lastRequestTime;
      if (timeSinceLastRequest < this.minDelayMs) {
        await new Promise((r) =>
          setTimeout(r, this.minDelayMs - timeSinceLastRequest),
        );
      }

      try {
        const result = await executeSupabaseSqlDirect(item.query);
        this.lastRequestTime = Date.now();
        item.resolve(result);
      } catch (err) {
        this.lastRequestTime = Date.now();
        item.reject(err as Error);
      }
    }

    this.processing = false;
  }
}

const supabaseQueue = new SupabaseRequestQueue();

/**
 * Execute SQL via Supabase MCP (direct, no queueing)
 */
async function executeSupabaseSqlDirect(query: string) {
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
 * Execute SQL via Supabase MCP (queued - prevents 429 rate limiting)
 */
async function executeSupabaseSql(query: string) {
  return supabaseQueue.execute(query);
}

/**
 * API plugin for bookmark operations using Supabase via MCP
 */
function bookmarksApiPlugin() {
  // Helper to escape SQL strings safely using dollar-quoting
  // This avoids issues with backslashes and quotes in content
  const escapeSQL = (str: string | null | undefined): string => {
    if (str === null || str === undefined) return "NULL";
    // Use dollar-quoting to avoid escaping issues entirely
    // If string contains $$, use a unique tag
    if (!str.includes("$$")) {
      return `$$${str}$$`;
    }
    // Find a safe delimiter that doesn't appear in the string
    let tag = "q";
    while (str.includes(`$${tag}$`)) {
      tag += "q";
    }
    return `$${tag}$${str}$${tag}$`;
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
                const total =
                  (totalRes as Array<{ total: number }>)?.[0]?.total || 0;
                const enriched =
                  (enrichedRes as Array<{ enriched: number }>)?.[0]?.enriched ||
                  0;
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

                let result;
                try {
                  result = await executeSupabaseSql(updateQuery);
                } catch (sqlErr) {
                  console.error("[API] SQL execution failed:", sqlErr);
                  res.statusCode = 500;
                  res.end(
                    JSON.stringify({
                      error: `SQL error: ${(sqlErr as Error).message}`,
                    }),
                  );
                  return;
                }

                console.log(
                  "[API] Update result type:",
                  typeof result,
                  Array.isArray(result),
                );
                console.log(
                  "[API] Update result:",
                  JSON.stringify(result)?.slice(0, 500),
                );

                // Handle case where result is a string (error message or empty)
                if (typeof result === "string") {
                  console.log("[API] Result is string:", result.slice(0, 200));
                  // Check if it contains error info
                  if (result.toLowerCase().includes("error")) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: result }));
                    return;
                  }
                }

                const updated = Array.isArray(result) ? result[0] : result;

                if (!updated || !updated.id) {
                  console.log(
                    "[API] No bookmark returned from update, result was:",
                    JSON.stringify(result)?.slice(0, 200),
                  );
                  res.statusCode = 404;
                  res.end(
                    JSON.stringify({
                      error: "Bookmark not found or update returned no data",
                    }),
                  );
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

          // BATCH UPDATE bookmarks (for enrichment) via Supabase MCP
          // Accepts array of bookmarks, updates ALL in a single SQL transaction
          if (
            req.url === "/api/bookmarks/batch-update" &&
            req.method === "POST"
          ) {
            console.log("[API] /api/bookmarks/batch-update called");
            let body = "";
            req.on("data", (chunk: Buffer) => {
              body += chunk.toString();
            });
            req.on("end", async () => {
              try {
                const { bookmarks: bookmarksToUpdate } = JSON.parse(body);
                console.log(
                  "[API] Batch updating",
                  bookmarksToUpdate?.length,
                  "bookmarks in single transaction",
                );

                if (
                  !bookmarksToUpdate ||
                  !Array.isArray(bookmarksToUpdate) ||
                  bookmarksToUpdate.length === 0
                ) {
                  res.statusCode = 400;
                  res.end(
                    JSON.stringify({ error: "bookmarks array required" }),
                  );
                  return;
                }

                // Exclude generated/system columns from updates
                const excludeFields = new Set([
                  "id",
                  "created_at",
                  "updated_at",
                  "search_vector",
                  "embedding",
                  "url", // URL is the key, not updatable
                  "tags", // Handled separately
                ]);

                // Build a single SQL transaction with all updates
                const updateStatements: string[] = [];
                const tagData: Array<{ url: string; tags: string[] }> = [];

                for (const bookmarkData of bookmarksToUpdate) {
                  const { url, tags, ...updates } = bookmarkData;
                  if (!url) continue;

                  // Build SET clause for this bookmark
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

                  updateStatements.push(
                    `UPDATE bookmarks SET ${setClauses.join(", ")} WHERE url = ${escapeSQL(url)};`,
                  );

                  // Collect tags for batch processing
                  if (tags && Array.isArray(tags)) {
                    tagData.push({ url, tags });
                  }
                }

                // Execute all updates in a single transaction
                const transactionSql = `
                  BEGIN;
                  ${updateStatements.join("\n")}
                  COMMIT;
                `;

                console.log(
                  "[API] Executing batch transaction:",
                  updateStatements.length,
                  "updates",
                );
                await executeSupabaseSql(transactionSql);

                // Now handle tags - first get all bookmark IDs we need
                if (tagData.length > 0) {
                  const urls = tagData.map((t) => escapeSQL(t.url)).join(", ");
                  const bookmarkIds = (await executeSupabaseSql(
                    `SELECT id, url FROM bookmarks WHERE url IN (${urls})`,
                  )) as Array<{ id: number; url: string }>;

                  const urlToId = new Map(
                    bookmarkIds.map((b) => [b.url, b.id]),
                  );

                  // Build batch delete + insert for tags
                  const idsToDelete = tagData
                    .map((t) => urlToId.get(t.url))
                    .filter(Boolean);

                  if (idsToDelete.length > 0) {
                    await executeSupabaseSql(
                      `DELETE FROM bookmark_tags WHERE bookmark_id IN (${idsToDelete.join(", ")})`,
                    );
                  }

                  // Batch insert all tags
                  const allTagValues: string[] = [];
                  for (const { url, tags } of tagData) {
                    const id = urlToId.get(url);
                    if (id && tags.length > 0) {
                      for (const tag of tags) {
                        allTagValues.push(`(${id}, ${escapeSQL(tag)})`);
                      }
                    }
                  }

                  if (allTagValues.length > 0) {
                    await executeSupabaseSql(
                      `INSERT INTO bookmark_tags (bookmark_id, tag) VALUES ${allTagValues.join(", ")}`,
                    );
                  }
                }

                // Fetch updated bookmarks to return
                const updatedUrls = bookmarksToUpdate
                  .map((b: { url?: string }) => b.url)
                  .filter((u): u is string => Boolean(u))
                  .map((u) => escapeSQL(u))
                  .join(", ");

                const updatedBookmarks = (await executeSupabaseSql(`
                  SELECT b.*, array_agg(t.tag) FILTER (WHERE t.tag IS NOT NULL) as tags
                  FROM bookmarks b
                  LEFT JOIN bookmark_tags t ON b.id = t.bookmark_id
                  WHERE b.url IN (${updatedUrls})
                  GROUP BY b.id
                `)) as Array<Record<string, unknown>>;

                const results = updatedBookmarks.map((b) => ({
                  url: b.url as string,
                  success: true,
                  data: b,
                }));

                console.log(
                  "[API] Batch update complete:",
                  results.filter((r) => r.success).length,
                  "succeeded,",
                  results.filter((r) => !r.success).length,
                  "failed",
                );

                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ results }));
              } catch (err) {
                console.error("[API] Batch update error:", err);
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
                const bookmark = (await executeSupabaseSql(
                  `SELECT id FROM bookmarks WHERE url = ${escapeSQL(url)}`,
                )) as Array<{ id: number }>;
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

          // CHECK if a bookmark URL already exists
          if (req.url === "/api/bookmarks/check" && req.method === "POST") {
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

                const result = (await executeSupabaseSql(
                  `SELECT id FROM bookmarks WHERE url = ${escapeSQL(url)} LIMIT 1`,
                )) as Array<{ id: number }>;

                res.setHeader("Content-Type", "application/json");
                res.end(
                  JSON.stringify({ exists: result && result.length > 0 }),
                );
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
                  const existing = (await executeSupabaseSql(
                    `SELECT * FROM bookmarks WHERE url = ${escapeSQL(url)}`,
                  )) as Array<Record<string, unknown>>;
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
 * Plugin to watch the SQLite database and auto-export content on changes
 */
function databaseWatcherPlugin() {
  let watcher: ReturnType<typeof watch> | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let isExporting = false;
  let pendingExport = false; // Track if another export is needed after current one

  const runExport = () => {
    if (isExporting) {
      // Mark that we need another export after the current one finishes
      pendingExport = true;
      return;
    }
    isExporting = true;
    pendingExport = false;

    console.log("\n🔄 Database changed, exporting content...");
    exec(
      "node --experimental-strip-types --experimental-sqlite scripts/export-content.ts",
      { cwd: resolve(__dirname) },
      (error, stdout, stderr) => {
        isExporting = false;
        if (error) {
          console.error("❌ Export failed:", stderr);
        } else {
          console.log(stdout.trim() || "✅ Content exported");
        }
        // If changes happened during export, run again
        if (pendingExport) {
          console.log("🔄 Re-exporting (changes detected during export)...");
          setTimeout(runExport, 100);
        }
      },
    );
  };

  return {
    name: "database-watcher",
    configureServer() {
      const dbPath = resolve(__dirname, "data", "content.db");

      // Watch the database file for changes
      watcher = watch(dbPath, { persistent: false }, (eventType) => {
        if (eventType === "change") {
          // Debounce rapid changes (e.g., multiple writes in quick succession)
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(runExport, 300);
        }
      });

      console.log("👁️  Watching database for changes...");
    },
    closeBundle() {
      if (watcher) {
        watcher.close();
        watcher = null;
      }
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
 * - Auto-export on database changes
 */
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    bookmarksApiPlugin(),
    databaseWatcherPlugin(),
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
