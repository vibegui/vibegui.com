/**
 * Finalize Build (Step 2 of build)
 *
 * Runs AFTER Vite build to:
 * - Copy manifest and bookmarks to dist/
 * - Process SSG HTML files (replace dev scripts with prod assets)
 * - Embed manifest data directly into index.html
 *
 * Only reads from .build/ and dist/ (no database access needed).
 */

import {
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  copyFileSync,
  rmSync,
} from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const DIST = resolve(ROOT, "dist");
const PUBLIC = resolve(ROOT, "public");
const BUILD = resolve(ROOT, ".build");

/**
 * Copy directory contents recursively
 */
function copyDir(src: string, dest: string) {
  if (!existsSync(src)) return;
  mkdirSync(dest, { recursive: true });

  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Extract asset tags from built index.html to inject into SSG pages
 */
function extractAssets(html: string): { styles: string; scripts: string } {
  const scriptTags =
    html.match(/<script[^>]*src="[^"]*"[^>]*><\/script>/g) || [];
  const styleTags =
    html.match(/<link[^>]*stylesheet[^>]*href="\/assets\/[^"]*"[^>]*>/g) || [];
  const preloadTags = html.match(/<link[^>]*modulepreload[^>]*>/g) || [];

  return {
    styles: [...preloadTags, ...styleTags].join("\n    "),
    scripts: scriptTags.join("\n    "),
  };
}

/**
 * Process SSG HTML files - replace dev scripts with prod assets
 */
function processSSGPages(
  srcDir: string,
  destDir: string,
  assets: { styles: string; scripts: string },
): number {
  if (!existsSync(srcDir)) return 0;

  // Clean dest
  if (existsSync(destDir)) {
    rmSync(destDir, { recursive: true });
  }
  mkdirSync(destDir, { recursive: true });

  let count = 0;

  function processDir(src: string, dest: string) {
    for (const entry of readdirSync(src, { withFileTypes: true })) {
      const srcPath = join(src, entry.name);
      const destPath = join(dest, entry.name);

      if (entry.isDirectory()) {
        mkdirSync(destPath, { recursive: true });
        processDir(srcPath, destPath);
      } else if (entry.name === "index.html") {
        let html = readFileSync(srcPath, "utf-8");

        // Replace dev scripts with prod assets
        html = html.replace(
          /<script type="module" src="\/@vite\/client"><\/script>\s*<script type="module" src="\/src\/main\.tsx"><\/script>/,
          `${assets.styles}\n    ${assets.scripts}`,
        );

        writeFileSync(destPath, html);
        count++;
      }
    }
  }

  processDir(srcDir, destDir);
  return count;
}

async function main() {
  const startTime = performance.now();
  console.log("\n🔧 Finalizing build...\n");

  // Copy manifest and bookmarks
  console.log("📁 Copying assets...");
  const contentDir = resolve(DIST, "content");
  mkdirSync(contentDir, { recursive: true });
  copyFileSync(
    resolve(PUBLIC, "content", "manifest.json"),
    resolve(contentDir, "manifest.json"),
  );
  copyDir(resolve(PUBLIC, "bookmarks"), resolve(DIST, "bookmarks"));
  console.log("  ✅ Manifest, bookmarks copied");

  // Extract assets from built index.html
  const indexPath = resolve(DIST, "index.html");
  const indexHtml = readFileSync(indexPath, "utf-8");
  const assets = extractAssets(indexHtml);

  // Process SSG HTML files (articles and context)
  console.log("\n📁 Processing SSG pages...");
  const articleCount = processSSGPages(
    resolve(BUILD, "article"),
    resolve(DIST, "article"),
    assets,
  );
  const contextCount = processSSGPages(
    resolve(BUILD, "context"),
    resolve(DIST, "context"),
    assets,
  );
  console.log(`  ✅ ${articleCount} articles, ${contextCount} context pages`);

  // Read manifest for embedding
  const manifestPath = resolve(DIST, "content", "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

  // Escape </script> to prevent HTML injection
  const manifestJson = JSON.stringify(manifest).replace(
    /<\/script>/g,
    "<\\/script>",
  );

  // Embed manifest into index.html
  console.log("\n📝 Updating index.html...");
  let updatedIndexHtml = indexHtml;

  // Remove any old manifest path injection
  updatedIndexHtml = updatedIndexHtml.replace(
    /<script>window\.__MANIFEST_PATH__="[^"]*";<\/script>\n?/g,
    "",
  );

  // Embed manifest data after <div id="root">
  const manifestTag = `<script id="manifest-data" type="application/json">${manifestJson}</script>`;
  updatedIndexHtml = updatedIndexHtml.replace(
    '<div id="root"></div>',
    `<div id="root"></div>\n    ${manifestTag}`,
  );

  writeFileSync(indexPath, updatedIndexHtml);
  console.log("  ✅ Embedded manifest (no fetch needed)");

  // Note: .build/ is kept around for dev server compatibility (it's in .gitignore)

  const elapsed = (performance.now() - startTime).toFixed(0);
  console.log(`\n✨ Build finalized (${elapsed}ms)`);
  console.log(`   Articles: ${articleCount}`);
  console.log(`   Context: ${contextCount}`);
  console.log(`   Projects: ${manifest.projects?.length || 0}\n`);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
