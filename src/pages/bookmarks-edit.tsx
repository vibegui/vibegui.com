/**
 * Bookmarks Dashboard
 *
 * Table-based viewer for curated links with AI enrichment workflow.
 * Features:
 * - Table view with all enrichment fields
 * - "Start Enriching" workflow that calls local mesh
 * - Research and classification via Perplexity + Claude
 *
 * Data source:
 * - Production: Supabase (read-only via anon key)
 * - Development: Supabase + MCP for writes
 */

import React, { useState, useRef } from "react";
import { PageHeader } from "../components/page-header";
import {
  BookmarkModal,
  clearBookmarkCache,
  type ModalType,
} from "../components/bookmark-modal";
import {
  getAllBookmarksLight,
  searchBookmarks,
  type BookmarkLight,
  type Bookmark as FullBookmark,
  type SearchResult,
} from "../../lib/supabase";

// Use the light bookmark type for list view
type Bookmark = BookmarkLight;

// Enrichment result type (full data for API save)
type EnrichmentResult = {
  url: string;
  title: string | null;
  description: string | null;
  perplexity_research: string | null;
  firecrawl_content: string | null;
  researched_at: string | null;
  stars: number | null;
  language: string | null;
  icon: string | null;
  insight_dev: string | null;
  insight_founder: string | null;
  insight_investor: string | null;
  classified_at: string | null;
  published_at: string | null;
  tags: string[];
};

// Tag type helpers
function hasTag(tags: string[] | undefined, tag: string): boolean {
  return tags?.includes(tag) ?? false;
}

// Extract platform from URL for filtering
const PLATFORM_PATTERNS: Record<string, RegExp> = {
  github: /github\.com/i,
  linkedin: /linkedin\.com/i,
  twitter: /twitter\.com|x\.com/i,
  youtube: /youtube\.com|youtu\.be/i,
  instagram: /instagram\.com/i,
  medium: /medium\.com/i,
  substack: /substack\.com/i,
  reddit: /reddit\.com/i,
  hackernews: /news\.ycombinator\.com/i,
  discord: /discord\.com|discord\.gg/i,
};

function getPlatform(url: string): string | null {
  for (const [platform, pattern] of Object.entries(PLATFORM_PATTERNS)) {
    if (pattern.test(url)) return platform;
  }
  return null;
}

interface EnrichmentStatus {
  isRunning: boolean;
  current: string | null;
  currentStep: number;
  stepMessage: string;
  processed: number;
  total: number;
  errors: string[];
  lastResult: string | null;
}

const TRACK_CONFIG = {
  mcp: { label: "MCP Developer", color: "#8b5cf6", icon: "🔌" },
  founder: { label: "Startup Founder", color: "#f59300", icon: "🚀" },
  investor: { label: "VC Investor", color: "#10b981", icon: "💰" },
};

// Note: Bookmarks are now loaded from SQLite via /api/bookmarks

function StarRating({ stars }: { stars?: number | null }) {
  if (!stars) return <span className="text-gray-400">—</span>;
  return (
    <span title={`${stars}/5`}>
      {"⭐".repeat(stars)}
      <span className="opacity-30">{"☆".repeat(5 - stars)}</span>
    </span>
  );
}

async function callMeshTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  // Call through local Vite proxy which handles auth
  const response = await fetch("/api/mesh/call", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ toolName, args }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Mesh call failed: ${response.status} - ${text}`);
  }

  const result = await response.json();
  if (result.error) {
    throw new Error(result.error.message || JSON.stringify(result.error));
  }

  return result.result ?? result;
}

// Retry wrapper for transient errors (timeouts, rate limits)
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  baseDelay = 2000,
): Promise<T> {
  let lastError: Error | null = null;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      const isRetryable =
        lastError.message.includes("timed out") ||
        lastError.message.includes("timeout") ||
        lastError.message.includes("rate limit") ||
        lastError.message.includes("429");
      if (!isRetryable || i === maxRetries) throw lastError;
      // Exponential backoff with jitter
      const delay = baseDelay * 2 ** i + Math.random() * 1000;
      console.log(
        `[Retry] Attempt ${i + 1} failed, retrying in ${Math.round(delay)}ms...`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

interface EnrichmentOptions {
  runResearch: boolean;
  runContent: boolean;
  runAnalysis: boolean;
}

async function enrichBookmark(
  bookmark: Bookmark,
  onStep: (stepNum: number, message: string) => void,
  options: EnrichmentOptions = {
    runResearch: true,
    runContent: true,
    runAnalysis: true,
  },
  existingData?: { research?: string; content?: string },
): Promise<EnrichmentResult> {
  // Type for tool results
  type ToolResult = {
    answer?: string;
    content?: Array<{ type: string; text: string }> | string;
    structuredContent?: { answer?: string };
    results?: Array<{ title?: string; text?: string; url?: string }>;
    isError?: boolean;
    // Firecrawl response
    markdown?: string;
    metadata?: Record<string, unknown>;
  };

  let research = existingData?.research || "";
  let pageContent = existingData?.content || "";
  let publishedAt: string | undefined;
  let researchedAt: string | undefined;

  // Step 1: Fetch research + page content in parallel (if enabled)
  if (options.runResearch || options.runContent) {
    onStep(
      1,
      `Fetching${options.runResearch ? " Perplexity" : ""}${options.runResearch && options.runContent ? " +" : ""}${options.runContent ? " Firecrawl" : ""}...`,
    );

    const tasks: Promise<ToolResult>[] = [];
    const taskNames: string[] = [];

    if (options.runResearch) {
      tasks.push(
        withRetry(
          () =>
            callMeshTool("perplexity_ask", {
              messages: [
                {
                  role: "user",
                  content: `Research ${bookmark.url}:

1. WHAT: One-sentence description. Key features.
2. TECH: Stack, languages, open source? GitHub stats if available.
3. BUSINESS: Pricing model, competitors, traction (users/funding).
4. TEAM: Who made it? Background.
5. STATUS: Last update, actively maintained?
6. DATE: Original release/publish date (YYYY-MM-DD if possible).

Be factual and concise.`,
                },
              ],
            }) as Promise<ToolResult>,
        ),
      );
      taskNames.push("research");
    }

    if (options.runContent) {
      tasks.push(
        withRetry(
          () =>
            callMeshTool("firecrawl_scrape", {
              url: bookmark.url,
              formats: ["markdown"],
              onlyMainContent: true,
            }) as Promise<ToolResult>,
        ),
      );
      taskNames.push("content");
    }

    const results = await Promise.all(tasks);

    // Map results back to their types
    let researchResult: ToolResult | undefined;
    let firecrawlResult: ToolResult | undefined;
    for (const [idx, name] of taskNames.entries()) {
      if (name === "research") researchResult = results[idx];
      if (name === "content") firecrawlResult = results[idx];
    }

    // Process research result
    if (researchResult) {
      if (researchResult.isError) {
        const errorText = Array.isArray(researchResult.content)
          ? researchResult.content.find((c) => c.type === "text")?.text
          : typeof researchResult.content === "string"
            ? researchResult.content
            : "Unknown error";
        throw new Error(`Perplexity research failed: ${errorText}`);
      }

      if (typeof researchResult.answer === "string") {
        research = researchResult.answer;
      } else if (researchResult.structuredContent?.answer) {
        research = researchResult.structuredContent.answer;
      } else if (Array.isArray(researchResult.content)) {
        const textContent = researchResult.content.find(
          (c) => c.type === "text",
        );
        if (textContent?.text) {
          try {
            const parsed = JSON.parse(textContent.text);
            if (parsed.isError || parsed.error) {
              throw new Error(
                `Perplexity research failed: ${parsed.error || parsed.text || "Unknown error"}`,
              );
            }
            research = parsed.answer ?? textContent.text;
          } catch (e) {
            if (
              e instanceof Error &&
              e.message.includes("Perplexity research failed")
            ) {
              throw e;
            }
            research = textContent.text;
          }
        }
      } else if (typeof researchResult.content === "string") {
        research = researchResult.content;
      }

      if (
        !research ||
        research.includes("MCP error") ||
        research.includes("Invalid arguments")
      ) {
        throw new Error(
          `Perplexity research failed: ${research || "No response"}`,
        );
      }

      researchedAt = new Date().toISOString();
    }

    // Process Firecrawl result
    if (firecrawlResult) {
      if (typeof firecrawlResult.markdown === "string") {
        pageContent = firecrawlResult.markdown;
      } else if (Array.isArray(firecrawlResult.content)) {
        const textContent = firecrawlResult.content.find(
          (c) => c.type === "text",
        );
        if (textContent?.text) {
          try {
            const parsed = JSON.parse(textContent.text);
            pageContent = parsed.markdown || textContent.text;
          } catch {
            pageContent = textContent.text;
          }
        }
      }

      // Extract publish date from metadata
      const metadata = firecrawlResult.metadata as
        | Record<string, unknown>
        | undefined;
      if (metadata) {
        const dateFields = [
          "article:published_time",
          "og:article:published_time",
          "datePublished",
          "publishedTime",
          "date",
          "pubdate",
          "publish_date",
          "created",
          "createdAt",
        ];
        for (const field of dateFields) {
          const value = metadata[field];
          if (value && typeof value === "string") {
            const parsed = new Date(value);
            if (!Number.isNaN(parsed.getTime())) {
              publishedAt = parsed.toISOString();
              console.log(
                `[Enrichment] Found publish date from metadata.${field}:`,
                publishedAt,
              );
              break;
            }
          }
        }
      }
    }
  } else {
    onStep(1, "Skipping fetch (using existing data)...");
  }

  // Debug: log what we're sending to the AI
  console.log("[Enrichment] Research length:", research.length);
  console.log("[Enrichment] Page content length:", pageContent.length);

  // If skipping analysis, return with existing data preserved
  if (!options.runAnalysis) {
    onStep(2, "Skipping analysis...");
    // Return minimal result - caller should merge with existing
    return {
      url: bookmark.url,
      title: bookmark.title,
      description: bookmark.description,
      perplexity_research: research || null,
      firecrawl_content: pageContent || null,
      researched_at: researchedAt || null,
      stars: bookmark.stars || 3,
      language: null,
      icon: bookmark.icon || null,
      insight_dev: null,
      insight_founder: null,
      insight_investor: null,
      classified_at: new Date().toISOString(),
      published_at: publishedAt || null,
      tags: bookmark.tags || [],
    };
  }

  // Step 2: Classify with OpenRouter (Gemini 2.5 Flash)
  onStep(2, "Classifying with Gemini 2.5 Flash...");
  const classifyResult = (await callMeshTool("mcp_openrouter_chat_completion", {
    model: "google/gemini-2.5-flash",
    messages: [
      {
        role: "system",
        content: `You are “VibeGUI Bookmark Analyst”: an ultra-high-value, high-context reviewer enriching bookmarks for https://vibegui.com.  
