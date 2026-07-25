import { describe, expect, test } from "bun:test";
import type { Env } from "./env.ts";
import { dispatchMcp } from "./mcp.ts";
import {
  BOOKMARKS_RESOURCE,
  mergeSemanticWriting,
  PERSONAL_AI_OS_RESOURCE,
} from "./tools.ts";

const env = {} as Env;

describe("MCP capability boundary", () => {
  test("public clients see only public writing tools", async () => {
    const result = (await dispatchMcp(env, "public", "tools/list")) as {
      tools: Array<{ name: string }>;
    };
    const names = result.tools.map((tool) => tool.name);

    expect(names).toContain("LIST_PUBLIC_WRITING");
    expect(names).toContain("GET_PUBLIC_WRITING");
    expect(names).toContain("LIST_BOOKMARKS");
    expect(names).toContain("SEARCH_BOOKMARKS");
    expect(names).toContain("GET_BOOKMARK");
    expect(names).not.toContain("GET_PORTFOLIO");
    expect(names).not.toContain("RECALL_MEMORY");
    expect(names).not.toContain("CREATE_BOOKMARK");
    expect(names).not.toContain("UPDATE_BOOKMARK");
    expect(names).not.toContain("DELETE_BOOKMARK");
    expect(names).not.toContain("IMPORT_BOOKMARKS");
    expect(names).not.toContain("ENRICH_BOOKMARK");
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
    expect(names).toContain("CREATE_BOOKMARK");
    expect(names).toContain("LIST_ALL_BOOKMARKS");
    expect(names).toContain("SEARCH_ALL_BOOKMARKS");
    expect(names).toContain("GET_BOOKMARK_ADMIN");
    expect(names).toContain("IMPORT_BOOKMARKS");
    expect(names).toContain("ENRICH_BOOKMARK");
  });

  test("guessed private tool calls fail for public clients", async () => {
    expect(
      dispatchMcp(env, "public", "tools/call", {
        name: "GET_PORTFOLIO",
        arguments: {},
      }),
    ).rejects.toThrow("Unknown tool");
    expect(
      dispatchMcp(env, "public", "tools/call", {
        name: "IMPORT_BOOKMARKS",
        arguments: { bookmarks: [] },
      }),
    ).rejects.toThrow("Unknown tool");
  });

  test("bookmark resources are visible only to private clients", async () => {
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

    expect(publicResult.resources).toEqual([]);
    expect(privateResult.resources.map((resource) => resource.uri)).toContain(
      BOOKMARKS_RESOURCE,
    );
    expect(privateResult.resources.map((resource) => resource.uri)).toContain(
      PERSONAL_AI_OS_RESOURCE,
    );
  });

  test("private bookmark app boots the complete list tool", async () => {
    const result = (await dispatchMcp(env, "private", "resources/read", {
      uri: BOOKMARKS_RESOURCE,
    })) as { contents: Array<{ text: string }> };

    expect(result.contents[0]?.text).toContain(
      "window.__BOOT_TOOL__='LIST_ALL_BOOKMARKS'",
    );
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
