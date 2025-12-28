/**
 * vibegui.com MCP Server
 *
 * This MCP server manages the entire lifecycle of the blog:
 * - Content collections: Ideas, Research, Drafts, Articles (CRUD)
 * - Development tools: dev server, build, git operations
 * - WhatsApp Bridge: Control WhatsApp Web via browser extension
 *
 * Agents transform content between collections using the CRUD tools directly.
 *
 * Usage:
 *   bun run mcp:dev     # Development with hot reload
 *   bun run mcp:serve   # Production server for MCP clients
 *
 * Connect to your MCP Mesh or use directly with Cursor/Claude.
 */

import { withRuntime } from "@decocms/runtime";
import { createTool } from "@decocms/runtime/tools";
import { z } from "zod";
import { join } from "node:path";
import { execSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import {
  discoverAllProfiles,
  createReader,
  getBrowserDisplayName,
  type BrowserProfile,
  type RawBookmark,
} from "./lib/bookmarks/index.ts";
import * as contentDb from "./lib/db/content.ts";

// ============================================================================
// WhatsApp Bridge - WebSocket Server
// ============================================================================

const WS_PORT = 9999;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

interface BridgeRequest {
  id: string;
  method: string;
  params: Record<string, unknown>;
}

interface BridgeResponse {
  id: string;
  result?: unknown;
  error?: { code: number; message: string };
}

let extensionSocket: import("bun").ServerWebSocket<unknown> | null = null;
const pendingRequests = new Map<string, PendingRequest>();

// Create WebSocket server for extension communication
const _wsServer = Bun.serve({
  port: WS_PORT,
  fetch(req, server) {
    // Upgrade HTTP requests to WebSocket
    if (server.upgrade(req)) {
      return; // Upgrade successful
    }
    return new Response("WebSocket server for WhatsApp MCP Bridge", {
      status: 200,
    });
  },
  websocket: {
    open(ws) {
      console.log("[MCP] WhatsApp extension connected");
      extensionSocket = ws;
    },
    message(ws, message) {
      try {
        const response = JSON.parse(
          typeof message === "string" ? message : message.toString(),
        ) as BridgeResponse;
        const pending = pendingRequests.get(response.id);
        if (pending) {
          clearTimeout(pending.timeout);
          pendingRequests.delete(response.id);
          if (response.error) {
            pending.reject(new Error(response.error.message));
          } else {
            pending.resolve(response.result);
          }
        }
      } catch (err) {
        console.error("[MCP] Failed to parse extension message:", err);
      }
    },
    close() {
      console.log("[MCP] WhatsApp extension disconnected");
      extensionSocket = null;
      // Reject all pending requests
      for (const [id, pending] of pendingRequests) {
        clearTimeout(pending.timeout);
        pending.reject(new Error("Extension disconnected"));
        pendingRequests.delete(id);
      }
    },
  },
});

console.log(
  `[MCP] WhatsApp Bridge WebSocket server listening on ws://localhost:${WS_PORT}`,
);

/**
 * Send a command to the WhatsApp extension and wait for response
 */
async function sendToExtension<T>(
  method: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  if (!extensionSocket) {
    throw new Error(
      "WhatsApp extension not connected. Open WhatsApp Web and ensure the extension is loaded.",
    );
  }

  const id = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error("Extension request timeout (30s)"));
    }, 30000);

    pendingRequests.set(id, {
      resolve: resolve as (value: unknown) => void,
      reject,
      timeout,
    });

    const request: BridgeRequest = { id, method, params };
    extensionSocket!.send(JSON.stringify(request));
  });
}

// ============================================================================
// Package.json Script Tools Generator
// ============================================================================

interface PackageJson {
  scripts?: Record<string, string>;
  mcp?: {
    scripts?: Record<
      string,
      {
        description?: string;
        expose?: boolean;
      }
    >;
  };
}

/**
 * Read package.json and generate MCP tools for exposed scripts
 */
function loadPackageJson(): PackageJson {
  const pkgPath = join(process.cwd(), "package.json");
  if (!existsSync(pkgPath)) return {};
  // Synchronous read for initialization
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as PackageJson;
  return pkg;
}

const pkg = loadPackageJson();

/**
 * Generate tools for each exposed script in package.json
 */
function createScriptTools() {
  const scripts = pkg.scripts ?? {};
  const mcpConfig = pkg.mcp?.scripts ?? {};
  const tools: ReturnType<typeof createTool>[] = [];

  for (const name of Object.keys(scripts)) {
    const config = mcpConfig[name];

    // Skip scripts not explicitly exposed
    if (!config?.expose) continue;

    // Convert script name to tool ID: "test:e2e" -> "SCRIPT_TEST_E2E"
    const toolId = `SCRIPT_${name.toUpperCase().replace(/[:-]/g, "_")}`;

    tools.push(
      createTool({
        id: toolId,
        description: config.description ?? `Run 'bun run ${name}'`,
        inputSchema: z.object({}),
        outputSchema: z.object({
          success: z.boolean(),
          output: z.string(),
          exitCode: z.number(),
        }),
        execute: async () => {
          try {
            const output = execSync(`bun run ${name}`, {
              cwd: process.cwd(),
              encoding: "utf-8",
              stdio: ["pipe", "pipe", "pipe"],
            });
            return { success: true, output, exitCode: 0 };
          } catch (error) {
            const execError = error as { stdout?: string; status?: number };
            return {
              success: false,
              output: execError.stdout ?? String(error),
              exitCode: execError.status ?? 1,
            };
          }
        },
      }),
    );
  }

  return tools;
}

// Generate script tools from package.json
const scriptTools = createScriptTools();
console.log(
  `[MCP] Generated ${scriptTools.length} script tools:`,
  scriptTools.map((t) => t.id),
);

