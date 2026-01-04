/**
 * vibegui.com MCP Server - Tool Definitions
 *
 * Shared tool definitions for both stdio and HTTP transports.
 * Uses the McpServer.registerTool() pattern from @modelcontextprotocol/sdk.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import * as contentDb from "../lib/db/content.ts";
import * as learningsDb from "../lib/db/learnings.ts";
import type { Project } from "../lib/db/content.ts";

// ============================================================================
// Mesh Bindings Configuration
// ============================================================================

// Mesh configuration (from env vars set by Mesh when spawning STDIO)
const meshConfig = {
  meshUrl: process.env.MESH_URL || "http://localhost:3000",
  meshToken: process.env.MESH_TOKEN as string | undefined,
};

// Binding schema for state configuration
// Uses @deco/nanobanana - Mesh will resolve this from the registry to get the tool definitions
const ImageGeneratorBinding = z.object({
  __type: z.literal("@deco/nanobanana").default("@deco/nanobanana"),
  value: z.string().describe("Connection ID"),
});

const StateSchema = z.object({
  IMAGE_GENERATOR: ImageGeneratorBinding.optional().describe(
    "Nano Banana image generator for cover image generation",
  ),
});

// Parse MESH_STATE from env (passed by Mesh when spawning STDIO process)
interface BindingValue {
  __type: string;
  value: string;
}

function parseBindingsFromEnv(): { imageGenerator?: string } {
  const meshStateJson = process.env.MESH_STATE;
  if (!meshStateJson) return {};

  try {
    const state = JSON.parse(meshStateJson) as Record<string, BindingValue>;
    return {
      imageGenerator: state.IMAGE_GENERATOR?.value,
    };
  } catch (e) {
    console.error("[vibegui] Failed to parse MESH_STATE:", e);
    return {};
  }
}

// Initialize bindings from env vars
const envBindings = parseBindingsFromEnv();
let imageGeneratorConnectionId: string | undefined = envBindings.imageGenerator;

// Log startup info
function logStartupInfo() {
  const hasMeshToken = !!meshConfig.meshToken;
  const meshStateChars = process.env.MESH_STATE?.length || 0;

  console.error("[vibegui] Mesh configuration:");
  console.error(`[vibegui]   MESH_URL: ${meshConfig.meshUrl}`);
  console.error(`[vibegui]   MESH_TOKEN: ${hasMeshToken ? "set" : "not set"}`);
  console.error(`[vibegui]   MESH_STATE: ${meshStateChars} chars`);

  if (imageGeneratorConnectionId) {
    console.error("[vibegui] ✅ Bindings from MESH_STATE:");
    console.error(`[vibegui]   IMAGE_GENERATOR: ${imageGeneratorConnectionId}`);
  } else if (meshStateChars > 0) {
    console.error(
      "[vibegui] ⚠️  MESH_STATE present but IMAGE_GENERATOR not configured",
    );
  } else {
    console.error(
      "[vibegui] ℹ️  No MESH_STATE (standalone mode or bindings not configured)",
    );
  }
}

// Call this when tools are registered
logStartupInfo();

// Cover image aspect ratio (16:9 is closest to 1.91:1 OG image standard)
const COVER_IMAGE_ASPECT_RATIO = "16:9";

/**
 * Call a tool on a Mesh connection via the proxy API.
 */
