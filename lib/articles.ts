/**
 * Article Management
 *
 * Reads articles from markdown files with YAML frontmatter.
 *
 * Article format:
 * ---
 * slug: my-article
 * title: "My Article Title"
 * description: "Brief description"
 * date: 2025-01-27
 * status: published
 * coverImage: /images/articles/my-article.png
 * tags:
 *   - tag1
 *   - tag2
 * ---
 *
 * Article content in markdown...
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface Article {
  slug: string;
  title: string;
  description: string;
  content: string;
  date: string;
  status: "draft" | "published";
  coverImage: string | null;
  tags: string[];
}

/**
 * Parse YAML frontmatter from markdown content
 */
function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  if (!content.startsWith("---")) {
    return { frontmatter: {}, body: content };
  }

  const endIndex = content.indexOf("\n---", 3);
  if (endIndex === -1) {
    return { frontmatter: {}, body: content };
  }

  const frontmatterStr = content.slice(4, endIndex);
  const body = content.slice(endIndex + 4).trim();

  // Simple YAML parser for our use case
  const frontmatter: Record<string, unknown> = {};
  let currentKey = "";
  let inArray = false;
  const arrayValues: string[] = [];

  for (const line of frontmatterStr.split("\n")) {
    const trimmed = line.trim();

    // Array item
    if (trimmed.startsWith("- ") && inArray) {
      arrayValues.push(trimmed.slice(2).trim());
      continue;
    }

    // End of array
    if (inArray && !trimmed.startsWith("-")) {
      frontmatter[currentKey] = arrayValues.slice();
      arrayValues.length = 0;
      inArray = false;
    }

    // Key-value pair
    const colonIndex = trimmed.indexOf(":");
    if (colonIndex > 0) {
      const key = trimmed.slice(0, colonIndex).trim();
      let value = trimmed.slice(colonIndex + 1).trim();

      // Check if this starts an array
      if (value === "") {
        currentKey = key;
        inArray = true;
        continue;
      }

      // Remove quotes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      // Handle null
      if (value === "null") {
        frontmatter[key] = null;
      } else {
        frontmatter[key] = value;
      }
    }
  }

  // Handle trailing array
  if (inArray) {
    frontmatter[currentKey] = arrayValues;
  }

  return { frontmatter, body };
}

/**
 * Read a single article from a markdown file
 */
export function readArticle(filePath: string): Article | null {
  if (!existsSync(filePath)) {
    return null;
  }

  const content = readFileSync(filePath, "utf-8");
  const { frontmatter, body } = parseFrontmatter(content);

  const slug =
    (frontmatter.slug as string) ||
    filePath.replace(/.*\//, "").replace(/\.md$/, "");

  return {
    slug,
    title: (frontmatter.title as string) || "Untitled",
    description: (frontmatter.description as string) || "",
    content: body,
    date:
      (frontmatter.date as string) || new Date().toISOString().split("T")[0],
    status: ((frontmatter.status as string) || "draft") as
      | "draft"
      | "published",
    coverImage: (frontmatter.coverImage as string) || null,
    tags: (frontmatter.tags as string[]) || [],
  };
}

/**
 * Read all articles from a directory
 */
export function readAllArticles(articlesDir: string): Article[] {
  if (!existsSync(articlesDir)) {
    return [];
  }

  const articles: Article[] = [];
  const files = readdirSync(articlesDir);

  for (const file of files) {
    if (!file.endsWith(".md")) {
      continue;
    }

    const article = readArticle(join(articlesDir, file));
    if (article) {
      articles.push(article);
    }
  }

  // Sort by date descending
  articles.sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return articles;
}

/**
 * Get all articles (convenience function for generate.ts)
 */
export function getAllContent(articlesDir = "blog/articles"): Article[] {
  return readAllArticles(articlesDir);
}
