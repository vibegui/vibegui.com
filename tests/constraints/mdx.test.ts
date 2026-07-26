import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readArticle } from "../../lib/articles-reader";
import { renderMdx } from "../../lib/mdx-renderer";

const STORY_PATH = join(
  import.meta.dir,
  "../../blog/articles/the-100-million-company-is-no-longer-a-lottery.mdx",
);

describe("MDX articles", () => {
  test("discovers MDX format and story layout", () => {
    const article = readArticle(STORY_PATH);

    expect(article?.format).toBe("mdx");
    expect(article?.layout).toBe("story");
  });

  test("renders JSX expressions to inert HTML", async () => {
    const html = await renderMdx(
      "Result: <strong>{[20, 5].reduce((value, part) => value * part)}M</strong>",
    );

    expect(html).toContain("<strong>100M</strong>");
    expect(html).not.toContain("reduce(");
  });

  test("embeds compiled story HTML in the built article", () => {
    const built = readFileSync(
      join(
        import.meta.dir,
        "../../dist/article/the-100-million-company-is-no-longer-a-lottery/index.html",
      ),
      "utf-8",
    );

    expect(built).toContain("story-thesis");
    expect(built).not.toContain("[object Promise]");
  });
});
