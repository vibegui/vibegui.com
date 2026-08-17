import { describe, test, expect } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import {
  GRAY_MATTER_OPTIONS,
  ArticleFrontmatterSchema,
  toCanonicalOrder,
} from "../../lib/articles";

const ARTICLES_DIR = join(import.meta.dir, "../../blog/articles");

describe("Article Roundtrip Fidelity", () => {
  const files = readdirSync(ARTICLES_DIR).filter(
    (f) => (f.endsWith(".md") || f.endsWith(".mdx")) && f !== "README.md",
  );

  test("all articles exist", () => {
    expect(files.length).toBeGreaterThanOrEqual(48);
  });

  test("locale slugs and translation pairs are unique", () => {
    const slugs = new Set<string>();
    const translations = new Set<string>();

    for (const file of files) {
      const parsed = matter(
        readFileSync(join(ARTICLES_DIR, file), "utf-8"),
        GRAY_MATTER_OPTIONS,
      );
      const frontmatter = ArticleFrontmatterSchema.parse(parsed.data);
      const slugKey = `${frontmatter.locale}:${frontmatter.slug}`;
      const translationKey = `${frontmatter.locale}:${frontmatter.translationKey}`;

      expect(slugs.has(slugKey)).toBe(false);
      expect(translations.has(translationKey)).toBe(false);
      slugs.add(slugKey);
      translations.add(translationKey);
    }
  });

  test("canonical order keeps translation metadata near the slug", () => {
    const ordered = toCanonicalOrder({
      tags: [],
      title: "Title",
      translationKey: "article",
      locale: "en",
      slug: "article",
      originalUrl: "https://example.com/article",
      description: "Description",
    });

    expect(Object.keys(ordered).slice(0, 6)).toEqual([
      "slug",
      "locale",
      "translationKey",
      "title",
      "originalUrl",
      "description",
    ]);
  });

  for (const file of files) {
    test(`roundtrip: ${file}`, () => {
      const content = readFileSync(join(ARTICLES_DIR, file), "utf-8");

      // Parse
      const parsed = matter(content, GRAY_MATTER_OPTIONS);

      // Stringify
      const output = matter.stringify(
        parsed.content,
        parsed.data,
        GRAY_MATTER_OPTIONS,
      );

      // Re-parse
      const reparsed = matter(output, GRAY_MATTER_OPTIONS);

      // Semantic equivalence: data objects match
      expect(reparsed.data).toEqual(parsed.data);

      // Trimmed content match
      expect(reparsed.content.trim()).toEqual(parsed.content.trim());
    });

    test(`schema valid: ${file}`, () => {
      const content = readFileSync(join(ARTICLES_DIR, file), "utf-8");
      const parsed = matter(content, GRAY_MATTER_OPTIONS);

      const result = ArticleFrontmatterSchema.safeParse(parsed.data);
      if (!result.success) {
        throw new Error(
          `${file}: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`,
        );
      }
    });
  }
});

describe("Drafts are never advertised", () => {
  // A draft may be reachable at its own URL on a Cloudflare Pages branch
  // preview. It must never be listed anywhere a crawler or a reader would
  // find it, in any build mode — that is what makes the preview link safe
  // to share.
  const PUBLIC_DIR = join(import.meta.dir, "../../public");

  const draftSlugs = readdirSync(ARTICLES_DIR)
    .filter(
      (f) => (f.endsWith(".md") || f.endsWith(".mdx")) && f !== "README.md",
    )
    .map((f) =>
      matter(readFileSync(join(ARTICLES_DIR, f), "utf-8"), GRAY_MATTER_OPTIONS),
    )
    .filter((parsed) => parsed.data.status === "draft")
    .map((parsed) => String(parsed.data.slug));

  for (const listing of [
    "sitemap.xml",
    "_redirects",
    "feed.xml",
    "en/feed.xml",
  ]) {
    test(`${listing} contains no draft slug`, () => {
      const content = readFileSync(join(PUBLIC_DIR, listing), "utf-8");
      const leaked = draftSlugs.filter((slug) =>
        content.includes(`/article/${slug}`),
      );
      expect(leaked).toEqual([]);
    });
  }
});
