import type { AccessLevel, Env } from "./env.ts";
import { MCP_APP_MIME, readResource, resourcesForAccess } from "./resources.ts";
import { toolByName, toolsForAccess } from "./tools.ts";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const SERVER_INFO = {
  name: "vibegui-personal-ai-os",
  version: "0.1.0",
};

const PROTOCOL_VERSION = "2024-11-05";

export async function handleMcpRequest(
  request: Request,
  env: Env,
  access: AccessLevel,
): Promise<Response> {
  const body = (await request
    .json()
    .catch(() => null)) as JsonRpcRequest | null;
  if (!body || body.jsonrpc !== "2.0" || !body.method) {
    return json(rpcError(null, -32600, "Invalid Request"), 400);
  }

  const id = body.id ?? null;
  try {
    const result = await dispatchMcp(env, access, body.method, body.params);
    return json(rpcOk(id, result));
  } catch (error) {
    const rpc = error as Error & { code?: number; data?: unknown };
    return json(
      rpcError(
        id,
        rpc.code ?? -32603,
        rpc.message || "Internal error",
        rpc.data,
      ),
    );
  }
}

export async function dispatchMcp(
  env: Env,
  access: AccessLevel,
  method: string,
  params: Record<string, unknown> = {},
): Promise<unknown> {
  switch (method) {
    case "initialize":
      return {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {
          tools: { listChanged: false },
          resources: { listChanged: false },
        },
        serverInfo: SERVER_INFO,
        instructions:
          access === "private" ? privateInstructions() : publicInstructions(),
      };

    case "ping":
      return {};

    case "tools/list":
      return {
        tools: toolsForAccess(access).map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          ...(tool._meta ? { _meta: tool._meta } : {}),
        })),
      };

    case "tools/call": {
      const name = typeof params.name === "string" ? params.name : undefined;
      const args =
        params.arguments &&
        typeof params.arguments === "object" &&
        !Array.isArray(params.arguments)
          ? (params.arguments as Record<string, unknown>)
          : {};
      if (!name) throw rpcErrorValue(-32602, "Missing tool name");

      const tool = toolByName[name];
      if (!tool || (tool.access === "private" && access !== "private")) {
        throw rpcErrorValue(-32601, `Unknown tool: ${name}`);
      }

      const output = await tool.execute(env, args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(output, null, 2),
          },
        ],
        structuredContent: output,
        isError: false,
      };
    }

    case "resources/list":
      return {
        resources: resourcesForAccess(access).map((resource) => ({
          uri: resource.uri,
          name: resource.name,
          description: resource.description,
          mimeType: MCP_APP_MIME,
        })),
      };

    case "resources/read": {
      const uri = typeof params.uri === "string" ? params.uri : undefined;
      if (!uri) throw rpcErrorValue(-32602, "Missing resource uri");

      const result = readResource(uri, access);
      if (!result) {
        throw rpcErrorValue(-32601, `Unknown resource: ${uri}`);
      }
      return {
        contents: [
          {
            uri,
            mimeType: MCP_APP_MIME,
            text: result.body,
          },
        ],
      };
    }

    case "prompts/list":
      return { prompts: [] };

    default:
      throw rpcErrorValue(-32601, `Method not found: ${method}`);
  }
}

function privateInstructions(): string {
  return [
    "You are the user's VibeGui Personal AI OS, used privately through deco Studio.",
    "At the beginning of a meaningful session, call GET_PORTFOLIO, LIST_GOALS, RECALL_MEMORY, and GET_DAILY_BRIEF before recommending priorities.",
    "Repositories and GitHub are read-only. Never claim to have changed an external project.",
    "You may maintain this system's own projects, goals, memory, decisions, captures, and daily briefs.",
    "Treat activity as evidence of attention, never as measured hours.",
    "Distinguish facts, observations, and recommendations. Cite repository or issue URLs when available.",
    "Persist only durable information. Routine conversation is not memory.",
    "Project lifecycle is explicit: draft, active, or archived. Do not invent additional priority labels.",
  ].join("\n");
}

function publicInstructions(): string {
  return [
    "You are connected to the public VibeGui writing tools.",
    "Only published writing is available. Private projects, goals, memory, captures, and conversations do not exist in this capability set.",
    "Cite article titles and canonical URLs when using the writing.",
  ].join("\n");
}

function rpcOk(id: number | string | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(
  id: number | string | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: { code, message, ...(data === undefined ? {} : { data }) },
  };
}

function rpcErrorValue(
  code: number,
  message: string,
): Error & { code: number } {
  const error = new Error(message) as Error & { code: number };
  error.code = code;
  return error;
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
