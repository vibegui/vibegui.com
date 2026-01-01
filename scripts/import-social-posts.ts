/**
 * Import LinkedIn posts into social_posts table
 *
 * This script:
 * 1. Creates the social_posts table if it doesn't exist
 * 2. Imports posts from temp/vibegui-linkedin-posts-500.json (deduplicating by activity_urn)
 * 3. Parses generated markdown files to link AI-generated titles/descriptions
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const DATA_DIR = join(PROJECT_ROOT, "data");
const DB_PATH = join(DATA_DIR, "content.db");
const POSTS_JSON = join(
  PROJECT_ROOT,
  "temp",
  "vibegui-linkedin-posts-500.json",
);
const ARTICLES_DIR = join(
  PROJECT_ROOT,
  "temp",
  "linkedin-articles",
  "articles",
);

// Use bun:sqlite directly (this script runs with Bun)
import { Database } from "bun:sqlite";

const db = new Database(DB_PATH);
db.exec("PRAGMA journal_mode = DELETE;");

// Create social_posts table
console.log("Creating social_posts table...");
db.exec(`
  CREATE TABLE IF NOT EXISTS social_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- URN identifiers (for deduplication)
    activity_urn TEXT UNIQUE NOT NULL,
    share_urn TEXT,
    ugc_post_urn TEXT,
    full_urn TEXT NOT NULL,
    
    -- Post data
    platform TEXT NOT NULL DEFAULT 'linkedin',
    post_type TEXT NOT NULL,  -- regular, repost, quote
    posted_at TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    text TEXT NOT NULL,
    url TEXT NOT NULL,
    
    -- Author data
    author_username TEXT NOT NULL,
    author_first_name TEXT,
    author_last_name TEXT,
    author_headline TEXT,
    author_profile_url TEXT,
    author_profile_picture TEXT,
    
    -- Stats (for ranking)
    total_reactions INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    supports INTEGER DEFAULT 0,
    loves INTEGER DEFAULT 0,
    insights INTEGER DEFAULT 0,
    celebrates INTEGER DEFAULT 0,
    funnies INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    reposts INTEGER DEFAULT 0,
    
    -- Media
    media_type TEXT,
    media_url TEXT,
    media_thumbnail TEXT,
    media_images_json TEXT,  -- JSON array of image objects
    
    -- Article/Link preview
    article_url TEXT,
    article_title TEXT,
    article_subtitle TEXT,
    
    -- Reshared post (for reposts/quotes)
    reshared_post_json TEXT,  -- Full JSON of reshared post
    
    -- AI-generated content (from markdown extraction)
    generated_title TEXT,
    generated_description TEXT,
    article_content TEXT,  -- Full AI-expanded article
    
    -- Curation flags
    is_curated INTEGER DEFAULT 0,  -- Marked for article conversion
    curated_article_slug TEXT,  -- Link to converted article in content table
    
    -- Metadata
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_social_posts_activity_urn ON social_posts(activity_urn);
  CREATE INDEX IF NOT EXISTS idx_social_posts_author ON social_posts(author_username);
  CREATE INDEX IF NOT EXISTS idx_social_posts_posted_at ON social_posts(posted_at);
  CREATE INDEX IF NOT EXISTS idx_social_posts_timestamp ON social_posts(timestamp);
  CREATE INDEX IF NOT EXISTS idx_social_posts_reactions ON social_posts(total_reactions);
  CREATE INDEX IF NOT EXISTS idx_social_posts_comments ON social_posts(comments);
  CREATE INDEX IF NOT EXISTS idx_social_posts_curated ON social_posts(is_curated);
`);

// Types for LinkedIn post data
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
  post_type: string;
  author: {
    first_name: string;
    last_name: string;
    headline: string;
    username: string;
    profile_url: string;
    profile_picture: string;
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
    thumbnail?: string;
    images?: Array<{ url: string; width: number; height: number }>;
  };
  article?: {
    url: string;
    title: string;
    subtitle: string;
  };
  reshared_post?: unknown;
}

// Load posts from JSON
console.log(`Loading posts from ${POSTS_JSON}...`);
const postsJson = readFileSync(POSTS_JSON, "utf-8");
const posts: LinkedInPost[] = JSON.parse(postsJson);
console.log(`Loaded ${posts.length} posts from JSON`);

// Prepare insert statement
const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO social_posts (
    activity_urn, share_urn, ugc_post_urn, full_urn,
    platform, post_type, posted_at, timestamp, text, url,
    author_username, author_first_name, author_last_name, author_headline,
    author_profile_url, author_profile_picture,
    total_reactions, likes, supports, loves, insights, celebrates, funnies,
    comments, reposts,
    media_type, media_url, media_thumbnail, media_images_json,
    article_url, article_title, article_subtitle,
    reshared_post_json
  ) VALUES (
    ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?,
    ?, ?,
    ?, ?, ?, ?, ?, ?, ?,
    ?, ?,
    ?, ?, ?, ?,
    ?, ?, ?,
    ?
  )
`);

// Import posts
let imported = 0;
let skipped = 0;

for (const post of posts) {
  try {
    const result = insertStmt.run(
      post.urn.activity_urn,
      post.urn.share_urn,
      post.urn.ugcPost_urn,
      post.full_urn,
      "linkedin",
      post.post_type,
      post.posted_at.date,
      post.posted_at.timestamp,
      post.text,
      post.url,
      post.author.username,
      post.author.first_name,
      post.author.last_name,
      post.author.headline,
      post.author.profile_url,
      post.author.profile_picture,
      post.stats.total_reactions,
      post.stats.like,
      post.stats.support,
      post.stats.love,
      post.stats.insight,
      post.stats.celebrate,
      post.stats.funny,
      post.stats.comments,
      post.stats.reposts,
      post.media?.type || null,
      post.media?.url || null,
      post.media?.thumbnail || null,
      post.media?.images ? JSON.stringify(post.media.images) : null,
      post.article?.url || null,
      post.article?.title || null,
      post.article?.subtitle || null,
      post.reshared_post ? JSON.stringify(post.reshared_post) : null,
    );

    if (result.changes > 0) {
      imported++;
    } else {
      skipped++;
    }
  } catch (err) {
    console.error(`Error importing post ${post.urn.activity_urn}:`, err);
    skipped++;
  }
}

console.log(`Imported ${imported} posts, skipped ${skipped} duplicates`);

// Now parse markdown files to get generated titles/descriptions
console.log(`\nParsing generated markdown files from ${ARTICLES_DIR}...`);

interface MarkdownFrontmatter {
  title: string;
  date: string;
  originalUrl: string;
  reactions: number;
  comments: number;
}

function parseMarkdownFrontmatter(content: string): {
  frontmatter: MarkdownFrontmatter;
  body: string;
} | null {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!frontmatterMatch) return null;

  const [, frontmatterStr, body] = frontmatterMatch;
  const frontmatter: Record<string, string | number> = {};

  for (const line of frontmatterStr.split("\n")) {
    const match = line.match(/^(\w+):\s*"?([^"]*)"?$/);
    if (match) {
      const [, key, value] = match;
      // Parse numbers
      if (key === "reactions" || key === "comments") {
        frontmatter[key] = parseInt(value, 10);
      } else {
        frontmatter[key] = value;
      }
    }
  }

  return {
    frontmatter: frontmatter as unknown as MarkdownFrontmatter,
    body: body.trim(),
  };
}

// Extract activity_urn from LinkedIn URL
function extractActivityUrn(url: string): string | null {
  // URLs look like: https://www.linkedin.com/posts/vibegui_...-activity-7258072637707329536-5m8I?...
  const match = url.match(/activity-(\d+)/);
  return match ? match[1] : null;
}

if (existsSync(ARTICLES_DIR)) {
  const files = readdirSync(ARTICLES_DIR).filter((f) => f.endsWith(".md"));
  console.log(`Found ${files.length} markdown files`);

  // Group by originalUrl to find duplicates and pick the best one
  const articlesByUrn: Map<
    string,
    Array<{ file: string; title: string; body: string }>
  > = new Map();

  for (const file of files) {
    const content = readFileSync(join(ARTICLES_DIR, file), "utf-8");
    const parsed = parseMarkdownFrontmatter(content);
    if (!parsed) continue;

    const activityUrn = extractActivityUrn(parsed.frontmatter.originalUrl);
    if (!activityUrn) continue;

    if (!articlesByUrn.has(activityUrn)) {
      articlesByUrn.set(activityUrn, []);
    }
    articlesByUrn.get(activityUrn)!.push({
      file,
      title: parsed.frontmatter.title,
      body: parsed.body,
    });
  }

  console.log(
    `Found ${articlesByUrn.size} unique posts with generated content`,
  );

  // Update posts with generated content
  const updateStmt = db.prepare(`
    UPDATE social_posts 
    SET generated_title = ?, 
        generated_description = ?,
        article_content = ?,
        updated_at = datetime('now')
    WHERE activity_urn = ?
  `);

  let updated = 0;
  for (const [activityUrn, articles] of articlesByUrn) {
    // Pick the first one (or could pick longest/best)
    const article = articles[0];

    // Generate a short description from the body (first 200 chars)
    const description =
      article.body.length > 200
        ? article.body.slice(0, 200).trim() + "..."
        : article.body;

    const result = updateStmt.run(
      article.title,
      description,
      article.body,
      activityUrn,
    );

    if (result.changes > 0) {
      updated++;
    }
  }

  console.log(`Updated ${updated} posts with generated titles/content`);
}

// Print summary stats
console.log("\n=== Summary ===");
const totalPosts = (
  db.prepare("SELECT COUNT(*) as count FROM social_posts").get() as {
    count: number;
  }
).count;
const myPosts = (
  db
    .prepare(
      "SELECT COUNT(*) as count FROM social_posts WHERE author_username = 'vibegui'",
    )
    .get() as { count: number }
).count;
const withContent = (
  db
    .prepare(
      "SELECT COUNT(*) as count FROM social_posts WHERE article_content IS NOT NULL",
    )
    .get() as { count: number }
).count;
const topByReactions = db
  .prepare(`
    SELECT posted_at, total_reactions, comments, generated_title, substr(text, 1, 80) as text_preview
    FROM social_posts 
    WHERE author_username = 'vibegui'
    ORDER BY total_reactions DESC 
    LIMIT 10
  `)
  .all() as Array<{
  posted_at: string;
  total_reactions: number;
  comments: number;
  generated_title: string | null;
  text_preview: string;
}>;

console.log(`Total posts in database: ${totalPosts}`);
console.log(`Your posts (vibegui): ${myPosts}`);
console.log(`Posts with AI-generated content: ${withContent}`);
console.log("\nTop 10 posts by reactions:");
for (const post of topByReactions) {
  const title = post.generated_title || post.text_preview;
  console.log(
    `  ${post.posted_at} | ${post.total_reactions} reactions, ${post.comments} comments | ${title.slice(0, 60)}...`,
  );
}
