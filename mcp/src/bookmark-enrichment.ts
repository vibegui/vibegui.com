import {
  BookmarkError,
  getBookmark,
  updateBookmark,
  type BookmarkDetail,
} from "./bookmarks.ts";
import type { Env } from "./env.ts";

const MAX_MESH_RESPONSE_BYTES = 16 * 1024 * 1024;
const MAX_ANALYSIS_CONTENT_CHARS = 80_000;

export interface EnrichmentOptions {
  runResearch?: boolean;
  runContent?: boolean;
  runAnalysis?: boolean;
}

interface MeshToolResult {
  answer?: string;
  markdown?: string;
  metadata?: Record<string, unknown>;
  data?: {
    markdown?: string;
    metadata?: Record<string, unknown>;
  };
  structuredContent?: Record<string, unknown>;
  content?: string | Array<{ type?: string; text?: string }>;
  isError?: boolean;
}

export interface BookmarkClassification {
  stars?: number;
  language?: string;
  icon?: string;
  title?: string;
  description?: string;
  tags?: string[];
  insight_dev?: string[] | string;
  insight_founder?: string[] | string;
  insight_investor?: string[] | string;
  published_at?: string | null;
}

export async function enrichBookmark(
  env: Env,
  url: string,
  options: EnrichmentOptions = {},
): Promise<BookmarkDetail> {
  if (!env.MESH_GATEWAY_URL || !env.MESH_API_KEY) {
    throw new BookmarkError(
      "Bookmark enrichment is unavailable. Configure the Worker secrets MESH_GATEWAY_URL and MESH_API_KEY, then retry ENRICH_BOOKMARK.",
      503,
      "MESH_NOT_CONFIGURED",
    );
  }
  const existing = await getBookmark(env, url, true);
  if (!existing) {
    throw new BookmarkError(
      `Bookmark not found: ${url}`,
      404,
      "BOOKMARK_NOT_FOUND",
    );
  }

  const runResearch = options.runResearch !== false;
  const runContent = options.runContent !== false;
  const runAnalysis = options.runAnalysis !== false;
  let research = existing.perplexity_research ?? "";
  let content = existing.firecrawl_content ?? "";
  let publishedAt = existing.published_at;
  let researchedAt = existing.researched_at;

  const fetches: Array<
    Promise<{ kind: "research" | "content"; value: unknown }>
  > = [];
  if (runResearch) {
    fetches.push(
      withRetry(() =>
        callMeshTool(env, "perplexity_ask", {
          messages: [
            {
              role: "user",
              content: `Research ${existing.url} concisely and factually:
1. WHAT: one-sentence description and key features.
2. TECH: stack, languages, open source status, GitHub stats if available.
3. BUSINESS: pricing, competitors, traction or funding.
4. TEAM: creators and relevant background.
5. STATUS: maintenance and latest meaningful update.
6. DATE: original release or publication date (YYYY-MM-DD if known).`,
            },
          ],
        }).then((value) => ({ kind: "research" as const, value })),
      ),
    );
  }
  if (runContent) {
    fetches.push(
      withRetry(() =>
        callMeshTool(env, "firecrawl_scrape", {
          url: existing.url,
          formats: ["markdown"],
          onlyMainContent: true,
        }).then((value) => ({ kind: "content" as const, value })),
      ),
    );
  }

  const fetched = await Promise.all(fetches);
  for (const result of fetched) {
    if (result.kind === "research") {
      research = extractResearch(result.value);
      researchedAt = new Date().toISOString();
    } else {
      const page = extractFirecrawl(result.value);
      content = page.markdown;
      publishedAt = extractPublishedAt(page.metadata) ?? publishedAt;
    }
  }

  if (!runAnalysis) {
    return updateBookmark(env, {
      url: existing.url,
      perplexity_research: research || null,
      firecrawl_content: content || null,
      researched_at: researchedAt,
      published_at: publishedAt,
      reading_time_min: estimateReadingTime(content),
    });
  }

  const classificationResult = await callMeshTool(
    env,
    "mcp_openrouter_chat_completion",
    {
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You are the VibeGUI Bookmark Analyst. Return exactly one JSON object, without Markdown:
{
  "stars": <integer 1-5>,
  "language": "<ISO 639-1>",
  "icon": "<one emoji>",
  "title": "<faithful page title>",
  "description": "<1-2 factual sentences, max 240 chars>",
  "tags": ["tech:...", "persona:...", "type:...", "topic:...", "stage:..."],
  "insight_dev": ["4-5 technical paragraphs"],
  "insight_founder": ["4-5 business/strategy paragraphs"],
  "insight_investor": ["4-5 market/investment paragraphs"],
  "published_at": "<ISO 8601 or null>"
}
Rate ruthlessly: 1 broken/spam, 2 generic, 3 solid/common, 4 distinctive,
5 category-defining. Use 3-8 precise tags and at least one of
persona:mcp_developer, persona:startup_founder, persona:vc_investor. Each
insight paragraph must contain 2-4 sentences. Keep personas separate. Prefer
the original title unless missing, misleading, or over 80 characters.`,
        },
        {
          role: "user",
          content: `URL: ${existing.url}
Title: ${existing.title ?? "Unknown"}
Description: ${existing.description ?? "Unknown"}

RESEARCH:
${research}

PAGE:
${content.slice(0, MAX_ANALYSIS_CONTENT_CHARS)}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 16_384,
    },
  );
  const classification = parseClassification(
    extractMeshText(classificationResult),
  );
  const tags = Array.isArray(classification.tags)
    ? [...new Set(classification.tags.map((tag) => tag.trim()).filter(Boolean))]
    : existing.tags;
  if (
    !tags.some((tag) =>
      [
        "persona:mcp_developer",
        "persona:startup_founder",
        "persona:vc_investor",
      ].includes(tag),
    )
  ) {
    tags.push("persona:mcp_developer");
  }
  const stars =
    typeof classification.stars === "number"
      ? Math.min(5, Math.max(1, Math.round(classification.stars)))
      : (existing.stars ?? 3);

  return updateBookmark(env, {
    url: existing.url,
    title: classification.title || existing.title,
    description: classification.description || existing.description,
    icon: classification.icon || existing.icon,
    stars,
    language: classification.language || existing.language,
    reading_time_min: estimateReadingTime(content),
    perplexity_research: research || null,
    firecrawl_content: content || null,
    researched_at: researchedAt,
    insight_dev: formatInsight(classification.insight_dev),
    insight_founder: formatInsight(classification.insight_founder),
    insight_investor: formatInsight(classification.insight_investor),
    classified_at: new Date().toISOString(),
    published_at:
      publishedAt ??
      normalizeClassificationDate(classification.published_at) ??
      null,
    tags,
  });
}

