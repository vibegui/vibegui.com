#!/usr/bin/env node
/**
 * vibegui.com MCP Server - STDIO Transport
 *
 * This file runs the MCP server over STDIO for use with MCP clients like
 * Claude Desktop, Cursor, or Mesh's npx-based connections.
 *
 * Usage:
 *   bun mcp-stdio.ts              # Run directly
 *   npx vibegui.com               # If published to npm
 *
 * In Mesh, add as STDIO connection:
 *   Command: bun
 *   Args: /path/to/vibegui.com/mcp-stdio.ts
 *
 * Or for npx (after publishing):
 *   Command: npx
 *   Args: vibegui.com
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { join } from "node:path";
import { execSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

/**
 * Trigger content export after changes so dev server picks them up.
 * Runs in the background - doesn't block the response.
 */
function triggerExport() {
  try {
    spawn("bun", ["run", "export"], {
      cwd: process.cwd(),
      stdio: "ignore",
      detached: true,
    }).unref();
  } catch (err) {
    console.error("[MCP] Failed to trigger export:", err);
  }
}
import {
  discoverAllProfiles,
  createReader,
  getBrowserDisplayName,
  type BrowserProfile,
  type RawBookmark,
} from "./lib/bookmarks/index.ts";
import * as contentDb from "./lib/db/content.ts";

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

function loadPackageJson(): PackageJson {
  const pkgPath = join(process.cwd(), "package.json");
  if (!existsSync(pkgPath)) return {};
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as PackageJson;
  return pkg;
}

const pkg = loadPackageJson();

// ============================================================================
// Helper Functions
// ============================================================================

const todayISO = () => new Date().toISOString().slice(0, 10);

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function getSearchCommand(): "rg" | "grep" {
  try {
    execSync("which rg", { encoding: "utf-8", stdio: "pipe" });
    return "rg";
  } catch {
    return "grep";
  }
}

const searchCommand = getSearchCommand();

function executeSearch(
  pattern: string,
  directory: string,
  contextLines: number,
  caseSensitive: boolean,
): string {
  const caseFlag = caseSensitive ? "" : "-i";

  try {
    if (searchCommand === "rg") {
      const cmd = `rg ${caseFlag} -n --context ${contextLines} --color never "${pattern}" "${directory}"`;
      return execSync(cmd, {
        cwd: process.cwd(),
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    } else {
      const cmd = `grep ${caseFlag} -rn -C ${contextLines} "${pattern}" "${directory}"`;
      return execSync(cmd, {
        cwd: process.cwd(),
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    }
  } catch (error) {
    const execError = error as { stdout?: string; status?: number };
    if (execError.status === 1) {
      return "";
    }
    throw error;
  }
}

// ============================================================================
// Tool Definitions
// ============================================================================

interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

const tools: ToolDef[] = [];

// Content Tools (Drafts & Articles)
tools.push({
  name: "COLLECTION_DRAFTS_LIST",
  description: "List all drafts with optional filtering",
  inputSchema: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["draft", "published"] },
      limit: { type: "number", default: 50 },
      offset: { type: "number", default: 0 },
    },
  },
  handler: async (args) => {
    const status = args.status as "draft" | "published" | undefined;
    const limit = (args.limit as number) || 50;
    const offset = (args.offset as number) || 0;

    const allContent = status
      ? contentDb.getContentByStatus(status)
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

    const paginated = items.slice(offset, offset + limit);

    return {
      items: paginated,
      totalCount: items.length,
      hasMore: items.length > offset + limit,
    };
  },
});

tools.push({
  name: "COLLECTION_DRAFTS_GET",
  description: "Get a single draft by ID (slug)",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "The slug/ID of the content" },
    },
    required: ["id"],
  },
  handler: async (args) => {
    const content = contentDb.getContentBySlug(args.id as string);
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
});

