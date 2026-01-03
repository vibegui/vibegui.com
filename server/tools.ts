/**
 * vibegui.com MCP Server - Tool Definitions
 *
 * Shared tool definitions for both stdio and HTTP transports.
 * Uses the McpServer.registerTool() pattern from @modelcontextprotocol/sdk.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as contentDb from "../lib/db/content.ts";
import * as learningsDb from "../lib/db/learnings.ts";
import type { Project } from "../lib/db/content.ts";

// ============================================================================
// Helper Functions
// ============================================================================

// Get project root from script location (works when run via stdio from mesh)
const PROJECT_ROOT = join(import.meta.dir, "..");

const todayISO = () => new Date().toISOString().slice(0, 10);

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

/**
 * Trigger content export after changes so dev server picks them up.
 */
function triggerExport() {
  try {
    spawn("bun", ["run", "export"], {
      cwd: PROJECT_ROOT,
      stdio: "ignore",
      detached: true,
    }).unref();
  } catch (err) {
    console.error("[MCP] Failed to trigger export:", err);
  }
}

/**
 * Log tool invocation to stderr
 */
function logTool(name: string, args: Record<string, unknown>) {
  const argStr = Object.entries(args)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(" ");
  console.error(`[MCP] ${name}${argStr ? ` ${argStr}` : ""}`);
}

/**
 * Wrap a tool handler with logging
 */
function withLogging<T extends Record<string, unknown>>(
  toolName: string,
  handler: (args: T) => Promise<CallToolResult>,
): (args: T) => Promise<CallToolResult> {
  return async (args: T) => {
    logTool(toolName, args as Record<string, unknown>);
    return handler(args);
  };
}

// ============================================================================
// Register All Tools
// ============================================================================