// ============================================================================
// Configuration Schema - Bindings
// ============================================================================

/**
 * State schema for the MCP server.
 * No external bindings required - research tool works manually.
 */
const StateSchema = z.object({});

// ============================================================================
// Content Types
// ============================================================================

/**
 * Content entity returned by collection tools
 */
const ContentEntitySchema = z.object({
  id: z.string().describe("Slug/filename without extension"),
  title: z.string(),
  description: z.string().nullish(),
  date: z.string(),
  tags: z.array(z.string()).optional(),
  status: z.enum(["draft", "published"]),
  content: z.string().describe("Raw markdown content"),
  created_at: z.string(),
  updated_at: z.string(),
});

// ============================================================================
// Content Directory Paths
// ============================================================================

/** Get today's date as YYYY-MM-DD */
const todayISO = () => new Date().toISOString().slice(0, 10);

// Content is now stored in SQLite database, not files

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a slug from a title
 */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

// ============================================================================
// Auto-Export on Content Changes
// ============================================================================

/**
 * Trigger content export after changes so dev server picks them up.
 * Runs in the background - doesn't block the response.
 */
function triggerExport() {
  try {
    // Run export in background
    spawn("bun", ["run", "export"], {
      cwd: process.cwd(),
      stdio: "ignore",
      detached: true,
    }).unref();
    console.log("[MCP] Triggered content export");
  } catch (err) {
    console.error("[MCP] Failed to trigger export:", err);
  }
}

// ============================================================================
// SQLite-Based Content Tools
// ============================================================================

/**
 * Creates CRUD tools for content (drafts and articles) using SQLite database
 */
