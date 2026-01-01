#!/usr/bin/env bun
/**
 * LinkedIn Posts to Articles Processor
 *
 * This script processes scraped LinkedIn posts and uses AI to:
 * 1. Filter out reposts with no original content
 * 2. Evaluate posts for blog article potential
 * 3. Extract and format selected posts as article drafts
 *
 * Usage:
 *   bun run scripts/process-linkedin-posts.ts [input-file] [output-dir]
 *
 * Example:
 *   bun run scripts/process-linkedin-posts.ts temp/vibegui-linkedin-posts-500.json temp/articles
 */

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

// ============================================================
// Types
// ============================================================

interface LinkedInPost {
  urn: {
    activity_urn: string;
    share_urn: string | null;
    ugcPost_urn: string | null;
  };
  full_urn: string;
  posted_at: {
    date: string;
    relative: string;
    timestamp: number;
  };
  text: string;
  url: string;
  post_type: "regular" | "quote" | "repost";
  author: {
    first_name: string;
    last_name: string;
    headline: string;
    username: string;
    profile_url: string;
    profile_picture?: string;
  };
  stats: {
    total_reactions: number;
    like: number;
    support: number;
    love: number;
    insight: number;
    celebrate: number;
    funny: number;
    comments: number;
    reposts: number;
  };
  media?: {
    type: string;
    url: string;
  };
  article?: {
    url: string;
    title: string;
    subtitle?: string;
  };
  reshared_post?: {
    text: string;
    author: {
      first_name: string;
      last_name: string;
    };
  };
}

interface ClassifiedPost {
  id: string;
  date: string;
  text: string;
  url: string;
  post_type: string;
  reactions: number;
  comments: number;
  reposts: number;
  engagement_score: number;
  classification: "article" | "skip";
  skip_reason?: string;
  article_title?: string;
  article_content?: string;
}

interface MonthlySnapshot {
  month: string; // YYYY-MM
  post_count: number;
  article_count: number;
  total_reactions: number;
  total_comments: number;
  top_themes: string[];
  deco_updates: string[];
  personal_updates: string[];
  interesting_links: string[];
  best_quotes: string[];
  ai_summary: string;
}

interface ProcessingResult {
  total_posts: number;
  filtered_out_reposts: number;
  filtered_out_not_yours: number;
  processed_posts: number;
  articles_created: number;
  posts_skipped: number;
  skip_reasons: Record<string, number>;
  top_posts: ClassifiedPost[];
  articles: ClassifiedPost[];
  all_posts: ClassifiedPost[];
  monthly_timeline: MonthlySnapshot[];
  processing_time_ms: number;
}

// ============================================================
// Logger
// ============================================================

const colors = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
};

function log(
  level: "info" | "success" | "warn" | "error" | "debug",
  message: string,
  data?: unknown,
) {
  const timestamp = new Date().toLocaleTimeString("en-US", { hour12: false });
  const levelColors = {
    info: colors.cyan,
    success: colors.green,
    warn: colors.yellow,
    error: colors.red,
    debug: colors.dim,
  };
  const levelLabels = {
    info: "INFO ",
    success: "  OK ",
    warn: "WARN ",
    error: "ERR  ",
    debug: "DEBUG",
  };

  const color = levelColors[level];
  const label = levelLabels[level];

  console.error(
    `${colors.dim}${timestamp}${colors.reset} ${color}${colors.bold}${label}${colors.reset} ${message}`,
  );

  if (data !== undefined) {
    console.error(
      `${colors.dim}${JSON.stringify(data, null, 2)}${colors.reset}`,
    );
  }
}

function progress(current: number, total: number, message: string) {
  const pct = Math.round((current / total) * 100);
  const bar =
    "█".repeat(Math.floor(pct / 5)) + "░".repeat(20 - Math.floor(pct / 5));
  process.stderr.write(
    `\r${colors.cyan}[${bar}]${colors.reset} ${pct}% ${colors.dim}(${current}/${total})${colors.reset} ${message}          `,
  );
}

// ============================================================
// OpenRouter via Mesh Gateway (MCP)
// ============================================================