export function registerTools(server: McpServer): void {
  console.error(`[MCP] All tools registered`);

  // =========================================================================
  // Context Tools
  // =========================================================================

  server.registerTool(
    "TONE_OF_VOICE",
    {
      title: "Get Tone of Voice",
      description:
        "Returns Guilherme's comprehensive tone of voice guide. This forensic analysis contains writing patterns, hook structures, vocabulary, philosophical frameworks, and templates for authentic content creation. Call this BEFORE writing any articles or content.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    withLogging("TONE_OF_VOICE", async () => {
      const toneOfVoicePath = join(
        PROJECT_ROOT,
        "context",
        "GUILHERME_TONE_OF_VOICE.md",
      );
      const content = readFileSync(toneOfVoicePath, "utf-8");
      return {
        content: [{ type: "text", text: content }],
      };
    }),
  );

  server.registerTool(
    "VISUAL_STYLE",
    {
      title: "Get Visual Style Guide",
      description:
        "Returns vibegui.com's visual style guide for image generation. Retro 1950s comic book / Marvel-DC hero aesthetic with heavy dithering, pixelation, and monochromatic green tones (#1a4d3e background, #c4e538 accent). Call this BEFORE generating any images.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    withLogging("VISUAL_STYLE", async () => {
      const visualStylePath = join(PROJECT_ROOT, "context", "VISUAL_STYLE.md");
      const content = readFileSync(visualStylePath, "utf-8");
      return {
        content: [{ type: "text", text: content }],
      };
    }),
  );

  // =========================================================================
  // Content Tools (Articles)
  // =========================================================================

  server.registerTool(
    "COLLECTION_ARTICLES_LIST",
    {
      title: "List Articles",
      description: "List all articles with optional filtering",
      inputSchema: {
        status: z.enum(["draft", "published"]).optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      },
      annotations: { readOnlyHint: true },
    },
    withLogging("COLLECTION_ARTICLES_LIST", async (args) => {
      const allContent = args.status
        ? contentDb.getContentByStatus(args.status)
        : contentDb.getAllContent();

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

      const paginated = items.slice(args.offset, args.offset + args.limit);

      const result = {
        items: paginated,
        totalCount: items.length,
        hasMore: items.length > args.offset + args.limit,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    }),
  );

  server.registerTool(
    "COLLECTION_ARTICLES_GET",
    {
      title: "Get Article",
      description: "Get a single article by ID (slug)",
      inputSchema: {
        id: z.string().describe("The slug/ID of the content"),
      },
      annotations: { readOnlyHint: true },
    },
    withLogging("COLLECTION_ARTICLES_GET", async (args) => {
      const content = contentDb.getContentBySlug(args.id);
      if (!content) {
        const result = { item: null };
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
          structuredContent: result,
        };
      }
      const now = new Date().toISOString();
      const result = {
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
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    }),
  );

  server.registerTool(
    "COLLECTION_ARTICLES_CREATE",
    {
      title: "Create Article",
      description:
        "Create a new article. IMPORTANT: Call TONE_OF_VOICE first to get Guilherme's writing style guide before creating content.",
      inputSchema: {
        title: z.string(),
        description: z.string().optional(),
        content: z.string().default(""),
        tags: z.array(z.string()).optional(),
        status: z.enum(["draft", "published"]).default("draft"),
        date: z.string().optional(),
        fromSocialPostId: z.number().optional(),
      },
      annotations: { readOnlyHint: false },
    },
    withLogging("COLLECTION_ARTICLES_CREATE", async (args) => {
      const slug = slugify(args.title);
      const created = contentDb.createContent({
        slug,
        title: args.title,
        description: args.description,
        content: args.content,
        date: args.date ?? todayISO(),
        status: args.status,
        tags: args.tags,
        fromSocialPostId: args.fromSocialPostId,
      });

      triggerExport();

      const now = new Date().toISOString();
      const result = {
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
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    }),
  );

  server.registerTool(
    "COLLECTION_ARTICLES_UPDATE",
    {
      title: "Update Article",
      description:
        "Update an existing article. IMPORTANT: Call TONE_OF_VOICE first to get Guilherme's writing style guide before modifying content.",
      inputSchema: {
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        content: z.string().optional(),
        date: z.string().optional(),
        tags: z.array(z.string()).optional(),
        status: z.enum(["draft", "published"]).optional(),
        coverImage: z.string().optional(),
      },
      annotations: { readOnlyHint: false },
    },
    withLogging("COLLECTION_ARTICLES_UPDATE", async (args) => {
      const updated = contentDb.updateContent(args.id, {
        title: args.title,
        description: args.description,
        content: args.content,
        date: args.date,
        status: args.status,
        tags: args.tags,
        coverImage: args.coverImage,
      });

      if (!updated) {
        return {
          content: [
            { type: "text", text: `Error: Content not found: ${args.id}` },
          ],
          isError: true,
        };
      }

      triggerExport();

      const now = new Date().toISOString();
      const result = {
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
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    }),
  );

  server.registerTool(
    "COLLECTION_ARTICLES_DELETE",
    {
      title: "Delete Article",
      description: "Delete an article",
      inputSchema: {
        id: z.string(),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    withLogging("COLLECTION_ARTICLES_DELETE", async (args) => {
      const success = contentDb.deleteContent(args.id);
      if (!success) {
        return {
          content: [
            { type: "text", text: `Error: Content not found: ${args.id}` },
          ],
          isError: true,
        };
      }
      triggerExport();
      const result = { success: true, id: args.id };
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result,
      };
    }),
  );

  // =========================================================================
  // Piecemeal Editing Tools
  // =========================================================================

  server.registerTool(
    "CONTENT_SEARCH_REPLACE",
    {
      title: "Search/Replace in Content",
      description:
        "Replace text in content using search/replace. Use this for precise edits without sending the entire content. The old_string must match exactly (including whitespace).",
      inputSchema: {
        id: z.string().describe("The slug/ID of the content to edit"),
        old_string: z.string().describe("The exact text to find and replace"),
        new_string: z.string().describe("The replacement text"),
        replace_all: z
          .boolean()
          .default(false)
          .describe("Replace all occurrences (default: first only)"),
      },
      annotations: { readOnlyHint: false },
    },
    withLogging("CONTENT_SEARCH_REPLACE", async (args) => {
      const content = contentDb.getContentBySlug(args.id);
      if (!content) {
        return {
          content: [
            { type: "text", text: `Error: Content not found: ${args.id}` },
          ],
          isError: true,
        };
      }

      const oldContent = content.content;
      if (!oldContent.includes(args.old_string)) {
        return {
          content: [
            {
              type: "text",
              text: "Error: old_string not found in content. Make sure it matches exactly including whitespace.",
            },
          ],
          isError: true,
        };
      }

      let newContent: string;
      let replacements: number;

      if (args.replace_all) {
        const parts = oldContent.split(args.old_string);
        replacements = parts.length - 1;
        newContent = parts.join(args.new_string);
      } else {
        replacements = 1;
        newContent = oldContent.replace(args.old_string, args.new_string);
      }

      contentDb.updateContent(args.id, { content: newContent });
      triggerExport();

      const idx = newContent.indexOf(args.new_string);
      const start = Math.max(0, idx - 50);
      const end = Math.min(
        newContent.length,
        idx + args.new_string.length + 50,
      );
      const preview =
        (start > 0 ? "..." : "") +
        newContent.slice(start, end) +
        (end < newContent.length ? "..." : "");

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { success: true, replacements, preview },
              null,
              2,
            ),
          },
        ],
      };
    }),
  );

  server.registerTool(
    "CONTENT_APPEND",
    {
      title: "Append to Content",
      description: "Append text to the end of content",
      inputSchema: {
        id: z.string().describe("The slug/ID of the content"),
        text: z.string().describe("Text to append"),
        separator: z
          .string()
          .default("\n\n")
          .describe("Separator between existing content and appended text"),
      },
      annotations: { readOnlyHint: false },
    },
    withLogging("CONTENT_APPEND", async (args) => {
      const content = contentDb.getContentBySlug(args.id);
      if (!content) {
        return {
          content: [
            { type: "text", text: `Error: Content not found: ${args.id}` },
          ],
          isError: true,
        };
      }

      const newContent = content.content + args.separator + args.text;
      contentDb.updateContent(args.id, { content: newContent });
      triggerExport();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              newLength: newContent.length,
            }),
          },
        ],
      };
    }),
  );

  server.registerTool(
    "CONTENT_PREPEND",
    {
      title: "Prepend to Content",
      description: "Prepend text to the beginning of content",
      inputSchema: {
        id: z.string().describe("The slug/ID of the content"),
        text: z.string().describe("Text to prepend"),
        separator: z
          .string()
          .default("\n\n")
          .describe("Separator between prepended text and existing content"),
      },
      annotations: { readOnlyHint: false },
    },
    withLogging("CONTENT_PREPEND", async (args) => {
      const content = contentDb.getContentBySlug(args.id);
      if (!content) {
        return {
          content: [
            { type: "text", text: `Error: Content not found: ${args.id}` },
          ],
          isError: true,
        };
      }

      const newContent = args.text + args.separator + content.content;
      contentDb.updateContent(args.id, { content: newContent });
      triggerExport();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              newLength: newContent.length,
            }),
          },
        ],
      };
    }),
  );

  server.registerTool(
    "CONTENT_INSERT_AFTER",
    {
      title: "Insert After Marker",
      description: "Insert text after a specific marker in content",
      inputSchema: {
        id: z.string().describe("The slug/ID of the content"),
        marker: z.string().describe("The text to insert after"),
        text: z.string().describe("Text to insert"),
      },
      annotations: { readOnlyHint: false },
    },
    withLogging("CONTENT_INSERT_AFTER", async (args) => {
      const content = contentDb.getContentBySlug(args.id);
      if (!content) {
        return {
          content: [
            { type: "text", text: `Error: Content not found: ${args.id}` },
          ],
          isError: true,
        };
      }

      if (!content.content.includes(args.marker)) {
        return {
          content: [
            { type: "text", text: "Error: Marker not found in content" },
          ],
          isError: true,
        };
      }

      const newContent = content.content.replace(
        args.marker,
        args.marker + args.text,
      );
      contentDb.updateContent(args.id, { content: newContent });
      triggerExport();

      const idx = newContent.indexOf(args.marker);
      const start = Math.max(0, idx - 20);
      const end = Math.min(
        newContent.length,
        idx + args.marker.length + args.text.length + 20,
      );
      const preview = newContent.slice(start, end);

      return {
        content: [
          { type: "text", text: JSON.stringify({ success: true, preview }) },
        ],
      };
    }),
  );

  server.registerTool(
    "CONTENT_INSERT_BEFORE",
    {
      title: "Insert Before Marker",
      description: "Insert text before a specific marker in content",
      inputSchema: {
        id: z.string().describe("The slug/ID of the content"),
        marker: z.string().describe("The text to insert before"),
        text: z.string().describe("Text to insert"),
      },
      annotations: { readOnlyHint: false },
    },
    withLogging("CONTENT_INSERT_BEFORE", async (args) => {
      const content = contentDb.getContentBySlug(args.id);
      if (!content) {
        return {
          content: [
            { type: "text", text: `Error: Content not found: ${args.id}` },
          ],
          isError: true,
        };
      }

      if (!content.content.includes(args.marker)) {
        return {
          content: [
            { type: "text", text: "Error: Marker not found in content" },
          ],
          isError: true,
        };
      }

      const newContent = content.content.replace(
        args.marker,
        args.text + args.marker,
      );
      contentDb.updateContent(args.id, { content: newContent });
      triggerExport();

      const idx = newContent.indexOf(args.text);
      const start = Math.max(0, idx - 20);
      const end = Math.min(
        newContent.length,
        idx + args.text.length + args.marker.length + 20,
      );
      const preview = newContent.slice(start, end);

      return {
        content: [
          { type: "text", text: JSON.stringify({ success: true, preview }) },
        ],
      };
    }),
  );

  // =========================================================================
  // Learnings Tools
  // =========================================================================

  server.registerTool(
    "LEARNINGS_RECORD",
    {
      title: "Record Learning",
      description:
        "Record a new learning, insight, or accomplishment. Use this whenever something important is learned during our work.",
      inputSchema: {
        summary: z.string().describe("One-line summary of the learning"),
        content: z.string().describe("Full details of what was learned"),
        category: z
          .enum([
            "bug_fix",
            "architecture",
            "tool",
            "insight",
            "accomplishment",
            "debugging",
            "optimization",
            "feature",
            "process",
            "cost",
          ])
          .describe("Category of learning"),
        project: z.string().optional().describe("Project this relates to"),
        importance: z
          .enum(["low", "normal", "high", "critical"])
          .default("normal")
          .describe("How important is this learning"),
        tags: z.array(z.string()).optional().describe("Tags for filtering"),
        related_files: z
          .array(z.string())
          .optional()
          .describe("File paths involved"),
        related_urls: z.array(z.string()).optional().describe("Related URLs"),
        publishable: z
          .boolean()
          .default(false)
          .describe("Could this be shared publicly in a blog post?"),
      },
      annotations: { readOnlyHint: false },
    },
    withLogging("LEARNINGS_RECORD", async (args) => {
      const learning = learningsDb.createLearning({
        summary: args.summary,
        content: args.content,
        category: args.category,
        project: args.project,
        importance: args.importance,
        tags: args.tags,
        related_files: args.related_files,
        related_urls: args.related_urls,
        publishable: args.publishable,
        repo: "vibegui.com",
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                learning,
                message: `✓ Recorded learning #${learning.id}: ${learning.summary}`,
              },
              null,
              2,
            ),
          },
        ],
      };
    }),
  );

  server.registerTool(
    "LEARNINGS_TODAY",
    {
      title: "Today's Learnings",
      description:
        "Get all learnings from today. Use this to review what we've learned in the current session.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    withLogging("LEARNINGS_TODAY", async () => {
      const learnings = learningsDb.getLearningsToday();
      const byCategory: Record<string, number> = {};
      for (const l of learnings) {
        byCategory[l.category] = (byCategory[l.category] || 0) + 1;
      }
      const summary =
        learnings.length === 0
          ? "No learnings recorded today yet."
          : `Today: ${learnings.length} learnings (${Object.entries(byCategory)
              .map(([cat, count]) => `${count} ${cat}`)
              .join(", ")})`;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { learnings, count: learnings.length, summary },
              null,
              2,
            ),
          },
        ],
      };
    }),
  );

  server.registerTool(
    "LEARNINGS_BY_PROJECT",
    {
      title: "Learnings by Project",
      description: "Get all learnings for a specific project.",
      inputSchema: {
        project: z.string().describe("Project name to filter by"),
      },
      annotations: { readOnlyHint: true },
    },
    withLogging("LEARNINGS_BY_PROJECT", async (args) => {
      const learnings = learningsDb.getLearningsByProject(args.project);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { learnings, count: learnings.length },
              null,
              2,
            ),
          },
        ],
      };
    }),
  );

  server.registerTool(
    "LEARNINGS_SEARCH",
    {
      title: "Search Learnings",
      description: "Search learnings by keyword in summary or content.",
      inputSchema: {
        query: z.string().describe("Search query"),
        limit: z.number().default(20),
      },
      annotations: { readOnlyHint: true },
    },
    withLogging("LEARNINGS_SEARCH", async (args) => {
      const learnings = learningsDb.searchLearnings(args.query, args.limit);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { learnings, count: learnings.length },
              null,
              2,
            ),
          },
        ],
      };
    }),
  );

  server.registerTool(
    "LEARNINGS_STATS",
    {
      title: "Learnings Stats",
      description: "Get statistics about recorded learnings.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    withLogging("LEARNINGS_STATS", async () => {
      const stats = learningsDb.getStats();
      return {
        content: [{ type: "text", text: JSON.stringify(stats, null, 2) }],
      };
    }),
  );

  server.registerTool(
    "LEARNINGS_BY_DATE_RANGE",
    {
      title: "Learnings by Date Range",
      description: "Get learnings within a date range.",
      inputSchema: {
        startDate: z.string().describe("Start date (YYYY-MM-DD)"),
        endDate: z.string().describe("End date (YYYY-MM-DD)"),
      },
      annotations: { readOnlyHint: true },
    },
    withLogging("LEARNINGS_BY_DATE_RANGE", async (args) => {
      const learnings = learningsDb.getLearningsByDateRange(
        args.startDate,
        args.endDate,
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { learnings, count: learnings.length },
              null,
              2,
            ),
          },
        ],
      };
    }),
  );

  // =========================================================================
  // Project Tools
  // =========================================================================

  const ActionItemSchema = z.object({
    id: z.number().optional(),
    task: z.string(),
    owner: z.string().default("me"),
    dueDate: z.string().optional(),
    completed: z.boolean().optional(),
    sortOrder: z.number().optional(),
  });

  server.registerTool(
    "COLLECTION_PROJECTS_LIST",
    {
      title: "List Projects",
      description:
        "List all projects in the roadmap, optionally filtered by status.",
      inputSchema: {
        status: z.enum(["completed", "ongoing", "future"]).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    withLogging("COLLECTION_PROJECTS_LIST", async (args) => {
      const projects = args.status
        ? contentDb.getProjectsByStatus(args.status)
        : contentDb.getAllProjects();
      const result = {
        items: projects,
        totalCount: projects.length,
        hasMore: false,
      };
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    }),
  );

  server.registerTool(
    "COLLECTION_PROJECTS_GET",
    {
      title: "Get Project",
      description: "Get a single project by ID.",
      inputSchema: {
        id: z.string().describe("Project ID (slug)"),
      },
      annotations: { readOnlyHint: true },
    },
    withLogging("COLLECTION_PROJECTS_GET", async (args) => {
      const project = contentDb.getProjectById(args.id);
      const result = { item: project };
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    }),
  );

  server.registerTool(
    "COLLECTION_PROJECTS_CREATE",
    {
      title: "Create Project",
      description: "Create a new project in the roadmap.",
      inputSchema: {
        id: z.string().describe("Unique project ID (slug)"),
        title: z.string(),
        tagline: z.string(),
        description: z.string(),
        status: z.enum(["completed", "ongoing", "future"]),
        icon: z.string().optional(),
        coverGradient: z.string().optional(),
        url: z.string().optional(),
        startDate: z.string().optional(),
        targetDate: z.string().optional(),
        completedDate: z.string().optional(),
        sortOrder: z.number().optional(),
        notes: z
          .string()
          .optional()
          .describe("Rich notes/context for the project (internal use)"),
        tags: z.array(z.string()).optional(),
        actionPlan: z.array(ActionItemSchema).optional(),
      },
      annotations: { readOnlyHint: false },
    },
    withLogging("COLLECTION_PROJECTS_CREATE", async (args) => {
      const project = contentDb.createProject(args as Project);
      triggerExport();
      const result = { item: project };
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    }),
  );

  server.registerTool(
    "COLLECTION_PROJECTS_UPDATE",
    {
      title: "Update Project",
      description: "Update an existing project.",
      inputSchema: {
        id: z.string().describe("Project ID to update"),
        title: z.string().optional(),
        tagline: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(["completed", "ongoing", "future"]).optional(),
        icon: z.string().optional(),
        coverGradient: z.string().optional(),
        url: z.string().optional(),
        startDate: z.string().optional(),
        targetDate: z.string().optional(),
        completedDate: z.string().optional(),
        sortOrder: z.number().optional(),
        notes: z
          .string()
          .optional()
          .describe("Rich notes/context for the project (internal use)"),
        tags: z.array(z.string()).optional(),
        actionPlan: z.array(ActionItemSchema).optional(),
      },
      annotations: { readOnlyHint: false },
    },
    withLogging("COLLECTION_PROJECTS_UPDATE", async (args) => {
      const project = contentDb.updateProject(
        args.id,
        args as Partial<Project>,
      );
      if (project) triggerExport();
      const result = { item: project };
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    }),
  );

  server.registerTool(
    "COLLECTION_PROJECTS_DELETE",
    {
      title: "Delete Project",
      description: "Delete a project from the roadmap.",
      inputSchema: {
        id: z.string().describe("Project ID to delete"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    withLogging("COLLECTION_PROJECTS_DELETE", async (args) => {
      const success = contentDb.deleteProject(args.id);
      if (success) triggerExport();
      const result = { success, id: args.id };
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result,
      };
    }),
  );

  server.registerTool(
    "PROJECT_MARK_COMPLETE",
    {
      title: "Mark Project Complete",
      description: "Mark a project as completed with today's date.",
      inputSchema: {
        id: z.string().describe("Project ID to mark complete"),
      },
      annotations: { readOnlyHint: false },
    },
    withLogging("PROJECT_MARK_COMPLETE", async (args) => {
      const project = contentDb.updateProject(args.id, {
        status: "completed",
        completedDate: todayISO(),
      });
      if (project) triggerExport();
      const result = { item: project };
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    }),
  );

  // =========================================================================
  // Preview & Tunnel Tools
  // =========================================================================

  // Track running processes
  let previewProcess: ReturnType<typeof spawn> | null = null;
  let tunnelProcess: ReturnType<typeof spawn> | null = null;
  let currentTunnelUrl: string | null = null;

  server.registerTool(
    "START_PREVIEW_TUNNEL",
    {
      title: "Start Preview with Tunnel",
      description:
        "Builds the site, starts a preview server, and creates a public tunnel. Returns the public URL for previewing drafts.",
      inputSchema: {},
      annotations: { readOnlyHint: false },
    },
    withLogging("START_PREVIEW_TUNNEL", async () => {
      // If already running, just return the URL
      if (currentTunnelUrl && previewProcess && tunnelProcess) {
        return {
          content: [
            {
              type: "text",
              text: `Preview already running at: ${currentTunnelUrl}`,
            },
          ],
          structuredContent: {
            url: currentTunnelUrl,
            status: "already_running",
          },
        };
      }

      // Build first
      console.error("[MCP] Building site...");
      const buildResult = await new Promise<{
        success: boolean;
        error?: string;
      }>((resolve) => {
        const build = spawn("bun", ["run", "build"], {
          cwd: PROJECT_ROOT,
          stdio: ["ignore", "pipe", "pipe"],
        });

        let stderr = "";
        build.stderr?.on("data", (d) => (stderr += d.toString()));

        build.on("close", (code) => {
          resolve(
            code === 0 ? { success: true } : { success: false, error: stderr },
          );
        });

        build.on("error", (err) =>
          resolve({ success: false, error: err.message }),
        );
      });

      if (!buildResult.success) {
        return {
          content: [
            { type: "text", text: `Build failed: ${buildResult.error}` },
          ],
          structuredContent: {
            error: buildResult.error,
            status: "build_failed",
          },
        };
      }

      // Start preview server on port 4002
      console.error("[MCP] Starting preview server on port 4002...");
      previewProcess = spawn("bun", ["run", "preview"], {
        cwd: PROJECT_ROOT,
        stdio: ["ignore", "pipe", "pipe"],
        detached: true,
      });

      // Wait for server to start
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Start tunnel
      console.error("[MCP] Starting tunnel with deco link...");
      tunnelProcess = spawn("deco", ["link", "-p", "4002"], {
        cwd: PROJECT_ROOT,
        stdio: ["ignore", "pipe", "pipe"],
        detached: true,
      });

      // Capture tunnel URL from output
      currentTunnelUrl = null;
      const urlPromise = new Promise<string | null>((resolve) => {
        const timeout = setTimeout(() => resolve(null), 15000);

        const onData = (data: Buffer) => {
          const text = data.toString();
          // Look for the deco.host URL
          const match = text.match(/https:\/\/[^\s]+\.deco\.host/);
          if (match) {
            clearTimeout(timeout);
            currentTunnelUrl = match[0];
            resolve(match[0]);
          }
        };

        tunnelProcess?.stdout?.on("data", onData);
        tunnelProcess?.stderr?.on("data", onData);
      });

      const tunnelUrl = await urlPromise;

      if (!tunnelUrl) {
        // Cleanup on failure
        previewProcess?.kill();
        tunnelProcess?.kill();
        previewProcess = null;
        tunnelProcess = null;

        return {
          content: [
            {
              type: "text",
              text: "Failed to get tunnel URL. Is deco CLI installed?",
            },
          ],
          structuredContent: {
            error: "Tunnel timeout",
            status: "tunnel_failed",
          },
        };
      }

      const result = {
        url: tunnelUrl,
        previewUrl: `${tunnelUrl}/articles`,
        status: "running",
      };

      return {
        content: [
          {
            type: "text",
            text: `✅ Preview running!\n\n🌐 Public URL: ${tunnelUrl}\n📝 Articles: ${tunnelUrl}/articles\n\nDraft articles are visible at /articles/[slug]`,
          },
        ],
        structuredContent: result,
      };
    }),
  );

  server.registerTool(
    "GET_PREVIEW_URL",
    {
      title: "Get Preview URL",
      description:
        "Get the current public preview URL if the tunnel is running.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    withLogging("GET_PREVIEW_URL", async () => {
      if (currentTunnelUrl && previewProcess && tunnelProcess) {
        const result = {
          url: currentTunnelUrl,
          previewUrl: `${currentTunnelUrl}/articles`,
          status: "running",
        };
        return {
          content: [
            { type: "text", text: `Preview running at: ${currentTunnelUrl}` },
          ],
          structuredContent: result,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: "No preview tunnel running. Call START_PREVIEW_TUNNEL to start one.",
          },
        ],
        structuredContent: { status: "not_running" },
      };
    }),
  );

  server.registerTool(
    "STOP_PREVIEW",
    {
      title: "Stop Preview Tunnel",
      description: "Stop the preview server and tunnel.",
      inputSchema: {},
      annotations: { readOnlyHint: false },
    },
    withLogging("STOP_PREVIEW", async () => {
      let stopped = false;

      if (previewProcess) {
        try {
          process.kill(-previewProcess.pid!);
        } catch {
          previewProcess.kill();
        }
        previewProcess = null;
        stopped = true;
      }

      if (tunnelProcess) {
        try {
          process.kill(-tunnelProcess.pid!);
        } catch {
          tunnelProcess.kill();
        }
        tunnelProcess = null;
        stopped = true;
      }

      currentTunnelUrl = null;

      return {
        content: [
          {
            type: "text",
            text: stopped
              ? "Preview and tunnel stopped."
              : "No preview was running.",
          },
        ],
        structuredContent: { stopped, status: "stopped" },
      };
    }),
  );

  console.error("[MCP] All tools registered");
}
