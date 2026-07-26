import { defineConfig, type Connect } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve, join } from "node:path";
import { watch, existsSync, readFileSync } from "node:fs";
import { exec } from "node:child_process";

/**
 * Serve generated article and context pages through Vite in development.
 */
function ssgDevPlugin() {
  return {
    name: "ssg-dev",
    configureServer(server: {
      middlewares: { use: (middleware: Connect.HandleFunction) => void };
      transformIndexHtml: (url: string, html: string) => Promise<string>;
    }) {
      server.middlewares.use(
        (
          req: Connect.IncomingMessage,
          res: import("http").ServerResponse,
          next: Connect.NextFunction,
        ) => {
          const url = req.url || "";

          // Standalone static mini-sites (/irene, /malvados): serve the
          // complete HTML/JSON from .build/ verbatim (no SPA injection).
          const staticSite = url.match(/^\/(irene|malvados)(\/[^?]*)?(\?.*)?$/);
          if (staticSite) {
            const rest = (staticSite[2] || "").replace(/\/$/, "");
            const base = resolve(__dirname, ".build", staticSite[1] + rest);
            const filePath = rest.endsWith(".json")
              ? base
              : join(base, "index.html");
            if (existsSync(filePath)) {
              res.setHeader(
                "Content-Type",
                filePath.endsWith(".json") ? "application/json" : "text/html",
              );
              res.end(readFileSync(filePath));
              return;
            }
            return next();
          }

          let buildDir: string;
          let dataScriptId: string;
          let pathPrefix: string;

          if (url.startsWith("/article/")) {
            buildDir = "article";
            dataScriptId = "article-data";
            pathPrefix = "/article/";
          } else if (url.startsWith("/context/") && url !== "/context/") {
            buildDir = "context";
            dataScriptId = "context-data";
            pathPrefix = "/context/";
          } else {
            return next();
          }

          const path = url
            .slice(pathPrefix.length)
            .replace(/\/$/, "")
            .split("?")[0];
          if (!path) return next();

          const ssgPath = resolve(
            __dirname,
            ".build",
            buildDir,
            path,
            "index.html",
          );
          if (!existsSync(ssgPath)) {
            console.log(
              `⚠️  SSG file not found: ${ssgPath}\n   Content is being regenerated...`,
            );
            res.setHeader("Content-Type", "text/html");
            res.end(`<!DOCTYPE html>
<html>
<head><title>Rebuilding...</title></head>
<body style="background:#1a1a2e;color:#fff;font-family:system-ui;padding:2rem;">
  <h1>Content rebuilding...</h1>
  <p>The SSG file for <code>/${buildDir}/${path}</code> was not found.</p>
  <p>This usually happens when a build is in progress.</p>
  <p>The page will auto-refresh when content is ready.</p>
</body>
</html>`);
            return;
          }

          const ssgHtml = readFileSync(ssgPath, "utf-8");
          const regex = new RegExp(
            `<script id="${dataScriptId}" type="application/json">([\\s\\S]*?)</script>`,
          );
          const match = ssgHtml.match(regex);
          if (!match) return next();

          const indexPath = resolve(__dirname, "index.html");
          let indexHtml = readFileSync(indexPath, "utf-8");
          const dataScript = `<script id="${dataScriptId}" type="application/json">${match[1]}</script>`;
          indexHtml = indexHtml.replace("</body>", `${dataScript}\n</body>`);

          server
            .transformIndexHtml(url, indexHtml)
            .then((transformed) => {
              res.setHeader("Content-Type", "text/html");
              res.end(transformed);
            })
            .catch((error) => {
              console.error("Transform error:", error);
              next(error);
            });
        },
      );
    },
  };
}

/**
 * Regenerate article output and reload Vite when Markdown changes.
 */
function articleWatcherPlugin() {
  let articlesWatcher: ReturnType<typeof watch> | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let isExporting = false;
  let viteServer: { ws: { send: (message: { type: string }) => void } } | null =
    null;

  const runExport = () => {
    if (isExporting) return;
    isExporting = true;

    console.log("\n🔄 Articles changed, regenerating content...");
    exec(
      "bun scripts/generate.ts",
      { cwd: resolve(__dirname) },
      (error, stdout, stderr) => {
        isExporting = false;
        if (error) {
          console.error("❌ Build failed:", stderr);
          return;
        }

        console.log(stdout.trim() || "✅ Content rebuilt");
        setTimeout(() => {
          if (viteServer?.ws) {
            console.log("🔄 Reloading browser...");
            viteServer.ws.send({ type: "full-reload" });
          }
        }, 100);
      },
    );
  };

  return {
    name: "article-watcher",
    configureServer(server: {
      ws: { send: (message: { type: string }) => void };
    }) {
      viteServer = server;
      const articlesDir = resolve(__dirname, "blog", "articles");
      articlesWatcher = watch(
        articlesDir,
        { persistent: false, recursive: true },
        (_eventType, filename) => {
          if (!filename?.endsWith(".md") && !filename?.endsWith(".mdx")) return;
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(runExport, 300);
        },
      );
      console.log("👁️  Watching blog/articles/ for changes...");
    },
    closeBundle() {
      articlesWatcher?.close();
      articlesWatcher = null;
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), ssgDevPlugin(), articleWatcherPlugin()],

  resolve: {
    alias: {
      "~": resolve(__dirname, "./src"),
    },
  },

  build: {
    outDir: "dist",
    manifest: true,
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name].[hash].js",
        chunkFileNames: "assets/[name].[hash].js",
        assetFileNames: "assets/[name].[hash].[ext]",
        manualChunks(id) {
          if (id.includes("node_modules/react-dom")) return "react-dom";
          if (id.includes("node_modules/react")) return "react";
          if (id.includes("node_modules/marked")) return "markdown";
        },
      },
      onwarn(warning, warn) {
        if (
          warning.code === "CHUNK_SIZE_WARNING" &&
          warning.message?.includes("react-dom")
        ) {
          return;
        }
        warn(warning);
      },
    },
    target: "esnext",
    chunkSizeWarningLimit: 200,
  },

  server: {
    port: 4001,
    strictPort: true,
    host: true,
    allowedHosts: [".decocms.com", "localhost"],
    fs: {
      allow: [".", "content"],
    },
    watch: {
      ignored: ["**/.build/**", "**/public/bookmarks/**"],
    },
  },

  publicDir: "public",

  preview: {
    port: 4001,
  },
});
