#!/usr/bin/env bun
/**
 * Backup Supabase database using pg_dump
 * Creates a proper PostgreSQL dump file with timestamp
 *
 * Usage: bun run backup
 *
 * Requires:
 * - SUPABASE_DB_URL in .env (postgresql://... with URL-encoded password)
 *   Note: Replace @ in password with %40
 * - pg_dump installed (brew install libpq)
 */

import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { spawn } from "node:child_process";

// Load .env file manually since Bun doesn't auto-load for scripts
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
    // .env file not found, that's ok
  }
}

await loadEnv();

const DB_URL = process.env.SUPABASE_DB_URL;

if (!DB_URL) {
  console.error("❌ SUPABASE_DB_URL required in .env");
  console.error(
    "   Get it from: Supabase Dashboard > Settings > Database > Connection string (URI)",
  );
  console.error("   Note: URL-encode special chars in password (@ → %40)");
  process.exit(1);
}

// Try common pg_dump locations
const pgDumpPaths = [
  "/opt/homebrew/opt/libpq/bin/pg_dump",
  "/usr/local/opt/libpq/bin/pg_dump",
  "/usr/bin/pg_dump",
];

async function findPgDump(): Promise<string> {
  for (const path of pgDumpPaths) {
    const file = Bun.file(path);
    if (await file.exists()) {
      return path;
    }
  }
  return "pg_dump";
}

async function backup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupDir = join(homedir(), "Backups", "supabase-vibegui.com");
  const backupFile = join(backupDir, `backup-${timestamp}.sql`);

  console.log("🔄 Starting pg_dump backup...");
  console.log(`📁 Target: ${backupFile}`);

  await mkdir(backupDir, { recursive: true });

  const pgDump = await findPgDump();
  console.log(`🔧 Using: ${pgDump}`);

  const proc = spawn(
    pgDump,
    [
      `--dbname=${DB_URL}`,
      "--no-owner",
      "--no-acl",
      "--schema=public",
      "-f",
      backupFile,
    ],
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
    console.error("❌ pg_dump failed:");
    console.error(stderr);
    process.exit(1);
  }

  const file = Bun.file(backupFile);
  const size = file.size;
  const sizeMb = (size / 1024 / 1024).toFixed(1);

  console.log(`\n✅ Backup complete!`);
  console.log(`   📄 ${backupFile}`);
  console.log(`   📊 ${sizeMb} MB`);
}

backup().catch((err) => {
  console.error("❌ Backup failed:", err);
  process.exit(1);
});
