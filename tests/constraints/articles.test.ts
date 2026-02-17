import { describe, test, expect } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import {
  GRAY_MATTER_OPTIONS,
  ArticleFrontmatterSchema,
} from "../../lib/articles";

const ARTICLES_DIR = join(import.meta.dir, "../../blog/articles");

describe("Article Roundtrip Fidelity", () => {
  const files = readdirSync(ARTICLES_DIR).filter(
    (f) => f.endsWith(".md") && f !== "README.md",
  );

  test("all articles exist", () => {
    expect(files.length).toBeGreaterThanOrEqual(52);
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
