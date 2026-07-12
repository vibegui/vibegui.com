import type { Env } from "./env.ts";

export interface PublicWriting {
  slug: string;
  title: string;
  description: string;
  date: string;
  status: "published";
  tags: string[];
  coverImage: string | null;
  url: string;
}

interface Manifest {
  articles?: Array<Omit<PublicWriting, "url"> & { status: string }>;
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function listPublicWriting(env: Env): Promise<PublicWriting[]> {
  const siteOrigin = normalizedOrigin(
    env.PUBLIC_SITE_ORIGIN,
    "https://vibegui.com",
  );
  const response = await fetch(`${siteOrigin}/content/manifest.json`, {
    headers: { accept: "application/json" },
    cf: { cacheTtl: 300, cacheEverything: true },
  });
  if (!response.ok) {
    throw new Error(`Public manifest request failed (${response.status})`);
  }

  const manifest = (await response.json()) as Manifest;
  return (manifest.articles ?? [])
    .filter(
      (article): article is Omit<PublicWriting, "url"> =>
        article.status === "published" && SLUG_PATTERN.test(article.slug),
    )
    .map((article) => ({
      ...article,
      status: "published",
      tags: article.tags ?? [],
      coverImage: article.coverImage ?? null,
      url: `${siteOrigin}/article/${article.slug}`,
    }));
}

export async function getPublicWriting(
  env: Env,
  slug: string,
): Promise<PublicWriting & { content: string }> {
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error("Invalid article slug");
  }

  const writing = await listPublicWriting(env);
  const article = writing.find((candidate) => candidate.slug === slug);
  if (!article) throw new Error(`Published article not found: ${slug}`);

  const rawOrigin = normalizedOrigin(
    env.PUBLIC_REPO_RAW_ORIGIN,
    "https://raw.githubusercontent.com/vibegui/vibegui.com/main",
  );
  const response = await fetch(`${rawOrigin}/blog/articles/${slug}.md`, {
    headers: { accept: "text/markdown,text/plain" },
    cf: { cacheTtl: 300, cacheEverything: true },
  });
  if (!response.ok) {
    throw new Error(`Article source request failed (${response.status})`);
  }

  const markdown = await response.text();
  const content = publishedMarkdownBody(markdown);
  return { ...article, content };
}

export async function searchPublicWriting(
  env: Env,
  query: string,
  limit = 10,
): Promise<PublicWriting[]> {
  const terms = query
    .toLocaleLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
  if (terms.length === 0) return [];

  const writing = await listPublicWriting(env);
  return writing
    .map((article) => {
      const searchable = [
        article.title,
        article.description,
        article.tags.join(" "),
      ]
        .join(" ")
        .toLocaleLowerCase();
      const score = terms.reduce(
        (total, term) => total + (searchable.includes(term) ? 1 : 0),
        0,
      );
      return { article, score };
    })
    .filter(({ score }) => score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.article.date.localeCompare(left.article.date),
    )
    .slice(0, Math.min(50, Math.max(1, limit)))
    .map(({ article }) => article);
}

function publishedMarkdownBody(markdown: string): string {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error("Article source has invalid frontmatter");

  const frontmatter = match[1] ?? "";
  const status = frontmatter.match(
    /^status:\s*['"]?([^'"\r\n]+)['"]?\s*$/m,
  )?.[1];
  if (status?.trim() !== "published") {
    throw new Error("Article source is not published");
  }

  return (match[2] ?? "").trim();
}

function normalizedOrigin(value: string | undefined, fallback: string): string {
  return (value || fallback).replace(/\/+$/, "");
}
