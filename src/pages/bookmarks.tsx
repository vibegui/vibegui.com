/**
 * Bookmarks Dashboard
 *
 * Table-based viewer for curated links with AI enrichment workflow.
 * Features:
 * - Table view with all enrichment fields
 * - "Start Enriching" workflow that calls local mesh
 * - Research and classification via Perplexity + Claude
 */

import React, { useState, useEffect, useRef } from "react";
import { marked } from "marked";
import { PageHeader } from "../components/page-header";

interface Bookmark {
  id?: number;
  url: string;
  title?: string;
  description?: string;
  // Enrichment fields - Step 1: Research
  research_raw?: string;
  exa_content?: string;
  researched_at?: string;
  // Enrichment fields - Step 2: Classification
  stars?: number;
  reading_time_min?: number;
  language?: string;
  icon?: string;
  tags?: string[];
  // Audience-specific insights
  insight_dev?: string;
  insight_founder?: string;
  insight_investor?: string;
  classified_at?: string;
}

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
  { id: 1, name: "Fetch", description: "Perplexity + Exa in parallel" },
  { id: 2, name: "Classify", description: "Claude Haiku analysis" },
  { id: 3, name: "Save", description: "Persist enriched data" },
];

const TRACK_CONFIG = {
  mcp: { label: "MCP Developer", color: "#8b5cf6", icon: "🔌" },
  founder: { label: "Startup Founder", color: "#f59300", icon: "🚀" },
  investor: { label: "VC Investor", color: "#10b981", icon: "💰" },
};

// Note: Bookmarks are now loaded from SQLite via /api/bookmarks

