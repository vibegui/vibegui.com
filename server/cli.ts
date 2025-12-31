#!/usr/bin/env node
/**
 * vibegui.com MCP Server - CLI Entry Point
 *
 * Unified CLI that supports both stdio (default) and http transports.
 *
 * Usage:
 *   bun server/cli.ts                  # stdio mode (default)
 *   bun server/cli.ts --http           # http mode (requires @decocms/runtime)
 *   bun server/cli.ts --http --port 3001
 *
 * Development with hot reload:
 *   bun --watch server/cli.ts          # stdio mode with watch
 *   bun run mcp:stdio:dev              # same as above via npm script
 *
 * As npm binary (after publishing):
 *   vibegui-mcp                        # stdio mode
 *   vibegui-mcp --http                 # http mode
 *
 * For Mesh integration:
 *   Command: bun
 *   Args: --watch /path/to/vibegui.com/server/stdio.ts
 *   (This enables hot reload when you change tools)
 */

const args = process.argv.slice(2);

// Check for --http flag
const httpIndex = args.indexOf("--http");
const isHttpMode = httpIndex !== -1;

if (isHttpMode) {
  // Remove --http flag from args before passing to http module
  args.splice(httpIndex, 1);
  process.argv = [process.argv[0], process.argv[1], ...args];

  // For HTTP mode, we use the @decocms/runtime-based server
  console.error("[vibegui] Starting in HTTP mode...");
  console.error(
    "[vibegui] Use 'bun main.ts' or 'bun mcp-server.ts' for the full HTTP server with WhatsApp bridge.",
  );

  // Dynamic import of the main HTTP server
  import("../main.ts");
} else {
  // Default to stdio mode
  import("./stdio.ts");
}
