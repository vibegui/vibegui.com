/**
 * Finalize Build (Step 2 of build)
 *
 * Runs AFTER Vite build to:
 * - Copy manifest and bookmarks to dist/
 * - Process article HTML (replace dev scripts with prod assets)
 * - Hash context files for immutable caching
 * - Embed manifest data directly into index.html
 *
 * Does NOT require SQLite - only reads from public/ and dist/.
 */

import { createHash } from "node:crypto";
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
const CONTEXT_DIR = resolve(ROOT, "context");

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 8);
}

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
 * Process context files with hashed names
 */
function processContextDirectory(
  sourceDir: string,
  destDir: string,
  relativePath = "",
): Array<{ original: string; path: string; hash: string }> {
  const results: Array<{ original: string; path: string; hash: string }> = [];

  if (!existsSync(sourceDir)) return results;

  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = join(sourceDir, entry.name);
    const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const subDestDir = join(destDir, entry.name);
      mkdirSync(subDestDir, { recursive: true });
      results.push(...processContextDirectory(sourcePath, subDestDir, relPath));
    } else if (entry.name.endsWith(".md")) {
      const content = readFileSync(sourcePath, "utf-8");
      const hash = hashContent(content);
      const baseName = entry.name.replace(".md", "");
      const hashedName = `${baseName}.${hash}.md`;

      writeFileSync(join(destDir, hashedName), content);

      const originalPath = relativePath
        ? `${relativePath}/${baseName}`
        : baseName;
      const hashedPath = relativePath
        ? `${relativePath}/${hashedName}`
        : hashedName;

      results.push({ original: originalPath, path: hashedPath, hash });
      console.log(`  📄 ${originalPath}.md → ${hashedName}`);
    } else {
      copyFileSync(sourcePath, join(destDir, entry.name));
    }
  }

  return results;
}

/**
 * Extract asset tags from built index.html to inject into article pages
 */
function extractAssets(html: string): { styles: string; scripts: string } {
  // Get script tags with src
  const scriptTags =
    html.match(/<script[^>]*src="[^"]*"[^>]*><\/script>/g) || [];
  // Get stylesheet links pointing to /assets/
  const styleTags =
    html.match(/<link[^>]*stylesheet[^>]*href="\/assets\/[^"]*"[^>]*>/g) || [];
  // Get modulepreload links
  const preloadTags = html.match(/<link[^>]*modulepreload[^>]*>/g) || [];

  return {
    styles: [...preloadTags, ...styleTags].join("\n    "),
    scripts: scriptTags.join("\n    "),
  };
}

/**
 * Process article HTML files - replace dev scripts with prod assets
 */
function processArticles(assets: { styles: string; scripts: string }) {
  const buildArticles = resolve(ROOT, ".build", "article");
  const distArticles = resolve(DIST, "article");

  if (!existsSync(buildArticles)) return 0;

  // Clean dist/article/
  if (existsSync(distArticles)) {
    rmSync(distArticles, { recursive: true });
  }
  mkdirSync(distArticles, { recursive: true });

  let count = 0;
  for (const slug of readdirSync(buildArticles)) {
    const srcPath = join(buildArticles, slug, "index.html");
    if (!existsSync(srcPath)) continue;

    let html = readFileSync(srcPath, "utf-8");

    // Replace dev scripts with prod assets
    html = html.replace(
      /<script type="module" src="\/@vite\/client"><\/script>\s*<script type="module" src="\/src\/main\.tsx"><\/script>/,
      `${assets.styles}\n    ${assets.scripts}`,
    );

    const destDir = join(distArticles, slug);
    mkdirSync(destDir, { recursive: true });
    writeFileSync(join(destDir, "index.html"), html);
    count++;
  }

  return count;
}

async function main() {
  const startTime = performance.now();
  console.log("\n🔐 Hashing content files...\n");

  // Copy manifest.json
  console.log("📁 Copying content...");
  const contentDir = resolve(DIST, "content");
  if (!existsSync(contentDir)) {
    mkdirSync(contentDir, { recursive: true });
  }
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

  // Process article HTML files
  console.log("\n📁 Processing articles...");
  const articleCount = processArticles(assets);
  console.log(`  ✅ ${articleCount} article pages processed`);

  // Process context files with hashing
  console.log("\n📁 Processing context...");
  const distContext = resolve(DIST, "context");
  if (existsSync(distContext)) {
    rmSync(distContext, { recursive: true });
  }
  mkdirSync(distContext, { recursive: true });
  const contextFiles = processContextDirectory(CONTEXT_DIR, distContext);

  // Read content manifest (articles, projects)
  const contentManifestPath = resolve(DIST, "content", "manifest.json");
  const contentManifest = existsSync(contentManifestPath)
    ? JSON.parse(readFileSync(contentManifestPath, "utf-8"))
    : { articles: [], projects: [] };

  // Build final manifest
  const finalManifest = {
    version: 1,
    articles: contentManifest.articles || [],
    projects: contentManifest.projects || [],
    context: contextFiles,
  };

  // Escape </script> in manifest to prevent HTML injection issues
  const manifestJson = JSON.stringify(finalManifest).replace(
    /<\/script>/g,
    "<\\/script>",
  );

  console.log(
    `\n📋 Manifest ready (${finalManifest.articles.length} articles, ${finalManifest.projects.length} projects)`,
  );

  // Embed manifest directly into index.html (no fetch needed)
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
  console.log(`  ✅ Embedded manifest data (no fetch needed)`);

  const elapsed = (performance.now() - startTime).toFixed(0);
  console.log(`\n✨ Hash complete (${elapsed}ms)`);
  console.log(`   Articles: ${articleCount}`);
  console.log(`   Projects: ${finalManifest.projects.length}`);
  console.log(`   Context: ${contextFiles.length}\n`);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