export function parseClassification(text: string): BookmarkClassification {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new BookmarkError(
      `OpenRouter returned no classification JSON: ${text.slice(0, 300)}`,
      502,
      "CLASSIFICATION_INVALID",
    );
  }
  try {
    return JSON.parse(match[0]) as BookmarkClassification;
  } catch {
    let inString = false;
    let escaped = false;
    let sanitized = "";
    for (const character of match[0]) {
      if (escaped) {
        sanitized += character;
        escaped = false;
      } else if (character === "\\") {
        sanitized += character;
        escaped = true;
      } else if (character === '"') {
        inString = !inString;
        sanitized += character;
      } else if (inString && character === "\n") {
        sanitized += "\\n";
      } else {
        const code = character.charCodeAt(0);
        sanitized += code < 32 && character !== "\t" ? " " : character;
      }
    }
    try {
      return JSON.parse(sanitized) as BookmarkClassification;
    } catch (error) {
      throw new BookmarkError(
        `OpenRouter returned malformed classification JSON: ${
          error instanceof Error ? error.message : "parse failed"
        }`,
        502,
        "CLASSIFICATION_INVALID",
      );
    }
  }
}

export function formatInsight(
  insight: string[] | string | undefined,
): string | null {
  if (!insight) return null;
  if (Array.isArray(insight)) {
    return insight
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .map((paragraph) => `- ${paragraph}`)
      .join("\n\n");
  }
  return insight
    .trim()
    .replace(/\s*\|\s*-\s*/g, "\n\n- ")
    .replace(/\.,\s*-\s*/g, ".\n\n- ")
    .replace(/,\s*-\s+/g, "\n\n- ");
}