function StarRating({ stars }: { stars?: number }) {
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
  // Step 1: Fetch research + content in parallel
  onStep(1, "Fetching from Perplexity + Exa...");

  // Run Perplexity and Exa in parallel
  const [researchResult, exaResult] = await Promise.all([
    callMeshTool("ASK_PERPLEXITY", {
      query: `What is ${bookmark.url}? Brief overview: purpose, features, target audience, key insights. Is it still active?`,
      model: "sonar",
      max_tokens: 1500,
    }) as Promise<{
      answer?: string;
      content?: Array<{ type: string; text: string }>;
      structuredContent?: { answer?: string };
    }>,
    callMeshTool("web_search_exa", {
      query: bookmark.url,
      numResults: 3,
      livecrawl: "preferred",
    }) as Promise<{
      content?: Array<{ type: string; text: string }>;
      results?: Array<{ title?: string; text?: string; url?: string }>;
    }>,
  ]);

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
        research = parsed.answer ?? textContent.text;
      } catch {
        research = textContent.text;
      }
    }
  } else if (typeof researchResult.content === "string") {
    research = researchResult.content;
  }

  // Extract content from Exa response
  let exaContent = "";
  if (Array.isArray(exaResult.content)) {
    const textContent = exaResult.content.find((c) => c.type === "text");
    if (textContent?.text) {
      try {
        const parsed = JSON.parse(textContent.text);
        if (parsed.context) {
          exaContent = parsed.context;
        } else if (Array.isArray(parsed.results)) {
          exaContent = parsed.results
            .map(
              (r: { title?: string; text?: string }) =>
                `${r.title || ""}\n${r.text || ""}`,
            )
            .join("\n\n");
        }
      } catch {
        exaContent = textContent.text;
      }
    }
  } else if (Array.isArray(exaResult.results)) {
    exaContent = exaResult.results
      .map((r) => `${r.title || ""}\n${r.text || ""}`)
      .join("\n\n");
  }

  const researchedAt = new Date().toISOString();

  // Debug: log what we're sending to the AI
  console.log("[Enrichment] Research length:", research.length);
  console.log("[Enrichment] Exa content length:", exaContent.length);

  // Step 2: Classify with Claude Sonnet
  onStep(2, "Classifying with Claude Sonnet...");
  const classifyResult = (await callMeshTool("LLM_DO_GENERATE", {
    modelId: "anthropic/claude-sonnet-4",
    callOptions: {
      prompt: [
        {
          role: "system",
          content: `You are a harsh tech curator. Analyze the resource and return ONLY a JSON object (no markdown, no explanation):

{
  "stars": <number 1-5>,
  "language": "<en|pt|etc>",
  "icon": "<single emoji representing this resource>",
  "title": "<improved short catchy title>",
  "description": "<1-2 sentence description>",
  "tags": ["tech:typescript", "persona:mcp_developer", "type:tool"],
  "insight_dev": "<1-2 sentences: Key insight for AI/MCP developers>",
  "insight_founder": "<1-2 sentences: Key insight for startup founders>",
  "insight_investor": "<1-2 sentences: Key insight for VC investors>"
}

STAR RATING GUIDE - BE HARSH AND USE THE FULL RANGE:
- 1 star: Garbage, spam, broken, outdated, or irrelevant
- 2 stars: Mediocre, nothing special, generic content, or poorly executed
- 3 stars: Decent, useful but not remarkable, average quality
- 4 stars: Good, valuable content, well-made, worth bookmarking
- 5 stars: Exceptional, must-read, groundbreaking, or extremely valuable

Most resources should be 2-3 stars. Only give 4-5 to truly excellent content. Don't hesitate to give 1-2 for low quality.

Tags must include at least one persona tag: persona:mcp_developer, persona:startup_founder, or persona:vc_investor.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this resource:

URL: ${bookmark.url}
Title: ${bookmark.title || "Unknown"}
Description: ${bookmark.description || "No description"}

Research:
${research.slice(0, 2000)}

${exaContent ? `Page Content:\n${exaContent.slice(0, 1500)}` : ""}`,
            },
          ],
        },
      ],
      temperature: 0.2,
      maxOutputTokens: 1500,
    },
  })) as {
    content?: Array<{ type: string; text: string }>;
    text?: string;
  };

  // Extract classification text from response - may be double-nested
  let classText = "";
  if (typeof classifyResult.text === "string") {
    classText = classifyResult.text;
  } else if (Array.isArray(classifyResult.content)) {
    const textContent = classifyResult.content.find((c) => c.type === "text");
    let rawText = textContent?.text ?? "";

    // Check if the text is itself a JSON with content array (double-nested from OpenRouter)
    try {
      const parsed = JSON.parse(rawText);
      if (Array.isArray(parsed.content)) {
        const innerText = parsed.content.find(
          (c: { type: string; text?: string }) => c.type === "text",
        );
        rawText = innerText?.text ?? rawText;
      }
    } catch {
      // Not nested JSON, use as-is
    }

    classText = rawText;
  }

  // Debug: log the raw response
  console.log("[Enrichment] Raw AI response:", classText.slice(0, 800));

  const jsonMatch = classText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(
      `Failed to parse classification JSON from: ${classText.slice(0, 500)}`,
    );
  }

  const c = JSON.parse(jsonMatch[0]);

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
    research_raw: research,
    exa_content: exaContent || undefined,
    researched_at: researchedAt,
    title: c.title || bookmark.title,
    description: c.description || bookmark.description,
    stars,
    tags,
    language: c.language,
    icon: c.icon,
    insight_dev: c.insight_dev,
    insight_founder: c.insight_founder,
    insight_investor: c.insight_investor,
    classified_at: new Date().toISOString(),
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
  const [sortBy, setSortBy] = useState<"default" | "rating">("default");
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

  const queueEnrichment = (url: string) => {
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
    if (bookmark.research_raw) available.push("research");
    if (bookmark.exa_content) available.push("exa");
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

  // Fetch bookmarks from static JSON (generated from SQLite at build/dev start)
  useEffect(() => {
    const fetchBookmarks = async () => {
      try {
        const res = await fetch("/bookmarks/data.json");
        if (!res.ok) throw new Error("Failed to load bookmarks");
        const data = await res.json();
        setBookmarks(data);
        setLoading(false);
      } catch (err) {
        setError((err as Error).message);
        setLoading(false);
      }
    };
    fetchBookmarks();
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
      if (sortBy === "rating") {
        // Pure rating sort: highest stars first, unenriched at bottom
        return (b.stars || 0) - (a.stars || 0);
      }
      // Default: enriched first, then by stars
      const aEnriched = a.classified_at ? 1 : 0;
      const bEnriched = b.classified_at ? 1 : 0;
      if (aEnriched !== bEnriched) return bEnriched - aEnriched;
      if (aEnriched && bEnriched) {
        return (b.stars || 0) - (a.stars || 0);
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
      setStatus((s) => ({
        ...s,
        isRunning: false,
        errors: [...s.errors, `${bookmark.url}: ${(err as Error).message}`],
      }));
    }
  };

  // Process enrichment queue
  React.useEffect(() => {
    if (status.isRunning || enrichQueue.length === 0) return;

    const nextUrl = enrichQueue[0];
    const bookmark = bookmarks.find((b) => b.url === nextUrl);

    if (bookmark && !bookmark.classified_at) {
      // Remove from queue and start enriching
      setEnrichQueue((prev) => prev.slice(1));
      enrichSpecificBookmark(bookmark);
    } else {
      // Already enriched or not found, skip
      setEnrichQueue((prev) => prev.slice(1));
    }
  }, [enrichQueue, status.isRunning]);

  // Auto-enrich when selecting an unenriched row (dev only)
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
        <div className="flex items-center gap-2">
          <span
            className="text-xs py-1"
            style={{ color: "var(--color-fg-muted)" }}
          >
            Sort:
          </span>
          <button
            type="button"
            onClick={() =>
              setSortBy(sortBy === "default" ? "rating" : "default")
            }
            className="px-2 py-0.5 rounded text-xs font-medium transition-all"
            style={{
              backgroundColor:
                sortBy === "rating" ? "#8b5cf630" : "var(--color-bg-secondary)",
              color: sortBy === "rating" ? "#8b5cf6" : "var(--color-fg-muted)",
              border: `1px solid ${sortBy === "rating" ? "#8b5cf6" : "var(--color-border)"}`,
            }}
          >
            {sortBy === "rating" ? "⭐ By Rating" : "📊 Default"}
          </button>
        </div>
      </div>

      {/* Enrichment Workflow Panel - only in development */}
      {isDev && (
        <div
          className="mb-6 p-4 rounded-lg"
          style={{
            backgroundColor: "var(--color-bg-secondary)",
            border: `1px solid ${status.isRunning ? "var(--color-accent)" : "var(--color-border)"}`,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span
                className="text-lg font-medium"
                style={{ color: "var(--color-fg)" }}
              >
                🔬 Enrichment Workflow
              </span>
              {status.isRunning && (
                <span
                  className="px-2 py-0.5 rounded text-xs animate-pulse"
                  style={{ backgroundColor: "#f5930030", color: "#f59300" }}
                >
                  Running
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!status.isRunning ? (
                <>
                  <button
                    type="button"
                    onClick={() => startEnrichment(1)}
                    disabled={unenriched.length === 0}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
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
                    🚀 Next
                  </button>
                  <button
                    type="button"
                    onClick={() => startEnrichment(10)}
                    disabled={unenriched.length === 0}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
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
                    🚀 Next 10
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={stopEnrichment}
                  className="px-4 py-2 rounded-lg text-sm font-medium"
                  style={{ backgroundColor: "#ef4444", color: "white" }}
                >
                  ⏹ Stop
                </button>
              )}
              {enrichQueue.length > 0 && (
                <span
                  className="px-2 py-1 rounded text-xs font-medium"
                  style={{ backgroundColor: "#8b5cf620", color: "#8b5cf6" }}
                >
                  📋 {enrichQueue.length} queued
                </span>
              )}
            </div>
          </div>

          {/* Workflow Steps */}
          <div className="flex items-center gap-2 mb-3">
            {WORKFLOW_STEPS.map((step, idx) => (
              <React.Fragment key={step.id}>
                {idx > 0 && (
                  <div
                    className="h-0.5 w-8"
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
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all"
                  style={{
                    backgroundColor:
                      status.currentStep === step.id
                        ? "var(--color-accent)"
                        : status.currentStep > step.id
                          ? "#10b98130"
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
                  <span className="font-medium">
                    {status.currentStep > step.id ? "✓" : step.id}
                  </span>
                  <span>{step.name}</span>
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* Current Status */}
          <div
            className="flex items-center justify-between text-sm p-2 rounded"
            style={{ backgroundColor: "var(--color-bg)" }}
          >
            <div style={{ color: "var(--color-fg-muted)" }}>
              {status.isRunning ? (
                <>
                  <span
                    className="font-medium"
                    style={{ color: "var(--color-fg)" }}
                  >
                    {status.current}
                  </span>
                  {" · "}
                  {status.stepMessage}
                </>
              ) : (
                <>
                  {unenriched.length} bookmarks pending enrichment
                  {status.lastResult && ` · Last: ${status.lastResult}`}
                </>
              )}
            </div>
            <div style={{ color: "var(--color-fg-muted)" }}>
              {status.processed}/{status.total || unenriched.length} processed
              {status.errors.length > 0 && (
                <span className="ml-2 text-red-400">
                  ({status.errors.length} errors)
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
                <th className="text-left p-3 font-medium">Insights</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((bookmark, i) => {
                const isProcessing =
                  status.current === bookmark.title ||
                  status.current === bookmark.url;
                const isSelected = selectedRowIndex === i;

                return (
                  <tr
                    key={`${bookmark.url}-${i}`}
                    id={`bookmark-row-${i}`}
                    className="hover:bg-(--color-bg) transition-colors group cursor-pointer"
                    style={{
                      borderBottom: "1px solid var(--color-border)",
                      backgroundColor: isSelected
                        ? "var(--color-accent-muted, rgba(59, 130, 246, 0.1))"
                        : undefined,
                      outline: isSelected
                        ? "2px solid var(--color-accent)"
                        : undefined,
                    }}
                    onClick={() => setSelectedRowIndex(i)}
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
                          onClick={() => {
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

                    {/* Insight buttons */}
                    <td className="p-3">
                      <div className="flex gap-1 flex-wrap">
                        {bookmark.research_raw && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRowIndex(i);
                              openModal("research", bookmark.url);
                            }}
                            className="px-2 py-1 rounded text-xs transition-colors"
                            style={{
                              backgroundColor: "#3b82f620",
                              color: "#3b82f6",
                            }}
                            title="Research"
                          >
                            🔬
                          </button>
                        )}
                        {bookmark.exa_content && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRowIndex(i);
                              openModal("exa", bookmark.url);
                            }}
                            className="px-2 py-1 rounded text-xs transition-colors"
                            style={{
                              backgroundColor: "#06b6d420",
                              color: "#06b6d4",
                            }}
                            title="Page Content"
                          >
                            🌐
                          </button>
                        )}
                        {bookmark.insight_dev && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRowIndex(i);
                              openModal("dev", bookmark.url);
                            }}
                            className="px-2 py-1 rounded text-xs transition-colors"
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
                            onClick={() => {
                              setSelectedRowIndex(i);
                              openModal("founder", bookmark.url);
                            }}
                            className="px-2 py-1 rounded text-xs transition-colors"
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
                            onClick={() => {
                              setSelectedRowIndex(i);
                              openModal("investor", bookmark.url);
                            }}
                            className="px-2 py-1 rounded text-xs transition-colors"
                            style={{
                              backgroundColor: "#10b98120",
                              color: "#10b981",
                            }}
                            title="Investor Insight"
                          >
                            💰
                          </button>
                        )}
                        {/* Enrich button for unenriched bookmarks - dev only */}
                        {isDev &&
                          !bookmark.classified_at &&
                          (() => {
                            const queuePos = enrichQueue.indexOf(bookmark.url);
                            const isCurrentlyEnriching =
                              status.isRunning &&
                              status.current ===
                                (bookmark.title || bookmark.url);

                            if (isCurrentlyEnriching) {
                              return (
                                <span
                                  className="px-2 py-1 rounded text-xs animate-pulse"
                                  style={{
                                    backgroundColor: "#f59e0b20",
                                    color: "#f59e0b",
                                  }}
                                >
                                  ⏳ Enriching...
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
                                  #{queuePos + 1} queued
                                </span>
                              );
                            }

                            return (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  queueEnrichment(bookmark.url);
                                }}
                                className="px-2 py-1 rounded text-xs transition-colors hover:scale-105"
                                style={{
                                  backgroundColor: "var(--color-accent)",
                                  color: "#000",
                                }}
                                title="Click to enrich this bookmark"
                              >
                                ✨ Enrich
                              </button>
                            );
                          })()}
                      </div>
                    </td>
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
              content: modalBookmark.research_raw || "No research available.",
              color: "#3b82f6",
            },
            exa: {
              icon: "🌐",
              title: "Page Content",
              content:
                modalBookmark.exa_content || "No page content available.",
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
                className="max-w-3xl w-full h-[70vh] rounded-xl p-0 m-0 flex flex-col outline-none"
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
                {/* Fixed Header */}
                <div
                  className="flex items-start justify-between p-4 border-b"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <div>
                    <h3
                      className="text-xl font-bold flex items-center gap-2"
                      style={{ color: config.color }}
                    >
                      <span>{config.icon}</span>
                      <span>{config.title}</span>
                    </h3>
                    <div
                      className="font-medium mt-1"
                      style={{ color: "var(--color-fg)" }}
                    >
                      {modalBookmark.title}
                    </div>
                    <a
                      href={modalBookmark.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm hover:underline"
                      style={{ color: "var(--color-accent)" }}
                    >
                      {modalBookmark.url}
                    </a>
                  </div>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="p-2 rounded-lg hover:bg-opacity-80 transition-colors"
                    style={{
                      backgroundColor: "var(--color-bg-secondary)",
                      color: "var(--color-fg-muted)",
                    }}
                  >
                    ✕
                  </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-4">
                  <div
                    className="prose prose-sm max-w-none p-4 rounded-lg"
                    style={{
                      backgroundColor: "var(--color-bg-secondary)",
                      borderLeft: `3px solid ${config.color}`,
                      lineHeight: 1.6,
                    }}
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: markdown rendering
                    dangerouslySetInnerHTML={{
                      __html: marked(config.content, {
                        async: false,
                      }) as string,
                    }}
                  />
                </div>

                {/* Fixed Footer - single row */}
                <div
                  className="p-3 border-t flex items-center justify-between gap-2"
                  style={{
                    borderColor: "var(--color-border)",
                    backgroundColor: "var(--color-bg)",
                  }}
                >
                  {/* Left: Prev/Next */}
                  <div className="flex gap-1">
                    {availableModals.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() => navigateModal("prev")}
                          className="px-2 py-1.5 rounded-lg text-sm font-medium transition-colors"
                          style={{
                            backgroundColor: "var(--color-bg-secondary)",
                            color: "var(--color-fg)",
                            border: "1px solid var(--color-border)",
                          }}
                          title="Previous (←)"
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          onClick={() => navigateModal("next")}
                          className="px-2 py-1.5 rounded-lg text-sm font-medium transition-colors"
                          style={{
                            backgroundColor: "var(--color-bg-secondary)",
                            color: "var(--color-fg)",
                            border: "1px solid var(--color-border)",
                          }}
                          title="Next (→)"
                        >
                          →
                        </button>
                      </>
                    )}
                  </div>

                  {/* Center: Modal type indicators */}
                  {availableModals.length > 1 && (
                    <div className="flex items-center gap-1">
                      {availableModals.map((type) => {
                        const isActive = type === activeModal.type;
                        const typeConfig = configs[type];
                        if (!typeConfig) return null;
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() =>
                              activeModal.url &&
                              setActiveModal({ type, url: activeModal.url })
                            }
                            className="w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all"
                            style={{
                              backgroundColor: isActive
                                ? typeConfig.color
                                : "var(--color-bg-secondary)",
                              opacity: isActive ? 1 : 0.5,
                              transform: isActive ? "scale(1.1)" : "scale(1)",
                            }}
                            title={typeConfig.title}
                          >
                            {typeConfig.icon}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Right: Copy/Close */}
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(config.content);
                      }}
                      className="px-2 py-1.5 rounded-lg text-sm font-medium transition-colors"
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
                      className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
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