You receive:
- RESEARCH → short Perplexity summary (with citations, release info, repo data)
- PAGE → Firecrawl scrape (full text, metadata, title, date hints)
- URL → the original resource

Your task: return ONE valid JSON object (no markdown, no explanation) that will render correctly in the VibeGUI library UI.

──────────────────────────────────────────────
OUTPUT JSON SCHEMA
──────────────────────────────────────────────
{
  "stars": <integer 1-5>,
  "language": "<ISO 639-1 code>",
  "icon": "<single emoji>",
  "title": "<catchy, ≤60 chars>",
  "description": "<1-2 sentences, ≤240 chars>",
  "tags": ["tech:...", "persona:...", "type:..."],
  "insight_dev": ["<paragraph 1>", "<paragraph 2>", "<paragraph 3>"],
  "insight_founder": ["<paragraph 1>", "<paragraph 2>", "<paragraph 3>"],
  "insight_investor": ["<paragraph 1>", "<paragraph 2>", "<paragraph 3>"],
  "published_at": "<ISO 8601 or null>"
}

──────────────────────────────────────────────
JSON RULES (CRITICAL)
──────────────────────────────────────────────
1. Output exactly one JSON object, no markdown fences.
2. Each insight is an ARRAY of 3-5 strings (one paragraph each).
3. Each paragraph is 2-4 sentences, plain text, no bullet markers.
4. Use straight quotes only. Avoid special characters.
5. Do not use pipe | separators.

──────────────────────────────────────────────
STAR RATING — BE RUTHLESS
──────────────────────────────────────────────
1 ⭐ spam / broken / outdated / irrelevant  
2 ⭐ generic or shallow  
3 ⭐ solid and useful but common  
4 ⭐ strong execution, distinct insight  
5 ⭐ exceptional or category-defining  

(Most links should be 2-3 ⭐.)

──────────────────────────────────────────────
ICON GUIDELINES
──────────────────────────────────────────────
Any emoji allowed.  
Common picks: 🧠 idea, 🧰 tool, ⚙️ infra, 📚 doc, 💡 concept, 🚀 launch, 🔒 security, 🪄 UI, 🧪 research, 🛠️ code, 🧭 strategy, 💸 biz, 🌍 data, 🧑‍💻 dev, 🔥 trend.

──────────────────────────────────────────────
TAG SYSTEM
──────────────────────────────────────────────
Always include ≥1 persona tag:
persona:mcp_developer • persona:startup_founder • persona:vc_investor  
Use 3-8 concise tags:
- tech:<stack or protocol> — e.g. tech:mcp, tech:typescript, tech:llm, tech:agents  
- type:<form> — e.g. type:tool, type:paper, type:repo, type:blog, type:product  
- topic:<theme> — e.g. topic:observability, topic:prompting, topic:security  
- stage:<maturity> — e.g. stage:research, stage:beta, stage:prod  

Prefer precision over quantity.

──────────────────────────────────────────────
INSIGHT ARRAYS (3-5 paragraphs each, 2-4 sentences per paragraph)
──────────────────────────────────────────────
**insight_dev** (MCP / AI Developer) — technical only  
Integration, API design, DX, limitations, LLM/Agent interop, gotchas. Agentic workflows, MCP servers.

**insight_founder** (Startup Founder) — business & strategy only  
Problem solved, target user, differentiation, moat, strategic move. How to use for my startup?

**insight_investor** (VC / Market) — investment view only  
Market trends, competitive signals, defensibility, risk/reward. Evolution of AI.

Never mix personas. Each array element is one standalone paragraph.

──────────────────────────────────────────────
PUBLISH DATE EXTRACTION
──────────────────────────────────────────────
Goal: *original publish / release / announcement date*  
Order of checks:
1️⃣ RESEARCH → look for “launched”, “released”, “announced”, “published”.  
2️⃣ PAGE → meta tags, byline, footer, JSON-LD, changelog, version notes.  
3️⃣ GitHub → first release > first commit > repo created (only if explicit).  

Format as ISO 8601 UTC:
- Full date → "2025-03-12T00:00:00.000Z"  
- Only month/year → use first of month  
- Only year → use Jan 1  
If none found → null.

──────────────────────────────────────────────
SELF-CHECK
──────────────────────────────────────────────
✔ Each insight field is an array of 3-5 strings
✔ No pipe separators, no bullet markers
✔ JSON is syntactically valid
✔ No markdown fences

Output the JSON object only.
`,
      },
      {
        role: "user",
        content: `Analyze this resource:

URL: ${bookmark.url}
Title: ${bookmark.title || "Unknown"}
Description: ${bookmark.description || "No description"}

RESEARCH (from Perplexity):
${research}

${pageContent ? `PAGE CONTENT (from Firecrawl):\n${pageContent}` : ""}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 16384, // Ensure full insights are generated for large inputs
  })) as string | { content?: Array<{ type: string; text: string }> };

  // Extract text from OpenRouter response - may be string or { content: [{ type, text }] }
  let classText = "";
  if (typeof classifyResult === "string") {
    classText = classifyResult;
  } else if (classifyResult?.content && Array.isArray(classifyResult.content)) {
    const textContent = classifyResult.content.find((c) => c.type === "text");
    classText = textContent?.text ?? "";
  } else {
    classText = JSON.stringify(classifyResult);
  }

  // Debug: log the raw response
  console.log("[Enrichment] Raw AI response:", classText.slice(0, 800));

  const jsonMatch = classText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(
      `Failed to parse classification JSON from: ${classText.slice(0, 500)}`,
    );
  }

  // Attempt to parse JSON, with fallback sanitization for common issues
  interface Classification {
    stars?: number;
    language?: string;
    icon?: string;
    title?: string;
    description?: string;
    tags?: string[];
    insight_dev?: string[] | string; // Array preferred, string for backwards compat
    insight_founder?: string[] | string;
    insight_investor?: string[] | string;
    published_at?: string | null;
  }

  let c: Classification;

  // Robust JSON parsing with multiple fallback strategies
  const parseJsonRobust = (jsonStr: string): Classification => {
    // Strategy 1: Direct parse
    try {
      return JSON.parse(jsonStr) as Classification;
    } catch {
      // Continue to sanitization
    }

    // Strategy 2: Escape literal newlines inside JSON string values
    // JSON doesn't allow bare newlines in strings - they must be \n
    // Use a simple state machine to track if we're inside a string
    let inString = false;
    let escaped = false;
    let sanitized = "";
    for (const char of jsonStr) {
      if (escaped) {
        sanitized += char;
        escaped = false;
        continue;
      }
      if (char === "\\") {
        sanitized += char;
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        sanitized += char;
        continue;
      }
      if (inString && char === "\n") {
        // Escape literal newline inside string
        sanitized += "\\n";
        continue;
      }
      if (inString && char === "\r") {
        // Skip carriage returns inside strings
        continue;
      }
      // Replace other control chars with space
      const code = char.charCodeAt(0);
      if (
        (code >= 0 && code <= 8) ||
        code === 11 ||
        code === 12 ||
        (code >= 14 && code <= 31)
      ) {
        sanitized += " ";
        continue;
      }
      sanitized += char;
    }

    // Fix missing commas between properties (multiple patterns)
    sanitized = sanitized.replace(/"\s*\n\s*"/g, '",\n  "');

    // No fallback - if JSON is malformed, fail hard so we can retry
    return JSON.parse(sanitized) as Classification;
  };

  try {
    c = parseJsonRobust(jsonMatch[0]);
  } catch (parseError) {
    const err = parseError as Error;
    console.error("[Enrichment] JSON parse error:", err.message);
    console.error(
      "[Enrichment] Problematic JSON:",
      jsonMatch[0].slice(0, 1000),
    );
    throw new Error(`${bookmark.title || bookmark.url}: ${err.message}`);
  }

  // Debug: log parsed fields
  console.log("[Enrichment] Parsed fields:", {
    stars: c.stars,
    icon: c.icon,
    insight_dev: Array.isArray(c.insight_dev)
      ? `[${c.insight_dev.length} items]`
      : c.insight_dev?.slice(0, 50),
  });

  // Convert insight to markdown bullet list
  // Handles both new array format and old string format
  const formatInsight = (
    insight: string[] | string | undefined,
  ): string | null => {
    if (!insight) return null;
    if (Array.isArray(insight)) {
      // New format: array of paragraphs → bullet list
      return insight.map((p) => `- ${p.trim()}`).join("\n\n");
    }
    // Old format: string with " | - " separators
    return insight
      .replace(/\s*\|\s*-\s*/g, "\n\n- ")
      .replace(/\.,\s*-\s*/g, ".\n\n- ")
      .replace(/,\s*-\s+/g, "\n\n- ");
  };

  // Defensive extraction with defaults
  const stars = typeof c.stars === "number" ? c.stars : 3;
  const tags: string[] = Array.isArray(c.tags) ? c.tags : [];

  // Check persona tags for backwards compatibility
  const trackDev = hasTag(tags, "persona:mcp_developer");
  const trackFounder = hasTag(tags, "persona:startup_founder");
  const trackInvestor = hasTag(tags, "persona:vc_investor");

  // Ensure at least one main track is selected
  if (!trackDev && !trackFounder && !trackInvestor) {
    tags.push("persona:mcp_developer");
  }

  // Return enriched bookmark (Step 3: Save happens in caller)
  return {
    url: bookmark.url,
    title: c.title || bookmark.title,
    description: c.description || bookmark.description,
    perplexity_research: research,
    firecrawl_content: pageContent || null,
    researched_at: researchedAt || null,
    stars,
    language: c.language || null,
    icon: c.icon || null,
    insight_dev: formatInsight(c.insight_dev),
    insight_founder: formatInsight(c.insight_founder),
    insight_investor: formatInsight(c.insight_investor),
    classified_at: new Date().toISOString(),
    published_at:
      publishedAt ||
      (c.published_at && c.published_at !== "null" ? c.published_at : null),
    tags,
  };
}

