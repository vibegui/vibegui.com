import { describe, expect, test } from "bun:test";
import type { Env } from "./env.ts";
import { dispatchMcp } from "./mcp.ts";
import { mergeSemanticWriting, PERSONAL_AI_OS_RESOURCE } from "./tools.ts";

const env = {} as Env;

describe("MCP capability boundary", () => {
  test("public clients see only public writing tools", async () => {
    const result = (await dispatchMcp(env, "public", "tools/list")) as {
      tools: Array<{ name: string }>;
    };
    const names = result.tools.map((tool) => tool.name);

    expect(names).toContain("LIST_PUBLIC_WRITING");
    expect(names).toContain("GET_PUBLIC_WRITING");
    expect(names).not.toContain("GET_PORTFOLIO");
    expect(names).not.toContain("RECALL_MEMORY");
  });

  test("private clients see public and private tools", async () => {
    const result = (await dispatchMcp(env, "private", "tools/list")) as {
      tools: Array<{ name: string }>;
    };
    const names = result.tools.map((tool) => tool.name);

    expect(names).toContain("LIST_PUBLIC_WRITING");
    expect(names).toContain("GET_PORTFOLIO");
    expect(names).toContain("RECALL_MEMORY");
    expect(names).toContain("GET_DAILY_BRIEF_INPUT");
  });

  test("guessed private tool calls fail for public clients", async () => {
    expect(
      dispatchMcp(env, "public", "tools/call", {
        name: "GET_PORTFOLIO",
        arguments: {},
      }),
    ).rejects.toThrow("Unknown tool");
  });

  test("private resources are hidden from public clients", async () => {
    const publicResult = (await dispatchMcp(
      env,
      "public",
      "resources/list",
    )) as { resources: unknown[] };
    const privateResult = (await dispatchMcp(
      env,
      "private",
      "resources/list",
    )) as { resources: Array<{ uri: string }> };

    expect(publicResult.resources).toHaveLength(0);
    expect(privateResult.resources[0]?.uri).toBe(PERSONAL_AI_OS_RESOURCE);
  });

  test("semantic results exclude stale or unpublished corpus slugs", () => {
    const merged = mergeSemanticWriting(
      [
        { slug: "published", text: "best", score: 0.9 },
        { slug: "published", text: "duplicate", score: 0.5 },
        { slug: "stale-draft", text: "must not leak", score: 1 },
      ],
      [{ slug: "published", title: "Published article" }],
      10,
    );

    expect(merged).toEqual([
      {
        slug: "published",
        title: "Published article",
        text: "best",
        score: 0.9,
      },
    ]);
  });
});
