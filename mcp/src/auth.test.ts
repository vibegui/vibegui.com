import { describe, expect, test } from "bun:test";
import { accessForRequest, timingSafeEqual } from "./auth.ts";
import type { Env } from "./env.ts";

function env(token?: string): Env {
  return {
    MCP_PRIVATE_TOKEN: token,
  } as Env;
}

describe("private MCP authentication", () => {
  test("fails closed when no private token is configured", () => {
    const request = new Request("https://example.com/mcp", {
      headers: { authorization: "Bearer anything" },
    });
    expect(accessForRequest(request, env())).toBe("public");
  });

  test("accepts the configured bearer token", () => {
    const request = new Request("https://example.com/mcp", {
      headers: { authorization: "Bearer private-value" },
    });
    expect(accessForRequest(request, env("private-value"))).toBe("private");
  });

  test("rejects an incorrect token", () => {
    const request = new Request("https://example.com/mcp", {
      headers: { "x-mcp-auth": "wrong" },
    });
    expect(accessForRequest(request, env("private-value"))).toBe("public");
  });

  test("timing-safe comparison handles equal and unequal values", () => {
    expect(timingSafeEqual("same", "same")).toBe(true);
    expect(timingSafeEqual("same", "diff")).toBe(false);
    expect(timingSafeEqual("short", "longer")).toBe(false);
  });
});
