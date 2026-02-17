/**
 * Article Management
 *
 * Reads articles from markdown files with YAML frontmatter.
 * Uses gray-matter for parsing with yaml.JSON_SCHEMA to prevent date coercion.
 * Validates frontmatter against a Zod schema at parse time.
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
import matter from "gray-matter";
import yaml from "js-yaml";
import { z } from "zod";

// -- Schema Definition --

export const ArticleFrontmatterSchema = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["published", "draft"]),
  coverImage: z.string().nullable(),
  tags: z
    .array(z.union([z.string(), z.number()]).transform((v) => String(v)))
    .nullable(),
});

export type ArticleFrontmatter = z.infer<typeof ArticleFrontmatterSchema>;

// -- gray-matter Configuration --

const YAML_ENGINE = {
  parse: (str: string) =>
    yaml.load(str, { schema: yaml.JSON_SCHEMA }) as object,
  stringify: (data: object) =>
    yaml.dump(data, {
      schema: yaml.JSON_SCHEMA,
      lineWidth: -1,
    }),
};

export const GRAY_MATTER_OPTIONS = {
  engines: { yaml: YAML_ENGINE },
};

// -- Canonical Key Ordering --

const CANONICAL_KEY_ORDER = [
  "slug",
  "title",
  "description",
  "date",
  "status",
  "coverImage",
  "tags",
] as const;

export function toCanonicalOrder(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const ordered: Record<string, unknown> = {};
  for (const key of CANONICAL_KEY_ORDER) {
    if (key in data) ordered[key] = data[key];
  }
  for (const key of Object.keys(data)) {
    if (!(key in ordered)) ordered[key] = data[key];
  }
  return ordered;
}

// -- Stringify --

export function stringifyArticle(
  frontmatter: ArticleFrontmatter,
  content: string,
): string {
  const ordered = toCanonicalOrder(
    frontmatter as unknown as Record<string, unknown>,
  );
  return matter.stringify(content, ordered, GRAY_MATTER_OPTIONS);
}

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

// -- Read --

/**
 * Read a single article from a markdown file
 */
export function readArticle(filePath: string): Article | null {
  if (!existsSync(filePath)) {
    return null;
  }

  const fileContent = readFileSync(filePath, "utf-8");
  const { data, content } = matter(fileContent, GRAY_MATTER_OPTIONS);
  const frontmatter = ArticleFrontmatterSchema.parse(data);

  return {
    slug: frontmatter.slug,
    title: frontmatter.title,
    description: frontmatter.description,
    content: content.trim(),
    date: frontmatter.date,
    status: frontmatter.status,
    coverImage: frontmatter.coverImage,
    tags: frontmatter.tags ?? [],
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
    if (!file.endsWith(".md") || file === "README.md") {
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