tools.push({
  name: "COLLECTION_DRAFTS_CREATE",
  description: "Create a new draft",
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      content: { type: "string", default: "" },
      tags: { type: "array", items: { type: "string" } },
      status: {
        type: "string",
        enum: ["draft", "published"],
        default: "draft",
      },
    },
    required: ["title"],
  },
  handler: async (args) => {
    const slug = slugify(args.title as string);
    const created = contentDb.createContent({
      slug,
      title: args.title as string,
      description: args.description as string | undefined,
      content: (args.content as string) || "",
      date: todayISO(),
      status: (args.status as "draft" | "published") || "draft",
      tags: args.tags as string[] | undefined,
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
});

tools.push({
  name: "COLLECTION_DRAFTS_UPDATE",
  description: "Update an existing draft",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string" },
      title: { type: "string" },
      description: { type: "string" },
      content: { type: "string" },
      date: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
      status: { type: "string", enum: ["draft", "published"] },
    },
    required: ["id"],
  },
  handler: async (args) => {
    const updated = contentDb.updateContent(args.id as string, {
      title: args.title as string | undefined,
      description: args.description as string | undefined,
      content: args.content as string | undefined,
      date: args.date as string | undefined,
      status: args.status as "draft" | "published" | undefined,
      tags: args.tags as string[] | undefined,
    });

    if (!updated) throw new Error(`Content not found: ${args.id}`);

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
});

tools.push({
  name: "COLLECTION_DRAFTS_DELETE",
  description: "Delete a draft",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string" },
    },
    required: ["id"],
  },
  handler: async (args) => {
    const success = contentDb.deleteContent(args.id as string);
    if (!success) throw new Error(`Content not found: ${args.id}`);
    triggerExport(); // Auto-export for dev server
    return { success: true, id: args.id };
  },
});

// Articles CRUD
tools.push({
  name: "COLLECTION_ARTICLES_LIST",
  description: "List all articles with optional filtering",
  inputSchema: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["draft", "published"] },
      limit: { type: "number", default: 50 },
      offset: { type: "number", default: 0 },
    },
  },
  handler: async (args) => {
    const status = args.status as "draft" | "published" | undefined;
    const limit = (args.limit as number) || 50;
    const offset = (args.offset as number) || 0;

    const allContent = status
      ? contentDb.getContentByStatus(status)
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

    const paginated = items.slice(offset, offset + limit);

    return {
      items: paginated,
      totalCount: items.length,
      hasMore: items.length > offset + limit,
    };
  },
});

tools.push({
  name: "COLLECTION_ARTICLES_GET",
  description: "Get a single article by ID (slug)",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "The slug/ID of the content" },
    },
    required: ["id"],
  },
  handler: async (args) => {
    const content = contentDb.getContentBySlug(args.id as string);
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
});

tools.push({
  name: "COLLECTION_ARTICLES_CREATE",
  description: "Create a new article",
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      content: { type: "string", default: "" },
      tags: { type: "array", items: { type: "string" } },
      status: {
        type: "string",
        enum: ["draft", "published"],
        default: "draft",
      },
    },
    required: ["title"],
  },
  handler: async (args) => {
    const slug = slugify(args.title as string);
    const created = contentDb.createContent({
      slug,
      title: args.title as string,
      description: args.description as string | undefined,
      content: (args.content as string) || "",
      date: todayISO(),
      status: (args.status as "draft" | "published") || "draft",
      tags: args.tags as string[] | undefined,
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
});

tools.push({
  name: "COLLECTION_ARTICLES_UPDATE",
  description: "Update an existing article",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string" },
      title: { type: "string" },
      description: { type: "string" },
      content: { type: "string" },
      date: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
      status: { type: "string", enum: ["draft", "published"] },
    },
    required: ["id"],
  },
  handler: async (args) => {
    const updated = contentDb.updateContent(args.id as string, {
      title: args.title as string | undefined,
      description: args.description as string | undefined,
      content: args.content as string | undefined,
      date: args.date as string | undefined,
      status: args.status as "draft" | "published" | undefined,
      tags: args.tags as string[] | undefined,
    });

    if (!updated) throw new Error(`Content not found: ${args.id}`);

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
});

