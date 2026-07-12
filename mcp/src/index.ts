import { accessForRequest } from "./auth.ts";
import type { Env } from "./env.ts";
import { refreshGitHub } from "./github.ts";
import { handleMcpRequest } from "./mcp.ts";
import { markBriefDue } from "./state.ts";

const worker: ExportedHandler<Env> = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const access = accessForRequest(request, env);

    if (request.method === "GET" && url.pathname === "/") {
      return json({
        name: "vibegui-personal-ai-os",
        ok: true,
        publicMcp: `${url.origin}/mcp`,
        privateMode: access === "private",
      });
    }

    if (request.method === "GET" && url.pathname === "/mcp") {
      return json({
        jsonrpc: "2.0",
        server: {
          name: "vibegui-personal-ai-os",
          version: "0.1.0",
        },
        mode: access,
        hint: "POST MCP JSON-RPC requests here.",
      });
    }

    if (request.method === "POST" && url.pathname === "/mcp") {
      return handleMcpRequest(request, env, access);
    }

    return json({ error: "not found", path: url.pathname }, 404);
  },

  async scheduled(_controller, env, context) {
    context.waitUntil(
      Promise.all([
        markBriefDue(env),
        env.GITHUB_TOKEN
          ? refreshGitHub(env).catch((error) => {
              console.warn("Scheduled GitHub refresh failed", error);
            })
          : Promise.resolve(),
      ]).then(() => undefined),
    );
  },
};

export default worker;

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
