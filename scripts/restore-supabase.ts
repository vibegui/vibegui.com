#!/usr/bin/env bun
/**
 * Restore Supabase database from pg_dump backup
 *
 * Usage: bun run restore <backup-file.sql>
 *
 * ⚠️ WARNING: This will overwrite existing data!
 *
 * Requires:
 * - SUPABASE_DB_URL in .env (postgresql://... with URL-encoded password)
 * - psql installed (brew install libpq)
 */

import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

// Load .env file manually
async function loadEnv() {
  try {
    const envFile = await readFile(".env", "utf-8");
    for (const line of envFile.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [key, ...valueParts] = trimmed.split("=");
      const value = valueParts.join("=").replace(/^["']|["']$/g, "");
      if (key && value && !process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env file not found
  }
}

await loadEnv();

const DB_URL = process.env.SUPABASE_DB_URL;

if (!DB_URL) {
  console.error("❌ SUPABASE_DB_URL required in .env");
  process.exit(1);
}

const backupFile = process.argv[2];
if (!backupFile) {
  console.error("❌ Usage: bun run restore <backup-file.sql>");
  console.error(
    "   Example: bun run restore ~/Backups/supabase-vibegui.com/backup-2025-12-28.sql",
  );
  process.exit(1);
}

// Check file exists
const file = Bun.file(backupFile);
if (!(await file.exists())) {
  console.error(`❌ File not found: ${backupFile}`);
  process.exit(1);
}

// Try common psql locations
const psqlPaths = [
  "/opt/homebrew/opt/libpq/bin/psql",
  "/usr/local/opt/libpq/bin/psql",
  "/usr/bin/psql",
];

async function findPsql(): Promise<string> {
  for (const path of psqlPaths) {
    const f = Bun.file(path);
    if (await f.exists()) {
      return path;
    }
  }
  return "psql";
}

async function restore() {
  const sizeMb = (file.size / 1024 / 1024).toFixed(1);

  console.log(`🔄 Restore from: ${backupFile}`);
  console.log(`   📊 ${sizeMb} MB`);
  console.log("");
  console.log("⚠️  WARNING: This will overwrite existing data!");
  console.log("   Press Ctrl+C within 5 seconds to cancel...");

  await new Promise((r) => setTimeout(r, 5000));

  console.log("\n🚀 Starting restore...\n");

  const psql = await findPsql();
  console.log(`🔧 Using: ${psql}`);

  const proc = spawn(
    psql,
    [`--dbname=${DB_URL}`, "-f", backupFile, "--quiet"],
    {
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  let stderr = "";
  proc.stderr.on("data", (data) => {
    stderr += data.toString();
  });

  const exitCode = await new Promise<number>((resolve) => {
    proc.on("close", resolve);
  });

  if (exitCode !== 0) {
    console.error("❌ psql restore failed:");
    console.error(stderr);
    process.exit(1);
  }

  // Show any warnings (non-fatal)
  if (stderr) {
    console.log("⚠️ Warnings:");
    console.log(stderr);
  }

  console.log(`\n✅ Restore complete!`);
}

restore().catch((err) => {
  console.error("❌ Restore failed:", err);
  process.exit(1);
});