// Load .env file
const envPath = new URL("../.env", import.meta.url).pathname;
if (existsSync(envPath)) {
  const envContent = await readFile(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    if (line.startsWith("#") || !line.includes("=")) continue;
    const [key, ...valueParts] = line.split("=");
    const value = valueParts.join("=").trim();
    if (key && value && !process.env[key.trim()]) {
      process.env[key.trim()] = value;
    }
  }
}

const MESH_GATEWAY_URL = process.env.MESH_GATEWAY_URL;
const MESH_API_KEY = process.env.MESH_API_KEY;
const MODEL = "google/gemini-2.5-flash";

if (!MESH_GATEWAY_URL || !MESH_API_KEY) {
  log(
    "error",
    "MESH_GATEWAY_URL and MESH_API_KEY environment variables are required",
  );
  log("info", "Add them to your .env file");
  process.exit(1);
}

/**
 * Call OpenRouter through Mesh gateway using mcp_openrouter_chat_completion tool
 */
async function callOpenRouter(
  prompt: string,
  systemPrompt: string,
): Promise<string> {
  const response = await fetch(MESH_GATEWAY_URL!, {
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
      params: {
        name: "mcp_openrouter_chat_completion",
        arguments: {
          model: MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 16384,
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Mesh API error: ${response.status} - ${error}`);
  }

  const responseText = await response.text();

  let data: any;
  try {
    data = JSON.parse(responseText);
  } catch {
    log("debug", `Raw response: ${responseText.slice(0, 500)}`);
    throw new Error(
      `Failed to parse response as JSON: ${responseText.slice(0, 200)}`,
    );
  }

  if (data.error) {
    throw new Error(
      `MCP error: ${data.error.message || JSON.stringify(data.error)}`,
    );
  }

  // Extract text from MCP result
  const result = data.result;
  if (result?.content) {
    for (const item of result.content) {
      if (item.type === "text") {
        return item.text;
      }
    }
  }

  // Fallback: check structuredContent
  if (result?.structuredContent?.content) {
    return result.structuredContent.content;
  }

  log(
    "debug",
    `Unexpected response structure: ${JSON.stringify(data).slice(0, 500)}`,
  );
  throw new Error("Could not extract text from MCP response");
}

// ============================================================
// Processing Logic
// ============================================================

const SYSTEM_PROMPT = `You are helping classify scraped LinkedIn posts from Guilherme Rodrigues' profile (vibegui).

Your task is to evaluate posts and decide which ones are suitable for being converted into blog articles.

CRITERIA FOR SELECTION:
- Long-form, thoughtful content with original insights
- Authorial voice and personal perspective
- Educational or informative content
- NOT simple announcements or promotional posts
- NOT short quips or one-liners (unless exceptionally insightful)
- NOT posts that are primarily sharing someone else's content with minimal commentary
- Consider engagement (reactions/comments) as a signal of value, but not the only factor
- Minimum ~150 words of substantive content preferred

For posts that qualify as articles:
- Extract the text verbatim (ipsis literis)
- Create a cohesive, SEO-friendly title if not obvious from content
- Do NOT add any "originally published" footer - just the content

OUTPUT FORMAT (JSON):
{
  "posts": [
    {
      "id": "post_urn_id",
      "classification": "article" | "skip",
      "skip_reason": "reason if skipped (e.g., 'too_short', 'announcement', 'repost_commentary', 'low_engagement', 'promotional')",
      "article_title": "Title for blog post (if article)",
      "article_content": "Full markdown content for blog (if article)"
    }
  ]
}

Only output valid JSON, no markdown code blocks or explanations.`;

interface BatchResult {
  posts: Array<{
    id: string;
    classification: "article" | "skip";
    skip_reason?: string;
    article_title?: string;
    article_content?: string;
  }>;
}

async function processBatch(
  posts: LinkedInPost[],
  batchNum: number,
  totalBatches: number,
): Promise<BatchResult> {
  log(
    "info",
    `Processing batch ${batchNum}/${totalBatches} (${posts.length} posts)`,
  );

  const postsForAI = posts.map((p) => ({
    id: p.full_urn,
    date: p.posted_at.date,
    text: p.text,
    url: p.url,
    post_type: p.post_type,
    reactions: p.stats.total_reactions,
    comments: p.stats.comments,
    reposts: p.stats.reposts,
    reshared_context: p.reshared_post
      ? `[Quote of ${p.reshared_post.author.first_name} ${p.reshared_post.author.last_name}'s post: "${p.reshared_post.text?.slice(0, 200)}..."]`
      : undefined,
  }));

  const prompt = `Analyze these ${posts.length} LinkedIn posts and classify them:

${JSON.stringify(postsForAI, null, 2)}

Remember: Only select truly article-worthy content. Be selective.`;

  try {
    const response = await callOpenRouter(prompt, SYSTEM_PROMPT);

    // Debug: log the raw response
    log("debug", `AI response preview: ${response.slice(0, 300)}`);

    // Parse JSON response (handle potential markdown code blocks)
    let jsonStr = response.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr
        .replace(/```json?\n?/g, "")
        .replace(/```$/g, "")
        .trim();
    }

    const result: BatchResult = JSON.parse(jsonStr);
    return result;
  } catch (error) {
    log("error", `Batch ${batchNum} failed: ${(error as Error).message}`);
    // Return all as skipped on error
    return {
      posts: posts.map((p) => ({
        id: p.full_urn,
        classification: "skip" as const,
        skip_reason: "processing_error",
      })),
    };
  }
}

function calculateEngagementScore(stats: LinkedInPost["stats"]): number {
  // Weighted engagement score
  return (
    stats.total_reactions * 1 +
    stats.comments * 3 + // Comments are more valuable
    stats.reposts * 2
  );
}

const TIMELINE_PROMPT = `You are analyzing ALL LinkedIn posts from a specific month to create a "year in review" summary for Guilherme Rodrigues (vibegui), CEO of deco.cx.

IMPORTANT: Analyze EVERY post, including short ones, announcements, comments on events, personal updates, and long-form content. All posts reveal what was on my mind that month.

Given the posts from this month, provide:

1. **top_themes**: 3-5 key themes/topics I was thinking about or discussing (from ANY post, not just long ones)
2. **deco_updates**: Key updates, milestones, product launches, team events, or developments at deco.cx
3. **personal_updates**: Personal reflections, life events, mindset shifts, places visited, people mentioned
4. **interesting_links**: URLs, tools, products, books, articles, people, or companies I referenced or recommended
5. **best_quotes**: 2-4 memorable quotes or phrases from my posts this month (verbatim, keep the original language)
6. **ai_summary**: A 2-3 sentence narrative summary of what this month was about for me - the vibe, the focus, the energy

Be SPECIFIC - extract actual events, product names, people mentioned, places visited, concrete topics. Don't be generic.
Short announcement posts often contain the most concrete updates!
For best_quotes, pick punchy, memorable, or insightful lines that capture my voice.

OUTPUT FORMAT (JSON only, no markdown):
{
  "top_themes": ["theme1", "theme2", ...],
  "deco_updates": ["update1", "update2", ...],
  "personal_updates": ["update1", "update2", ...],
  "interesting_links": ["link or reference 1", "link or reference 2", ...],
  "best_quotes": ["quote 1", "quote 2", ...],
  "ai_summary": "Narrative summary of the month..."
}`;

async function generateMonthlyTimeline(
  classifiedPosts: ClassifiedPost[],
  originalPosts: LinkedInPost[],
): Promise<MonthlySnapshot[]> {
  // Group posts by month - start with originalPosts (always has data)
  const postsByMonth = new Map<
    string,
    { classified: ClassifiedPost[]; original: LinkedInPost[] }
  >();

  // First, group ALL original posts by month
  for (const post of originalPosts) {
    const month = post.posted_at.date.slice(0, 7);
    if (!postsByMonth.has(month)) {
      postsByMonth.set(month, { classified: [], original: [] });
    }
    postsByMonth.get(month)!.original.push(post);
  }

  // Then, add classified posts to their respective months (if we have them)
  for (const post of classifiedPosts) {
    const month = post.date.slice(0, 7); // YYYY-MM
    if (postsByMonth.has(month)) {
      postsByMonth.get(month)!.classified.push(post);
    }
  }

  // Sort months chronologically
  const sortedMonths = [...postsByMonth.keys()].sort();

  const timeline: MonthlySnapshot[] = [];

  for (const month of sortedMonths) {
    const { classified, original } = postsByMonth.get(month)!;

    // Calculate stats - use original posts if no classified posts available
    const totalReactions =
      classified.length > 0
        ? classified.reduce((sum, p) => sum + p.reactions, 0)
        : original.reduce((sum, p) => sum + p.stats.total_reactions, 0);
    const totalComments =
      classified.length > 0
        ? classified.reduce((sum, p) => sum + p.comments, 0)
        : original.reduce((sum, p) => sum + p.stats.comments, 0);
    const articleCount = classified.filter(
      (p) => p.classification === "article",
    ).length;
    const postCount =
      classified.length > 0 ? classified.length : original.length;

    // Get the text of all posts for AI analysis
    const postsText = original
      .map((p) => {
        // Get text from post or reshared content
        const text =
          p.text || p.reshared_post?.text || p.article?.title || "[no text]";
        const author =
          p.author.username === "vibegui"
            ? ""
            : ` (shared from ${p.author.first_name} ${p.author.last_name})`;
        return `[${p.posted_at.date}]${author} ${text.slice(0, 500)}`;
      })
      .join("\n\n---\n\n");

    progress(
      sortedMonths.indexOf(month) + 1,
      sortedMonths.length,
      `Analyzing ${month}...`,
    );

    try {
      const prompt = `Month: ${month}\nNumber of posts: ${original.length}\n\nPosts:\n${postsText}`;
      const response = await callOpenRouter(prompt, TIMELINE_PROMPT);

      // Parse response
      let jsonStr = response.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr
          .replace(/```json?\n?/g, "")
          .replace(/```$/g, "")
          .trim();
      }

      const analysis = JSON.parse(jsonStr);

      timeline.push({
        month,
        post_count: postCount,
        article_count: articleCount,
        total_reactions: totalReactions,
        total_comments: totalComments,
        top_themes: analysis.top_themes || [],
        deco_updates: analysis.deco_updates || [],
        personal_updates: analysis.personal_updates || [],
        interesting_links: analysis.interesting_links || [],
        best_quotes: analysis.best_quotes || [],
        ai_summary: analysis.ai_summary || "",
      });
    } catch (error) {
      log("warn", `Failed to analyze ${month}: ${(error as Error).message}`);
      timeline.push({
        month,
        post_count: postCount,
        article_count: articleCount,
        total_reactions: totalReactions,
        total_comments: totalComments,
        top_themes: [],
        deco_updates: [],
        personal_updates: [],
        interesting_links: [],
        best_quotes: [],
        ai_summary: `Analysis failed: ${(error as Error).message}`,
      });
    }
  }

  return timeline;
}