async function callMeshTool(
  env: Env,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const gatewayUrl = env.MESH_GATEWAY_URL;
  const apiKey = env.MESH_API_KEY;
  if (!gatewayUrl || !apiKey) {
    throw new BookmarkError(
      "MESH_GATEWAY_URL and MESH_API_KEY are not configured",
      503,
      "MESH_NOT_CONFIGURED",
    );
  }
  const response = await fetch(gatewayUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  const declaredSize = Number(response.headers.get("content-length") ?? 0);
  if (declaredSize > MAX_MESH_RESPONSE_BYTES) {
    throw new BookmarkError(
      `Mesh response for ${name} exceeds the ${MAX_MESH_RESPONSE_BYTES}-byte limit`,
      502,
      "MESH_RESPONSE_TOO_LARGE",
    );
  }
  const raw = await response.text();
  if (!response.ok) {
    throw new BookmarkError(
      `Mesh ${name} failed with HTTP ${response.status}: ${raw.slice(0, 300)}`,
      502,
      "MESH_CALL_FAILED",
    );
  }
  let envelope: {
    result?: unknown;
    error?: { message?: string };
  };
  try {
    envelope = JSON.parse(raw) as typeof envelope;
  } catch {
    const dataLine = raw.split("\n").find((line) => line.startsWith("data:"));
    if (!dataLine) {
      throw new BookmarkError(
        `Mesh ${name} returned invalid JSON`,
        502,
        "MESH_CALL_FAILED",
      );
    }
    envelope = JSON.parse(dataLine.slice(5).trim()) as typeof envelope;
  }
  if (envelope.error) {
    throw new BookmarkError(
      `Mesh ${name} failed: ${envelope.error.message ?? "unknown error"}`,
      502,
      "MESH_CALL_FAILED",
    );
  }
  return envelope.result;
}

function extractResearch(value: unknown): string {
  const result = asToolResult(value);
  if (result.isError) {
    throw new BookmarkError(
      `Perplexity research failed: ${extractMeshText(value).slice(0, 300)}`,
      502,
      "RESEARCH_FAILED",
    );
  }
  const structuredAnswer = result.structuredContent?.answer;
  let answer =
    result.answer ??
    (typeof structuredAnswer === "string" ? structuredAnswer : undefined) ??
    extractMeshText(value);
  try {
    const parsed = JSON.parse(answer) as {
      answer?: unknown;
      text?: unknown;
      error?: unknown;
    };
    if (typeof parsed.answer === "string") answer = parsed.answer;
    else if (typeof parsed.text === "string") answer = parsed.text;
    else if (parsed.error) {
      throw new BookmarkError(
        `Perplexity research failed: ${String(parsed.error)}`,
        502,
        "RESEARCH_FAILED",
      );
    }
  } catch (error) {
    if (error instanceof BookmarkError) throw error;
  }
  if (
    !answer ||
    answer.includes("MCP error") ||
    answer.includes("Invalid arguments")
  ) {
    throw new BookmarkError(
      `Perplexity research failed: ${answer || "empty response"}`,
      502,
      "RESEARCH_FAILED",
    );
  }
  return answer;
}

function extractFirecrawl(value: unknown): {
  markdown: string;
  metadata?: Record<string, unknown>;
} {
  const result = asToolResult(value);
  const structured = result.structuredContent;
  const structuredData =
    structured?.data &&
    typeof structured.data === "object" &&
    !Array.isArray(structured.data)
      ? (structured.data as Record<string, unknown>)
      : structured;
  const markdown =
    result.markdown ??
    result.data?.markdown ??
    (typeof structuredData?.markdown === "string"
      ? structuredData.markdown
      : undefined);
  const metadata =
    result.metadata ??
    result.data?.metadata ??
    (structuredData?.metadata &&
    typeof structuredData.metadata === "object" &&
    !Array.isArray(structuredData.metadata)
      ? (structuredData.metadata as Record<string, unknown>)
      : undefined);
  if (markdown !== undefined) return { markdown, metadata };

  const text = extractMeshText(value);
  try {
    const parsed = JSON.parse(text) as MeshToolResult;
    return extractFirecrawl(parsed);
  } catch {
    if (text) return { markdown: text };
    throw new BookmarkError(
      "Firecrawl returned no Markdown content",
      502,
      "CONTENT_FETCH_FAILED",
    );
  }
}

function asToolResult(value: unknown): MeshToolResult {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as MeshToolResult)
    : {};
}

function extractMeshText(value: unknown): string {
  if (typeof value === "string") return value;
  const result = asToolResult(value);
  if (typeof result.content === "string") return result.content;
  if (Array.isArray(result.content)) {
    return result.content.find((item) => item.type === "text")?.text ?? "";
  }
  return JSON.stringify(value ?? "");
}

function extractPublishedAt(
  metadata: Record<string, unknown> | undefined,
): string | null {
  if (!metadata) return null;
  for (const field of [
    "article:published_time",
    "og:article:published_time",
    "datePublished",
    "publishedTime",
    "date",
    "pubdate",
    "publish_date",
    "created",
    "createdAt",
  ]) {
    const value = metadata[field];
    if (typeof value !== "string") continue;
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return null;
}

function normalizeClassificationDate(value: string | null | undefined) {
  if (!value || value === "null") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function estimateReadingTime(content: string): number | null {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return words === 0 ? null : Math.max(1, Math.ceil(words / 200));
}

async function withRetry<T>(
  operation: () => Promise<T>,
  retries = 2,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      const retryable =
        message.includes("timeout") ||
        message.includes("timed out") ||
        message.includes("rate limit") ||
        message.includes("429") ||
        message.includes("503");
      if (!retryable || attempt === retries) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1_000 * 2 ** attempt));
    }
  }
  throw lastError;
}