async function callMeshTool<T = unknown>(
  connectionId: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<T> {
  if (!meshConfig.meshToken) {
    throw new Error(
      "Mesh not configured. Configure bindings in Mesh UI first.",
    );
  }

  const endpoint = `${meshConfig.meshUrl}/mcp/${connectionId}`;

  console.error(`[vibegui] → ${connectionId.slice(0, 12)}/${toolName}`);
  const startTime = Date.now();

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${meshConfig.meshToken}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(
      `[vibegui] ✗ ${toolName}: ${response.status} - ${text.slice(0, 100)}`,
    );
    throw new Error(`Mesh API error (${response.status}): ${text}`);
  }

  // Handle both JSON and SSE responses
  const contentType = response.headers.get("Content-Type") || "";

  let json: {
    result?: {
      structuredContent?: T;
      content?: Array<{
        type?: string;
        text?: string;
        data?: string;
        mimeType?: string;
      }>;
    };
    error?: { message: string };
  };

  if (contentType.includes("text/event-stream")) {
    const text = await response.text();
    const lines = text.split("\n");
    const dataLines = lines.filter((line) => line.startsWith("data: "));
    const lastData = dataLines[dataLines.length - 1];
    if (!lastData) {
      throw new Error("Empty SSE response from Mesh API");
    }
    json = JSON.parse(lastData.slice(6));
  } else {
    json = await response.json();
  }

  if (json.error) {
    throw new Error(`Mesh tool error: ${json.error.message}`);
  }

  const duration = Date.now() - startTime;
  console.error(`[vibegui] ✓ ${toolName} (${duration}ms)`);

  // Return structured content if available
  if (json.result?.structuredContent) {
    return json.result.structuredContent as T;
  }

  // Process content array
  const content = json.result?.content;
  if (content && content.length > 0) {
    // Look for image content (base64 data) - MCP standard format
    const imageItem = content.find((c) => c.type === "image" || c.data);
    if (imageItem?.data && imageItem?.mimeType) {
      const dataUrl = `data:${imageItem.mimeType};base64,${imageItem.data}`;
      return { image: dataUrl, mimeType: imageItem.mimeType } as T;
    }

    // Look for text content
    const textItem = content.find((c) => c.type === "text" || c.text);
    if (textItem?.text) {
      try {
        const parsed = JSON.parse(textItem.text);
        // Check if parsed result contains an image
        if (
          parsed.image &&
          typeof parsed.image === "string" &&
          parsed.image.startsWith("data:")
        ) {
          return parsed as T;
        }
        return parsed as T;
      } catch {
        return { text: textItem.text } as T;
      }
    }
  }

  return null as T;
}

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
  // Mesh Configuration Tools
  // =========================================================================

  server.registerTool(
    "MCP_CONFIGURATION",
    {
      title: "MCP Configuration",
      description:
        "Returns the configuration schema for this MCP server. Called by Mesh to discover available bindings.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      // Convert Zod schema to JSON Schema format for Mesh UI
      const stateSchema = zodToJsonSchema(StateSchema, {
        $refStrategy: "none",
      });

      const result = {
        stateSchema,
        // Scopes define which tools vibegui can call on bound connections
        // Format: "BINDING_KEY::TOOL_NAME"
        scopes: ["IMAGE_GENERATOR::GENERATE_IMAGE"],
      };

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    "ON_MCP_CONFIGURATION",
    {
      title: "Receive Configuration",
      description:
        "Receive configuration from Mesh. This is called automatically when the MCP is connected to a Mesh instance.",
      inputSchema: {
        state: z.record(z.string(), z.unknown()).optional(),
        meshToken: z.string().optional(),
        meshUrl: z.string().optional(),
      },
    },
    async (args) => {
      const { state, meshToken, meshUrl } = args;

      if (meshToken) meshConfig.meshToken = meshToken;
      if (meshUrl) meshConfig.meshUrl = meshUrl;

      // Parse IMAGE_GENERATOR binding
      const parsedState = StateSchema.safeParse(state);
      if (parsedState.success && parsedState.data.IMAGE_GENERATOR?.value) {
        imageGeneratorConnectionId = parsedState.data.IMAGE_GENERATOR.value;
      }

      console.error(`[vibegui] ON_MCP_CONFIGURATION received`);
      console.error(
        `[vibegui]   meshToken: ${meshToken ? "updated" : "not provided"}`,
      );
      console.error(`[vibegui]   meshUrl: ${meshUrl || "not provided"}`);
      console.error(
        `[vibegui]   IMAGE_GENERATOR: ${imageGeneratorConnectionId || "not set"}`,
      );

      return {
        content: [{ type: "text", text: JSON.stringify({ success: true }) }],
        structuredContent: { success: true },
      };
    },
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

  // =========================================================================
  // Cover Image Generation Tool
  // =========================================================================

  server.registerTool(
    "COVER_IMAGE_GENERATE",
    {
      title: "Generate Cover Image",
      description:
        "Generate a cover image for an article using the IMAGE_GENERATOR binding (e.g., nanobanana). Automatically applies vibegui.com's visual style (retro comic book aesthetic with green monochrome palette). Saves the image to public/images and links it to the article. Requires IMAGE_GENERATOR binding to be configured in Mesh.",
      inputSchema: {
        articleSlug: z
          .string()
          .describe("The slug of the article to generate a cover for"),
        concept: z
          .string()
          .describe(
            "Brief description of the main concept/subject for the image (e.g., 'AI robot helper', 'developer coding', 'startup rocket launch')",
          ),
        model: z
          .enum([
            "gemini-2.5-flash-image-preview",
            "gemini-3-pro-image-preview",
          ])
          .default("gemini-2.5-flash-image-preview")
          .describe("AI model to use for generation"),
      },
      annotations: { readOnlyHint: false },
    },
    withLogging("COVER_IMAGE_GENERATE", async (args) => {
      // Check if IMAGE_GENERATOR binding is configured
      if (!imageGeneratorConnectionId) {
        return {
          content: [
            {
              type: "text",
              text: "Error: IMAGE_GENERATOR binding not configured. Configure the nanobanana connection in Mesh UI and set it as the IMAGE_GENERATOR binding.",
            },
          ],
          isError: true,
        };
      }

      // Verify article exists
      const article = contentDb.getContentBySlug(args.articleSlug);
      if (!article) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Article not found: ${args.articleSlug}`,
            },
          ],
          isError: true,
        };
      }

      // Read the visual style guide
      const visualStylePath = join(PROJECT_ROOT, "context", "VISUAL_STYLE.md");
      const visualStyle = readFileSync(visualStylePath, "utf-8");

      // Build the prompt with visual style baked in
      const prompt = `Create a landscape digital artwork (1200x630) for a blog article cover image.

SUBJECT: ${args.concept}

VISUAL STYLE (MUST FOLLOW EXACTLY):
${visualStyle}

The image must:
- Be in retro 1950s-60s comic book style with deep forest green background (hex #1a4d3e)
- Have bright lime-green accents (hex #c4e538) for highlights and glowing elements
- Use ONLY monochromatic green palette - no other colors
- Include heavy dithering patterns, halftone dots, pixelation effects
- Have CRT scanline effects and film grain texture
- Use bold, dramatic composition with noir lighting
- NO text or words in the image
- Capture the essence of: ${article.title}`;

      try {
        // Call the IMAGE_GENERATOR binding's GENERATE_IMAGE tool via Mesh
        const result = await callMeshTool<{
          image?: string;
          error?: boolean;
          finishReason?: string;
        }>(imageGeneratorConnectionId, "GENERATE_IMAGE", {
          prompt,
          aspectRatio: COVER_IMAGE_ASPECT_RATIO,
          model: args.model,
        });

        if (result.error || !result.image) {
          return {
            content: [
              {
                type: "text",
                text: `Error: Image generation failed. Reason: ${result.finishReason || "unknown"}`,
              },
            ],
            isError: true,
          };
        }

        // The image comes as a URL (presigned or data URL) from nanobanana
        const imageUrl = result.image;

        // Download or decode the image
        let imageBuffer: Buffer;

        if (imageUrl.startsWith("data:")) {
          // Base64 data URL
          const base64Data = imageUrl.split(",")[1];
          imageBuffer = Buffer.from(base64Data, "base64");
        } else {
          // HTTP URL - download using curl (more reliable for presigned URLs than Bun's fetch)
          try {
            const { execSync } = await import("node:child_process");
            const result = execSync(`curl -sS -L -o - "${imageUrl}"`, {
              maxBuffer: 50 * 1024 * 1024, // 50MB
              encoding: "buffer",
            });
            imageBuffer = Buffer.from(result);
          } catch {
            // Fallback to fetch if curl fails
            const imageResponse = await fetch(imageUrl, { method: "GET" });
            if (!imageResponse.ok) {
              const errorText = await imageResponse.text().catch(() => "");
              return {
                content: [
                  {
                    type: "text",
                    text: `Error downloading image: ${imageResponse.status} - ${errorText.slice(0, 200)}`,
                  },
                ],
                isError: true,
              };
            }
            imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
          }
        }

        // Ensure images directory exists
        const imagesDir = join(PROJECT_ROOT, "public", "images");
        if (!existsSync(imagesDir)) {
          mkdirSync(imagesDir, { recursive: true });
        }

        // Save the image
        const filename = `cover-${args.articleSlug}.png`;
        const imagePath = join(imagesDir, filename);
        writeFileSync(imagePath, imageBuffer);

        // Update the article with the cover image path
        const coverImageUrl = `/images/${filename}`;
        contentDb.updateContent(args.articleSlug, {
          coverImage: coverImageUrl,
        });

        // Trigger export to update manifest
        triggerExport();

        const toolResult = {
          success: true,
          coverImage: coverImageUrl,
          articleSlug: args.articleSlug,
          articleTitle: article.title,
          model: args.model,
          finishReason: result.finishReason,
        };

        return {
          content: [
            {
              type: "text",
              text: `✅ Cover image generated and saved!\n\n📷 Path: ${coverImageUrl}\n📝 Article: ${article.title}\n🎨 Model: ${args.model}`,
            },
          ],
          structuredContent: toolResult,
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error generating image: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }),
  );

  console.error("[MCP] All tools registered");
}