async function processLinkedInPosts(
  inputFile: string,
  outputDir: string,
  overridePosts?: LinkedInPost[],
  timelineOnly = false,
): Promise<ProcessingResult> {
  const startTime = Date.now();

  let postsWithContent: LinkedInPost[];
  let allYourPosts: LinkedInPost[]; // ALL posts by you (for timeline analysis)
  let notYoursCount = 0;
  let repostCount = 0;
  let totalPosts = 0;

  if (overridePosts) {
    // Use provided posts (for retry mode)
    postsWithContent = overridePosts;
    allYourPosts = overridePosts; // In retry mode, use same posts
    totalPosts = overridePosts.length;
    log("info", `Processing ${overridePosts.length} posts (retry mode)`);
  } else {
    log("info", `Loading posts from ${inputFile}`);
    const rawData = await readFile(inputFile, "utf-8");
    const allPosts: LinkedInPost[] = JSON.parse(rawData);
    totalPosts = allPosts.length;

    log("info", `Loaded ${allPosts.length} total posts`);

    // ALL posts go to timeline (including shares of others' content - you shared them!)
    allYourPosts = allPosts;
    log(
      "info",
      `Timeline will analyze ALL ${allYourPosts.length} posts (your posts + shares)`,
    );

    // For ARTICLE classification, only your original posts with content
    const yourOriginalPosts = allPosts.filter(
      (p) => p.author.username === "vibegui",
    );
    notYoursCount = allPosts.length - yourOriginalPosts.length;
    log(
      "info",
      `Found ${yourOriginalPosts.length} posts authored by you, ${notYoursCount} shares of others' content`,
    );

    // Filter out pure reposts for ARTICLE classification
    postsWithContent = yourOriginalPosts.filter(
      (p) => p.post_type !== "repost" && p.text && p.text.trim().length > 0,
    );
    repostCount = yourOriginalPosts.length - postsWithContent.length;
    log(
      "info",
      `${postsWithContent.length} posts eligible for article analysis (removed ${repostCount} pure reposts)`,
    );
  }

  // Sort by engagement for processing priority
  const sortedPosts = postsWithContent.sort(
    (a, b) =>
      calculateEngagementScore(b.stats) - calculateEngagementScore(a.stats),
  );

  // Process batches for article classification (skip if timeline-only mode)
  const classifiedPosts: ClassifiedPost[] = [];
  const skipReasons: Record<string, number> = {};

  if (timelineOnly) {
    log("info", "Timeline-only mode: skipping article classification");
  } else {
    // Split into batches of ~25 posts
    const BATCH_SIZE = 25;
    const batches: LinkedInPost[][] = [];
    for (let i = 0; i < sortedPosts.length; i += BATCH_SIZE) {
      batches.push(sortedPosts.slice(i, i + BATCH_SIZE));
    }

    log("info", `Split into ${batches.length} batches for processing`);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      progress(i + 1, batches.length, `Processing batch ${i + 1}...`);

      const result = await processBatch(batch, i + 1, batches.length);

      // Merge results with original post data
      for (const post of batch) {
        const aiResult = result.posts.find((r) => r.id === post.full_urn);

        const classified: ClassifiedPost = {
          id: post.full_urn,
          date: post.posted_at.date,
          text: post.text,
          url: post.url,
          post_type: post.post_type,
          reactions: post.stats.total_reactions,
          comments: post.stats.comments,
          reposts: post.stats.reposts,
          engagement_score: calculateEngagementScore(post.stats),
          classification: aiResult?.classification || "skip",
          skip_reason: aiResult?.skip_reason,
          article_title: aiResult?.article_title,
          article_content: aiResult?.article_content,
        };

        classifiedPosts.push(classified);

        if (classified.classification === "skip" && classified.skip_reason) {
          skipReasons[classified.skip_reason] =
            (skipReasons[classified.skip_reason] || 0) + 1;
        }
      }

      // Small delay between batches to avoid rate limiting
      if (i < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    console.error(""); // New line after progress bar
  } // End of article classification block

  // Separate articles and skipped
  const articles = classifiedPosts.filter(
    (p) => p.classification === "article",
  );
  const skipped = classifiedPosts.filter((p) => p.classification === "skip");

  if (!timelineOnly) {
    log(
      "success",
      `Classification complete: ${articles.length} articles, ${skipped.length} skipped`,
    );
  }

  // Create output directory
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true });
  }

  // Save articles as markdown files (skip if timeline-only mode)
  if (!timelineOnly && articles.length > 0) {
    const articlesDir = join(outputDir, "articles");
    if (!existsSync(articlesDir)) {
      await mkdir(articlesDir, { recursive: true });
    }

    for (const article of articles) {
      const date = article.date.split(" ")[0]; // YYYY-MM-DD
      const slug = (article.article_title || "untitled")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60);

      const filename = `${date}-${slug}.md`;
      const filepath = join(articlesDir, filename);

      const frontmatter = `---
title: "${article.article_title?.replace(/"/g, '\\"') || "Untitled"}"
date: "${date}"
originalUrl: "${article.url}"
reactions: ${article.reactions}
comments: ${article.comments}
---

`;

      const content = frontmatter + (article.article_content || article.text);
      await writeFile(filepath, content, "utf-8");
      log("success", `Saved: ${filename}`);
    }
  } // End of article saving block

  // Generate report
  const topPosts = [...classifiedPosts]
    .sort((a, b) => b.engagement_score - a.engagement_score)
    .slice(0, 20);

  // Generate monthly timeline (using ALL posts, not just article-worthy ones)
  log("info", "Generating monthly timeline analysis...");
  const monthlyTimeline = await generateMonthlyTimeline(
    classifiedPosts,
    allYourPosts,
  );

  const result: ProcessingResult = {
    total_posts: totalPosts,
    filtered_out_reposts: repostCount,
    filtered_out_not_yours: notYoursCount,
    processed_posts: postsWithContent.length,
    articles_created: articles.length,
    posts_skipped: skipped.length,
    skip_reasons: skipReasons,
    top_posts: topPosts,
    articles: articles,
    all_posts: classifiedPosts,
    monthly_timeline: monthlyTimeline,
    processing_time_ms: Date.now() - startTime,
  };

  // Save report
  const reportPath = join(outputDir, "report.json");
  await writeFile(reportPath, JSON.stringify(result, null, 2), "utf-8");
  log("success", `Report saved to ${reportPath}`);

  return result;
}