function createSQLiteContentTools() {
  return [
    // DRAFTS LIST
    createTool({
      id: "COLLECTION_DRAFTS_LIST",
      description: "List all drafts with optional filtering",
      inputSchema: z.object({
        status: z.enum(["draft", "published"]).optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      }),
      outputSchema: z.object({
        items: z.array(ContentEntitySchema.omit({ content: true })),
        totalCount: z.number(),
        hasMore: z.boolean(),
      }),
      execute: async ({ context }) => {
        const allContent = context.status
          ? contentDb.getContentByStatus(context.status)
          : contentDb.getDrafts();

        const now = new Date().toISOString();
        const items = allContent.map((c) => ({
          id: c.slug,
          title: c.title,
          description: c.description,
          date: c.date,
          status: c.status,
          tags: c.tags,
          created_at: now,
          updated_at: now,
        }));

        const paginated = items.slice(
          context.offset,
          context.offset + context.limit,
        );

        return {
          items: paginated,
          totalCount: items.length,
          hasMore: items.length > context.offset + context.limit,
        };
      },
    }),

    // DRAFTS GET
    createTool({
      id: "COLLECTION_DRAFTS_GET",
      description: "Get a single draft by ID (slug)",
      inputSchema: z.object({
        id: z.string().describe("The slug/ID of the content"),
      }),
      outputSchema: z.object({
        item: ContentEntitySchema.nullable(),
      }),
      execute: async ({ context }) => {
        const content = contentDb.getContentBySlug(context.id);
        if (!content) return { item: null };
        const now = new Date().toISOString();
        return {
          item: {
            id: content.slug,
            title: content.title,
            description: content.description,
            content: content.content,
            date: content.date,
            status: content.status,
            tags: content.tags,
            created_at: now,
            updated_at: now,
          },
        };
      },
    }),

    // DRAFTS CREATE
    createTool({
      id: "COLLECTION_DRAFTS_CREATE",
      description: "Create a new draft",
      inputSchema: z.object({
        title: z.string(),
        description: z.string().optional(),
        content: z.string().default(""),
        tags: z.array(z.string()).optional(),
        status: z.enum(["draft", "published"]).default("draft"),
      }),
      outputSchema: z.object({
        item: ContentEntitySchema,
      }),
      execute: async ({ context }) => {
        const slug = slugify(context.title);
        const created = contentDb.createContent({
          slug,
          title: context.title,
          description: context.description,
          content: context.content,
          date: todayISO(),
          status: context.status,
          tags: context.tags,
        });

        triggerExport(); // Auto-export for dev server

        const now = new Date().toISOString();
        return {
          item: {
            id: created.slug,
            title: created.title,
            description: created.description,
            content: created.content,
            date: created.date,
            status: created.status,
            tags: created.tags,
            created_at: now,
            updated_at: now,
          },
        };
      },
    }),

    // DRAFTS UPDATE
    createTool({
      id: "COLLECTION_DRAFTS_UPDATE",
      description: "Update an existing draft",
      inputSchema: z.object({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        content: z.string().optional(),
        date: z.string().optional(),
        tags: z.array(z.string()).optional(),
        status: z.enum(["draft", "published"]).optional(),
      }),
      outputSchema: z.object({
        item: ContentEntitySchema,
      }),
      execute: async ({ context }) => {
        const updated = contentDb.updateContent(context.id, {
          title: context.title,
          description: context.description,
          content: context.content,
          date: context.date,
          status: context.status,
          tags: context.tags,
        });

        if (!updated) throw new Error(`Content not found: ${context.id}`);

        triggerExport(); // Auto-export for dev server

        const now = new Date().toISOString();
        return {
          item: {
            id: updated.slug,
            title: updated.title,
            description: updated.description,
            content: updated.content,
            date: updated.date,
            status: updated.status,
            tags: updated.tags,
            created_at: now,
            updated_at: now,
          },
        };
      },
    }),

    // DRAFTS DELETE
    createTool({
      id: "COLLECTION_DRAFTS_DELETE",
      description: "Delete a draft",
      inputSchema: z.object({
        id: z.string(),
      }),
      outputSchema: z.object({
        success: z.boolean(),
        id: z.string(),
      }),
      execute: async ({ context }) => {
        const success = contentDb.deleteContent(context.id);
        if (!success) throw new Error(`Content not found: ${context.id}`);
        triggerExport(); // Auto-export for dev server
        return { success: true, id: context.id };
      },
    }),

    // ARTICLES LIST
    createTool({
      id: "COLLECTION_ARTICLES_LIST",
      description: "List all articles with optional filtering",
      inputSchema: z.object({
        status: z.enum(["draft", "published"]).optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      }),
      outputSchema: z.object({
        items: z.array(ContentEntitySchema.omit({ content: true })),
        totalCount: z.number(),
        hasMore: z.boolean(),
      }),
      execute: async ({ context }) => {
        const allContent = context.status
          ? contentDb.getContentByStatus(context.status)
          : contentDb.getArticles();

        const now = new Date().toISOString();
        const items = allContent.map((c) => ({
          id: c.slug,
          title: c.title,
          description: c.description,
          date: c.date,
          status: c.status,
          tags: c.tags,
          created_at: now,
          updated_at: now,
        }));

        const paginated = items.slice(
          context.offset,
          context.offset + context.limit,
        );

        return {
          items: paginated,
          totalCount: items.length,
          hasMore: items.length > context.offset + context.limit,
        };
      },
    }),

    // ARTICLES GET
    createTool({
      id: "COLLECTION_ARTICLES_GET",
      description: "Get a single article by ID (slug)",
      inputSchema: z.object({
        id: z.string().describe("The slug/ID of the content"),
      }),
      outputSchema: z.object({
        item: ContentEntitySchema.nullable(),
      }),
      execute: async ({ context }) => {
        const content = contentDb.getContentBySlug(context.id);
        if (!content) return { item: null };
        const now = new Date().toISOString();
        return {
          item: {
            id: content.slug,
            title: content.title,
            description: content.description,
            content: content.content,
            date: content.date,
            status: content.status,
            tags: content.tags,
            created_at: now,
            updated_at: now,
          },
        };
      },
    }),

    // ARTICLES CREATE
    createTool({
      id: "COLLECTION_ARTICLES_CREATE",
      description: "Create a new article",
      inputSchema: z.object({
        title: z.string(),
        description: z.string().optional(),
        content: z.string().default(""),
        tags: z.array(z.string()).optional(),
        status: z.enum(["draft", "published"]).default("draft"),
      }),
      outputSchema: z.object({
        item: ContentEntitySchema,
      }),
      execute: async ({ context }) => {
        const slug = slugify(context.title);
        const created = contentDb.createContent({
          slug,
          title: context.title,
          description: context.description,
          content: context.content,
          date: todayISO(),
          status: context.status,
          tags: context.tags,
        });

        triggerExport(); // Auto-export for dev server

        const now = new Date().toISOString();
        return {
          item: {
            id: created.slug,
            title: created.title,
            description: created.description,
            content: created.content,
            date: created.date,
            status: created.status,
            tags: created.tags,
            created_at: now,
            updated_at: now,
          },
        };
      },
    }),

    // ARTICLES UPDATE
    createTool({
      id: "COLLECTION_ARTICLES_UPDATE",
      description: "Update an existing article",
      inputSchema: z.object({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        content: z.string().optional(),
        date: z.string().optional(),
        tags: z.array(z.string()).optional(),
        status: z.enum(["draft", "published"]).optional(),
      }),
      outputSchema: z.object({
        item: ContentEntitySchema,
      }),
      execute: async ({ context }) => {
        const updated = contentDb.updateContent(context.id, {
          title: context.title,
          description: context.description,
          content: context.content,
          date: context.date,
          status: context.status,
          tags: context.tags,
        });

        if (!updated) throw new Error(`Content not found: ${context.id}`);

        triggerExport(); // Auto-export for dev server

        const now = new Date().toISOString();
        return {
          item: {
            id: updated.slug,
            title: updated.title,
            description: updated.description,
            content: updated.content,
            date: updated.date,
            status: updated.status,
            tags: updated.tags,
            created_at: now,
            updated_at: now,
          },
        };
      },
    }),

    // ARTICLES DELETE
    createTool({
      id: "COLLECTION_ARTICLES_DELETE",
      description: "Delete an article",
      inputSchema: z.object({
        id: z.string(),
      }),
      outputSchema: z.object({
        success: z.boolean(),
        id: z.string(),
      }),
      execute: async ({ context }) => {
        const success = contentDb.deleteContent(context.id);
        if (!success) throw new Error(`Content not found: ${context.id}`);
        triggerExport(); // Auto-export for dev server
        return { success: true, id: context.id };
      },
    }),

    // CONTENT SEARCH_REPLACE - Piecemeal editing like Cursor
    createTool({
      id: "CONTENT_SEARCH_REPLACE",
      description:
        "Replace text in content using search/replace. Use this for precise edits without sending the entire content. The old_string must match exactly (including whitespace).",
      inputSchema: z.object({
        id: z.string().describe("The slug/ID of the content to edit"),
        old_string: z.string().describe("The exact text to find and replace"),
        new_string: z.string().describe("The replacement text"),
        replace_all: z
          .boolean()
          .default(false)
          .describe("Replace all occurrences (default: first only)"),
      }),
      outputSchema: z.object({
        success: z.boolean(),
        replacements: z.number().describe("Number of replacements made"),
        preview: z.string().describe("Preview of the change context"),
      }),
      execute: async ({ context }) => {
        const content = contentDb.getContentBySlug(context.id);
        if (!content) throw new Error(`Content not found: ${context.id}`);

        const oldContent = content.content;
        if (!oldContent.includes(context.old_string)) {
          throw new Error(
            `old_string not found in content. Make sure it matches exactly including whitespace.`,
          );
        }

        let newContent: string;
        let replacements: number;

        if (context.replace_all) {
          const parts = oldContent.split(context.old_string);
          replacements = parts.length - 1;
          newContent = parts.join(context.new_string);
        } else {
          replacements = 1;
          newContent = oldContent.replace(
            context.old_string,
            context.new_string,
          );
        }

        contentDb.updateContent(context.id, { content: newContent });
        triggerExport();

        // Generate preview context (show 50 chars before/after first replacement)
        const idx = newContent.indexOf(context.new_string);
        const start = Math.max(0, idx - 50);
        const end = Math.min(
          newContent.length,
          idx + context.new_string.length + 50,
        );
        const preview =
          (start > 0 ? "..." : "") +
          newContent.slice(start, end) +
          (end < newContent.length ? "..." : "");

        return { success: true, replacements, preview };
      },
    }),

    // CONTENT APPEND - Add text to end of content
    createTool({
      id: "CONTENT_APPEND",
      description: "Append text to the end of content",
      inputSchema: z.object({
        id: z.string().describe("The slug/ID of the content"),
        text: z.string().describe("Text to append"),
        separator: z
          .string()
          .default("\n\n")
          .describe("Separator between existing content and appended text"),
      }),
      outputSchema: z.object({
        success: z.boolean(),
        newLength: z.number(),
      }),
      execute: async ({ context }) => {
        const content = contentDb.getContentBySlug(context.id);
        if (!content) throw new Error(`Content not found: ${context.id}`);

        const newContent = content.content + context.separator + context.text;
        contentDb.updateContent(context.id, { content: newContent });
        triggerExport();

        return { success: true, newLength: newContent.length };
      },
    }),

    // CONTENT PREPEND - Add text to beginning of content
    createTool({
      id: "CONTENT_PREPEND",
      description: "Prepend text to the beginning of content",
      inputSchema: z.object({
        id: z.string().describe("The slug/ID of the content"),
        text: z.string().describe("Text to prepend"),
        separator: z
          .string()
          .default("\n\n")
          .describe("Separator between prepended text and existing content"),
      }),
      outputSchema: z.object({
        success: z.boolean(),
        newLength: z.number(),
      }),
      execute: async ({ context }) => {
        const content = contentDb.getContentBySlug(context.id);
        if (!content) throw new Error(`Content not found: ${context.id}`);

        const newContent = context.text + context.separator + content.content;
        contentDb.updateContent(context.id, { content: newContent });
        triggerExport();

        return { success: true, newLength: newContent.length };
      },
    }),

    // CONTENT INSERT_AFTER - Insert text after a marker
    createTool({
      id: "CONTENT_INSERT_AFTER",
      description: "Insert text after a specific marker in content",
      inputSchema: z.object({
        id: z.string().describe("The slug/ID of the content"),
        marker: z.string().describe("The text to insert after"),
        text: z.string().describe("Text to insert"),
      }),
      outputSchema: z.object({
        success: z.boolean(),
        preview: z.string(),
      }),
      execute: async ({ context }) => {
        const content = contentDb.getContentBySlug(context.id);
        if (!content) throw new Error(`Content not found: ${context.id}`);

        if (!content.content.includes(context.marker)) {
          throw new Error(`Marker not found in content`);
        }

        const newContent = content.content.replace(
          context.marker,
          context.marker + context.text,
        );
        contentDb.updateContent(context.id, { content: newContent });
        triggerExport();

        const idx = newContent.indexOf(context.marker);
        const start = Math.max(0, idx - 20);
        const end = Math.min(
          newContent.length,
          idx + context.marker.length + context.text.length + 20,
        );
        const preview = newContent.slice(start, end);

        return { success: true, preview };
      },
    }),

    // CONTENT INSERT_BEFORE - Insert text before a marker
    createTool({
      id: "CONTENT_INSERT_BEFORE",
      description: "Insert text before a specific marker in content",
      inputSchema: z.object({
        id: z.string().describe("The slug/ID of the content"),
        marker: z.string().describe("The text to insert before"),
        text: z.string().describe("Text to insert"),
      }),
      outputSchema: z.object({
        success: z.boolean(),
        preview: z.string(),
      }),
      execute: async ({ context }) => {
        const content = contentDb.getContentBySlug(context.id);
        if (!content) throw new Error(`Content not found: ${context.id}`);

        if (!content.content.includes(context.marker)) {
          throw new Error(`Marker not found in content`);
        }

        const newContent = content.content.replace(
          context.marker,
          context.text + context.marker,
        );
        contentDb.updateContent(context.id, { content: newContent });
        triggerExport();

        const idx = newContent.indexOf(context.text);
        const start = Math.max(0, idx - 20);
        const end = Math.min(
          newContent.length,
          idx + context.text.length + context.marker.length + 20,
        );
        const preview = newContent.slice(start, end);

        return { success: true, preview };
      },
    }),
  ];
}

