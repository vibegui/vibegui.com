/**
 * Enrich Social Media Links
 *
 * Fetches metadata (title, description) for X, LinkedIn, and Instagram links
 * and updates the bookmarks CSV.
 *
 * Usage: bun run scripts/enrich-social-links.ts
 */

import { readFileSync, writeFileSync } from "fs";

interface Bookmark {
  url: string;
  category: string;
  domain: string;
  content_type: string;
  relevance: string;
  title: string;
  description: string;
}

const CSV_PATH = "./public/bookmarks/links.csv";

// Parse CSV
function parseCSV(text: string): Bookmark[] {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",");

  return lines.slice(1).map((line) => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current);

    const obj: Record<string, string> = {};
    headers.forEach((header, i) => {
      obj[header] = values[i] || "";
    });

    return obj as unknown as Bookmark;
  });
}

// Convert bookmarks back to CSV
function toCSV(bookmarks: Bookmark[]): string {
  const headers = [
    "url",
    "category",
    "domain",
    "content_type",
    "relevance",
    "title",
    "description",
  ];
  const lines = [headers.join(",")];

  for (const b of bookmarks) {
    const values = headers.map((h) => {
      const val = (b as Record<string, string>)[h] || "";
      // Escape commas and quotes
      if (val.includes(",") || val.includes('"')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    });
    lines.push(values.join(","));
  }

  return lines.join("\n");
}

// Extract metadata from HTML
function extractMetadata(html: string): { title: string; description: string } {
  let title = "";
  let description = "";

  // Try og:title first
  const ogTitle = html.match(
    /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i,
  );
  if (ogTitle) {
    title = ogTitle[1];
  }

  // Try twitter:title
  if (!title) {
    const twitterTitle = html.match(
      /<meta[^>]*name=["']twitter:title["'][^>]*content=["']([^"']+)["']/i,
    );
    if (twitterTitle) {
      title = twitterTitle[1];
    }
  }

  // Try regular title tag
  if (!title) {
    const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleTag) {
      title = titleTag[1];
    }
  }

  // Try og:description
  const ogDesc = html.match(
    /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i,
  );
  if (ogDesc) {
    description = ogDesc[1];
  }

  // Try twitter:description
  if (!description) {
    const twitterDesc = html.match(
      /<meta[^>]*name=["']twitter:description["'][^>]*content=["']([^"']+)["']/i,
    );
    if (twitterDesc) {
      description = twitterDesc[1];
    }
  }

  // Try meta description
  if (!description) {
    const metaDesc = html.match(
      /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i,
    );
    if (metaDesc) {
      description = metaDesc[1];
    }
  }

  // Clean up HTML entities
  title = decodeHTMLEntities(title);
  description = decodeHTMLEntities(description);

  return { title, description };
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

// Fetch metadata for a URL
async function fetchMetadata(
  url: string,
): Promise<{ title: string; description: string } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.log(`  ❌ HTTP ${response.status}`);
      return null;
    }

    const html = await response.text();
    return extractMetadata(html);
  } catch (error) {
    console.log(`  ❌ ${(error as Error).message}`);
    return null;
  }
}

// Get platform from URL
function getPlatform(url: string): "x" | "linkedin" | "instagram" | null {
  if (url.includes("x.com") || url.includes("twitter.com")) return "x";
  if (url.includes("linkedin.com")) return "linkedin";
  if (url.includes("instagram.com")) return "instagram";
  return null;
}

// Extract username/author from URL
function extractAuthor(url: string, platform: string): string {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;

    if (platform === "x") {
      // x.com/username/status/...
      const match = path.match(/^\/([^/]+)/);
      if (match && match[1] !== "i" && match[1] !== "status") {
        return `@${match[1]}`;
      }
    }

    if (platform === "linkedin") {
      // linkedin.com/in/username or linkedin.com/posts/username_...
      const inMatch = path.match(/^\/in\/([^/]+)/);
      if (inMatch) return inMatch[1];
      const postsMatch = path.match(/^\/posts\/([^_]+)/);
      if (postsMatch) return postsMatch[1];
    }

    if (platform === "instagram") {
      // instagram.com/reel/... - harder to get username
      return "Instagram";
    }
  } catch {
    // ignore
  }
  return "";
}

async function main() {
  console.log("📖 Reading CSV...");
  const csvContent = readFileSync(CSV_PATH, "utf-8");
  const bookmarks = parseCSV(csvContent);

  console.log(`📊 Found ${bookmarks.length} bookmarks`);

  // Filter social links
  const socialLinks = bookmarks.filter((b) => getPlatform(b.url) !== null);
  console.log(`🔗 Found ${socialLinks.length} social media links to enrich`);

  // Group by platform
  const byPlatform = {
    x: socialLinks.filter((b) => getPlatform(b.url) === "x"),
    linkedin: socialLinks.filter((b) => getPlatform(b.url) === "linkedin"),
    instagram: socialLinks.filter((b) => getPlatform(b.url) === "instagram"),
  };

  console.log(`\n📱 X/Twitter: ${byPlatform.x.length}`);
  console.log(`💼 LinkedIn: ${byPlatform.linkedin.length}`);
  console.log(`📸 Instagram: ${byPlatform.instagram.length}`);

  let enriched = 0;
  let failed = 0;

  // Process each platform
  for (const [platform, links] of Object.entries(byPlatform)) {
    console.log(`\n${"=".repeat(50)}`);
    console.log(`Processing ${platform.toUpperCase()} (${links.length} links)`);
    console.log("=".repeat(50));

    for (let i = 0; i < links.length; i++) {
      const bookmark = links[i];
      console.log(
        `\n[${i + 1}/${links.length}] ${bookmark.url.slice(0, 60)}...`,
      );

      // Skip if already has good metadata
      if (
        bookmark.title &&
        bookmark.title.length > 20 &&
        !bookmark.title.includes("Post") &&
        !bookmark.title.includes("Twitter")
      ) {
        console.log(
          `  ✅ Already enriched: "${bookmark.title.slice(0, 40)}..."`,
        );
        continue;
      }

      const metadata = await fetchMetadata(bookmark.url);

      if (metadata && (metadata.title || metadata.description)) {
        // Update the bookmark in the main array
        const idx = bookmarks.findIndex((b) => b.url === bookmark.url);
        if (idx !== -1) {
          if (metadata.title) {
            bookmarks[idx].title = metadata.title.slice(0, 100);
            console.log(`  📝 Title: "${metadata.title.slice(0, 50)}..."`);
          }
          if (metadata.description) {
            bookmarks[idx].description = metadata.description.slice(0, 200);
            console.log(`  📄 Desc: "${metadata.description.slice(0, 50)}..."`);
          }

          // Add author to title if we got it
          const author = extractAuthor(bookmark.url, platform);
          if (author && !bookmarks[idx].title.includes(author)) {
            bookmarks[idx].title = `${author}: ${bookmarks[idx].title}`;
          }

          enriched++;
        }
      } else {
        // Set a better default based on author
        const author = extractAuthor(bookmark.url, platform);
        const idx = bookmarks.findIndex((b) => b.url === bookmark.url);
        if (idx !== -1 && author) {
          bookmarks[idx].title =
            `${author} on ${platform === "x" ? "X" : platform === "linkedin" ? "LinkedIn" : "Instagram"}`;
          bookmarks[idx].description = `Social media post from ${author}`;
        }
        failed++;
      }

      // Rate limiting - be nice to servers
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`✅ Enriched: ${enriched}`);
  console.log(`❌ Failed/Skipped: ${failed}`);
  console.log("=".repeat(50));

  // Write back to CSV
  console.log("\n💾 Saving CSV...");
  const newCSV = toCSV(bookmarks);
  writeFileSync(CSV_PATH, newCSV);
  console.log("✅ Done!");
}

main().catch(console.error);
