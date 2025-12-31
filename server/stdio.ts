#!/usr/bin/env node
/**
 * vibegui.com MCP Server - Stdio Transport
 *
 * This is the main entry point for running the MCP server via stdio,
 * which is the standard transport for CLI-based MCP servers.
 *
 * Usage:
 *   bun server/stdio.ts              # Run directly
 *   npx vibegui-mcp                  # If published to npm
 *
 * In Mesh, add as STDIO connection:
 *   Command: bun
 *   Args: /path/to/vibegui.com/server/stdio.ts
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools.ts";

/**
 * Create and start the MCP server with stdio transport
 */
async function main() {
  // Create MCP server
  const server = new McpServer({
    name: "vibegui",
    version: "1.0.0",
  });

  // Register all tools
  registerTools(server);

  // Connect to stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log startup (goes to stderr so it doesn't interfere with stdio protocol)
  console.error("[vibegui] MCP server running via stdio");
  console.error(
    "[vibegui] Available tool categories: Articles, Content Editing, Search, Scripts, Git, Bookmarks, Learnings, Projects",
  );
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
