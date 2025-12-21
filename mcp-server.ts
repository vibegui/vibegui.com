/**
 * vibegui.com MCP Server
 *
 * This MCP server manages the entire lifecycle of the blog:
 * - Content collections: Ideas, Research, Drafts, Articles (CRUD)
 * - Development tools: dev server, build, git operations
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
import { readdir, readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { join, basename } from "node:path";
import { execSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";

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
 * Frontmatter schema for all content types
 */
const FrontmatterSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  date: z.string(),
  tags: z.array(z.string()).optional(),
  status: z.enum(["draft", "published"]).default("draft"),
});

type Frontmatter = z.infer<typeof FrontmatterSchema>;

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

type ContentEntity = z.infer<typeof ContentEntitySchema>;

// ============================================================================
// Content Directory Paths
// ============================================================================

/** Get today's date as YYYY-MM-DD */
const todayISO = () => new Date().toISOString().slice(0, 10);

const CONTENT_DIRS = {
  ideas: "./content/ideas",
  research: "./content/research",
  drafts: "./content/drafts",
  articles: "./content/articles",
} as const;

type CollectionName = keyof typeof CONTENT_DIRS;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse frontmatter from markdown content
 */
function parseFrontmatter(content: string): {
  frontmatter: Frontmatter;
  body: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return {
      frontmatter: {
        title: "Untitled",
        date: todayISO(),
        status: "draft",
      },
      body: content,
    };
  }

  const [, yamlStr, body] = match;
  const frontmatter: Record<string, unknown> = {};

  // Simple YAML parsing (for our limited use case)
  for (const line of (yamlStr ?? "").split("\n")) {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      let value: unknown = line.slice(colonIndex + 1).trim();

      // Handle quoted strings
      if (
        typeof value === "string" &&
        value.startsWith('"') &&
        value.endsWith('"')
      ) {
        value = value.slice(1, -1);
      }

      // Handle arrays
      if (typeof value === "string" && value.startsWith("[")) {
        try {
          value = JSON.parse(value.replace(/'/g, '"'));
        } catch {
          // Keep as string if parse fails
        }
      }

      frontmatter[key] = value;
    }
  }

  return {
    frontmatter: FrontmatterSchema.parse({
      title: frontmatter.title ?? "Untitled",
      description: frontmatter.description,
      date: frontmatter.date ?? new Date().toISOString().split("T")[0],
      tags: frontmatter.tags,
      status: frontmatter.status ?? "draft",
    }),
    body: body ?? "",
  };
}

/**
 * Serialize frontmatter and body back to markdown
 */
function serializeMarkdown(frontmatter: Frontmatter, body: string): string {
  const yaml = [
    "---",
    `title: "${frontmatter.title}"`,
    frontmatter.description
      ? `description: "${frontmatter.description}"`
      : null,
    `date: ${frontmatter.date}`,
    frontmatter.tags?.length
      ? `tags: ${JSON.stringify(frontmatter.tags)}`
      : null,
    `status: ${frontmatter.status}`,
    "---",
  ]
    .filter(Boolean)
    .join("\n");

  return `${yaml}\n\n${body}`;
}

/**
 * Ensure content directory exists
 */
