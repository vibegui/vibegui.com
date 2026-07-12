import type { AccessLevel, Env } from "./env.ts";

const BEARER_PREFIX = "Bearer ";

export function extractPrivateToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith(BEARER_PREFIX)) {
    return authorization.slice(BEARER_PREFIX.length).trim();
  }

  const custom = request.headers.get("x-mcp-auth");
  return custom?.trim() || null;
}

export function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;

  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export function accessForRequest(request: Request, env: Env): AccessLevel {
  const expected = env.MCP_PRIVATE_TOKEN;
  if (!expected) return "public";

  const received = extractPrivateToken(request);
  if (!received || !timingSafeEqual(received, expected)) return "public";
  return "private";
}
