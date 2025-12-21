/**
 * MCP Server Entry Point
 *
 * This file starts the MCP server using Bun's built-in HTTP server.
 * 
 * Usage:
 *   bun run mcp:dev     # Development with hot reload
 *   bun run mcp:serve   # Production server
 *
 * The MCP server will be available at:
 *   - http://localhost:3001/mcp (MCP endpoint)
 *   - http://localhost:3001/_healthcheck (health check)
 *
 * To connect to MCP Mesh:
 *   1. Deploy this server somewhere accessible
 *   2. Or use local mesh with ngrok/cloudflared tunnel
 *   3. Register the MCP in your mesh at /mcp endpoint
 */

import runtime from "./mcp-server.ts";

const PORT = Number(process.env.MCP_PORT ?? 3001);

console.log(`
╔═════════════════════════════════════════════════════════╗
║            vibegui.com MCP Server                       ║
╠═════════════════════════════════════════════════════════╣
║  Endpoints:                                             ║
║  • MCP:         http://localhost:${PORT}/mcp               ║
║  • Health:      http://localhost:${PORT}/_healthcheck      ║
║                                                         ║
║  To connect to your Mesh:                               ║
║  1. Install this MCP in your mesh                       ║
║  2. Or run: npx cloudflared tunnel --url localhost:${PORT} ║
╚═════════════════════════════════════════════════════════╝
`);

// Use Bun's built-in server
Bun.serve({
  port: PORT,
  fetch: async (req) => {
    try {
      // Create a mock env object (will be populated by runtime)
      const env = {} as Parameters<typeof runtime.fetch>[1];
      
      // Call the runtime fetch handler
      return await runtime.fetch(req, env);
    } catch (error) {
      console.error("MCP Server Error:", error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  },
});

console.log(`MCP server listening on port ${PORT}`);

