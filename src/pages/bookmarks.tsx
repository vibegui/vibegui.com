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
import { marked } from "marked";
import { PageHeader } from "../components/page-header";
import {
  getAllBookmarks,
  type Bookmark as SupabaseBookmark,
} from "../../lib/supabase";

// Use the Supabase Bookmark type with some optional fields for local state
type Bookmark = SupabaseBookmark;

// Tag type helpers
function getTagsByType(tags: string[] | undefined, type: string): string[] {
  if (!tags) return [];
  const prefix = `${type}:`;
  return tags
    .filter((t) => t.startsWith(prefix))
    .map((t) => t.slice(prefix.length));
}

function hasTag(tags: string[] | undefined, tag: string): boolean {
  return tags?.includes(tag) ?? false;
}

function getFavicon(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return "";
  }
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

const WORKFLOW_STEPS = [
  { id: 1, name: "Fetch", description: "Perplexity + Firecrawl in parallel" },
  { id: 2, name: "Classify", description: "Gemini 2.5 Flash analysis" },
  { id: 3, name: "Save", description: "Persist enriched data" },
];

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

async function enrichBookmark(
  bookmark: Bookmark,
  onStep: (stepNum: number, message: string) => void,
): Promise<Bookmark> {
  // Step 1: Fetch research + page content in parallel
  onStep(1, "Fetching from Perplexity + Firecrawl...");

  // Run Perplexity and Firecrawl in parallel
  // Note: Official @perplexity-ai/mcp-server uses messages array format
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

  const [researchResult, firecrawlResult] = await Promise.all([
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
    callMeshTool("firecrawl_scrape", {
      url: bookmark.url,
      formats: ["markdown"],
      onlyMainContent: true,
    }) as Promise<ToolResult>,
  ]);

  // Check for errors in Perplexity response
  if (researchResult.isError) {
    const errorText = Array.isArray(researchResult.content)
      ? researchResult.content.find((c) => c.type === "text")?.text
      : typeof researchResult.content === "string"
        ? researchResult.content
        : "Unknown error";
    throw new Error(`Perplexity research failed: ${errorText}`);
  }

  // Extract research text from Perplexity response
  let research = "";
  if (typeof researchResult.answer === "string") {
    research = researchResult.answer;
  } else if (researchResult.structuredContent?.answer) {
    research = researchResult.structuredContent.answer;
  } else if (Array.isArray(researchResult.content)) {
    const textContent = researchResult.content.find((c) => c.type === "text");
    if (textContent?.text) {
      try {
        const parsed = JSON.parse(textContent.text);
        // Check if parsed result is an error
        if (parsed.isError || parsed.error) {
          throw new Error(
            `Perplexity research failed: ${parsed.error || parsed.text || "Unknown error"}`,
          );
        }
        research = parsed.answer ?? textContent.text;
      } catch (e) {
        // If it's our thrown error, rethrow it
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

  // If we still don't have research, fail early
  if (
    !research ||
    research.includes("MCP error") ||
    research.includes("Invalid arguments")
  ) {
    throw new Error(`Perplexity research failed: ${research || "No response"}`);
  }

  // Extract content from Firecrawl response
  let pageContent = "";
  let publishedAt: string | undefined;

  // Firecrawl returns { markdown: "...", metadata: {...} } directly
  if (typeof firecrawlResult.markdown === "string") {
    pageContent = firecrawlResult.markdown;
  } else if (Array.isArray(firecrawlResult.content)) {
    // Sometimes wrapped in content array
    const textContent = firecrawlResult.content.find((c) => c.type === "text");
    if (textContent?.text) {
      try {
        const parsed = JSON.parse(textContent.text);
        pageContent = parsed.markdown || textContent.text;
      } catch {
        pageContent = textContent.text;
      }
    }
  }

  // Try to extract publish date from Firecrawl metadata
  // Common metadata fields: article:published_time, datePublished, og:article:published_time
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
        // Validate it looks like a date
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

  const researchedAt = new Date().toISOString();

  // Debug: log what we're sending to the AI
  console.log("[Enrichment] Research length:", research.length);
  console.log("[Enrichment] Page content length:", pageContent.length);

  // Step 2: Classify with OpenRouter (Gemini 2.5 Flash)
  onStep(2, "Classifying with Gemini 2.5 Flash...");
  const classifyResult = (await callMeshTool("mcp_openrouter_chat_completion", {
    model: "google/gemini-2.5-flash",
    messages: [
      {
        role: "system",
        content: `You are a senior tech analyst writing thoughtful reviews for a curated resource library. Analyze the resource and return ONLY a JSON object (no markdown, no explanation):

{
  "stars": <number 1-5>,
  "language": "<en|pt|etc>",
  "icon": "<single emoji>",
  "title": "<catchy title>",
  "description": "<1-2 sentences>",
  "tags": ["tech:typescript", "persona:mcp_developer", "type:tool"],
  "insight_dev": "<3 paragraphs, technical focus, separated by spaces not newlines>",
  "insight_founder": "<3 paragraphs, business focus, separated by spaces not newlines>",
  "insight_investor": "<3 paragraphs, market focus, separated by spaces not newlines>",
  "published_at": "<ISO date or null>"
}

PUBLISH DATE - Extract the original publication/release date (be thorough!):
- FIRST check RESEARCH section - Perplexity often finds release dates, launch dates, announcement dates
- THEN check PAGE CONTENT for bylines, headers, footers, metadata
- Look for ANY date mentioned: "Published March 2024", "v1.0 released Jan 15, 2024", "Announced at X conference 2023"
- For GitHub repos: look for "first commit", "initial release", "created" dates in the research
- For blog posts: byline dates, "Posted on", "Updated:", footer dates
- For products/tools: launch date, first version release, announcement date
- Format as ISO 8601 (e.g., "2024-03-15T00:00:00.000Z") - use first of month if only month/year given
- ONLY return null if genuinely no date indicators exist (e.g., evergreen documentation pages)

STAR RATING GUIDE - BE HARSH:
- 1 star: Garbage, spam, broken, outdated, or irrelevant
- 2 stars: Mediocre, nothing special, generic content
- 3 stars: Decent, useful but not remarkable
- 4 stars: Good, valuable, well-made
- 5 stars: Exceptional, must-read, groundbreaking

Most resources should be 2-3 stars. Reserve 4-5 for truly excellent content.

INSIGHT REQUIREMENTS - Each insight is 3 SHORT paragraphs (2-3 sentences each), deeply focused on that persona's UNIQUE concerns. DO NOT blend perspectives - each persona cares about DIFFERENT things:

insight_dev (MCP/AI Developer - TECHNICAL ONLY):
Paragraph 1 - IMPLEMENTATION: Tech stack, architecture, code quality, API design, dependencies. How is it built? What languages/frameworks? Is the code clean?
Paragraph 2 - INTEGRATION: How does it fit with MCP, Claude, agents, existing tools? What's the learning curve? Documentation quality? Examples available?
Paragraph 3 - VERDICT: Should a developer use this? What are the gotchas, limitations, alternatives? Time investment worth it?
DO NOT mention business models, markets, or investment - that's not your concern.

insight_founder (Startup Founder - BUSINESS/STRATEGY ONLY):
Paragraph 1 - OPPORTUNITY: What problem does this solve? Who has this pain? Is this a vitamin or painkiller? Market timing?
Paragraph 2 - COMPETITIVE: Build vs buy vs partner? Could this be a feature or a company? Who are competitors? What's the moat?
Paragraph 3 - ACTION: Should you integrate this, compete with it, or ignore it? What's the strategic move for YOUR startup?
DO NOT mention technical implementation details - that's not your concern.

insight_investor (VC Investor - MARKET/INVESTMENT ONLY):
Paragraph 1 - MARKET: TAM/SAM/SOM? What macro trend does this ride? Is this a growing or shrinking market?
Paragraph 2 - THESIS: Does this represent an investable category? What would a winning company here look like? Who's funded in this space?
Paragraph 3 - SIGNALS: Traction indicators? Team quality? What would make you take a meeting vs pass?
DO NOT mention code quality or startup tactics - focus on MARKET OPPORTUNITY and INVESTMENT LOGIC.

CRITICAL JSON RULES (FOLLOW EXACTLY):
- EVERY property MUST have a comma after it EXCEPT the last one
- Escape all quotes inside strings with backslash: \\"
- NO newlines inside string values - use spaces instead
- NO trailing comma after the last property (published_at)
- Each insight is ONE LONG STRING with paragraphs separated by double spaces

Tags must include at least one persona tag: persona:mcp_developer, persona:startup_founder, or persona:vc_investor.`,
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
    insight_dev?: string;
    insight_founder?: string;
    insight_investor?: string;
    published_at?: string | null;
  }

  let c: Classification;
  try {
    c = JSON.parse(jsonMatch[0]) as Classification;
  } catch (parseError) {
    // Try to fix common JSON issues
    let sanitized = jsonMatch[0]
      // Remove problematic control characters
      .split("")
      .map((char) => {
        const code = char.charCodeAt(0);
        // Replace control chars (0-8, 11-12, 14-31) with space, keep tab/newline/cr
        if (
          (code >= 0 && code <= 8) ||
          code === 11 ||
          code === 12 ||
          (code >= 14 && code <= 31)
        ) {
          return " ";
        }
        return char;
      })
      .join("");

    // Fix missing commas between properties: "...(whitespace)"(property) -> "...(whitespace),"(property)
    // This catches when Claude forgets a comma after a long string value
    sanitized = sanitized.replace(/"\s*\n\s*"/g, '",\n  "');

    try {
      c = JSON.parse(sanitized) as Classification;
      console.log("[Enrichment] Fixed JSON after sanitization");
    } catch {
      // Last resort: log the error location
      const err = parseError as Error;
      console.error("[Enrichment] JSON parse error:", err.message);
      console.error(
        "[Enrichment] Problematic JSON:",
        jsonMatch[0].slice(0, 1000),
      );
      throw new Error(`${bookmark.title || bookmark.url}: ${err.message}`);
    }
  }

  // Debug: log parsed fields
  console.log("[Enrichment] Parsed fields:", {
    stars: c.stars,
    icon: c.icon,
    insight_dev: c.insight_dev?.slice(0, 50),
  });

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
    ...bookmark,
    perplexity_research: research,
    firecrawl_content: pageContent || null,
    researched_at: researchedAt,
    title: c.title || bookmark.title,
    description: c.description || bookmark.description,
    stars,
    tags,
    language: c.language || null,
    icon: c.icon || null,
    insight_dev: c.insight_dev || null,
    insight_founder: c.insight_founder || null,
    insight_investor: c.insight_investor || null,
    classified_at: new Date().toISOString(),
    // Prefer metadata publish date, fall back to AI-extracted date
    published_at:
      publishedAt ||
      (c.published_at && c.published_at !== "null" ? c.published_at : null),
  };
}

// Check if running in development mode (localhost)
const isDev =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

export function Bookmarks() {
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
  const [sortBy, setSortBy] = useState<"none" | "rating" | "alpha">("none");
  const [minStars, setMinStars] = useState<number | null>(null);
  const [platformFilter, setPlatformFilter] = useState<string | null>(null);
  // Modal states - each stores the bookmark URL to show (insights first, then research, then content)
  const MODAL_TYPES = [
    "dev",
    "founder",
    "investor",
    "research",
    "exa",
  ] as const;
  type ModalType = (typeof MODAL_TYPES)[number];

  const [activeModal, setActiveModal] = useState<{
    type: ModalType | null;
    url: string | null;
  }>({ type: null, url: null });

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

  const openModal = (type: ModalType, url: string) => {
    setActiveModal({ type, url });
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
  const closeModal = () => setActiveModal({ type: null, url: null });
  const modalBookmark = bookmarks.find((b) => b.url === activeModal.url);

  // Get available modal types for current bookmark (only those with content)
  const getAvailableModals = (bookmark: Bookmark | undefined): ModalType[] => {
    if (!bookmark) return [];
    const available: ModalType[] = [];
    // Insights first, then research, then content
    if (bookmark.insight_dev) available.push("dev");
    if (bookmark.insight_founder) available.push("founder");
    if (bookmark.insight_investor) available.push("investor");
    if (bookmark.perplexity_research) available.push("research");
    if (bookmark.firecrawl_content) available.push("exa");
    return available;
  };

  const availableModals = getAvailableModals(modalBookmark);
  const currentModalIndex = activeModal.type
    ? availableModals.indexOf(activeModal.type)
    : -1;

  const navigateModal = (direction: "prev" | "next") => {
    if (!activeModal.url || availableModals.length === 0) return;
    let newIndex = currentModalIndex;
    if (direction === "next") {
      newIndex = (currentModalIndex + 1) % availableModals.length;
    } else {
      newIndex =
        (currentModalIndex - 1 + availableModals.length) %
        availableModals.length;
    }
    const newType = availableModals[newIndex];
    if (newType) {
      setActiveModal({ type: newType, url: activeModal.url });
    }
  };

  // Keyboard navigation for modal
  React.useEffect(() => {
    if (!activeModal.type) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        navigateModal("next");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        navigateModal("prev");
      } else if (e.key === "Escape") {
        setActiveModal({ type: null, url: null });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // Keyboard navigation for table rows (when modal is closed)
  React.useEffect(() => {
    if (activeModal.type) return; // Skip when modal is open

    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      const list = filteredRef.current;
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        setSelectedRowIndex((prev) => {
          const next = prev === null ? 0 : Math.min(prev + 1, list.length - 1);
          // Scroll into view
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
          // Scroll into view
          setTimeout(() => {
            document
              .getElementById(`bookmark-row-${next}`)
              ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
          }, 0);
          return next;
        });
      } else if (e.key === "Enter" && selectedRowIndex !== null) {
        e.preventDefault();
        const bookmark = list[selectedRowIndex];
        if (bookmark?.insight_dev) {
          openModal("dev", bookmark.url);
        }
      } else if (
        isDev &&
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedRowIndex !== null
      ) {
        e.preventDefault();
        const bookmark = list[selectedRowIndex];
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
  });

  // Keyboard handler for delete confirmation modal
  React.useEffect(() => {
    if (!deleteConfirm) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        deleteBookmark(deleteConfirm.url);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setDeleteConfirm(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

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

  // Fetch bookmarks from Supabase
  const loadBookmarks = async () => {
    try {
      setLoading(true);
      const data = await getAllBookmarks();
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
  const sortedTechTags = Object.entries(techTagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15) // Top 15 tech tags
    .map(([tag]) => tag);
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
  const sortedTypeTags = Object.entries(typeTagCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag);

  // Collect platform counts for filter
  const platformCounts: Record<string, number> = {};
  for (const b of bookmarks) {
    const platform = getPlatform(b.url);
    if (platform) {
      platformCounts[platform] = (platformCounts[platform] || 0) + 1;
    }
  }
  const sortedPlatforms = Object.entries(platformCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([p]) => p);

  const filtered = bookmarks
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
      // Min stars filter
      if (minStars !== null && (b.stars || 0) < minStars) return false;
      // Platform filter
      if (platformFilter && getPlatform(b.url) !== platformFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          b.url.toLowerCase().includes(s) ||
          b.title?.toLowerCase().includes(s) ||
          b.description?.toLowerCase().includes(s) ||
          getTagsByType(b.tags, "tech").some((t) => t.toLowerCase().includes(s))
        );
      }
      return true;
    })
    // Sort based on sortBy option
    .sort((a, b) => {
      if (sortBy === "none") {
        // No sorting - maintain original database order
        return 0;
      }
      if (sortBy === "rating") {
        // Rating sort: highest stars first, unenriched at bottom
        return (b.stars || 0) - (a.stars || 0);
      }
      if (sortBy === "alpha") {
        // Alphabetical by title
        return (a.title || a.url).localeCompare(b.title || b.url);
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
      setBookmarks((prev) =>
        prev.map((b) => (b.url === savedBookmark.url ? savedBookmark : b)),
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
      activeModal.type ||
      deleteConfirm
    )
      return;

    const bookmark = filtered[selectedRowIndex];
    if (bookmark && !bookmark.classified_at) {
      queueEnrichment(bookmark.url);
    }
  }, [selectedRowIndex]);

  const startEnrichment = async (limit = 10) => {
    abortRef.current = false;
    const toEnrich = unenriched.slice(0, limit);

    setStatus({
      isRunning: true,
      current: null,
      currentStep: 0,
      stepMessage: "Initializing...",
      processed: 0,
      total: toEnrich.length,
      errors: [],
      lastResult: null,
    });

    for (let i = 0; i < toEnrich.length; i++) {
      if (abortRef.current) break;

      const bookmark = toEnrich[i] as Bookmark;
      setStatus((s) => ({
        ...s,
        current: bookmark.title || bookmark.url,
        currentStep: 1,
        stepMessage: "Starting...",
        processed: i,
      }));

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

        // Step 3: Update database with full enrichment
        setStatus((s) => ({
          ...s,
          currentStep: 3,
          stepMessage: "Saving to database...",
        }));

        console.log("[Enrichment] Saving bookmark:", enrichedBookmark.url);
        console.log("[Enrichment] Data to save:", {
          stars: enrichedBookmark.stars,
          icon: enrichedBookmark.icon,
          reading_time: enrichedBookmark.reading_time_min,
          insight_dev: enrichedBookmark.insight_dev?.slice(0, 50),
        });

        // Save to database via API (enrichedBookmark already has url)
        const saveResponse = await fetch("/api/bookmarks/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(enrichedBookmark),
        });

        console.log(
          "[Enrichment] Save response:",
          saveResponse.status,
          saveResponse.ok,
        );

        // Update bookmarks state
        setBookmarks((prev) =>
          prev.map((b) => (b.url === bookmark.url ? enrichedBookmark : b)),
        );

        setStatus((s) => ({
          ...s,
          lastResult: `✓ ${bookmark.title} - ${enrichedBookmark.stars}⭐`,
        }));
      } catch (err) {
        const errorMsg = (err as Error).message;
        setFailedUrls((prev) => new Map(prev).set(bookmark.url, errorMsg));
        setStatus((s) => ({
          ...s,
          errors: [...s.errors, `${bookmark.title}: ${errorMsg}`],
          lastResult: `✗ ${bookmark.title}: ${errorMsg}`,
        }));
      }

      // Small delay between requests
      await new Promise((r) => setTimeout(r, 500));
    }

    setStatus((s) => ({
      ...s,
      isRunning: false,
      current: null,
      currentStep: 0,
      stepMessage: "Complete!",
      processed: toEnrich.length,
    }));
  };

  const stopEnrichment = () => {
    abortRef.current = true;
    setStatus((s) => ({ ...s, stepMessage: "Stopping..." }));
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

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2 rounded-lg text-sm flex-1 max-w-xs"
          style={{
            backgroundColor: "var(--color-bg-secondary)",
            border: "1px solid var(--color-border)",
            color: "var(--color-fg)",
          }}
        />

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

      {/* Track Filters */}
      <div className="flex flex-wrap gap-2 mb-3">
        <span
          className="text-xs py-1"
          style={{ color: "var(--color-fg-muted)" }}
        >
          Tracks:
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
      {sortedTechTags.length > 0 && (
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
        </div>
      )}

      {/* Content Type Filters */}
      {sortedTypeTags.length > 0 && (
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
        </div>
      )}

      {/* Platform Filters */}
      {sortedPlatforms.length > 0 && (
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
        </div>
      )}

      {/* Rating Filter & Sort */}
      <div className="flex flex-wrap gap-4 mb-6 items-center">
        <div className="flex items-center gap-2">
          <span
            className="text-xs py-1"
            style={{ color: "var(--color-fg-muted)" }}
          >
            Min Stars:
          </span>
          {[1, 2, 3, 4, 5].map((stars) => (
            <button
              type="button"
              key={stars}
              onClick={() => setMinStars(minStars === stars ? null : stars)}
              className="px-2 py-0.5 rounded text-xs font-medium transition-all"
              style={{
                backgroundColor:
                  minStars === stars
                    ? "#eab30830"
                    : "var(--color-bg-secondary)",
                color: minStars === stars ? "#eab308" : "var(--color-fg-muted)",
                border: `1px solid ${minStars === stars ? "#eab308" : "var(--color-border)"}`,
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
          {(["none", "rating", "alpha"] as const).map((option) => {
            const isActive = sortBy === option;
            const labels = { none: "—", rating: "⭐", alpha: "A-Z" };
            const titles = {
              none: "No sorting",
              rating: "Sort by rating",
              alpha: "Sort alphabetically",
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
          })}
        </div>
      </div>

      {/* Enrichment Workflow Panel - only in development */}
      {isDev && (
        <div
          className="mb-8 p-5 rounded-xl"
          style={{
            backgroundColor: "var(--color-bg-secondary)",
            border: `2px solid ${status.isRunning ? "var(--color-accent)" : "var(--color-border)"}`,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-4">
              <span
                className="text-xl font-semibold"
                style={{ color: "var(--color-fg)" }}
              >
                🔬 Enrichment Workflow
              </span>
              {status.isRunning && (
                <span
                  className="px-3 py-1 rounded-full text-xs font-medium animate-pulse"
                  style={{ backgroundColor: "#f5930030", color: "#f59300" }}
                >
                  Running
                </span>
              )}
              {enrichQueue.length > 0 && (
                <span
                  className="px-3 py-1 rounded-full text-xs font-medium"
                  style={{ backgroundColor: "#8b5cf620", color: "#8b5cf6" }}
                >
                  📋 {enrichQueue.length} queued
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {!status.isRunning ? (
                <>
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="batch-size-input"
                      className="text-sm"
                      style={{ color: "var(--color-fg-muted)" }}
                    >
                      Batch:
                    </label>
                    <input
                      id="batch-size-input"
                      type="number"
                      min={1}
                      max={Math.min(50, unenriched.length)}
                      value={batchSize}
                      onChange={(e) =>
                        setBatchSize(
                          Math.max(
                            1,
                            Math.min(50, Number.parseInt(e.target.value) || 1),
                          ),
                        )
                      }
                      className="w-16 px-2 py-1.5 rounded-lg text-sm text-center font-medium"
                      style={{
                        backgroundColor: "var(--color-bg)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-fg)",
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => startEnrichment(batchSize)}
                    disabled={unenriched.length === 0}
                    className="px-5 py-2 rounded-lg text-sm font-semibold transition-all hover:scale-105"
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
                  >
                    🚀 Start
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={stopEnrichment}
                  className="px-5 py-2 rounded-lg text-sm font-semibold transition-all hover:scale-105"
                  style={{ backgroundColor: "#ef4444", color: "white" }}
                >
                  ⏹ Stop
                </button>
              )}
            </div>
          </div>

          {/* Workflow Steps */}
          <div className="flex items-center gap-3 mb-4">
            {WORKFLOW_STEPS.map((step, idx) => (
              <React.Fragment key={step.id}>
                {idx > 0 && (
                  <div
                    className="h-0.5 w-10"
                    style={{
                      backgroundColor:
                        status.currentStep > step.id
                          ? "#10b981"
                          : status.currentStep === step.id
                            ? "var(--color-accent)"
                            : "var(--color-border)",
                    }}
                  />
                )}
                <div
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all"
                  style={{
                    backgroundColor:
                      status.currentStep === step.id
                        ? "var(--color-accent)"
                        : status.currentStep > step.id
                          ? "#10b98120"
                          : "var(--color-bg)",
                    color:
                      status.currentStep === step.id
                        ? "#000"
                        : status.currentStep > step.id
                          ? "#10b981"
                          : "var(--color-fg-muted)",
                    border: `1px solid ${
                      status.currentStep === step.id
                        ? "var(--color-accent)"
                        : status.currentStep > step.id
                          ? "#10b981"
                          : "var(--color-border)"
                    }`,
                  }}
                >
                  <span className="font-semibold">
                    {status.currentStep > step.id ? "✓" : step.id}
                  </span>
                  <span className="font-medium">{step.name}</span>
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* Current Status */}
          <div
            className="flex items-center justify-between text-sm p-3 rounded-lg"
            style={{ backgroundColor: "var(--color-bg)" }}
          >
            <div style={{ color: "var(--color-fg-muted)" }}>
              {status.isRunning ? (
                <span className="flex items-center gap-2">
                  <span
                    className="font-semibold"
                    style={{ color: "var(--color-fg)" }}
                  >
                    {status.current}
                  </span>
                  <span style={{ color: "var(--color-fg-muted)" }}>·</span>
                  <span>{status.stepMessage}</span>
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span className="font-medium">{unenriched.length}</span>
                  <span>bookmarks pending</span>
                  {status.lastResult && (
                    <>
                      <span style={{ color: "var(--color-fg-muted)" }}>·</span>
                      <span>Last: {status.lastResult}</span>
                    </>
                  )}
                </span>
              )}
            </div>
            <div
              className="flex items-center gap-2"
              style={{ color: "var(--color-fg-muted)" }}
            >
              <span className="font-medium">
                {status.processed}/{status.total || unenriched.length}
              </span>
              <span>processed</span>
              {status.errors.length > 0 && (
                <span
                  className="ml-1 px-2 py-0.5 rounded text-xs"
                  style={{ backgroundColor: "#ef444420", color: "#ef4444" }}
                >
                  {status.errors.length} errors
                </span>
              )}
            </div>
          </div>

          {/* Errors */}
          {status.errors.length > 0 && (
            <details className="mt-2">
              <summary className="text-xs cursor-pointer text-red-400">
                View {status.errors.length} error(s)
              </summary>
              <div
                className="mt-1 p-2 rounded text-xs max-h-32 overflow-y-auto"
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
      )}

      {/* Table */}
      <div
        className="rounded-lg overflow-hidden"
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
                      // Open modal with first available insight, or dev by default
                      const available = getAvailableModals(bookmark);
                      const modalType = available.includes("dev")
                        ? "dev"
                        : available.includes("founder")
                          ? "founder"
                          : available.includes("investor")
                            ? "investor"
                            : available[0] || "dev";
                      openModal(modalType, bookmark.url);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedRowIndex(i);
                        const available = getAvailableModals(bookmark);
                        const modalType = available.includes("dev")
                          ? "dev"
                          : available.includes("founder")
                            ? "founder"
                            : available.includes("investor")
                              ? "investor"
                              : available[0] || "dev";
                        openModal(modalType, bookmark.url);
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
                      {bookmark.icon ? (
                        <span className="text-lg">{bookmark.icon}</span>
                      ) : (
                        <img
                          src={getFavicon(bookmark.url)}
                          alt=""
                          className="w-5 h-5 rounded opacity-70"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                      )}
                    </td>

                    {/* Content: Title + Description + Link + Reading Time */}
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
                    </td>

                    {/* Rating - clickable for Developer Insight */}
                    <td className="p-3 text-center">
                      {bookmark.classified_at ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRowIndex(i);
                            openModal("dev", bookmark.url);
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

                    {/* Insight buttons - order: dev, founder, investor, research, exa */}
                    <td className="p-3 pl-6">
                      <div className="flex gap-2 flex-wrap">
                        {bookmark.insight_dev && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRowIndex(i);
                              openModal("dev", bookmark.url);
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
                        )}
                        {bookmark.insight_founder && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRowIndex(i);
                              openModal("founder", bookmark.url);
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
                        )}
                        {bookmark.insight_investor && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRowIndex(i);
                              openModal("investor", bookmark.url);
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
                        )}
                        {bookmark.perplexity_research && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRowIndex(i);
                              openModal("research", bookmark.url);
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
                        )}
                        {bookmark.firecrawl_content && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRowIndex(i);
                              openModal("exa", bookmark.url);
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
                        )}
                      </div>
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

                    {/* Actions column - dev only */}
                    {isDev && (
                      <td className="p-3 text-center">
                        {(() => {
                          const queuePos = enrichQueue.indexOf(bookmark.url);
                          const isCurrentlyEnriching =
                            status.isRunning &&
                            status.current === (bookmark.title || bookmark.url);
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

      {/* Unified Modal */}
      {activeModal.type &&
        modalBookmark &&
        (() => {
          const configs: Record<
            string,
            { icon: string; title: string; content: string; color: string }
          > = {
            research: {
              icon: "🔬",
              title: "Research",
              content:
                modalBookmark.perplexity_research || "No research available.",
              color: "#3b82f6",
            },
            exa: {
              icon: "🌐",
              title: "Page Content",
              content:
                modalBookmark.firecrawl_content || "No page content available.",
              color: "#06b6d4",
            },
            dev: {
              icon: "🔌",
              title: "Developer Insight",
              content:
                modalBookmark.insight_dev || "No developer insight available.",
              color: "#8b5cf6",
            },
            founder: {
              icon: "🚀",
              title: "Founder Insight",
              content:
                modalBookmark.insight_founder ||
                "No founder insight available.",
              color: "#f59300",
            },
            investor: {
              icon: "💰",
              title: "Investor Insight",
              content:
                modalBookmark.insight_investor ||
                "No investor insight available.",
              color: "#10b981",
            },
          };
          const config = configs[activeModal.type];
          if (!config) return null;

          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
              onClick={closeModal}
              onKeyDown={(e) => {
                if (e.key === "Escape") closeModal();
              }}
            >
              <dialog
                ref={(el) => el?.focus()}
                open
                tabIndex={-1}
                className="max-w-3xl w-full h-[85vh] sm:h-[70vh] rounded-none sm:rounded-xl p-0 m-0 flex flex-col outline-none"
                style={{
                  backgroundColor: "var(--color-bg)",
                  border: `2px solid ${config.color}40`,
                  position: "relative",
                }}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  const list = filteredRef.current;
                  if (e.key === "ArrowRight") {
                    e.preventDefault();
                    navigateModal("next");
                  } else if (e.key === "ArrowLeft") {
                    e.preventDefault();
                    navigateModal("prev");
                  } else if (e.key === "ArrowDown" || e.key === "j") {
                    e.preventDefault();
                    // Move to next bookmark, same modal type
                    if (
                      selectedRowIndex !== null &&
                      selectedRowIndex < list.length - 1
                    ) {
                      const nextIndex = selectedRowIndex + 1;
                      setSelectedRowIndex(nextIndex);
                      const nextBookmark = list[nextIndex];
                      if (nextBookmark && activeModal.type) {
                        setActiveModal({
                          type: activeModal.type,
                          url: nextBookmark.url,
                        });
                      }
                    }
                  } else if (e.key === "ArrowUp" || e.key === "k") {
                    e.preventDefault();
                    // Move to previous bookmark, same modal type
                    if (selectedRowIndex !== null && selectedRowIndex > 0) {
                      const prevIndex = selectedRowIndex - 1;
                      setSelectedRowIndex(prevIndex);
                      const prevBookmark = list[prevIndex];
                      if (prevBookmark && activeModal.type) {
                        setActiveModal({
                          type: activeModal.type,
                          url: prevBookmark.url,
                        });
                      }
                    }
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    closeModal();
                  }
                }}
              >
                {/* Fixed Header - Title, URL, Tags, Close button */}
                <div
                  className="flex flex-col sm:flex-row sm:items-start justify-between p-3 sm:p-4 border-b gap-2"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3
                          className="text-lg sm:text-xl font-bold truncate"
                          style={{ color: "var(--color-fg)" }}
                        >
                          {modalBookmark.icon && (
                            <span className="mr-2">{modalBookmark.icon}</span>
                          )}
                          {modalBookmark.title}
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap">
                          <a
                            href={modalBookmark.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs sm:text-sm hover:underline truncate"
                            style={{ color: "var(--color-accent)" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {modalBookmark.url}
                          </a>
                          {modalBookmark.published_at && (
                            <span
                              className="text-xs px-2 py-0.5 rounded-full shrink-0"
                              style={{
                                backgroundColor: "var(--color-bg-secondary)",
                                color: "var(--color-fg-muted)",
                              }}
                              title={`Published: ${new Date(modalBookmark.published_at).toLocaleString()}`}
                            >
                              📅{" "}
                              {new Date(
                                modalBookmark.published_at,
                              ).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Tags - visible on larger screens */}
                      <div className="hidden sm:flex flex-wrap gap-1 max-w-[200px] justify-end">
                        {modalBookmark.tags?.slice(0, 4).map((tag) => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.5 rounded text-xs"
                            style={{
                              backgroundColor: tag.startsWith("tech:")
                                ? "#3b82f620"
                                : tag.startsWith("persona:")
                                  ? "#8b5cf620"
                                  : "#6b728020",
                              color: tag.startsWith("tech:")
                                ? "#3b82f6"
                                : tag.startsWith("persona:")
                                  ? "#8b5cf6"
                                  : "var(--color-fg-muted)",
                            }}
                          >
                            {tag.replace(
                              /^(tech:|persona:|type:|category:)/,
                              "",
                            )}
                          </span>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={closeModal}
                        className="p-1.5 sm:p-2 rounded-lg hover:bg-opacity-80 transition-colors shrink-0"
                        style={{
                          backgroundColor: "var(--color-bg-secondary)",
                          color: "var(--color-fg-muted)",
                        }}
                      >
                        ✕
                      </button>
                    </div>
                    {/* Tags - mobile, shown below title */}
                    <div className="flex sm:hidden flex-wrap gap-1 mt-2">
                      {modalBookmark.tags?.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.5 rounded text-xs"
                          style={{
                            backgroundColor: tag.startsWith("tech:")
                              ? "#3b82f620"
                              : tag.startsWith("persona:")
                                ? "#8b5cf620"
                                : "#6b728020",
                            color: tag.startsWith("tech:")
                              ? "#3b82f6"
                              : tag.startsWith("persona:")
                                ? "#8b5cf6"
                                : "var(--color-fg-muted)",
                          }}
                        >
                          {tag.replace(/^(tech:|persona:|type:|category:)/, "")}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Insight Tabs */}
                <div
                  className="flex gap-1 px-3 sm:px-4 py-2 border-b overflow-x-auto"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  {availableModals.map((modalType) => {
                    const tabConfigs: Record<
                      string,
                      { icon: string; label: string; color: string }
                    > = {
                      dev: { icon: "🔌", label: "Developer", color: "#8b5cf6" },
                      founder: {
                        icon: "🚀",
                        label: "Founder",
                        color: "#f59300",
                      },
                      investor: {
                        icon: "💰",
                        label: "Investor",
                        color: "#10b981",
                      },
                      research: {
                        icon: "🔬",
                        label: "Research",
                        color: "#3b82f6",
                      },
                      exa: { icon: "🌐", label: "Content", color: "#06b6d4" },
                    };
                    const tab = tabConfigs[modalType];
                    if (!tab) return null;
                    const isActive = activeModal.type === modalType;
                    return (
                      <button
                        key={modalType}
                        type="button"
                        onClick={() => openModal(modalType, modalBookmark.url)}
                        className="px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap"
                        style={{
                          backgroundColor: isActive
                            ? `${tab.color}20`
                            : "transparent",
                          color: isActive ? tab.color : "var(--color-fg-muted)",
                          border: isActive
                            ? `1px solid ${tab.color}40`
                            : "1px solid transparent",
                        }}
                      >
                        <span className="mr-1">{tab.icon}</span>
                        <span className="hidden sm:inline">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-4">
                  <div
                    className="prose prose-sm max-w-none p-3 sm:p-4 rounded-lg text-sm sm:text-base"
                    style={{
                      backgroundColor: "var(--color-bg-secondary)",
                      borderLeft: `3px solid ${config.color}`,
                      lineHeight: 1.7,
                    }}
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: markdown rendering
                    dangerouslySetInnerHTML={{
                      __html: marked(config.content, {
                        async: false,
                      }) as string,
                    }}
                  />
                </div>

                {/* Fixed Footer - simplified for mobile */}
                <div
                  className="p-2 sm:p-3 border-t flex items-center justify-between gap-2"
                  style={{
                    borderColor: "var(--color-border)",
                    backgroundColor: "var(--color-bg)",
                  }}
                >
                  {/* Left: Navigate between bookmarks */}
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const list = filteredRef.current;
                        if (selectedRowIndex !== null && selectedRowIndex > 0) {
                          const prevIndex = selectedRowIndex - 1;
                          setSelectedRowIndex(prevIndex);
                          const prevBookmark = list[prevIndex];
                          if (prevBookmark && activeModal.type) {
                            setActiveModal({
                              type: activeModal.type,
                              url: prevBookmark.url,
                            });
                          }
                        }
                      }}
                      disabled={
                        selectedRowIndex === null || selectedRowIndex === 0
                      }
                      className="px-2 sm:px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-30"
                      style={{
                        backgroundColor: "var(--color-bg-secondary)",
                        color: "var(--color-fg)",
                        border: "1px solid var(--color-border)",
                      }}
                      title="Previous bookmark (↑/k)"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const list = filteredRef.current;
                        if (
                          selectedRowIndex !== null &&
                          selectedRowIndex < list.length - 1
                        ) {
                          const nextIndex = selectedRowIndex + 1;
                          setSelectedRowIndex(nextIndex);
                          const nextBookmark = list[nextIndex];
                          if (nextBookmark && activeModal.type) {
                            setActiveModal({
                              type: activeModal.type,
                              url: nextBookmark.url,
                            });
                          }
                        }
                      }}
                      disabled={
                        selectedRowIndex === null ||
                        selectedRowIndex >= filteredRef.current.length - 1
                      }
                      className="px-2 sm:px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-30"
                      style={{
                        backgroundColor: "var(--color-bg-secondary)",
                        color: "var(--color-fg)",
                        border: "1px solid var(--color-border)",
                      }}
                      title="Next bookmark (↓/j)"
                    >
                      ↓
                    </button>
                  </div>

                  {/* Right: Copy/Close */}
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(config.content);
                      }}
                      className="px-2 sm:px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                      style={{
                        backgroundColor: "var(--color-bg-secondary)",
                        color: "var(--color-fg)",
                        border: "1px solid var(--color-border)",
                      }}
                      title="Copy to clipboard"
                    >
                      📋
                    </button>
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-2 sm:px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                      style={{
                        backgroundColor: config.color,
                        color: "#000",
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </dialog>
            </div>
          );
        })()}
    </div>
  );
}