// Convert a full bookmark (from API) to light format for state
function toBookmarkLight(full: FullBookmark): BookmarkLight {
  return {
    id: full.id,
    url: full.url,
    title: full.title,
    description: full.description,
    icon: full.icon,
    stars: full.stars,
    classified_at: full.classified_at,
    published_at: full.published_at,
    tags: full.tags,
  };
}

// Check if running in development mode (localhost)
const isDev =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

export function BookmarksEdit() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showOnlyUnenriched, setShowOnlyUnenriched] = useState(false);
  const [trackFilter, setTrackFilter] = useState<
    "mcp" | "founder" | "investor" | null
  >(null);
  const [techFilter, setTechFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<
    "none" | "rating" | "alpha" | "published" | "enriched"
  >("published");
  const [starsFilter, setStarsFilter] = useState<number | null>(null);
  const [platformFilter, setPlatformFilter] = useState<string | null>(null);
  // Tag expansion states
  const [showAllTechTags, setShowAllTechTags] = useState(false);
  const [showAllTypeTags, setShowAllTypeTags] = useState(false);
  const [showAllPlatforms, setShowAllPlatforms] = useState(false);
  // Full-text search match type filter
  const [matchTypeFilter, setMatchTypeFilter] = useState<
    "all" | "content" | "research" | "insight"
  >("all");
  // Modal state - URL and initial tab
  const [modalState, setModalState] = useState<{
    url: string;
    tab: ModalType;
  } | null>(null);

  // Selected row for keyboard navigation
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const filteredRef = useRef<Bookmark[]>([]);

  // Delete confirmation modal
  const [deleteConfirm, setDeleteConfirm] = useState<{
    url: string;
    title: string;
  } | null>(null);

  // Enrichment queue
  const [enrichQueue, setEnrichQueue] = useState<string[]>([]);
  // Track failed enrichments with their error messages
  const [failedUrls, setFailedUrls] = useState<Map<string, string>>(new Map());
  // Batch size for enrichment
  const [batchSize, setBatchSize] = useState(5);
  // Parallel workers count
  const [parallelCount, setParallelCount] = useState(3);
  // New URL import
  const [newUrlInput, setNewUrlInput] = useState("");
  const [importingUrl, setImportingUrl] = useState(false);
  // Track active workers
  const [activeWorkers, setActiveWorkers] = useState<Set<string>>(new Set());
  // Enrichment step selection (which steps to run)
  const [enrichSteps, setEnrichSteps] = useState({
    research: true, // Perplexity
    content: true, // Firecrawl
    analysis: true, // AI classification
  });

  // Search results from server-side search
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(
    null,
  );
  const [searching, setSearching] = useState(false);

  const queueEnrichment = (url: string) => {
    // Clear any previous error for this URL when re-queuing
    setFailedUrls((prev) => {
      const next = new Map(prev);
      next.delete(url);
      return next;
    });
    setEnrichQueue((prev) => {
      if (prev.includes(url)) return prev; // Already queued
      return [...prev, url];
    });
  };

  const openModal = (url: string, tab: ModalType = "dev") => {
    setModalState({ url, tab });
  };

  // Delete bookmark
  const deleteBookmark = async (url: string) => {
    try {
      const res = await fetch("/api/bookmarks/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error("Failed to delete");
      // Remove from local state
      setBookmarks((prev) => prev.filter((b) => b.url !== url));
      setDeleteConfirm(null);
      setSelectedRowIndex(null);
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete bookmark");
    }
  };
  const closeModal = () => setModalState(null);
  const modalBookmark = modalState
    ? bookmarks.find((b) => b.url === modalState.url)
    : null;

  // Ref for table navigation state
  const tableNavRef = useRef({
    selectedRowIndex,
    modalOpen: !!modalState,
  });
  tableNavRef.current = { selectedRowIndex, modalOpen: !!modalState };

  // Keyboard navigation for table rows (when modal is closed) - stable handler
  // biome-ignore lint/correctness/useExhaustiveDependencies: using ref for stable handler
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip when modal is open
      if (tableNavRef.current.modalOpen) return;

      // Skip if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      const list = filteredRef.current;
      const currentIdx = tableNavRef.current.selectedRowIndex;

      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        setSelectedRowIndex((prev) => {
          const next = prev === null ? 0 : Math.min(prev + 1, list.length - 1);
          setTimeout(() => {
            document
              .getElementById(`bookmark-row-${next}`)
              ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
          }, 0);
          return next;
        });
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        setSelectedRowIndex((prev) => {
          const next = prev === null ? list.length - 1 : Math.max(prev - 1, 0);
          setTimeout(() => {
            document
              .getElementById(`bookmark-row-${next}`)
              ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
          }, 0);
          return next;
        });
      } else if (e.key === "Enter" && currentIdx !== null) {
        e.preventDefault();
        const bookmark = list[currentIdx];
        if (bookmark?.classified_at) {
          openModal(bookmark.url);
        }
      } else if (
        isDev &&
        (e.key === "Delete" || e.key === "Backspace") &&
        currentIdx !== null
      ) {
        e.preventDefault();
        const bookmark = list[currentIdx];
        if (bookmark) {
          setDeleteConfirm({
            url: bookmark.url,
            title: bookmark.title || bookmark.url,
          });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Ref for delete confirmation
  const deleteConfirmRef = useRef(deleteConfirm);
  deleteConfirmRef.current = deleteConfirm;

  // Keyboard handler for delete confirmation modal - stable handler
  // biome-ignore lint/correctness/useExhaustiveDependencies: using ref for stable handler
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const confirm = deleteConfirmRef.current;
      if (!confirm) return;

      if (e.key === "Enter") {
        e.preventDefault();
        deleteBookmark(confirm.url);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setDeleteConfirm(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const [status, setStatus] = useState<EnrichmentStatus>({
    isRunning: false,
    current: null,
    currentStep: 0,
    stepMessage: "",
    processed: 0,
    total: 0,
    errors: [],
    lastResult: null,
  });
  const abortRef = useRef(false);

  // Fetch bookmarks from Supabase (light version - no heavy content)
  const loadBookmarks = async () => {
    try {
      setLoading(true);
      const data = await getAllBookmarksLight();
      setBookmarks(data);
      setLoading(false);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  // Initial load - runs once on mount
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally runs only on mount
  React.useEffect(() => {
    loadBookmarks();
  }, []);

  // Server-side search with debounce
  // biome-ignore lint/correctness/useExhaustiveDependencies: search dependency is intentional
  React.useEffect(() => {
    if (!search.trim()) {
      setSearchResults(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchBookmarks(search);
        setSearchResults(results);
      } catch (err) {
        console.error("Search failed:", err);
        setSearchResults(null);
      } finally {
        setSearching(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [search]);

  const unenriched = bookmarks.filter((b) => !b.classified_at);
  const enriched = bookmarks.filter((b) => b.classified_at);

  // Track counts (from persona: tags)
  const trackCounts = {
    mcp: bookmarks.filter((b) => hasTag(b.tags, "persona:mcp_developer"))
      .length,
    founder: bookmarks.filter((b) => hasTag(b.tags, "persona:startup_founder"))
      .length,
    investor: bookmarks.filter((b) => hasTag(b.tags, "persona:vc_investor"))
      .length,
  };

  // Collect all unique tags by type for filters
  const allTags = bookmarks.flatMap((b) => b.tags ?? []);
  const techTagCounts = allTags
    .filter((t) => t.startsWith("tech:"))
    .reduce(
      (acc, t) => {
        const tag = t.slice(5);
        acc[tag] = (acc[tag] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  const allSortedTechTags = Object.entries(techTagCounts)
    .filter(([, count]) => count > 1) // Exclude tags that appear only once
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag);
  const sortedTechTags = showAllTechTags
    ? allSortedTechTags
    : allSortedTechTags.slice(0, 15);
  const hasMoreTechTags = allSortedTechTags.length > 15;

  const typeTagCounts = allTags
    .filter((t) => t.startsWith("type:"))
    .reduce(
      (acc, t) => {
        const tag = t.slice(5);
        acc[tag] = (acc[tag] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  const allSortedTypeTags = Object.entries(typeTagCounts)
    .filter(([, count]) => count > 1) // Exclude tags that appear only once
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag);
  const sortedTypeTags = showAllTypeTags
    ? allSortedTypeTags
    : allSortedTypeTags.slice(0, 15);
  const hasMoreTypeTags = allSortedTypeTags.length > 15;

  // Collect platform counts for filter
  const platformCounts: Record<string, number> = {};
  for (const b of bookmarks) {
    const platform = getPlatform(b.url);
    if (platform) {
      platformCounts[platform] = (platformCounts[platform] || 0) + 1;
    }
  }
  const allSortedPlatforms = Object.entries(platformCounts)
    .filter(([, count]) => count > 1) // Exclude platforms that appear only once
    .sort((a, b) => b[1] - a[1])
    .map(([p]) => p);
  const sortedPlatforms = showAllPlatforms
    ? allSortedPlatforms
    : allSortedPlatforms.slice(0, 15);
  const hasMorePlatforms = allSortedPlatforms.length > 15;

  // Match types for search results (from server-side search)
  type MatchTypes = {
    content: boolean;
    research: boolean;
    insight: boolean;
  };
  const matchTypesMap = new Map<string, MatchTypes>();

  // Build filtered list - use search results when searching, otherwise filter bookmarks
  const baseList: Bookmark[] = searchResults
    ? searchResults
        .filter((r) => {
          // Apply match type filter
          if (matchTypeFilter === "content" && !r.matches.content) return false;
          if (matchTypeFilter === "research" && !r.matches.research)
            return false;
          if (matchTypeFilter === "insight" && !r.matches.insight) return false;
          return true;
        })
        .map((r) => {
          // Store match types for display
          matchTypesMap.set(r.bookmark.url, r.matches);
          return r.bookmark;
        })
    : bookmarks;

  const filtered = baseList
    .filter((b) => {
      if (showOnlyUnenriched && b.classified_at) return false;
      if (trackFilter === "mcp" && !hasTag(b.tags, "persona:mcp_developer"))
        return false;
      if (
        trackFilter === "founder" &&
        !hasTag(b.tags, "persona:startup_founder")
      )
        return false;
      if (trackFilter === "investor" && !hasTag(b.tags, "persona:vc_investor"))
        return false;
      if (techFilter && !hasTag(b.tags, `tech:${techFilter}`)) return false;
      if (typeFilter && !hasTag(b.tags, `type:${typeFilter}`)) return false;
      // Exact stars filter
      if (starsFilter !== null && b.stars !== starsFilter) return false;
      // Platform filter
      if (platformFilter && getPlatform(b.url) !== platformFilter) return false;
      return true;
    })
    // Sort based on sortBy option
    .sort((a, b) => {
      if (sortBy === "none") {
        // No sorting - maintain original database order
        return 0;
      }
      if (sortBy === "published") {
        // Recently published first, items without publish date at the end
        const aDate = a.published_at ? new Date(a.published_at).getTime() : 0;
        const bDate = b.published_at ? new Date(b.published_at).getTime() : 0;
        return bDate - aDate;
      }
      if (sortBy === "rating") {
        // Rating sort: highest stars first, unenriched at bottom
        return (b.stars || 0) - (a.stars || 0);
      }
      if (sortBy === "alpha") {
        // Alphabetical by title
        return (a.title || a.url).localeCompare(b.title || b.url);
      }
      if (sortBy === "enriched") {
        // Oldest enriched first (for re-enrichment), unenriched at top
        const aDate = a.classified_at ? new Date(a.classified_at).getTime() : 0;
        const bDate = b.classified_at ? new Date(b.classified_at).getTime() : 0;
        return aDate - bDate; // Oldest first
      }
      return 0;
    });

  // Keep ref in sync for keyboard navigation
  filteredRef.current = filtered;

  // Enrich a specific bookmark by URL
  const enrichSpecificBookmark = async (bookmark: Bookmark) => {
    if (status.isRunning) return; // Don't interrupt ongoing enrichment

    abortRef.current = false;
    setStatus({
      isRunning: true,
      current: bookmark.title || bookmark.url,
      currentStep: 1,
      stepMessage: "Starting...",
      processed: 0,
      total: 1,
      errors: [],
      lastResult: null,
    });

    try {
      const enrichedBookmark = await enrichBookmark(
        bookmark,
        (stepNum, message) => {
          setStatus((s) => ({
            ...s,
            currentStep: stepNum,
            stepMessage: message,
          }));
        },
      );

      setStatus((s) => ({
        ...s,
        currentStep: 3,
        stepMessage: "Saving to database...",
      }));

      const res = await fetch("/api/bookmarks/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(enrichedBookmark),
      });

      if (!res.ok) throw new Error("Failed to save");

      const savedBookmark = await res.json();
      const lightBookmark = toBookmarkLight(savedBookmark);
      setBookmarks((prev) =>
        prev.map((b) => (b.url === lightBookmark.url ? lightBookmark : b)),
      );

      setStatus((s) => ({
        ...s,
        isRunning: false,
        current: null,
        processed: 1,
        lastResult: `✓ ${bookmark.title || bookmark.url}`,
      }));
    } catch (err) {
      const errorMsg = (err as Error).message;
      setFailedUrls((prev) => new Map(prev).set(bookmark.url, errorMsg));
      setStatus((s) => ({
        ...s,
        isRunning: false,
        errors: [...s.errors, `${bookmark.url}: ${errorMsg}`],
      }));
    }
  };

  // Process enrichment queue
  // biome-ignore lint/correctness/useExhaustiveDependencies: bookmarks and enrichSpecificBookmark are stable references
  React.useEffect(() => {
    if (status.isRunning || enrichQueue.length === 0) return;

    const nextUrl = enrichQueue[0];
    const bookmark = bookmarks.find((b) => b.url === nextUrl);

    // Remove from queue
    setEnrichQueue((prev) => prev.slice(1));

    if (bookmark) {
      // Start enriching (works for both new and re-enrichment)
      enrichSpecificBookmark(bookmark);
    }
    // If bookmark not found, it's already removed from queue
  }, [enrichQueue, status.isRunning]);

  // Auto-enrich when selecting an unenriched row (dev only)
  // biome-ignore lint/correctness/useExhaustiveDependencies: only trigger on selectedRowIndex change
  React.useEffect(() => {
    if (!isDev) return; // Only auto-enrich in development
    if (
      selectedRowIndex === null ||
      status.isRunning ||
      modalState ||
      deleteConfirm
    )
      return;

    const bookmark = filtered[selectedRowIndex];
    if (bookmark && !bookmark.classified_at) {
      queueEnrichment(bookmark.url);
    }
  }, [selectedRowIndex]);

  // Start enrichment with optional specific bookmarks (for re-enrichment)
  const startEnrichment = async (
    limit = 10,
    specificBookmarks?: Bookmark[],
  ) => {
    abortRef.current = false;
    const toEnrich = specificBookmarks
      ? specificBookmarks.slice(0, limit)
      : unenriched.slice(0, limit);

    // Determine what we're running
    const runningSteps: string[] = [];
    if (enrichSteps.research) runningSteps.push("Research");
    if (enrichSteps.content) runningSteps.push("Content");
    if (enrichSteps.analysis) runningSteps.push("Analysis");
    const stepLabel = runningSteps.join(" + ") || "Nothing";

    setStatus({
      isRunning: true,
      current: null,
      currentStep: 0,
      stepMessage: `Initializing (${stepLabel})...`,
      processed: 0,
      total: toEnrich.length,
      errors: [],
      lastResult: null,
    });

    // Batch save queue - collect enriched bookmarks and flush in batches
    const SAVE_BATCH_SIZE = 10;
    const pendingSaves: EnrichmentResult[] = [];
    let isFlushing = false;

    // Flush pending saves to the batch-update endpoint
    const flushSaves = async (force = false): Promise<void> => {
      if (isFlushing || (pendingSaves.length < SAVE_BATCH_SIZE && !force)) {
        return;
      }
      if (pendingSaves.length === 0) return;

      isFlushing = true;
      const toSave = pendingSaves.splice(0, SAVE_BATCH_SIZE);
      console.log(`[Batch] Flushing ${toSave.length} bookmarks...`);

      try {
        const res = await withRetry(async () => {
          const response = await fetch("/api/bookmarks/batch-update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bookmarks: toSave }),
          });

          if (!response.ok) {
            const errorBody = await response.text();
            console.error(
              "[Batch] Error response:",
              response.status,
              errorBody,
            );
            throw new Error(
              `Batch save failed (${response.status}): ${errorBody.slice(0, 100)}`,
            );
          }

          return response.json();
        });

        // Process results
        const { results } = res as {
          results: Array<{
            url: string;
            success: boolean;
            error?: string;
            data?: Record<string, unknown>;
          }>;
        };

        for (const result of results) {
          if (result.success && result.data) {
            const lightBookmark = toBookmarkLight(
              result.data as unknown as FullBookmark,
            );
            setBookmarks((prev) =>
              prev.map((b) =>
                b.url === lightBookmark.url ? lightBookmark : b,
              ),
            );
            setStatus((s) => ({
              ...s,
              lastResult: `✓ ${result.data?.title || result.url}`,
            }));
          } else if (!result.success) {
            setFailedUrls((prev) =>
              new Map(prev).set(result.url, result.error || "Unknown error"),
            );
            setStatus((s) => ({
              ...s,
              errors: [...s.errors, `${result.url}: ${result.error}`],
            }));
          }
        }

        console.log(
          `[Batch] Saved ${results.filter((r) => r.success).length}/${results.length}`,
        );
      } catch (err) {
        console.error("[Batch] Flush error:", err);
        // Mark all as failed
        for (const bookmark of toSave) {
          setFailedUrls((prev) =>
            new Map(prev).set(bookmark.url, (err as Error).message),
          );
          setStatus((s) => ({
            ...s,
            errors: [...s.errors, `${bookmark.url}: ${(err as Error).message}`],
          }));
        }
      } finally {
        isFlushing = false;
        // Check if more pending saves need flushing
        if (pendingSaves.length >= SAVE_BATCH_SIZE) {
          void flushSaves();
        }
      }
    };

    // Process in parallel with limited concurrency
    const processBookmark = async (bookmark: Bookmark): Promise<void> => {
      if (abortRef.current) return;

      const bookmarkName = bookmark.title || bookmark.url;
      setActiveWorkers((prev) => new Set(prev).add(bookmark.url));
      setStatus((s) => ({
        ...s,
        current: `${s.processed + 1}/${s.total}: ${bookmarkName}`,
        stepMessage: `Processing ${activeWorkers.size + 1} bookmarks...`,
      }));

      try {
        // If we're skipping research or content but doing analysis, we need existing data
        let existingData: { research?: string; content?: string } | undefined;
        if (
          enrichSteps.analysis &&
          (!enrichSteps.research || !enrichSteps.content)
        ) {
          // Fetch existing content from the modal cache or API
          const { getBookmarkContent } = await import("../../lib/supabase");
          const content = await getBookmarkContent(bookmark.url);
          if (content) {
            existingData = {
              research: content.perplexity_research || undefined,
              content: content.firecrawl_content || undefined,
            };
          }
        }

        const enrichedBookmark = await enrichBookmark(
          bookmark,
          () => {
            // Individual step updates not shown in parallel mode
          },
          {
            runResearch: enrichSteps.research,
            runContent: enrichSteps.content,
            runAnalysis: enrichSteps.analysis,
          },
          existingData,
        );

        // Add to batch queue instead of saving immediately
        pendingSaves.push(enrichedBookmark);
        setStatus((s) => ({
          ...s,
          processed: s.processed + 1,
          stepMessage: `Enriched (${pendingSaves.length} pending save)...`,
        }));

        // Trigger batch flush if we have enough
        void flushSaves();
      } catch (err) {
        const errorMsg = (err as Error).message;
        setFailedUrls((prev) => new Map(prev).set(bookmark.url, errorMsg));
        setStatus((s) => ({
          ...s,
          processed: s.processed + 1,
          errors: [...s.errors, `${bookmark.url}: ${errorMsg}`],
        }));
      } finally {
        setActiveWorkers((prev) => {
          const next = new Set(prev);
          next.delete(bookmark.url);
          return next;
        });
      }
    };

    // Process with parallelCount concurrent workers
    const queue = [...toEnrich];
    const workers: Promise<void>[] = [];

    const startWorker = async (): Promise<void> => {
      while (queue.length > 0 && !abortRef.current) {
        const bookmark = queue.shift();
        if (bookmark) {
          try {
            await processBookmark(bookmark);
          } catch (err) {
            // Safety catch - should never reach here but ensures worker continues
            console.error("[Worker] Unhandled error:", err);
            setStatus((s) => ({
              ...s,
              processed: s.processed + 1,
              errors: [...s.errors, `${bookmark.url}: Unhandled error`],
            }));
          }
        }
      }
    };

    // Start parallelCount workers with staggered delay to avoid thundering herd
    for (let i = 0; i < Math.min(parallelCount, toEnrich.length); i++) {
      // Stagger worker starts by 500ms each
      if (i > 0) {
        await new Promise((r) => setTimeout(r, 500));
      }
      workers.push(startWorker());
    }

    await Promise.all(workers);

    // Final flush - save any remaining pending bookmarks
    if (pendingSaves.length > 0) {
      setStatus((s) => ({
        ...s,
        stepMessage: `Saving ${pendingSaves.length} remaining...`,
      }));
      await flushSaves(true);
      // Keep flushing until all are saved
      while (pendingSaves.length > 0) {
        await new Promise((r) => setTimeout(r, 100));
        await flushSaves(true);
      }
    }

    setStatus((s) => ({
      ...s,
      isRunning: false,
      current: null,
      stepMessage: abortRef.current ? "Stopped" : "Complete!",
    }));
  };

  const stopEnrichment = () => {
    abortRef.current = true;
    setStatus((s) => ({ ...s, stepMessage: "Stopping..." }));
  };

  // Import a new URL and trigger enrichment
  const importNewUrl = async () => {
    const url = newUrlInput.trim();
    if (!url) return;

    // Validate URL
    try {
      new URL(url);
    } catch {
      setStatus((s) => ({
        ...s,
        errors: [...s.errors, `Invalid URL: ${url}`],
      }));
      return;
    }

    // Check if URL already exists locally
    if (bookmarks.some((b) => b.url === url)) {
      setStatus((s) => ({
        ...s,
        errors: [...s.errors, `URL already exists: ${url}`],
      }));
      return;
    }

    setImportingUrl(true);

    try {
      // Check for duplicates in database BEFORE any analysis
      const checkRes = await fetch("/api/bookmarks/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (checkData.exists) {
          setStatus((s) => ({
            ...s,
            errors: [...s.errors, `URL already exists in database: ${url}`],
          }));
          setImportingUrl(false);
          return;
        }
      }

      setNewUrlInput("");

      // First, add the URL to the database
      const addRes = await fetch("/api/bookmarks/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!addRes.ok) {
        const errText = await addRes.text();
        throw new Error(`Failed to add URL: ${errText}`);
      }

      // Create a temporary bookmark object for enrichment
      const tempBookmark: Bookmark = {
        id: 0, // Temporary ID
        url,
        title: null,
        description: null,
        stars: null,
        icon: null,
        classified_at: null,
        published_at: null,
        tags: [],
      };

      // Add to local state immediately
      setBookmarks((prev) => [tempBookmark, ...prev]);

      // Trigger enrichment
      setStatus({
        isRunning: true,
        current: url,
        currentStep: 0,
        stepMessage: "Starting enrichment...",
        processed: 0,
        total: 1,
        errors: [],
        lastResult: null,
      });

      const enrichedBookmark = await enrichBookmark(
        tempBookmark,
        (stepNum, message) => {
          setStatus((s) => ({
            ...s,
            currentStep: stepNum,
            stepMessage: message,
          }));
        },
        {
          runResearch: enrichSteps.research,
          runContent: enrichSteps.content,
          runAnalysis: enrichSteps.analysis,
        },
      );

      // Save the enriched bookmark
      const saveRes = await fetch("/api/bookmarks/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(enrichedBookmark),
      });

      if (!saveRes.ok) {
        throw new Error(`Failed to save enriched bookmark: ${saveRes.status}`);
      }

      // Update local state with enriched data
      setBookmarks((prev) =>
        prev.map((b) =>
          b.url === url
            ? {
                ...b,
                title: enrichedBookmark.title,
                description: enrichedBookmark.description,
                icon: enrichedBookmark.icon,
                stars: enrichedBookmark.stars,
                classified_at: enrichedBookmark.classified_at,
                published_at: enrichedBookmark.published_at,
                tags: enrichedBookmark.tags,
              }
            : b,
        ),
      );

      // Clear the bookmark cache
      clearBookmarkCache();

      setStatus((s) => ({
        ...s,
        isRunning: false,
        processed: 1,
        stepMessage: "Done!",
        lastResult: `✓ ${url}`,
      }));
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setStatus((s) => ({
        ...s,
        isRunning: false,
        errors: [...s.errors, `Import failed: ${errMsg}`],
      }));
    } finally {
      setImportingUrl(false);
    }
  };

  if (loading) {
    return (
      <div className="container py-16 text-center">
        <div
          className="inline-block animate-spin rounded-full h-8 w-8 border-2"
          style={{
            borderColor: "var(--color-border)",
            borderTopColor: "var(--color-accent)",
          }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-16 text-center">
        <p style={{ color: "#ef4444" }}>Error: {error}</p>
      </div>
    );
  }

  // Get enriched bookmarks sorted by oldest classified_at for re-enrichment
  // Always use filtered list when any filter is active
  const hasActiveFilter =
    search ||
    trackFilter ||
    techFilter ||
    typeFilter ||
    platformFilter ||
    starsFilter;
  const enrichedForReEnrich = (
    hasActiveFilter || sortBy === "enriched"
      ? filtered.filter((b) => b.classified_at)
      : enriched.slice()
  ).sort((a, b) => {
    const aDate = a.classified_at ? new Date(a.classified_at).getTime() : 0;
    const bDate = b.classified_at ? new Date(b.classified_at).getTime() : 0;
    return aDate - bDate; // Oldest first
  });

  return (
    <div className="container py-8">
      <PageHeader
        title="Bookmarks"
        subtitle={
          isDev
            ? `${bookmarks.length} links · ${enriched.length} enriched · ${unenriched.length} pending`
            : `${enriched.length} curated links`
        }
      />

      {/* Sticky Enrichment Workflow Panel - only in development */}
      {isDev && (
        <div
          className="sticky z-30 -mx-4 px-4 pb-3 pt-2 mb-4"
          style={{
            top: "57px", // Below the nav menu
            backgroundColor: "var(--color-bg)",
          }}
        >
          <div
            className="p-3 rounded-xl"
            style={{
              backgroundColor: "var(--color-bg-secondary)",
              border: `2px solid ${status.isRunning ? "var(--color-accent)" : "var(--color-border)"}`,
            }}
          >
            <div className="flex flex-wrap items-center gap-4">
              {/* Title + Status */}
              <div className="flex items-center gap-3">
                <span
                  className="text-lg font-semibold"
                  style={{ color: "var(--color-fg)" }}
                >
                  🔬 Enrichment
                </span>
                {status.isRunning && (
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium animate-pulse"
                    style={{ backgroundColor: "#f5930030", color: "#f59300" }}
                  >
                    {status.processed}/{status.total}
                  </span>
                )}
              </div>

              {/* Step Checkboxes */}
              <div className="flex items-center gap-3 border-l border-[var(--color-border)] pl-4">
                <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={enrichSteps.research}
                    onChange={(e) =>
                      setEnrichSteps((s) => ({
                        ...s,
                        research: e.target.checked,
                      }))
                    }
                    className="w-3.5 h-3.5 rounded accent-[var(--color-accent)]"
                  />
                  <span style={{ color: "var(--color-fg-muted)" }}>
                    Research
                  </span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={enrichSteps.content}
                    onChange={(e) =>
                      setEnrichSteps((s) => ({
                        ...s,
                        content: e.target.checked,
                      }))
                    }
                    className="w-3.5 h-3.5 rounded accent-[var(--color-accent)]"
                  />
                  <span style={{ color: "var(--color-fg-muted)" }}>
                    Content
                  </span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={enrichSteps.analysis}
                    onChange={(e) =>
                      setEnrichSteps((s) => ({
                        ...s,
                        analysis: e.target.checked,
                      }))
                    }
                    className="w-3.5 h-3.5 rounded accent-[var(--color-accent)]"
                  />
                  <span style={{ color: "var(--color-fg-muted)" }}>
                    Analysis
                  </span>
                </label>
              </div>

              {/* Batch + Parallel Controls */}
              {!status.isRunning && (
                <div className="flex items-center gap-3 border-l border-[var(--color-border)] pl-4">
                  <div className="flex items-center gap-1.5">
                    <label
                      htmlFor="batch-input"
                      className="text-xs"
                      style={{ color: "var(--color-fg-muted)" }}
                    >
                      Batch:
                    </label>
                    <input
                      id="batch-input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      defaultValue={batchSize}
                      key={`batch-${batchSize}`}
                      onBlur={(e) => {
                        const v = Number.parseInt(e.target.value) || 5;
                        setBatchSize(Math.max(1, Math.min(500, v)));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.currentTarget.blur();
                        }
                      }}
                      className="w-12 px-1.5 py-1 rounded text-xs text-center font-medium"
                      style={{
                        backgroundColor: "var(--color-bg)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-fg)",
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <label
                      htmlFor="parallel-input"
                      className="text-xs"
                      style={{ color: "var(--color-fg-muted)" }}
                    >
                      Parallel:
                    </label>
                    <input
                      id="parallel-input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      defaultValue={parallelCount}
                      key={`parallel-${parallelCount}`}
                      onBlur={(e) => {
                        const v = Number.parseInt(e.target.value) || 3;
                        setParallelCount(Math.max(1, Math.min(10, v)));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.currentTarget.blur();
                        }
                      }}
                      className="w-12 px-1.5 py-1 rounded text-xs text-center font-medium"
                      style={{
                        backgroundColor: "var(--color-bg)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-fg)",
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 ml-auto">
                {!status.isRunning ? (
                  <>
                    {/* Enrich New */}
                    <button
                      type="button"
                      onClick={() => startEnrichment(batchSize)}
                      disabled={unenriched.length === 0}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105"
                      style={{
                        backgroundColor:
                          unenriched.length > 0
                            ? "var(--color-accent)"
                            : "var(--color-bg)",
                        color:
                          unenriched.length > 0
                            ? "#000"
                            : "var(--color-fg-muted)",
                      }}
                      title={`Enrich ${Math.min(batchSize, unenriched.length)} new bookmarks`}
                    >
                      🚀 New ({unenriched.length})
                    </button>
                    {/* Re-enrich */}
                    <button
                      type="button"
                      onClick={() =>
                        startEnrichment(batchSize, enrichedForReEnrich)
                      }
                      disabled={enrichedForReEnrich.length === 0}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105"
                      style={{
                        backgroundColor:
                          enrichedForReEnrich.length > 0
                            ? "#8b5cf6"
                            : "var(--color-bg)",
                        color:
                          enrichedForReEnrich.length > 0
                            ? "#fff"
                            : "var(--color-fg-muted)",
                      }}
                      title={`Re-enrich ${Math.min(batchSize, enrichedForReEnrich.length)} oldest enriched`}
                    >
                      🔄 Re-enrich
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={stopEnrichment}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105"
                    style={{ backgroundColor: "#ef4444", color: "white" }}
                  >
                    ⏹ Stop
                  </button>
                )}
              </div>
            </div>

            {/* Import URL Row */}
            {!status.isRunning && (
              <div
                className="mt-3 pt-3 border-t flex items-center gap-3"
                style={{ borderColor: "var(--color-border)" }}
              >
                <span
                  className="text-xs font-medium"
                  style={{ color: "var(--color-fg-muted)" }}
                >
                  Import:
                </span>
                <input
                  type="url"
                  placeholder="Paste URL to add..."
                  value={newUrlInput}
                  onChange={(e) => setNewUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newUrlInput.trim()) {
                      importNewUrl();
                    }
                  }}
                  disabled={importingUrl}
                  className="flex-1 max-w-md px-3 py-1.5 rounded-lg text-sm"
                  style={{
                    backgroundColor: "var(--color-bg)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-fg)",
                  }}
                />
                <button
                  type="button"
                  onClick={importNewUrl}
                  disabled={!newUrlInput.trim() || importingUrl}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105"
                  style={{
                    backgroundColor:
                      newUrlInput.trim() && !importingUrl
                        ? "#10b981"
                        : "var(--color-bg)",
                    color:
                      newUrlInput.trim() && !importingUrl
                        ? "#fff"
                        : "var(--color-fg-muted)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  {importingUrl ? "Importing..." : "➕ Add & Enrich"}
                </button>
              </div>
            )}

            {/* Progress + Errors (collapsible when running) */}
            {status.isRunning && (
              <div
                className="mt-3 pt-3 border-t text-sm flex items-center gap-4"
                style={{ borderColor: "var(--color-border)" }}
              >
                <span style={{ color: "var(--color-fg)" }}>
                  {status.current}
                </span>
                <span style={{ color: "var(--color-fg-muted)" }}>
                  {status.stepMessage}
                </span>
                {status.errors.length > 0 && (
                  <span className="text-red-400 text-xs">
                    {status.errors.length} errors
                  </span>
                )}
              </div>
            )}

            {/* Errors detail (after completion) */}
            {!status.isRunning && status.errors.length > 0 && (
              <details className="mt-2">
                <summary className="text-xs cursor-pointer text-red-400">
                  {status.errors.length} error(s) - click to view
                </summary>
                <div
                  className="mt-1 p-2 rounded text-xs max-h-24 overflow-y-auto"
                  style={{ backgroundColor: "var(--color-bg)" }}
                >
                  {status.errors.map((err) => (
                    <div key={err} className="text-red-400">
                      {err}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-xs">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2 rounded-lg text-sm w-full"
            style={{
              backgroundColor: "var(--color-bg-secondary)",
              border: "1px solid var(--color-border)",
              color: "var(--color-fg)",
            }}
          />
          {searching && (
            <span
              className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2"
              style={{ color: "var(--color-accent)" }}
            >
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </span>
          )}
        </div>

        {isDev && (
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlyUnenriched}
              onChange={(e) => setShowOnlyUnenriched(e.target.checked)}
              className="rounded"
            />
            <span style={{ color: "var(--color-fg-muted)" }}>
              Unenriched only ({unenriched.length})
            </span>
          </label>
        )}
      </div>

      {/* Match Type Filter - only shows when searching */}
      {search && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span
            className="text-xs py-1"
            style={{ color: "var(--color-fg-muted)" }}
          >
            Match in:
          </span>
          {(["all", "content", "research", "insight"] as const).map((type) => {
            const isActive = matchTypeFilter === type;
            const labels = {
              all: "All",
              content: "🌐 Content",
              research: "🔬 Research",
              insight: "💡 Insight",
            };
            const colors = {
              all: "#6b7280",
              content: "#06b6d4",
              research: "#3b82f6",
              insight: "#8b5cf6",
            };
            return (
              <button
                key={type}
                type="button"
                onClick={() => setMatchTypeFilter(type)}
                className="px-2 py-0.5 rounded text-xs font-medium transition-all"
                style={{
                  backgroundColor: isActive
                    ? `${colors[type]}20`
                    : "var(--color-bg-secondary)",
                  color: isActive ? colors[type] : "var(--color-fg-muted)",
                  border: `1px solid ${isActive ? colors[type] : "var(--color-border)"}`,
                }}
              >
                {labels[type]}
              </button>
            );
          })}
          <span
            className="text-xs ml-2"
            style={{ color: "var(--color-fg-muted)" }}
          >
            ({filtered.length} results)
          </span>
        </div>
      )}

      {/* Audience Filters */}
      <div className="flex flex-wrap gap-2 mb-3">
        <span
          className="text-xs py-1"
          style={{ color: "var(--color-fg-muted)" }}
        >
          Audience:
        </span>
        {(["mcp", "founder", "investor"] as const).map((track) => (
          <button
            type="button"
            key={track}
            onClick={() => setTrackFilter(track === trackFilter ? null : track)}
            className="px-3 py-1 rounded-full text-xs font-medium transition-all"
            style={{
              backgroundColor:
                trackFilter === track
                  ? `${TRACK_CONFIG[track].color}30`
                  : "var(--color-bg-secondary)",
              color:
                trackFilter === track
                  ? TRACK_CONFIG[track].color
                  : "var(--color-fg-muted)",
              border: `1px solid ${trackFilter === track ? TRACK_CONFIG[track].color : "var(--color-border)"}`,
            }}
          >
            {TRACK_CONFIG[track].icon} {TRACK_CONFIG[track].label} (
            {trackCounts[track]})
          </button>
        ))}
      </div>

      {/* Tech Stack Filters */}
      {allSortedTechTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          <span
            className="text-xs py-1"
            style={{ color: "var(--color-fg-muted)" }}
          >
            Tech:
          </span>
          {sortedTechTags.map((tech) => (
            <button
              type="button"
              key={tech}
              onClick={() => setTechFilter(tech === techFilter ? null : tech)}
              className="px-2 py-0.5 rounded text-xs font-medium transition-all"
              style={{
                backgroundColor:
                  techFilter === tech
                    ? "#6366f130"
                    : "var(--color-bg-secondary)",
                color:
                  techFilter === tech ? "#6366f1" : "var(--color-fg-muted)",
                border: `1px solid ${techFilter === tech ? "#6366f1" : "var(--color-border)"}`,
              }}
            >
              {tech} ({techTagCounts[tech]})
            </button>
          ))}
          {hasMoreTechTags && (
            <button
              type="button"
              onClick={() => setShowAllTechTags(!showAllTechTags)}
              className="px-2 py-0.5 rounded text-xs font-medium transition-all"
              style={{
                backgroundColor: "transparent",
                color: "var(--color-accent)",
                border: "1px dashed var(--color-border)",
              }}
            >
              {showAllTechTags
                ? "show less"
                : `+${allSortedTechTags.length - 15} more...`}
            </button>
          )}
        </div>
      )}

      {/* Content Type Filters */}
      {allSortedTypeTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          <span
            className="text-xs py-1"
            style={{ color: "var(--color-fg-muted)" }}
          >
            Type:
          </span>
          {sortedTypeTags.map((type) => (
            <button
              type="button"
              key={type}
              onClick={() => setTypeFilter(type === typeFilter ? null : type)}
              className="px-2 py-0.5 rounded text-xs font-medium transition-all"
              style={{
                backgroundColor:
                  typeFilter === type
                    ? "#f5930030"
                    : "var(--color-bg-secondary)",
                color:
                  typeFilter === type ? "#f59300" : "var(--color-fg-muted)",
                border: `1px solid ${typeFilter === type ? "#f59300" : "var(--color-border)"}`,
              }}
            >
              {type} ({typeTagCounts[type]})
            </button>
          ))}
          {hasMoreTypeTags && (
            <button
              type="button"
              onClick={() => setShowAllTypeTags(!showAllTypeTags)}
              className="px-2 py-0.5 rounded text-xs font-medium transition-all"
              style={{
                backgroundColor: "transparent",
                color: "var(--color-accent)",
                border: "1px dashed var(--color-border)",
              }}
            >
              {showAllTypeTags
                ? "show less"
                : `+${allSortedTypeTags.length - 15} more...`}
            </button>
          )}
        </div>
      )}

      {/* Platform Filters */}
      {allSortedPlatforms.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          <span
            className="text-xs py-1"
            style={{ color: "var(--color-fg-muted)" }}
          >
            Platform:
          </span>
          {sortedPlatforms.map((platform) => (
            <button
              type="button"
              key={platform}
              onClick={() =>
                setPlatformFilter(platform === platformFilter ? null : platform)
              }
              className="px-2 py-0.5 rounded text-xs font-medium transition-all"
              style={{
                backgroundColor:
                  platformFilter === platform
                    ? "#10b98130"
                    : "var(--color-bg-secondary)",
                color:
                  platformFilter === platform
                    ? "#10b981"
                    : "var(--color-fg-muted)",
                border: `1px solid ${platformFilter === platform ? "#10b981" : "var(--color-border)"}`,
              }}
            >
              {platform} ({platformCounts[platform]})
            </button>
          ))}
          {hasMorePlatforms && (
            <button
              type="button"
              onClick={() => setShowAllPlatforms(!showAllPlatforms)}
              className="px-2 py-0.5 rounded text-xs font-medium transition-all"
              style={{
                backgroundColor: "transparent",
                color: "var(--color-accent)",
                border: "1px dashed var(--color-border)",
              }}
            >
              {showAllPlatforms
                ? "show less"
                : `+${allSortedPlatforms.length - 15} more...`}
            </button>
          )}
        </div>
      )}

      {/* Rating Filter & Sort */}
      <div className="flex flex-wrap gap-4 mb-6 items-center">
        <div className="flex items-center gap-2">
          <span
            className="text-xs py-1"
            style={{ color: "var(--color-fg-muted)" }}
          >
            Stars:
          </span>
          {[1, 2, 3, 4, 5].map((stars) => (
            <button
              type="button"
              key={stars}
              onClick={() =>
                setStarsFilter(starsFilter === stars ? null : stars)
              }
              className="px-2 py-0.5 rounded text-xs font-medium transition-all"
              style={{
                backgroundColor:
                  starsFilter === stars
                    ? "#eab30830"
                    : "var(--color-bg-secondary)",
                color:
                  starsFilter === stars ? "#eab308" : "var(--color-fg-muted)",
                border: `1px solid ${starsFilter === stars ? "#eab308" : "var(--color-border)"}`,
              }}
            >
              {"⭐".repeat(stars)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span
            className="text-xs py-1 mr-1"
            style={{ color: "var(--color-fg-muted)" }}
          >
            Sort:
          </span>
          {(["published", "rating", "enriched", "alpha", "none"] as const).map(
            (option) => {
              const isActive = sortBy === option;
              const labels = {
                published: "📅",
                rating: "⭐",
                enriched: "🔄",
                alpha: "A-Z",
                none: "—",
              };
              const titles = {
                published: "Sort by recently published",
                rating: "Sort by rating",
                enriched: "Sort by oldest enriched (for re-enrichment)",
                alpha: "Sort alphabetically",
                none: "No sorting",
              };
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSortBy(option)}
                  className="px-2 py-0.5 rounded text-xs font-medium transition-all cursor-pointer"
                  style={{
                    backgroundColor: isActive
                      ? "#8b5cf630"
                      : "var(--color-bg-secondary)",
                    color: isActive ? "#8b5cf6" : "var(--color-fg-muted)",
                    border: `1px solid ${isActive ? "#8b5cf6" : "var(--color-border)"}`,
                  }}
                  title={titles[option]}
                >
                  {labels[option]}
                </button>
              );
            },
          )}
        </div>
      </div>

      {/* Table */}
      <div className="relative">
        {/* Search overlay */}
        <div
          className="absolute inset-0 z-10 pointer-events-none transition-opacity duration-200"
          style={{
            backgroundColor: "var(--color-bg)",
            opacity: searching ? 0.6 : 0,
          }}
        />
        {searching && (
          <div className="absolute inset-0 z-20 flex items-start justify-center pt-24 pointer-events-none">
            <div
              className="flex items-center gap-3 px-4 py-2 rounded-lg"
              style={{
                backgroundColor: "var(--color-bg-secondary)",
                border: "1px solid var(--color-border)",
              }}
            >
              <svg
                className="animate-spin h-5 w-5"
                style={{ color: "var(--color-accent)" }}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span
                className="text-sm font-medium"
                style={{ color: "var(--color-fg)" }}
              >
                Searching...
              </span>
            </div>
          </div>
        )}
        {/* Mobile Card Layout */}
        <div className="lg:hidden space-y-3">
          {filtered.map((bookmark, i) => {
            const isProcessing =
              status.current === bookmark.title ||
              status.current === bookmark.url;
            const errorMessage = failedUrls.get(bookmark.url);
            const hasFailed = !!errorMessage;

            return (
              <button
                type="button"
                key={`mobile-${bookmark.url}-${i}`}
                className="rounded-xl p-4 cursor-pointer active:scale-[0.98] transition-transform w-full text-left"
                style={{
                  backgroundColor: hasFailed
                    ? "rgba(239, 68, 68, 0.1)"
                    : "var(--color-bg-secondary)",
                  border: hasFailed
                    ? "2px solid rgba(239, 68, 68, 0.5)"
                    : "1px solid var(--color-border)",
                }}
                onClick={() => {
                  setSelectedRowIndex(i);
                  openModal(bookmark.url);
                }}
              >
                <div className="flex gap-3">
                  <span className="text-2xl">{bookmark.icon || "🔗"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="font-semibold truncate"
                        style={{ color: "var(--color-fg)" }}
                      >
                        {bookmark.title || new URL(bookmark.url).hostname}
                      </span>
                      {bookmark.classified_at && (
                        <span className="shrink-0">
                          <StarRating stars={bookmark.stars} />
                        </span>
                      )}
                    </div>
                    <p
                      className="text-sm mt-1 line-clamp-2"
                      style={{ color: "var(--color-fg-muted)" }}
                    >
                      {bookmark.description}
                    </p>
                    <a
                      href={bookmark.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs mt-2 truncate block"
                      style={{ color: "var(--color-accent)" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {bookmark.url}
                    </a>
                    {bookmark.classified_at && (
                      <div className="flex gap-2 mt-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openModal(bookmark.url, "dev");
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-xs"
                          style={{
                            backgroundColor: "#8b5cf620",
                            color: "#8b5cf6",
                          }}
                        >
                          🔌 Dev
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openModal(bookmark.url, "founder");
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-xs"
                          style={{
                            backgroundColor: "#f5930020",
                            color: "#f59300",
                          }}
                        >
                          🚀 Founder
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openModal(bookmark.url, "investor");
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-xs"
                          style={{
                            backgroundColor: "#10b98120",
                            color: "#10b981",
                          }}
                        >
                          💰 Investor
                        </button>
                      </div>
                    )}
                    {isProcessing && (
                      <span
                        className="inline-block mt-2 px-2 py-0.5 rounded text-xs animate-pulse"
                        style={{
                          backgroundColor: "#f5930020",
                          color: "#f59300",
                        }}
                      >
                        Processing...
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Desktop Table Layout */}
        <div
          className="rounded-lg overflow-hidden hidden lg:block"
          style={{
            backgroundColor: "var(--color-bg-secondary)",
            border: "1px solid var(--color-border)",
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ tableLayout: "fixed" }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: "var(--color-bg)",
                    borderBottom: "1px solid var(--color-border)",
                  }}
                >
                  <th
                    className="text-left p-3 font-medium"
                    style={{ width: "40px" }}
                  />
                  <th
                    className="text-left p-3 font-medium"
                    style={{ width: "300px", maxWidth: "300px" }}
                  >
                    Content
                  </th>
                  <th
                    className="text-center p-3 font-medium"
                    style={{ width: "80px" }}
                  >
                    Rating
                  </th>
                  <th className="text-left p-3 pl-6 font-medium">Insights</th>
                  <th
                    className="text-center p-3 font-medium"
                    style={{ width: "100px" }}
                  >
                    Published
                  </th>
                  <th
                    className="text-center p-3 font-medium"
                    style={{ width: "100px" }}
                  >
                    Analyzed
                  </th>
                  {isDev && (
                    <th
                      className="text-center p-3 font-medium"
                      style={{ width: "80px" }}
                    >
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((bookmark, i) => {
                  const isProcessing =
                    status.current === bookmark.title ||
                    status.current === bookmark.url;
                  const isSelected = selectedRowIndex === i;
                  const errorMessage = failedUrls.get(bookmark.url);
                  const hasFailed = !!errorMessage;

                  return (
                    <tr
                      key={`${bookmark.url}-${i}`}
                      id={`bookmark-row-${i}`}
                      tabIndex={0}
                      className="hover:bg-(--color-bg) transition-colors group cursor-pointer"
                      style={{
                        borderBottom: "1px solid var(--color-border)",
                        backgroundColor: hasFailed
                          ? "rgba(239, 68, 68, 0.1)"
                          : isSelected
                            ? "var(--color-accent-muted, rgba(59, 130, 246, 0.1))"
                            : undefined,
                        outline: hasFailed
                          ? "2px solid rgba(239, 68, 68, 0.5)"
                          : isSelected
                            ? "2px solid var(--color-accent)"
                            : undefined,
                      }}
                      onClick={() => {
                        setSelectedRowIndex(i);
                        openModal(bookmark.url);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedRowIndex(i);
                          openModal(bookmark.url);
                        }
                      }}
                      title={
                        hasFailed
                          ? `Error: ${errorMessage}`
                          : "Click to view insights"
                      }
                    >
                      {/* Icon */}
                      <td className="p-3 text-center">
                        <span className="text-lg">{bookmark.icon || "🔗"}</span>
                      </td>

                      {/* Content: Title + Description + Link + Match Indicators */}
                      <td className="p-3" style={{ maxWidth: "300px" }}>
                        <div className="flex items-center gap-2">
                          <div
                            className="font-medium truncate flex-1"
                            style={{ color: "var(--color-fg)" }}
                          >
                            {bookmark.title || new URL(bookmark.url).hostname}
                          </div>
                        </div>
                        <div
                          className="text-xs mt-0.5 line-clamp-1"
                          style={{ color: "var(--color-fg-muted)" }}
                        >
                          {bookmark.description}
                        </div>
                        <a
                          href={bookmark.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs mt-0.5 truncate block hover:underline"
                          style={{ color: "var(--color-accent)", opacity: 0.7 }}
                        >
                          {bookmark.url}
                        </a>
                        {/* Match type indicators when searching */}
                        {search &&
                          (() => {
                            const matches = matchTypesMap.get(bookmark.url);
                            if (!matches) return null;
                            const indicators: {
                              label: string;
                              color: string;
                            }[] = [];
                            if (matches.content)
                              indicators.push({
                                label: "Content",
                                color: "#06b6d4",
                              });
                            if (matches.research)
                              indicators.push({
                                label: "Research",
                                color: "#3b82f6",
                              });
                            if (matches.insight)
                              indicators.push({
                                label: "Insight",
                                color: "#8b5cf6",
                              });
                            if (indicators.length === 0) return null;
                            return (
                              <div className="flex gap-1 mt-1">
                                {indicators.map((ind) => (
                                  <span
                                    key={ind.label}
                                    className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                                    style={{
                                      backgroundColor: `${ind.color}20`,
                                      color: ind.color,
                                    }}
                                  >
                                    {ind.label} Match
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
                      </td>

                      {/* Rating - clickable for Developer Insight */}
                      <td className="p-3 text-center">
                        {bookmark.classified_at ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRowIndex(i);
                              openModal(bookmark.url);
                            }}
                            className="hover:scale-110 transition-transform cursor-pointer"
                            title="View Developer Insight"
                          >
                            <StarRating stars={bookmark.stars} />
                          </button>
                        ) : isProcessing ? (
                          <span
                            className="px-2 py-0.5 rounded text-xs animate-pulse"
                            style={{
                              backgroundColor: "#f5930020",
                              color: "#f59300",
                            }}
                          >
                            ...
                          </span>
                        ) : (
                          <span className="text-gray-500 text-xs">—</span>
                        )}
                      </td>

                      {/* Insight buttons - shown when bookmark is enriched */}
                      <td className="p-3 pl-6">
                        {bookmark.classified_at ? (
                          <div className="flex gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRowIndex(i);
                                openModal(bookmark.url, "dev");
                              }}
                              className="px-2 py-1 rounded text-xs transition-colors cursor-pointer hover:scale-110"
                              style={{
                                backgroundColor: "#8b5cf620",
                                color: "#8b5cf6",
                              }}
                              title="Dev Insight"
                            >
                              🔌
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRowIndex(i);
                                openModal(bookmark.url, "founder");
                              }}
                              className="px-2 py-1 rounded text-xs transition-colors cursor-pointer hover:scale-110"
                              style={{
                                backgroundColor: "#f5930020",
                                color: "#f59300",
                              }}
                              title="Founder Insight"
                            >
                              🚀
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRowIndex(i);
                                openModal(bookmark.url, "investor");
                              }}
                              className="px-2 py-1 rounded text-xs transition-colors cursor-pointer hover:scale-110"
                              style={{
                                backgroundColor: "#10b98120",
                                color: "#10b981",
                              }}
                              title="Investor Insight"
                            >
                              💰
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRowIndex(i);
                                openModal(bookmark.url, "research");
                              }}
                              className="px-2 py-1 rounded text-xs transition-colors cursor-pointer hover:scale-110"
                              style={{
                                backgroundColor: "#3b82f620",
                                color: "#3b82f6",
                              }}
                              title="Research"
                            >
                              🔬
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRowIndex(i);
                                openModal(bookmark.url, "exa");
                              }}
                              className="px-2 py-1 rounded text-xs transition-colors cursor-pointer hover:scale-110"
                              style={{
                                backgroundColor: "#06b6d420",
                                color: "#06b6d4",
                              }}
                              title="Page Content"
                            >
                              🌐
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-500 text-xs">—</span>
                        )}
                      </td>

                      {/* Published date column */}
                      <td className="p-3 text-center">
                        {bookmark.published_at ? (
                          <span
                            className="text-xs"
                            style={{ color: "var(--color-fg-muted)" }}
                            title={new Date(
                              bookmark.published_at,
                            ).toLocaleString()}
                          >
                            {new Date(bookmark.published_at).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                year: "numeric",
                              },
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-500 text-xs">—</span>
                        )}
                      </td>

                      {/* Analyzed date column */}
                      <td className="p-3 text-center">
                        {bookmark.classified_at ? (
                          <span
                            className="text-xs"
                            style={{ color: "var(--color-fg-muted)" }}
                            title={new Date(
                              bookmark.classified_at,
                            ).toLocaleString()}
                          >
                            {new Date(
                              bookmark.classified_at,
                            ).toLocaleDateString("en-US", {
                              month: "numeric",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        ) : (
                          <span className="text-gray-500 text-xs">—</span>
                        )}
                      </td>

                      {/* Actions column - dev only */}
                      {isDev && (
                        <td className="p-3 text-center">
                          {(() => {
                            const queuePos = enrichQueue.indexOf(bookmark.url);
                            const isCurrentlyEnriching =
                              status.isRunning &&
                              status.current ===
                                (bookmark.title || bookmark.url);
                            const isEnriched = !!bookmark.classified_at;

                            if (isCurrentlyEnriching) {
                              return (
                                <span
                                  className="px-2 py-1 rounded text-xs animate-pulse"
                                  style={{
                                    backgroundColor: "#f59e0b20",
                                    color: "#f59e0b",
                                  }}
                                >
                                  ⏳
                                </span>
                              );
                            }

                            if (queuePos >= 0) {
                              return (
                                <span
                                  className="px-2 py-1 rounded text-xs"
                                  style={{
                                    backgroundColor: "#8b5cf620",
                                    color: "#8b5cf6",
                                  }}
                                  title={`Queue position: ${queuePos + 1}`}
                                >
                                  #{queuePos + 1}
                                </span>
                              );
                            }

                            // Show error state with retry button
                            if (hasFailed) {
                              return (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    queueEnrichment(bookmark.url);
                                  }}
                                  className="px-2 py-1 rounded text-xs transition-colors hover:scale-105 cursor-pointer"
                                  style={{
                                    backgroundColor: "rgba(239, 68, 68, 0.2)",
                                    color: "#ef4444",
                                  }}
                                  title={`Failed: ${errorMessage}\nClick to retry`}
                                >
                                  ⚠️ Retry
                                </button>
                              );
                            }

                            return (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  queueEnrichment(bookmark.url);
                                }}
                                className="px-2 py-1 rounded text-xs transition-colors hover:scale-105 cursor-pointer"
                                style={{
                                  backgroundColor: isEnriched
                                    ? "var(--color-bg-subtle)"
                                    : "var(--color-accent)",
                                  color: isEnriched
                                    ? "var(--color-fg-muted)"
                                    : "#000",
                                  border: isEnriched
                                    ? "1px solid var(--color-border)"
                                    : "none",
                                }}
                                title={
                                  isEnriched
                                    ? "Re-enrich this bookmark"
                                    : "Enrich this bookmark"
                                }
                              >
                                {isEnriched ? "🔄" : "✨"}
                              </button>
                            );
                          })()}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <p style={{ color: "var(--color-fg-muted)" }}>
            No bookmarks match your filters
          </p>
        </div>
      )}

      {/* Stats */}
      {enriched.length > 0 && (
        <div
          className="mt-6 p-4 rounded-lg grid grid-cols-2 md:grid-cols-4 gap-4"
          style={{
            backgroundColor: "var(--color-bg-secondary)",
            border: "1px solid var(--color-border)",
          }}
        >
          <div>
            <div
              className="text-2xl font-bold"
              style={{ color: "var(--color-fg)" }}
            >
              {(
                enriched.reduce((sum, b) => sum + (b.stars || 0), 0) /
                enriched.length
              ).toFixed(1)}
              ⭐
            </div>
            <div className="text-xs" style={{ color: "var(--color-fg-muted)" }}>
              Avg Rating
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold" style={{ color: "#8b5cf6" }}>
              {
                enriched.filter((b) => hasTag(b.tags, "persona:mcp_developer"))
                  .length
              }
            </div>
            <div className="text-xs" style={{ color: "var(--color-fg-muted)" }}>
              MCP Developer
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold" style={{ color: "#f59300" }}>
              {
                enriched.filter((b) =>
                  hasTag(b.tags, "persona:startup_founder"),
                ).length
              }
            </div>
            <div className="text-xs" style={{ color: "var(--color-fg-muted)" }}>
              Startup Founder
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold" style={{ color: "#10b981" }}>
              {
                enriched.filter((b) => hasTag(b.tags, "persona:vc_investor"))
                  .length
              }
            </div>
            <div className="text-xs" style={{ color: "var(--color-fg-muted)" }}>
              VC Investor
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
          onClick={() => setDeleteConfirm(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setDeleteConfirm(null);
          }}
        >
          <dialog
            ref={(el) => el?.focus()}
            open
            tabIndex={-1}
            className="max-w-md w-full rounded-xl p-6 m-0 outline-none"
            style={{
              backgroundColor: "var(--color-bg)",
              border: "2px solid #ef4444",
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") setDeleteConfirm(null);
            }}
          >
            <h3 className="text-xl font-bold mb-2" style={{ color: "#ef4444" }}>
              🗑️ Delete Bookmark?
            </h3>
            <p className="mb-4" style={{ color: "var(--color-fg-muted)" }}>
              Are you sure you want to delete this bookmark?
            </p>
            <div
              className="p-3 rounded-lg mb-4 truncate"
              style={{ backgroundColor: "var(--color-bg-secondary)" }}
            >
              <div className="font-medium" style={{ color: "var(--color-fg)" }}>
                {deleteConfirm.title}
              </div>
              <div
                className="text-sm truncate"
                style={{ color: "var(--color-fg-muted)" }}
              >
                {deleteConfirm.url}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: "var(--color-bg-secondary)",
                  color: "var(--color-fg)",
                  border: "1px solid var(--color-border)",
                }}
              >
                Cancel (Esc)
              </button>
              <button
                type="button"
                onClick={() => deleteBookmark(deleteConfirm.url)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: "#ef4444",
                  color: "#fff",
                }}
              >
                Delete (Enter)
              </button>
            </div>
          </dialog>
        </div>
      )}

      {/* Bookmark Modal */}
      {modalBookmark && modalState && (
        <BookmarkModal
          bookmark={{
            url: modalBookmark.url,
            title: modalBookmark.title,
            icon: modalBookmark.icon,
            published_at: modalBookmark.published_at,
            classified_at: modalBookmark.classified_at,
            tags: modalBookmark.tags,
          }}
          initialTab={modalState.tab}
          onClose={closeModal}
          onNavigateBookmark={(direction) => {
            const list = filteredRef.current;
            const currentIdx = list.findIndex(
              (b) => b.url === modalBookmark.url,
            );
            if (direction === "next") {
              const nextIdx = currentIdx + 1;
              const nextBookmark = list[nextIdx];
              if (nextIdx < list.length && nextBookmark) {
                setSelectedRowIndex(nextIdx);
                setModalState({ url: nextBookmark.url, tab: modalState.tab });
              }
            } else {
              const prevIdx = currentIdx - 1;
              const prevBookmark = list[prevIdx];
              if (prevIdx >= 0 && prevBookmark) {
                setSelectedRowIndex(prevIdx);
                setModalState({ url: prevBookmark.url, tab: modalState.tab });
              }
            }
          }}
          canNavigatePrev={
            filteredRef.current.findIndex((b) => b.url === modalBookmark.url) >
            0
          }
          canNavigateNext={
            filteredRef.current.findIndex((b) => b.url === modalBookmark.url) <
            filteredRef.current.length - 1
          }
        />
      )}

      {/* Clear cache link */}
      <div className="text-center py-6 mt-8">
        <button
          type="button"
          onClick={() => {
            clearBookmarkCache();
            window.location.reload();
          }}
          className="text-xs opacity-30 hover:opacity-60 transition-opacity cursor-pointer"
          style={{ color: "var(--color-fg-muted)" }}
        >
          Clear cached bookmarks
        </button>
      </div>
    </div>
  );
}