tools.push({
  name: "COLLECTION_ARTICLES_DELETE",
  description: "Delete an article",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string" },
    },
    required: ["id"],
  },
  handler: async (args) => {
    const success = contentDb.deleteContent(args.id as string);
    if (!success) throw new Error(`Content not found: ${args.id}`);
    triggerExport(); // Auto-export for dev server
    return { success: true, id: args.id };
  },
});

// Piecemeal Editing Tools (like Cursor's search/replace)
tools.push({
  name: "CONTENT_SEARCH_REPLACE",
  description:
    "Replace text in content using search/replace. Use this for precise edits without sending the entire content. The old_string must match exactly (including whitespace).",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "The slug/ID of the content to edit" },
      old_string: {
        type: "string",
        description: "The exact text to find and replace",
      },
      new_string: { type: "string", description: "The replacement text" },
      replace_all: {
        type: "boolean",
        default: false,
        description: "Replace all occurrences (default: first only)",
      },
    },
    required: ["id", "old_string", "new_string"],
  },
  handler: async (args) => {
    const content = contentDb.getContentBySlug(args.id as string);
    if (!content) throw new Error(`Content not found: ${args.id}`);

    const oldContent = content.content;
    const oldString = args.old_string as string;
    const newString = args.new_string as string;

    if (!oldContent.includes(oldString)) {
      throw new Error(
        `old_string not found in content. Make sure it matches exactly including whitespace.`,
      );
    }

    let newContent: string;
    let replacements: number;

    if (args.replace_all) {
      const parts = oldContent.split(oldString);
      replacements = parts.length - 1;
      newContent = parts.join(newString);
    } else {
      replacements = 1;
      newContent = oldContent.replace(oldString, newString);
    }

    contentDb.updateContent(args.id as string, { content: newContent });
    triggerExport();

    const idx = newContent.indexOf(newString);
    const start = Math.max(0, idx - 50);
    const end = Math.min(newContent.length, idx + newString.length + 50);
    const preview =
      (start > 0 ? "..." : "") +
      newContent.slice(start, end) +
      (end < newContent.length ? "..." : "");

    return { success: true, replacements, preview };
  },
});

tools.push({
  name: "CONTENT_APPEND",
  description: "Append text to the end of content",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "The slug/ID of the content" },
      text: { type: "string", description: "Text to append" },
      separator: {
        type: "string",
        default: "\n\n",
        description: "Separator between existing content and appended text",
      },
    },
    required: ["id", "text"],
  },
  handler: async (args) => {
    const content = contentDb.getContentBySlug(args.id as string);
    if (!content) throw new Error(`Content not found: ${args.id}`);

    const separator = (args.separator as string) ?? "\n\n";
    const newContent = content.content + separator + (args.text as string);
    contentDb.updateContent(args.id as string, { content: newContent });
    triggerExport();

    return { success: true, newLength: newContent.length };
  },
});

tools.push({
  name: "CONTENT_PREPEND",
  description: "Prepend text to the beginning of content",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "The slug/ID of the content" },
      text: { type: "string", description: "Text to prepend" },
      separator: {
        type: "string",
        default: "\n\n",
        description: "Separator between prepended text and existing content",
      },
    },
    required: ["id", "text"],
  },
  handler: async (args) => {
    const content = contentDb.getContentBySlug(args.id as string);
    if (!content) throw new Error(`Content not found: ${args.id}`);

    const separator = (args.separator as string) ?? "\n\n";
    const newContent = (args.text as string) + separator + content.content;
    contentDb.updateContent(args.id as string, { content: newContent });
    triggerExport();

    return { success: true, newLength: newContent.length };
  },
});

tools.push({
  name: "CONTENT_INSERT_AFTER",
  description: "Insert text after a specific marker in content",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "The slug/ID of the content" },
      marker: { type: "string", description: "The text to insert after" },
      text: { type: "string", description: "Text to insert" },
    },
    required: ["id", "marker", "text"],
  },
  handler: async (args) => {
    const content = contentDb.getContentBySlug(args.id as string);
    if (!content) throw new Error(`Content not found: ${args.id}`);

    const marker = args.marker as string;
    const text = args.text as string;

    if (!content.content.includes(marker)) {
      throw new Error(`Marker not found in content`);
    }

    const newContent = content.content.replace(marker, marker + text);
    contentDb.updateContent(args.id as string, { content: newContent });
    triggerExport();

    const idx = newContent.indexOf(marker);
    const start = Math.max(0, idx - 20);
    const end = Math.min(
      newContent.length,
      idx + marker.length + text.length + 20,
    );
    const preview = newContent.slice(start, end);

    return { success: true, preview };
  },
});

