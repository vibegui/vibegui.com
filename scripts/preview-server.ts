/**
 * Simple static file server for preview/E2E testing
 *
 * Serves static HTML files before falling back to SPA (index.html).
 * This is needed because vite preview always uses SPA fallback,
 * which doesn't respect SSG article HTML files.
 */

import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DIST = join(__dirname, "..", "dist");
const PORT = parseInt(process.argv[2] || "4002", 10);

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".webmanifest": "application/manifest+json",
};

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

const server = createServer((req, res) => {
  let url = req.url || "/";

  // Remove query string
  url = url.split("?")[0];

  // Try static file first
  let filePath = join(DIST, url);

  // Check for exact file match
  if (isFile(filePath)) {
    const ext = extname(filePath);
    const content = readFileSync(filePath);
    res.setHeader(
      "Content-Type",
      MIME_TYPES[ext] || "application/octet-stream",
    );
    res.end(content);
    return;
  }

  // Check for directory index.html
  filePath = join(DIST, url, "index.html");
  if (isFile(filePath)) {
    const content = readFileSync(filePath, "utf-8");
    res.setHeader("Content-Type", "text/html");
    res.end(content);
    return;
  }

  // Fallback to root index.html (SPA)
  filePath = join(DIST, "index.html");
  if (isFile(filePath)) {
    const content = readFileSync(filePath, "utf-8");
    res.setHeader("Content-Type", "text/html");
    res.end(content);
    return;
  }

  // 404
  res.statusCode = 404;
  res.end("Not Found");
});

server.listen(PORT, () => {
  console.log(`  ➜  Local:   http://localhost:${PORT}/`);
});