// ============================================================================
// Search Tools - ripgrep/grep for finding references
// ============================================================================

/**
 * Check if ripgrep (rg) is available, fall back to grep
 */
function getSearchCommand(): "rg" | "grep" {
  try {
    execSync("which rg", { encoding: "utf-8", stdio: "pipe" });
    return "rg";
  } catch {
    return "grep";
  }
}

const searchCommand = getSearchCommand();
console.log(`[MCP] Using search command: ${searchCommand}`);

/**
 * Execute search with ripgrep or grep
 */
function executeSearch(
  pattern: string,
  directory: string,
  contextLines: number,
  caseSensitive: boolean,
): string {
  const caseFlag = caseSensitive ? "" : "-i";

  try {
    if (searchCommand === "rg") {
      // ripgrep: faster, respects .gitignore, better output
      const cmd = `rg ${caseFlag} -n --context ${contextLines} --color never "${pattern}" "${directory}"`;
      return execSync(cmd, {
        cwd: process.cwd(),
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    } else {
      // grep fallback: -r recursive, -n line numbers, -C context
      const cmd = `grep ${caseFlag} -rn -C ${contextLines} "${pattern}" "${directory}"`;
      return execSync(cmd, {
        cwd: process.cwd(),
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    }
  } catch (error) {
    // grep/rg return exit code 1 when no matches found
    const execError = error as { stdout?: string; status?: number };
    if (execError.status === 1) {
      return ""; // No matches
    }
    throw error;
  }
}

const searchTools = [
  createTool({
    id: "SEARCH_CONTEXT",
    description:
      "Search through context/ files for references, concepts, and quotes. Uses ripgrep if available, otherwise grep.",
    inputSchema: z.object({
      pattern: z.string().describe("Search pattern (regex supported)"),
      contextLines: z
        .number()
        .default(5)
        .describe("Lines of context before and after each match"),
      caseSensitive: z
        .boolean()
        .default(false)
        .describe("Case-sensitive search"),
    }),
    outputSchema: z.object({
      matches: z
        .string()
        .describe("Search results with file paths and context"),
      matchCount: z.number().describe("Approximate number of matches"),
      searchEngine: z
        .string()
        .describe("Which search tool was used (rg or grep)"),
    }),
    execute: async ({ context }) => {
      const results = executeSearch(
        context.pattern,
        "./context",
        context.contextLines,
        context.caseSensitive,
      );

      // Count matches (lines that contain the pattern, not context lines)
      const matchCount = results
        .split("\n")
        .filter((line) => line.includes(":") && !line.startsWith("--")).length;

      return {
        matches: results || "No matches found",
        matchCount,
        searchEngine: searchCommand,
      };
    },
  }),

  createTool({
    id: "SEARCH_CONTENT",
    description:
      "Search through content/ files (drafts, articles) for references and concepts. Uses ripgrep if available.",
    inputSchema: z.object({
      pattern: z.string().describe("Search pattern (regex supported)"),
      contextLines: z
        .number()
        .default(5)
        .describe("Lines of context before and after each match"),
      caseSensitive: z
        .boolean()
        .default(false)
        .describe("Case-sensitive search"),
      collection: z
        .enum(["all", "drafts", "articles"])
        .default("all")
        .describe("Which collection to search"),
    }),
    outputSchema: z.object({
      matches: z
        .string()
        .describe("Search results with file paths and context"),
      matchCount: z.number().describe("Approximate number of matches"),
      searchEngine: z
        .string()
        .describe("Which search tool was used (rg or grep)"),
    }),
    execute: async ({ context }) => {
      const dir =
        context.collection === "all"
          ? "./content"
          : `./content/${context.collection}`;

      const results = executeSearch(
        context.pattern,
        dir,
        context.contextLines,
        context.caseSensitive,
      );

      const matchCount = results
        .split("\n")
        .filter((line) => line.includes(":") && !line.startsWith("--")).length;

      return {
        matches: results || "No matches found",
        matchCount,
        searchEngine: searchCommand,
      };
    },
  }),

  createTool({
    id: "SEARCH_ALL",
    description:
      "Search through all markdown files in both context/ and content/ directories at once.",
    inputSchema: z.object({
      pattern: z.string().describe("Search pattern (regex supported)"),
      contextLines: z
        .number()
        .default(3)
        .describe("Lines of context before and after each match"),
      caseSensitive: z
        .boolean()
        .default(false)
        .describe("Case-sensitive search"),
    }),
    outputSchema: z.object({
      contextMatches: z.string(),
      contentMatches: z.string(),
      totalMatchCount: z.number(),
      searchEngine: z.string(),
    }),
    execute: async ({ context }) => {
      const contextResults = executeSearch(
        context.pattern,
        "./context",
        context.contextLines,
        context.caseSensitive,
      );

      const contentResults = executeSearch(
        context.pattern,
        "./content",
        context.contextLines,
        context.caseSensitive,
      );

      const countMatches = (results: string) =>
        results
          .split("\n")
          .filter((line) => line.includes(":") && !line.startsWith("--"))
          .length;

      return {
        contextMatches: contextResults || "No matches in context/",
        contentMatches: contentResults || "No matches in content/",
        totalMatchCount:
          countMatches(contextResults) + countMatches(contentResults),
        searchEngine: searchCommand,
      };
    },
  }),
];

// ============================================================================
// Interactive Development Tools (not auto-generated from package.json)
// ============================================================================

let devServerProcess: ChildProcess | null = null;

const interactiveTools = [
  createTool({
    id: "DEV_SERVER_START",
    description: "Start the Vite development server",
    inputSchema: z.object({}),
    outputSchema: z.object({
      success: z.boolean(),
      url: z.string(),
      message: z.string(),
    }),
    execute: async () => {
      if (devServerProcess) {
        return {
          success: true,
          url: "http://localhost:4001",
          message: "Dev server already running",
        };
      }

      devServerProcess = spawn("bun", ["run", "dev"], {
        cwd: process.cwd(),
        stdio: "inherit",
        detached: false,
      });

      // Wait a bit for server to start
      await new Promise((resolve) => setTimeout(resolve, 2000));

      return {
        success: true,
        url: "http://localhost:4001",
        message: "Dev server started",
      };
    },
  }),

  createTool({
    id: "DEV_SERVER_STOP",
    description: "Stop the Vite development server",
    inputSchema: z.object({}),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
    }),
    execute: async () => {
      if (!devServerProcess) {
        return { success: true, message: "Dev server not running" };
      }

      devServerProcess.kill();
      devServerProcess = null;

      return { success: true, message: "Dev server stopped" };
    },
  }),

  createTool({
    id: "GIT_STATUS",
    description: "Get git status - list of changed files",
    inputSchema: z.object({}),
    outputSchema: z.object({
      files: z.array(z.string()),
      staged: z.array(z.string()),
      unstaged: z.array(z.string()),
    }),
    execute: async () => {
      const status = execSync("git status --porcelain", {
        cwd: process.cwd(),
        encoding: "utf-8",
      });

      const lines = status.split("\n").filter(Boolean);
      const files = lines.map((line) => line.slice(3));
      const staged = lines
        .filter((line) => line[0] !== " " && line[0] !== "?")
        .map((line) => line.slice(3));
      const unstaged = lines
        .filter((line) => line[0] === " " || line[0] === "?" || line[1] !== " ")
        .map((line) => line.slice(3));

      return { files, staged, unstaged };
    },
  }),

  createTool({
    id: "COMMIT",
    description: "Stage all changes and commit with a message",
    inputSchema: z.object({
      message: z.string().describe("Commit message"),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      hash: z.string().optional(),
      error: z.string().optional(),
    }),
    execute: async ({ context }) => {
      try {
        execSync("git add .", { cwd: process.cwd() });
        execSync(`git commit -m "${context.message}"`, {
          cwd: process.cwd(),
        });

        const hash = execSync("git rev-parse --short HEAD", {
          cwd: process.cwd(),
          encoding: "utf-8",
        }).trim();

        return { success: true, hash };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  }),

  createTool({
    id: "PUSH",
    description: "Push commits to remote",
    inputSchema: z.object({
      force: z.boolean().default(false),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      output: z.string(),
    }),
    execute: async ({ context }) => {
      try {
        const cmd = context.force ? "git push --force" : "git push";
        const output = execSync(cmd, {
          cwd: process.cwd(),
          encoding: "utf-8",
        });
        return { success: true, output: output || "Pushed successfully" };
      } catch (error) {
        return {
          success: false,
          output: error instanceof Error ? error.message : String(error),
        };
      }
    },
  }),
];

// ============================================================================
// WhatsApp Bridge Tools
// ============================================================================

/**
 * Schema for a WhatsApp chat in the sidebar
 */
const WhatsAppChatSchema = z.object({
  name: z.string(),
  lastMessage: z.string().optional(),
  time: z.string().optional(),
  unread: z.number().optional(),
});

/**
 * Schema for a WhatsApp message
 */
const WhatsAppMessageSchema = z.object({
  id: z.string(),
  text: z.string(),
  isOutgoing: z.boolean(),
  timestamp: z.string().optional(),
  author: z.string().optional(),
  hasMedia: z.boolean().optional(),
});

const whatsappTools = [
  createTool({
    id: "WHATSAPP_STATUS",
    description:
      "Check if WhatsApp extension is connected and a chat is open. Use this first to verify the bridge is working.",
    inputSchema: z.object({}),
    outputSchema: z.object({
      connected: z.boolean().describe("Whether extension is connected"),
      chatOpen: z.boolean().describe("Whether a chat is currently open"),
      currentChat: z.string().optional().describe("Name of current chat"),
    }),
    execute: async () => {
      try {
        const result = await sendToExtension<{
          connected: boolean;
          chatOpen: boolean;
          currentChat?: string;
        }>("status");
        return result;
      } catch {
        return { connected: false, chatOpen: false };
      }
    },
  }),

  createTool({
    id: "WHATSAPP_LIST_CHATS",
    description:
      "List visible chats in WhatsApp sidebar. Returns chat names, last messages, and timestamps.",
    inputSchema: z.object({
      limit: z
        .number()
        .default(20)
        .describe("Maximum number of chats to return"),
    }),
    outputSchema: z.object({
      chats: z.array(WhatsAppChatSchema),
      total: z.number(),
    }),
    execute: async ({ context }) => {
      return sendToExtension("listChats", { limit: context.limit });
    },
  }),

  createTool({
    id: "WHATSAPP_SEARCH_CHATS",
    description:
      "Search for a chat by name using WhatsApp's search box. Updates the visible chat list.",
    inputSchema: z.object({
      query: z.string().describe("Search query (name or phone number)"),
    }),
    outputSchema: z.object({
      success: z.boolean(),
    }),
    execute: async ({ context }) => {
      return sendToExtension("searchChats", { query: context.query });
    },
  }),

  createTool({
    id: "WHATSAPP_OPEN_CHAT",
    description:
      "Open a specific chat by name. Supports partial matching (case-insensitive).",
    inputSchema: z.object({
      name: z.string().describe("Chat name to open (partial match supported)"),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      openedChat: z.string().optional().describe("Full name of opened chat"),
    }),
    execute: async ({ context }) => {
      return sendToExtension("openChat", { name: context.name });
    },
  }),

  createTool({
    id: "WHATSAPP_GET_CURRENT_CHAT",
    description: "Get information about the currently open chat.",
    inputSchema: z.object({}),
    outputSchema: z.object({
      name: z.string().describe("Name of current chat"),
      isGroup: z.boolean().optional(),
    }),
    execute: async () => {
      return sendToExtension("getCurrentChat");
    },
  }),

  createTool({
    id: "WHATSAPP_READ_MESSAGES",
    description:
      "Read currently visible messages in the open chat. Does not scroll - only reads what's on screen.",
    inputSchema: z.object({
      filter: z
        .enum(["all", "me", "them"])
        .default("all")
        .describe("Filter by sender: all, me (outgoing), or them (incoming)"),
    }),
    outputSchema: z.object({
      messages: z.array(WhatsAppMessageSchema),
      total: z.number(),
      chatName: z.string().optional(),
    }),
    execute: async ({ context }) => {
      return sendToExtension("readMessages", { filter: context.filter });
    },
  }),

  createTool({
    id: "WHATSAPP_SCROLL_UP",
    description:
      "Scroll up to load older messages. Use this iteratively to navigate history.",
    inputSchema: z.object({
      count: z
        .number()
        .default(5)
        .describe("Number of scroll actions to perform"),
    }),
    outputSchema: z.object({
      scrolled: z.number().describe("Actual number of successful scrolls"),
      reachedTop: z.boolean().optional().describe("Whether we reached the top"),
    }),
    execute: async ({ context }) => {
      return sendToExtension("scrollUp", { count: context.count });
    },
  }),

  createTool({
    id: "WHATSAPP_SCROLL_DOWN",
    description: "Scroll down to see newer messages.",
    inputSchema: z.object({
      count: z
        .number()
        .default(5)
        .describe("Number of scroll actions to perform"),
    }),
    outputSchema: z.object({
      scrolled: z.number(),
    }),
    execute: async ({ context }) => {
      return sendToExtension("scrollDown", { count: context.count });
    },
  }),

  createTool({
    id: "WHATSAPP_SCRAPE",
    description:
      "Full scrape of chat history with auto-scroll. Collects all messages by scrolling through the entire conversation. Can take a while for long chats.",
    inputSchema: z.object({
      scrollLimit: z
        .number()
        .default(50)
        .describe(
          "Maximum scroll actions (more = older history, ~20 msgs per scroll)",
        ),
      filter: z
        .enum(["all", "me", "them"])
        .default("all")
        .describe("Filter messages by sender"),
      minLength: z
        .number()
        .default(0)
        .describe("Minimum message length in characters"),
    }),
    outputSchema: z.object({
      messages: z.array(WhatsAppMessageSchema),
      total: z.number(),
      scrollsPerformed: z.number().optional(),
    }),
    execute: async ({ context }) => {
      return sendToExtension("scrape", {
        scrollLimit: context.scrollLimit,
        filter: context.filter,
        minLength: context.minLength,
      });
    },
  }),

  createTool({
    id: "WHATSAPP_CLEAR_SEARCH",
    description: "Clear the search box and return to the full chat list.",
    inputSchema: z.object({}),
    outputSchema: z.object({
      success: z.boolean(),
    }),
    execute: async () => {
      return sendToExtension("clearSearch");
    },
  }),
];

console.log(`[MCP] Registered ${whatsappTools.length} WhatsApp Bridge tools`);

// ============================================================================
// Bookmark Tools - Read bookmarks from local browsers
// ============================================================================

const BrowserTypeSchema = z.enum([
  "chrome",
  "chromium",
  "brave",
  "edge",
  "dia",
  "comet",
  "firefox",
  "safari",
]);

const BrowserProfileSchema = z.object({
  browser: BrowserTypeSchema,
  name: z.string(),
  path: z.string(),
  bookmarksPath: z.string(),
  isDefault: z.boolean(),
});

const RawBookmarkSchema = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string(),
  dateAdded: z.number().optional(),
  dateModified: z.number().optional(),
  folderId: z.string().optional(),
});

const bookmarkTools = [
  createTool({
    id: "BOOKMARKS_DISCOVER_BROWSERS",
    description:
      "Discover all browser profiles on this system. Returns Chrome, Brave, Edge, Firefox, Safari profiles with their paths. Use this first to see available browsers before reading bookmarks.",
    inputSchema: z.object({}),
    outputSchema: z.object({
      profiles: z.array(BrowserProfileSchema),
      summary: z.string(),
    }),
    execute: async () => {
      const profiles = await discoverAllProfiles();

      // Group by browser for summary
      const byBrowser = new Map<string, number>();
      for (const p of profiles) {
        const name = getBrowserDisplayName(p.browser);
        byBrowser.set(name, (byBrowser.get(name) || 0) + 1);
      }

      const summary = Array.from(byBrowser.entries())
        .map(([name, count]) => `${name}: ${count} profile(s)`)
        .join(", ");

      return {
        profiles,
        summary: summary || "No browser profiles found",
      };
    },
  }),

  createTool({
    id: "BOOKMARKS_READ",
    description:
      "Read bookmarks from a specific browser profile. Returns all bookmarks with URLs, titles, and folder info. Supports Chrome, Brave, Edge, Dia, Comet, Safari. Firefox requires better-sqlite3.",
    inputSchema: z.object({
      browser: BrowserTypeSchema.describe("Browser type to read from"),
      profilePath: z
        .string()
        .optional()
        .describe(
          "Optional: specific profile path. If not provided, uses default profile.",
        ),
    }),
    outputSchema: z.object({
      bookmarks: z.array(RawBookmarkSchema),
      folderCount: z.number(),
      totalCount: z.number(),
      browser: z.string(),
      profileName: z.string(),
    }),
    execute: async ({ context }) => {
      const reader = createReader(context.browser);
      const profiles = await reader.discoverProfiles();

      let profile: BrowserProfile | undefined;

      if (context.profilePath) {
        profile = profiles.find((p) => p.path === context.profilePath);
        if (!profile) {
          throw new Error(`Profile not found at path: ${context.profilePath}`);
        }
      } else {
        profile = profiles.find((p) => p.isDefault) || profiles[0];
        if (!profile) {
          throw new Error(
            `No ${getBrowserDisplayName(context.browser)} profiles found`,
          );
        }
      }

      const data = await reader.readBookmarks(profile);

      return {
        bookmarks: data.bookmarks.map((b) => ({
          id: b.id,
          url: b.url,
          title: b.title,
          dateAdded: b.dateAdded,
          dateModified: b.dateModified,
          folderId: b.folderId,
        })),
        folderCount: data.folders.length,
        totalCount: data.bookmarks.length,
        browser: getBrowserDisplayName(context.browser),
        profileName: profile.name,
      };
    },
  }),

  createTool({
    id: "BOOKMARKS_SEARCH",
    description:
      "Search bookmarks across all browser profiles by URL or title pattern. Returns matching bookmarks from all installed browsers.",
    inputSchema: z.object({
      pattern: z
        .string()
        .describe("Search pattern (case-insensitive, matches URL or title)"),
      browsers: z
        .array(BrowserTypeSchema)
        .optional()
        .describe(
          "Optional: limit search to specific browsers. If not provided, searches all.",
        ),
      limit: z
        .number()
        .default(50)
        .describe("Maximum number of results to return"),
    }),
    outputSchema: z.object({
      results: z.array(
        z.object({
          browser: z.string(),
          profileName: z.string(),
          bookmark: RawBookmarkSchema,
        }),
      ),
      totalMatches: z.number(),
      searchedBrowsers: z.array(z.string()),
    }),
    execute: async ({ context }) => {
      const allProfiles = await discoverAllProfiles();
      const pattern = context.pattern.toLowerCase();

      // Filter by browser if specified
      const profilesToSearch = context.browsers
        ? allProfiles.filter((p) => context.browsers!.includes(p.browser))
        : allProfiles;

      const results: Array<{
        browser: string;
        profileName: string;
        bookmark: RawBookmark;
      }> = [];

      const searchedBrowsers = new Set<string>();

      for (const profile of profilesToSearch) {
        try {
          const reader = createReader(profile.browser);
          const data = await reader.readBookmarks(profile);

          searchedBrowsers.add(getBrowserDisplayName(profile.browser));

          for (const bookmark of data.bookmarks) {
            if (
              bookmark.url.toLowerCase().includes(pattern) ||
              bookmark.title.toLowerCase().includes(pattern)
            ) {
              results.push({
                browser: getBrowserDisplayName(profile.browser),
                profileName: profile.name,
                bookmark,
              });

              if (results.length >= context.limit) {
                break;
              }
            }
          }

          if (results.length >= context.limit) {
            break;
          }
        } catch {
          // Skip browsers that fail to read (e.g., Firefox without better-sqlite3)
        }
      }

      return {
        results: results.slice(0, context.limit).map((r) => ({
          browser: r.browser,
          profileName: r.profileName,
          bookmark: {
            id: r.bookmark.id,
            url: r.bookmark.url,
            title: r.bookmark.title,
            dateAdded: r.bookmark.dateAdded,
            dateModified: r.bookmark.dateModified,
            folderId: r.bookmark.folderId,
          },
        })),
        totalMatches: results.length,
        searchedBrowsers: Array.from(searchedBrowsers),
      };
    },
  }),

  createTool({
    id: "BOOKMARKS_EXPORT_CSV",
    description:
      "Export bookmarks from a browser to CSV format. Returns CSV content that can be saved or appended to existing CSV files.",
    inputSchema: z.object({
      browser: BrowserTypeSchema.describe("Browser type to export from"),
      profilePath: z
        .string()
        .optional()
        .describe("Optional: specific profile path"),
      includeHeader: z
        .boolean()
        .default(true)
        .describe("Include CSV header row"),
    }),
    outputSchema: z.object({
      csv: z.string(),
      rowCount: z.number(),
      browser: z.string(),
    }),
    execute: async ({ context }) => {
      const reader = createReader(context.browser);
      const profiles = await reader.discoverProfiles();

      let profile: BrowserProfile | undefined;

      if (context.profilePath) {
        profile = profiles.find((p) => p.path === context.profilePath);
      } else {
        profile = profiles.find((p) => p.isDefault) || profiles[0];
      }

      if (!profile) {
        throw new Error(
          `No ${getBrowserDisplayName(context.browser)} profiles found`,
        );
      }

      const data = await reader.readBookmarks(profile);

      // Build CSV
      const escapeCSV = (str: string) => {
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const lines: string[] = [];

      if (context.includeHeader) {
        lines.push("url,title,browser,profile,date_added");
      }

      for (const bookmark of data.bookmarks) {
        const dateAdded = bookmark.dateAdded
          ? new Date(bookmark.dateAdded / 1000).toISOString()
          : "";

        lines.push(
          [
            escapeCSV(bookmark.url),
            escapeCSV(bookmark.title),
            escapeCSV(getBrowserDisplayName(context.browser)),
            escapeCSV(profile.name),
            dateAdded,
          ].join(","),
        );
      }

      return {
        csv: lines.join("\n"),
        rowCount: data.bookmarks.length,
        browser: getBrowserDisplayName(context.browser),
      };
    },
  }),
];

console.log(`[MCP] Registered ${bookmarkTools.length} Bookmark tools`);

// ============================================================================
// MCP Server Export
// ============================================================================

// Wrap tools as functions that return tools (required by withRuntime)
const wrapTools = (tools: ReturnType<typeof createTool>[]) =>
  tools.map((tool) => () => tool);

const allTools = [
  // Content collections (SQLite-based)
  ...wrapTools(createSQLiteContentTools()),

  // Search tools (ripgrep/grep)
  ...wrapTools(searchTools),

  // Auto-generated script tools from package.json
  ...wrapTools(scriptTools),

  // Interactive tools (dev server, git)
  ...wrapTools(interactiveTools),

  // WhatsApp Bridge tools
  ...wrapTools(whatsappTools),

  // Bookmark tools (read from local browsers)
  ...wrapTools(bookmarkTools),
];

console.log(`[MCP] Registering ${allTools.length} total tools`);

const runtime = withRuntime({
  configuration: {
    state: StateSchema,
    scopes: [],
  },
  tools: allTools,
});

export default runtime;