async function ensureDir(dir: string): Promise<void> {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

/**
 * List all markdown files in a directory
 */
async function listMarkdownFiles(dir: string): Promise<string[]> {
  await ensureDir(dir);
  const files = await readdir(dir);
  return files.filter((f) => f.endsWith(".md"));
}

/**
 * Read and parse a markdown file
 */
async function readContentFile(
  dir: string,
  filename: string,
): Promise<ContentEntity | null> {
  const filepath = join(dir, filename);
  if (!existsSync(filepath)) return null;

  const raw = await readFile(filepath, "utf-8");
  const { frontmatter, body } = parseFrontmatter(raw);
  const stats = await import("node:fs").then((fs) => fs.statSync(filepath));

  const id = basename(filename, ".md");

  return {
    id,
    title: frontmatter.title,
    description: frontmatter.description ?? null,
    date: frontmatter.date,
    tags: frontmatter.tags,
    status: frontmatter.status,
    content: body.trim(),
    created_at: stats.birthtime.toISOString(),
    updated_at: stats.mtime.toISOString(),
  };
}

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
// Collection Tools Factory
// ============================================================================

/**
 * Creates CRUD tools for a content collection
 */
function createCollectionTools(name: CollectionName) {
  const dir = CONTENT_DIRS[name];
  const upperName = name.toUpperCase();

  return [
    // LIST
    createTool({
      id: `COLLECTION_${upperName}_LIST`,
      description: `List all ${name} with optional filtering`,
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
        const files = await listMarkdownFiles(dir);
        const items: Omit<ContentEntity, "content">[] = [];

        for (const file of files) {
          const entity = await readContentFile(dir, file);
          if (!entity) continue;
          if (context.status && entity.status !== context.status) continue;

          const { content: _, ...rest } = entity;
          items.push(rest);
        }

        // Sort by date descending
        items.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        );

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

    // GET
    createTool({
      id: `COLLECTION_${upperName}_GET`,
      description: `Get a single ${name.slice(0, -1)} by ID (slug)`,
      inputSchema: z.object({
        id: z.string().describe("The slug/ID of the content"),
      }),
      outputSchema: z.object({
        item: ContentEntitySchema.nullable(),
      }),
      execute: async ({ context }) => {
        const entity = await readContentFile(dir, `${context.id}.md`);
        return { item: entity };
      },
    }),

    // CREATE
    createTool({
      id: `COLLECTION_${upperName}_CREATE`,
      description: `Create a new ${name.slice(0, -1)}`,
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
        await ensureDir(dir);

        const slug = slugify(context.title);
        const filename = `${slug}.md`;
        const filepath = join(dir, filename);

        const frontmatter: Frontmatter = {
          title: context.title,
          description: context.description,
          date: todayISO(),
          tags: context.tags,
          status: context.status,
        };

        const markdown = serializeMarkdown(frontmatter, context.content);
        await writeFile(filepath, markdown, "utf-8");

        const entity = await readContentFile(dir, filename);
        if (!entity) throw new Error("Failed to create content");

        return { item: entity };
      },
    }),

    // UPDATE
    createTool({
      id: `COLLECTION_${upperName}_UPDATE`,
      description: `Update an existing ${name.slice(0, -1)}`,
      inputSchema: z.object({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        content: z.string().optional(),
        tags: z.array(z.string()).optional(),
        status: z.enum(["draft", "published"]).optional(),
      }),
      outputSchema: z.object({
        item: ContentEntitySchema,
      }),
      execute: async ({ context }) => {
        const existing = await readContentFile(dir, `${context.id}.md`);
        if (!existing) throw new Error(`Content not found: ${context.id}`);

        const frontmatter: Frontmatter = {
          title: context.title ?? existing.title,
          description: context.description ?? existing.description ?? undefined,
          date: existing.date,
          tags: context.tags ?? existing.tags,
          status: context.status ?? existing.status,
        };

        const body = context.content ?? existing.content;
        const markdown = serializeMarkdown(frontmatter, body);

        await writeFile(join(dir, `${context.id}.md`), markdown, "utf-8");

        const entity = await readContentFile(dir, `${context.id}.md`);
        if (!entity) throw new Error("Failed to update content");

        return { item: entity };
      },
    }),

    // DELETE
    createTool({
      id: `COLLECTION_${upperName}_DELETE`,
      description: `Delete a ${name.slice(0, -1)}`,
      inputSchema: z.object({
        id: z.string(),
      }),
      outputSchema: z.object({
        success: z.boolean(),
        id: z.string(),
      }),
      execute: async ({ context }) => {
        const filepath = join(dir, `${context.id}.md`);
        if (!existsSync(filepath)) {
          throw new Error(`Content not found: ${context.id}`);
        }

        await unlink(filepath);
        return { success: true, id: context.id };
      },
    }),
  ];
}

// ============================================================================
// Research Tools
// ============================================================================

const researchTools = [
  createTool({
    id: "RESEARCH_TOPIC",
    description:
      "Create a research stub for a topic. Saves a template to the research collection for you to fill in.",
    inputSchema: z.object({
      topic: z.string().describe("The topic to research"),
      questions: z
        .array(z.string())
        .optional()
        .describe("Specific questions to answer"),
    }),
    outputSchema: z.object({
      researchId: z.string(),
      title: z.string(),
      summary: z.string(),
    }),
    execute: async ({ context }) => {
      const questions = context.questions ?? [
        `What are the key facts about ${context.topic}?`,
        `What are recent developments regarding ${context.topic}?`,
        `What are different perspectives on ${context.topic}?`,
      ];

      let researchContent = `# Research: ${context.topic}\n\n`;
      for (const question of questions) {
        researchContent += `## ${question}\n\n*Add your research here...*\n\n`;
      }

      const slug = slugify(context.topic);
      const frontmatter: Frontmatter = {
        title: `Research: ${context.topic}`,
        description: `Research notes on ${context.topic}`,
        date: todayISO(),
        tags: ["research"],
        status: "draft",
      };

      await ensureDir(CONTENT_DIRS.research);
      const markdown = serializeMarkdown(frontmatter, researchContent);
      await writeFile(
        join(CONTENT_DIRS.research, `${slug}.md`),
        markdown,
        "utf-8",
      );

      return {
        researchId: slug,
        title: `Research: ${context.topic}`,
        summary: `Created research stub with ${questions.length} questions`,
      };
    },
  }),
];

// ============================================================================
// Development Tools
// ============================================================================

let devServerProcess: ChildProcess | null = null;

const devTools = [
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
          url: "http://localhost:4000",
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
        url: "http://localhost:4000",
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
    id: "BUILD",
    description: "Run production build",
    inputSchema: z.object({}),
    outputSchema: z.object({
      success: z.boolean(),
      output: z.string(),
    }),
    execute: async () => {
      try {
        const output = execSync("bun run build", {
          cwd: process.cwd(),
          encoding: "utf-8",
        });
        return { success: true, output };
      } catch (error) {
        return {
          success: false,
          output: error instanceof Error ? error.message : String(error),
        };
      }
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
// MCP Server Export
// ============================================================================

// Wrap tools as functions that return tools (required by withRuntime)
const wrapTools = (tools: ReturnType<typeof createTool>[]) =>
  tools.map((tool) => () => tool);

const runtime = withRuntime({
  configuration: {
    state: StateSchema,
    scopes: [],
  },
  tools: [
    // Content collections
    ...wrapTools(createCollectionTools("ideas")),
    ...wrapTools(createCollectionTools("research")),
    ...wrapTools(createCollectionTools("drafts")),
    ...wrapTools(createCollectionTools("articles")),

    // Research tools (uses Perplexity)
    ...wrapTools(researchTools),

    // Development tools
    ...wrapTools(devTools),
  ],
});

export default runtime;