tools.push({
  name: "CONTENT_INSERT_BEFORE",
  description: "Insert text before a specific marker in content",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "The slug/ID of the content" },
      marker: { type: "string", description: "The text to insert before" },
      text: { type: "string", description: "Text to insert" },
    },
    required: ["id", "marker", "text"],
  },
  handler: async (args) => {
    const content = contentDb.getContentBySlug(args.id as string);
    if (!content) throw new Error(`Content not found: ${args.id}`);

    const marker = args.marker as string;
    const text = args.text as string;

    if (!content.content.includes(marker)) {
      throw new Error(`Marker not found in content`);
    }

    const newContent = content.content.replace(marker, text + marker);
    contentDb.updateContent(args.id as string, { content: newContent });
    triggerExport();

    const idx = newContent.indexOf(text);
    const start = Math.max(0, idx - 20);
    const end = Math.min(
      newContent.length,
      idx + text.length + marker.length + 20,
    );
    const preview = newContent.slice(start, end);

    return { success: true, preview };
  },
});

// Search Tools
tools.push({
  name: "SEARCH_CONTEXT",
  description:
    "Search through context/ files for references, concepts, and quotes. Uses ripgrep if available, otherwise grep.",
  inputSchema: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "Search pattern (regex supported)",
      },
      contextLines: {
        type: "number",
        default: 5,
        description: "Lines of context before and after each match",
      },
      caseSensitive: {
        type: "boolean",
        default: false,
        description: "Case-sensitive search",
      },
    },
    required: ["pattern"],
  },
  handler: async (args) => {
    const results = executeSearch(
      args.pattern as string,
      "./context",
      (args.contextLines as number) || 5,
      (args.caseSensitive as boolean) || false,
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
});

tools.push({
  name: "SEARCH_CONTENT",
  description:
    "Search through content/ files (drafts, articles) for references and concepts. Uses ripgrep if available.",
  inputSchema: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "Search pattern (regex supported)",
      },
      contextLines: {
        type: "number",
        default: 5,
        description: "Lines of context before and after each match",
      },
      caseSensitive: {
        type: "boolean",
        default: false,
        description: "Case-sensitive search",
      },
      collection: {
        type: "string",
        enum: ["all", "drafts", "articles"],
        default: "all",
        description: "Which collection to search",
      },
    },
    required: ["pattern"],
  },
  handler: async (args) => {
    const collection = (args.collection as string) || "all";
    const dir = collection === "all" ? "./content" : `./content/${collection}`;

    const results = executeSearch(
      args.pattern as string,
      dir,
      (args.contextLines as number) || 5,
      (args.caseSensitive as boolean) || false,
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
});

tools.push({
  name: "SEARCH_ALL",
  description:
    "Search through all markdown files in both context/ and content/ directories at once.",
  inputSchema: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "Search pattern (regex supported)",
      },
      contextLines: {
        type: "number",
        default: 3,
        description: "Lines of context before and after each match",
      },
      caseSensitive: {
        type: "boolean",
        default: false,
        description: "Case-sensitive search",
      },
    },
    required: ["pattern"],
  },
  handler: async (args) => {
    const contextResults = executeSearch(
      args.pattern as string,
      "./context",
      (args.contextLines as number) || 3,
      (args.caseSensitive as boolean) || false,
    );

    const contentResults = executeSearch(
      args.pattern as string,
      "./content",
      (args.contextLines as number) || 3,
      (args.caseSensitive as boolean) || false,
    );

    const countMatches = (results: string) =>
      results
        .split("\n")
        .filter((line) => line.includes(":") && !line.startsWith("--")).length;

    return {
      contextMatches: contextResults || "No matches in context/",
      contentMatches: contentResults || "No matches in content/",
      totalMatchCount:
        countMatches(contextResults) + countMatches(contentResults),
      searchEngine: searchCommand,
    };
  },
});

