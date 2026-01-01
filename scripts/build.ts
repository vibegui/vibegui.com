#!/usr/bin/env bun
/**
 * Unified Build Script
 *
 * Usage:
 *   bun scripts/build.ts --mode=dev    # Generate + Vite dev server
 *   bun scripts/build.ts --mode=prod   # Generate + Vite build + Finalize
 *   bun scripts/build.ts --mode=pages  # Generate + Finalize (no Vite, for Cloudflare)
 *
 * The three modes:
 *   dev   - Local development with hot reload
 *   prod  - Full production build (requires bun/vite)
 *   pages - Cloudflare Pages build (Node.js only, no deps)
 */

import { spawn } from "node:child_process";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);

// Parse mode
const modeArg = args.find((a) => a.startsWith("--mode="));
const mode = modeArg?.split("=")[1] || "dev";

if (!["dev", "prod", "pages"].includes(mode)) {
  console.error(`❌ Unknown mode: ${mode}`);
  console.error("   Valid modes: dev, prod, pages");
  process.exit(1);
}

/**
 * Run a command and return a promise
 */
function run(
  cmd: string,
  cmdArgs: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, {
      stdio: "inherit",
      cwd: options.cwd || ROOT,
      env: { ...process.env, ...options.env },
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
    child.on("error", reject);
  });
}

/**
 * Run generate.ts (Step 1: SQLite → manifest.json + SSG HTML)
 */
async function generate() {
  console.log("\n📚 Generating content...\n");
  // Use node for pages mode (no bun on Cloudflare), bun otherwise
  if (mode === "pages") {
    await run("node", [
      "--experimental-strip-types",
      "--experimental-sqlite",
      "scripts/generate.ts",
    ]);
  } else {
    await run("bun", ["scripts/generate.ts"]);
  }
}

/**
 * Run Vite build (Step 2a: Bundle client assets)
 */
async function viteBuild() {
  console.log("\n⚡ Running Vite build...\n");
  await run("bun", ["vite", "build"]);
}

/**
 * Run Vite dev server (for dev mode)
 */
async function viteDev() {
  console.log("\n⚡ Starting Vite dev server...\n");
  await run("bun", ["vite"]);
}

/**
 * Run finalize.ts (Step 2b/3: Process SSG, embed manifest)
 */
async function finalize() {
  console.log("\n🔧 Finalizing build...\n");
  if (mode === "pages") {
    await run("node", ["--experimental-strip-types", "scripts/finalize.ts"]);
  } else {
    await run("bun", ["scripts/finalize.ts"]);
  }
}

// Main
async function main() {
  const startTime = performance.now();

  console.log(`\n🚀 Build mode: ${mode}\n`);

  switch (mode) {
    case "dev":
      await generate();
      await viteDev();
      break;

    case "prod":
      await generate();
      await viteBuild();
      await finalize();
      break;

    case "pages":
      // Cloudflare Pages: no Vite (pre-built assets in dist/)
      // This assumes dist/ already has Vite-built assets from a previous prod build
      // OR we're doing SSG-only (articles/context HTML) on top of existing assets
      await generate();
      await finalize();
      break;
  }

  if (mode !== "dev") {
    const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Build complete (${elapsed}s)\n`);
  }
}

main().catch((err) => {
  console.error("❌ Build failed:", err.message);
  process.exit(1);
});
