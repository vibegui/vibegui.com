/**
 * Zero-dependency Article Reader
 *
 * Reads articles from markdown files with YAML frontmatter using an inline parser.
 * No npm dependencies — safe for Cloudflare Pages builds (SKIP_DEPENDENCY_INSTALL).
 *
 * For the full-featured parser with gray-matter, Zod validation, and stringify
 * support, see lib/articles.ts (used by sync/import scripts that run locally).
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// -- Article Interface --

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

// -- Inline YAML Frontmatter Parser --

function parseFrontmatter(fileContent: string): {
  data: Record<string, unknown>;
  content: string;
} {
  const match = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { data: {}, content: fileContent };
  }

  const yamlBlock = match[1];
  const content = match[2];
  const data: Record<string, unknown> = {};

  let currentKey = "";
  let inArray = false;
  const arrayValues: string[] = [];

  for (const line of yamlBlock.split("\n")) {
    // Array item
    if (inArray && /^\s+-\s+/.test(line)) {
      arrayValues.push(unquote(line.replace(/^\s+-\s+/, "").trim()));
      continue;
    }

    // End of array — flush
    if (inArray) {
      data[currentKey] = arrayValues.slice();
      arrayValues.length = 0;
      inArray = false;
    }

    // Key-value pair
    const kvMatch = line.match(/^(\w+):\s*(.*)$/);
    if (!kvMatch) continue;

    const key = kvMatch[1];
    const rawValue = kvMatch[2].trim();

    // Empty value followed by array items
    if (rawValue === "" || rawValue === undefined) {
      currentKey = key;
      inArray = true;
      continue;
    }

    data[key] = parseValue(rawValue);
  }

  // Flush trailing array
  if (inArray) {
    data[currentKey] = arrayValues.slice();
  }

  return { data, content };
}

function unquote(s: string): string {
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}

function parseValue(raw: string): string | null {
  if (raw === "null" || raw === "~") return null;
  return unquote(raw);
}

// -- Read --

export function readArticle(filePath: string): Article | null {
  if (!existsSync(filePath)) {
    return null;
  }

  const fileContent = readFileSync(filePath, "utf-8");
  const { data, content } = parseFrontmatter(fileContent);

  const tags = Array.isArray(data.tags)
    ? data.tags.map((t: unknown) => String(t))
    : [];

  return {
    slug: String(data.slug || ""),
    title: String(data.title || ""),
    description: String(data.description || ""),
    content: content.trim(),
    date: String(data.date || ""),
    status: data.status === "draft" ? "draft" : "published",
    coverImage: data.coverImage != null ? String(data.coverImage) : null,
    tags,
  };
}

export function readAllArticles(articlesDir: string): Article[] {
  if (!existsSync(articlesDir)) {
    return [];
  }

  const articles: Article[] = [];
  const files = readdirSync(articlesDir);

  for (const file of files) {
    if (!file.endsWith(".md") || file === "README.md") {
      continue;
    }

    const article = readArticle(join(articlesDir, file));
    if (article) {
      articles.push(article);
    }
  }

  articles.sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return articles;
}

export function getAllContent(articlesDir = "blog/articles"): Article[] {
  return readAllArticles(articlesDir);
}