// Script Tools from package.json
const scripts = pkg.scripts ?? {};
const mcpConfig = pkg.mcp?.scripts ?? {};

for (const name of Object.keys(scripts)) {
  const config = mcpConfig[name];
  if (!config?.expose) continue;

  const toolId = `SCRIPT_${name.toUpperCase().replace(/[:-]/g, "_")}`;

  tools.push({
    name: toolId,
    description: config.description ?? `Run 'bun run ${name}'`,
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
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
  });
}

// Interactive Dev Tools
let devServerProcess: ChildProcess | null = null;

tools.push({
  name: "DEV_SERVER_START",
  description: "Start the Vite development server",
  inputSchema: { type: "object", properties: {} },
  handler: async () => {
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

    await new Promise((resolve) => setTimeout(resolve, 2000));

    return {
      success: true,
      url: "http://localhost:4001",
      message: "Dev server started",
    };
  },
});

tools.push({
  name: "DEV_SERVER_STOP",
  description: "Stop the Vite development server",
  inputSchema: { type: "object", properties: {} },
  handler: async () => {
    if (!devServerProcess) {
      return { success: true, message: "Dev server not running" };
    }

    devServerProcess.kill();
    devServerProcess = null;

    return { success: true, message: "Dev server stopped" };
  },
});