// ============================================================
// CLI Entry Point
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  const retryFailed = args.includes("--retry-failed");
  const timelineOnly = args.includes("--timeline-only");
  const filteredArgs = args.filter((a) => !a.startsWith("--"));
  const inputFile = filteredArgs[0] || "temp/vibegui-linkedin-posts-500.json";
  const outputDir = filteredArgs[1] || "temp/linkedin-articles";

  const title = timelineOnly
    ? "LinkedIn Posts → Monthly Timeline"
    : "LinkedIn Posts → Blog Articles Processor";

  console.error(`
${colors.cyan}${colors.bold}╔═══════════════════════════════════════════════════════════╗
║          ${title.padEnd(47)}║
╚═══════════════════════════════════════════════════════════╝${colors.reset}
`);

  log("info", `Input: ${inputFile}`);
  log("info", `Output: ${outputDir}`);
  log("info", `Gateway: ${MESH_GATEWAY_URL}`);
  log("info", `Model: ${MODEL}`);
  if (retryFailed) {
    log("info", `Mode: Retry failed posts only`);
  }
  console.error("");

  try {
    // If retry mode, filter to only failed posts
    let postsToProcess: LinkedInPost[] | undefined;
    if (retryFailed) {
      const reportPath = join(outputDir, "report.json");
      if (!existsSync(reportPath)) {
        log(
          "error",
          `No report found at ${reportPath}. Run without --retry-failed first.`,
        );
        process.exit(1);
      }
      const report = JSON.parse(await readFile(reportPath, "utf-8"));
      const reportPosts = report.all_posts || report.top_posts; // fallback to top_posts for old reports
      const failedIds = new Set(
        reportPosts
          .filter((p: ClassifiedPost) => p.skip_reason === "processing_error")
          .map((p: ClassifiedPost) => p.id),
      );
      log("info", `Found ${failedIds.size} failed posts to retry`);

      // Load original posts and filter to failed ones
      const rawData = await readFile(inputFile, "utf-8");
      const originalPosts: LinkedInPost[] = JSON.parse(rawData);
      postsToProcess = originalPosts.filter((p) => failedIds.has(p.full_urn));
      log("info", `Matched ${postsToProcess.length} posts from original file`);
    }

    const result = await processLinkedInPosts(
      inputFile,
      outputDir,
      postsToProcess,
      timelineOnly,
    );

    // Print summary
    console.error(`
${colors.cyan}${colors.bold}════════════════════════════════════════════════════════════
                         SUMMARY
════════════════════════════════════════════════════════════${colors.reset}

${colors.bold}Posts Breakdown:${colors.reset}
  Total scraped:           ${result.total_posts}
  Filtered (not yours):    ${result.filtered_out_not_yours}
  Filtered (pure reposts): ${result.filtered_out_reposts}
  Processed:               ${result.processed_posts}

${colors.bold}Results:${colors.reset}
  ${colors.green}Articles created:${colors.reset}       ${result.articles_created}
  ${colors.yellow}Posts skipped:${colors.reset}          ${result.posts_skipped}

${colors.bold}Skip Reasons:${colors.reset}
${Object.entries(result.skip_reasons)
  .sort((a, b) => b[1] - a[1])
  .map(([reason, count]) => `  ${reason.padEnd(25)} ${count}`)
  .join("\n")}

${colors.bold}Top 20 Most Popular Posts (by engagement):${colors.reset}
${"─".repeat(80)}
${colors.dim}${"Reactions".padStart(10)} ${"Comments".padStart(10)} ${"Score".padStart(8)} ${"Status".padStart(10)}  Title/Preview${colors.reset}
${"─".repeat(80)}
${result.top_posts
  .map((p) => {
    const status =
      p.classification === "article"
        ? `${colors.green}ARTICLE${colors.reset}`
        : `${colors.dim}skip${colors.reset}`;
    const preview =
      p.article_title ||
      (p.text || "").slice(0, 40).replace(/\n/g, " ") + "...";
    return `${String(p.reactions).padStart(10)} ${String(p.comments).padStart(10)} ${String(p.engagement_score).padStart(8)} ${status.padStart(18)}  ${preview}`;
  })
  .join("\n")}
${"─".repeat(80)}

${colors.bold}Processing Time:${colors.reset} ${(result.processing_time_ms / 1000).toFixed(1)}s

${colors.cyan}${colors.bold}Articles saved to: ${outputDir}/articles/${colors.reset}

${colors.bold}${colors.cyan}════════════════════════════════════════════════════════════
                    MONTHLY TIMELINE (Year in Review)
════════════════════════════════════════════════════════════${colors.reset}
${result.monthly_timeline
  .map((m) => {
    const monthName = new Date(m.month + "-01").toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    return `
${colors.bold}📅 ${monthName}${colors.reset} (${m.post_count} posts, ${m.article_count} articles, ${m.total_reactions} reactions)
${"─".repeat(60)}
${colors.dim}Themes:${colors.reset} ${m.top_themes.join(" • ") || "N/A"}
${colors.dim}Deco:${colors.reset} ${m.deco_updates.join(" | ") || "N/A"}
${colors.dim}Personal:${colors.reset} ${m.personal_updates.join(" | ") || "N/A"}
${colors.dim}Links:${colors.reset} ${m.interesting_links.join(" | ") || "N/A"}
${colors.dim}Quotes:${colors.reset} ${m.best_quotes.length > 0 ? `"${m.best_quotes[0]}"` : "N/A"}
${colors.dim}Summary:${colors.reset} ${m.ai_summary}`;
  })
  .join("\n")}

${colors.cyan}${colors.bold}Timeline saved to: ${outputDir}/timeline.md${colors.reset}
`);

    // Save timeline as markdown
    const timelineMd = generateTimelineMarkdown(result.monthly_timeline);
    await writeFile(join(outputDir, "timeline.md"), timelineMd, "utf-8");
  } catch (error) {
    log("error", `Failed: ${(error as Error).message}`);
    process.exit(1);
  }
}

