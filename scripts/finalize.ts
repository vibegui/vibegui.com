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

function embedManifest(html: string, manifestJson: string): string {
  const withoutOldManifest = html.replace(
    /\s*<script id="manifest-data" type="application\/json">[\s\S]*?<\/script>/g,
    "",
  );
  return withoutOldManifest.replace(
    '<div id="root"></div>',
    `<div id="root"></div>\n    <script id="manifest-data" type="application/json">${manifestJson}</script>`,
  );
}

function localizeHomeShell(html: string, locale: "pt-BR" | "en"): string {
  const english = locale === "en";
  const title = english
    ? "vibegui — Guilherme Rodrigues on AI, leadership, and software"
    : "vibegui — Guilherme Rodrigues sobre IA, liderança e software";
  const description = english
    ? "Writing by Guilherme Rodrigues on leadership, AI, software, Brazil, and possible futures."
    : "Textos de Guilherme Rodrigues sobre liderança, IA, software, Brasil e futuros possíveis.";
  const canonical = english
    ? "https://vibegui.com/en/"
    : "https://vibegui.com/";
  const ogLocale = english ? "en_US" : "pt_BR";
  const alternateOgLocale = english ? "pt_BR" : "en_US";

  return html
    .replace(/<html lang="[^"]+">/, `<html lang="${locale}">`)
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(
      /<meta name="description" content="[^"]*" \/>/,
      `<meta name="description" content="${description}" />`,
    )
    .replace(
      /<link rel="canonical" href="[^"]*" \/>/,
      `<link rel="canonical" href="${canonical}" />`,
    )
    .replace(
      /<link rel="alternate" hreflang="pt-BR" href="[^"]*" \/>/,
      '<link rel="alternate" hreflang="pt-BR" href="https://vibegui.com/" />',
    )
    .replace(
      /<link rel="alternate" hreflang="en" href="[^"]*" \/>/,
      '<link rel="alternate" hreflang="en" href="https://vibegui.com/en/" />',
    )
    .replace(
      /<link rel="alternate" hreflang="x-default" href="[^"]*" \/>/,
      '<link rel="alternate" hreflang="x-default" href="https://vibegui.com/" />',
    )
    .replace(
      /<meta property="og:title" content="[^"]*" \/>/,
      `<meta property="og:title" content="${title}" />`,
    )
    .replace(
      /<meta property="og:description" content="[^"]*" \/>/,
      `<meta property="og:description" content="${description}" />`,
    )
    .replace(
      /<meta property="og:url" content="[^"]*" \/>/,
      `<meta property="og:url" content="${canonical}" />`,
    )
    .replace(
      /<meta property="og:locale" content="[^"]*" \/>/,
      `<meta property="og:locale" content="${ogLocale}" />`,
    )
    .replace(
      /<meta property="og:locale:alternate" content="[^"]*" \/>/,
      `<meta property="og:locale:alternate" content="${alternateOgLocale}" />`,
    )
    .replace(
      /<meta name="twitter:title" content="[^"]*" \/>/,
      `<meta name="twitter:title" content="${title}" />`,
    )
    .replace(
      /<meta name="twitter:description" content="[^"]*" \/>/,
      `<meta name="twitter:description" content="${description}" />`,
    );
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
  for (const path of [
    "sitemap.xml",
    "robots.txt",
    "feed.xml",
    "_redirects",
    "_headers",
    "_routes.json",
  ]) {
    copyFileSync(resolve(PUBLIC, path), resolve(DIST, path));
  }
  // Pages SPA-fallbacks unknown paths to index.html; a 404.html under /assets
  // makes missing hashed bundles return a real 404 instead of cacheable HTML.
  mkdirSync(resolve(DIST, "assets"), { recursive: true });
  copyFileSync(
    resolve(PUBLIC, "assets", "404.html"),
    resolve(DIST, "assets", "404.html"),
  );
  mkdirSync(resolve(DIST, "en"), { recursive: true });
  copyFileSync(
    resolve(PUBLIC, "en", "feed.xml"),
    resolve(DIST, "en", "feed.xml"),
  );
  console.log("  ✅ Manifest, bookmarks, SEO files copied");

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
  const englishArticleCount = processSSGPages(
    resolve(BUILD, "en", "article"),
    resolve(DIST, "en", "article"),
    assets,
  );
  const contextCount = processSSGPages(
    resolve(BUILD, "context"),
    resolve(DIST, "context"),
    assets,
  );
  console.log(
    `  ✅ ${articleCount} PT + ${englishArticleCount} EN articles, ${contextCount} context pages`,
  );

  // Standalone static mini-sites (/irene, /malvados): pages in .build/ are
  // complete self-contained HTML — copy verbatim, no asset-tag swapping.
  // Merge-copy (never wipe): in prod mode Vite already copied the strip
  // images from public/malvados/ into dist/malvados/.
  console.log("\n📁 Copying static mini-sites...");
  copyDir(resolve(BUILD, "irene"), resolve(DIST, "irene"));
  copyDir(resolve(BUILD, "malvados"), resolve(DIST, "malvados"));
  copyDir(resolve(BUILD, "imprescindivel"), resolve(DIST, "imprescindivel"));
  // builds dos domínios dedicados (servidos por functions/_middleware.ts)
  copyDir(resolve(BUILD, "_dominio-irene"), resolve(DIST, "_dominio-irene"));
  copyDir(
    resolve(BUILD, "_dominio-malvados"),
    resolve(DIST, "_dominio-malvados"),
  );
  copyDir(
    resolve(BUILD, "_dominio-imprescindivel"),
    resolve(DIST, "_dominio-imprescindivel"),
  );
  // In pages mode (no Vite) the strip images must come straight from public/
  const mediaDest = resolve(DIST, "malvados", "tirinhas");
  if (!existsSync(mediaDest)) {
    copyDir(resolve(PUBLIC, "malvados", "tirinhas"), mediaDest);
  }
  console.log("  ✅ /irene, /malvados, /imprescindivel");

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

  updatedIndexHtml = embedManifest(
    localizeHomeShell(updatedIndexHtml, "pt-BR"),
    manifestJson,
  );
  const englishIndexHtml = embedManifest(
    localizeHomeShell(indexHtml, "en"),
    manifestJson,
  );

  writeFileSync(indexPath, updatedIndexHtml);
  writeFileSync(resolve(DIST, "en", "index.html"), englishIndexHtml);
  console.log("  ✅ Embedded manifest in PT and EN shells");

  // Note: .build/ is kept around for dev server compatibility (it's in .gitignore)

  const elapsed = (performance.now() - startTime).toFixed(0);
  console.log(`\n✨ Build finalized (${elapsed}ms)`);
  console.log(`   Articles: ${articleCount + englishArticleCount}`);
  console.log(`   Context: ${contextCount}`);
  console.log(`   Projects: ${manifest.projects?.length || 0}\n`);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