tools.push({
  name: "GIT_STATUS",
  description: "Get git status - list of changed files",
  inputSchema: { type: "object", properties: {} },
  handler: async () => {
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
});

tools.push({
  name: "COMMIT",
  description: "Stage all changes and commit with a message",
  inputSchema: {
    type: "object",
    properties: {
      message: { type: "string", description: "Commit message" },
    },
    required: ["message"],
  },
  handler: async (args) => {
    try {
      execSync("git add .", { cwd: process.cwd() });
      execSync(`git commit -m "${args.message}"`, {
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
});

tools.push({
  name: "PUSH",
  description: "Push commits to remote",
  inputSchema: {
    type: "object",
    properties: {
      force: { type: "boolean", default: false },
    },
  },
  handler: async (args) => {
    try {
      const cmd = args.force ? "git push --force" : "git push";
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
});

// Bookmark Tools
tools.push({
  name: "BOOKMARKS_DISCOVER_BROWSERS",
  description:
    "Discover all browser profiles on this system. Returns Chrome, Brave, Edge, Firefox, Safari profiles with their paths. Use this first to see available browsers before reading bookmarks.",
  inputSchema: { type: "object", properties: {} },
  handler: async () => {
    const profiles = await discoverAllProfiles();

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
});

tools.push({
  name: "BOOKMARKS_READ",
  description:
    "Read bookmarks from a specific browser profile. Returns all bookmarks with URLs, titles, and folder info. Supports Chrome, Brave, Edge, Dia, Comet, Safari. Firefox requires better-sqlite3.",
  inputSchema: {
    type: "object",
    properties: {
      browser: {
        type: "string",
        enum: [
          "chrome",
          "chromium",
          "brave",
          "edge",
          "dia",
          "comet",
          "firefox",
          "safari",
        ],
        description: "Browser type to read from",
      },
      profilePath: {
        type: "string",
        description:
          "Optional: specific profile path. If not provided, uses default profile.",
      },
    },
    required: ["browser"],
  },
  handler: async (args) => {
    const browserType = args.browser as
      | "chrome"
      | "chromium"
      | "brave"
      | "edge"
      | "dia"
      | "comet"
      | "firefox"
      | "safari";
    const reader = createReader(browserType);
    const profiles = await reader.discoverProfiles();

    let profile: BrowserProfile | undefined;

    if (args.profilePath) {
      profile = profiles.find((p) => p.path === args.profilePath);
      if (!profile) {
        throw new Error(`Profile not found at path: ${args.profilePath}`);
      }
    } else {
      profile = profiles.find((p) => p.isDefault) || profiles[0];
      if (!profile) {
        throw new Error(
          `No ${getBrowserDisplayName(browserType)} profiles found`,
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
      browser: getBrowserDisplayName(browserType),
      profileName: profile.name,
    };
  },
});

tools.push({
  name: "BOOKMARKS_SEARCH",
  description:
    "Search bookmarks across all browser profiles by URL or title pattern. Returns matching bookmarks from all installed browsers.",
  inputSchema: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "Search pattern (case-insensitive, matches URL or title)",
      },
      browsers: {
        type: "array",
        items: {
          type: "string",
          enum: [
            "chrome",
            "chromium",
            "brave",
            "edge",
            "dia",
            "comet",
            "firefox",
            "safari",
          ],
        },
        description:
          "Optional: limit search to specific browsers. If not provided, searches all.",
      },
      limit: {
        type: "number",
        default: 50,
        description: "Maximum number of results to return",
      },
    },
    required: ["pattern"],
  },
  handler: async (args) => {
    const allProfiles = await discoverAllProfiles();
    const pattern = (args.pattern as string).toLowerCase();
    const limit = (args.limit as number) || 50;
    const browsers = args.browsers as string[] | undefined;

    const profilesToSearch = browsers
      ? allProfiles.filter((p) => browsers.includes(p.browser))
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

            if (results.length >= limit) {
              break;
            }
          }
        }

        if (results.length >= limit) {
          break;
        }
      } catch {
        // Skip browsers that fail to read
      }
    }

    return {
      results: results.slice(0, limit).map((r) => ({
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
});

tools.push({
  name: "BOOKMARKS_EXPORT_CSV",
  description:
    "Export bookmarks from a browser to CSV format. Returns CSV content that can be saved or appended to existing CSV files.",
  inputSchema: {
    type: "object",
    properties: {
      browser: {
        type: "string",
        enum: [
          "chrome",
          "chromium",
          "brave",
          "edge",
          "dia",
          "comet",
          "firefox",
          "safari",
        ],
        description: "Browser type to export from",
      },
      profilePath: {
        type: "string",
        description: "Optional: specific profile path",
      },
      includeHeader: {
        type: "boolean",
        default: true,
        description: "Include CSV header row",
      },
    },
    required: ["browser"],
  },
  handler: async (args) => {
    const browserType = args.browser as
      | "chrome"
      | "chromium"
      | "brave"
      | "edge"
      | "dia"
      | "comet"
      | "firefox"
      | "safari";
    const reader = createReader(browserType);
    const profiles = await reader.discoverProfiles();

    let profile: BrowserProfile | undefined;

    if (args.profilePath) {
      profile = profiles.find((p) => p.path === args.profilePath);
    } else {
      profile = profiles.find((p) => p.isDefault) || profiles[0];
    }

    if (!profile) {
      throw new Error(
        `No ${getBrowserDisplayName(browserType)} profiles found`,
      );
    }

    const data = await reader.readBookmarks(profile);

    const escapeCSV = (str: string) => {
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const lines: string[] = [];

    if (args.includeHeader !== false) {
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
          escapeCSV(getBrowserDisplayName(browserType)),
          escapeCSV(profile.name),
          dateAdded,
        ].join(","),
      );
    }

    return {
      csv: lines.join("\n"),
      rowCount: data.bookmarks.length,
      browser: getBrowserDisplayName(browserType),
    };
  },
});

tools.push({
  name: "MCP_CONFIGURATION",
  description: "MCP Configuration",
  inputSchema: { type: "object", properties: {} },
  handler: async () => {
    return {
      name: "vibegui.com",
      version: pkg.version || "0.1.0",
      description:
        "vibegui.com MCP Server - Content, Search, Dev Tools, and Browser Bookmarks",
      transport: "stdio",
      tools: tools.map((t) => t.name),
    };
  },
});

// ============================================================================
// MCP Server Setup
// ============================================================================

const server = new Server(
  {
    name: "vibegui",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Register list tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  };
});

// Register call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  const tool = tools.find((t) => t.name === name);
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }

  try {
    const result = await tool.handler(args || {});
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `[vibegui] STDIO MCP server running with ${tools.length} tools`,
  );
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