function generateTimelineMarkdown(timeline: MonthlySnapshot[]): string {
  let md = `# Year in Review - LinkedIn Activity Timeline\n\n`;
  md += `*Generated on ${new Date().toISOString().split("T")[0]}*\n\n`;

  for (const m of timeline) {
    const monthName = new Date(m.month + "-01").toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });

    md += `## 📅 ${monthName}\n\n`;
    md += `**Stats:** ${m.post_count} posts, ${m.article_count} articles, ${m.total_reactions} reactions, ${m.total_comments} comments\n\n`;

    if (m.ai_summary) {
      md += `> ${m.ai_summary}\n\n`;
    }

    if (m.top_themes.length > 0) {
      md += `### 🧠 Key Themes\n`;
      for (const theme of m.top_themes) {
        md += `- ${theme}\n`;
      }
      md += `\n`;
    }

    if (m.deco_updates.length > 0) {
      md += `### 🚀 Deco Updates\n`;
      for (const update of m.deco_updates) {
        md += `- ${update}\n`;
      }
      md += `\n`;
    }

    if (m.personal_updates.length > 0) {
      md += `### 💭 Personal Reflections\n`;
      for (const update of m.personal_updates) {
        md += `- ${update}\n`;
      }
      md += `\n`;
    }

    if (m.interesting_links.length > 0) {
      md += `### 🔗 Interesting Links & References\n`;
      for (const link of m.interesting_links) {
        md += `- ${link}\n`;
      }
      md += `\n`;
    }

    if (m.best_quotes.length > 0) {
      md += `### 💬 Best Quotes\n`;
      for (const quote of m.best_quotes) {
        md += `> "${quote}"\n\n`;
      }
    }

    md += `---\n\n`;
  }

  return md;
}

main();
