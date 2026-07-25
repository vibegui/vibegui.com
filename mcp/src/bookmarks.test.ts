import { describe, expect, test } from "bun:test";
import {
  buildFtsQuery,
  computeMatchFlags,
  parseBookmarkInput,
  tokenizeSearch,
} from "./bookmarks.ts";
import { formatInsight, parseClassification } from "./bookmark-enrichment.ts";

describe("bookmark transformations", () => {
  test("builds a safe prefix FTS query from user text", () => {
    expect(tokenizeSearch("  MCP + Agents, MCP! ")).toEqual(["mcp", "agents"]);
    expect(buildFtsQuery("MCP + Agents")).toBe('"mcp"* AND "agents"*');
    expect(() => buildFtsQuery(" ! ")).toThrow("searchable word");
  });

  test("reports the areas containing search terms", () => {
    expect(
      computeMatchFlags(
        {
          title: "Agent observability",
          description: null,
          url: "https://example.com",
          search_tags: "tech:mcp",
          perplexity_research: "Founded in Paris",
          insight_dev: "Trace every tool call",
          insight_founder: null,
          insight_investor: null,
          content_excerpt: "Production setup",
        },
        ["mcp", "trace"],
      ),
    ).toEqual({
      metadata: false,
      tags: true,
      research: false,
      insight: true,
      content: false,
    });
  });

  test("validates imported bookmark values", () => {
    expect(
      parseBookmarkInput({
        url: "https://example.com/article#section",
        stars: 5,
        reading_time_min: 3,
        tags: ["tech:mcp"],
        firecrawl_content: "# Article",
      }),
    ).toMatchObject({
      url: "https://example.com/article#section",
      stars: 5,
      tags: ["tech:mcp"],
    });
    expect(() => parseBookmarkInput({ url: "javascript:alert(1)" })).toThrow(
      "http or https",
    );
    expect(() =>
      parseBookmarkInput({ url: "https://example.com", stars: 6 }),
    ).toThrow("stars");
  });

  test("parses classification JSON and formats insight arrays", () => {
    const classification = parseClassification(
      'Result: {"stars":4,"tags":["persona:mcp_developer"],"insight_dev":["First paragraph.","Second paragraph."]}',
    );
    expect(classification.stars).toBe(4);
    expect(formatInsight(classification.insight_dev)).toBe(
      "- First paragraph.\n\n- Second paragraph.",
    );
  });
});
