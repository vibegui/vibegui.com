/**
 * SQLite Database for Bookmarks
 *
 * Runtime-aware: uses bun:sqlite when running in Bun, node:sqlite in Node.
 * Database file is stored in data/bookmarks.db
 */

import { join, dirname } from "node:path";
import { mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "..", "data");
const DB_PATH = join(DATA_DIR, "bookmarks.db");

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// Runtime detection and database initialization
const isBun = typeof globalThis.Bun !== "undefined";

interface DBWrapper {
  exec(sql: string): void;
  prepare(sql: string): {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown | undefined;
    run(...params: unknown[]): {
      changes: number;
      lastInsertRowid: number | bigint;
    };
  };
}

// Use top-level await for dynamic import (works in both Bun and Node ESM)
let db: DBWrapper;

if (isBun) {
  // Bun runtime - use bun:sqlite
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { Database } = (await import("bun:sqlite")) as any;
  const bunDb = new Database(DB_PATH);
  db = {
    exec: (sql: string) => bunDb.exec(sql),
    prepare: (sql: string) => {
      const stmt = bunDb.prepare(sql);
      return {
        all: (...params: unknown[]) => stmt.all(...params),
        get: (...params: unknown[]) => stmt.get(...params),
        run: (...params: unknown[]) => stmt.run(...params),
      };
    },
  };
} else {
  // Node runtime - use node:sqlite
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { DatabaseSync } = (await import("node:sqlite")) as any;
  const nodeDb = new DatabaseSync(DB_PATH);
  db = {
    exec: (sql: string) => nodeDb.exec(sql),
    prepare: (sql: string) => {
      const stmt = nodeDb.prepare(sql);
      return {
        all: (...params: unknown[]) => stmt.all(...params) as unknown[],
        get: (...params: unknown[]) => stmt.get(...params) as unknown,
        run: (...params: unknown[]) =>
          stmt.run(...params) as {
            changes: number;
            lastInsertRowid: number | bigint;
          },
      };
    },
  };
}

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT UNIQUE NOT NULL,
    title TEXT,
    description TEXT,
    -- Enrichment fields - Step 1: Research
    research_raw TEXT,
    exa_content TEXT,
    researched_at TEXT,
    -- Enrichment fields - Step 2: Classification
    stars INTEGER,
    reading_time_min INTEGER,
    language TEXT,
    icon TEXT,
    -- Audience-specific insights
    insight_dev TEXT,
    insight_founder TEXT,
    insight_investor TEXT,
    classified_at TEXT,
    -- Timestamps
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bookmark_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bookmark_id INTEGER NOT NULL,
    tag TEXT NOT NULL,
    FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE,
    UNIQUE(bookmark_id, tag)
  );

  CREATE INDEX IF NOT EXISTS idx_bookmarks_url ON bookmarks(url);
  CREATE INDEX IF NOT EXISTS idx_bookmarks_classified ON bookmarks(classified_at);
  CREATE INDEX IF NOT EXISTS idx_bookmark_tags_bookmark ON bookmark_tags(bookmark_id);
  CREATE INDEX IF NOT EXISTS idx_bookmark_tags_tag ON bookmark_tags(tag);
`);

export interface BookmarkRow {
  id: number;
  url: string;
  title: string | null;
  description: string | null;
  research_raw: string | null;
  exa_content: string | null;
  researched_at: string | null;
  stars: number | null;
  reading_time_min: number | null;
  language: string | null;
  icon: string | null;
  insight_dev: string | null;
  insight_founder: string | null;
  insight_investor: string | null;
  classified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Bookmark {
  id?: number;
  url: string;
  title?: string;
  description?: string;
  research_raw?: string;
  exa_content?: string;
  researched_at?: string;
  stars?: number;
  reading_time_min?: number;
  language?: string;
  icon?: string;
  tags?: string[];
  insight_dev?: string;
  insight_founder?: string;
  insight_investor?: string;
  classified_at?: string;
}

// Convert database row to Bookmark object
function rowToBookmark(row: BookmarkRow, tags: string[]): Bookmark {
  return {
    id: row.id,
    url: row.url,
    title: row.title || undefined,
    description: row.description || undefined,
    research_raw: row.research_raw || undefined,
    exa_content: row.exa_content || undefined,
    researched_at: row.researched_at || undefined,
    stars: row.stars || undefined,
    reading_time_min: row.reading_time_min || undefined,
    language: row.language || undefined,
    icon: row.icon || undefined,
    tags: tags.length > 0 ? tags : undefined,
    insight_dev: row.insight_dev || undefined,
    insight_founder: row.insight_founder || undefined,
    insight_investor: row.insight_investor || undefined,
    classified_at: row.classified_at || undefined,
  };
}

// Prepared statements
const selectAllStmt = db.prepare("SELECT * FROM bookmarks ORDER BY id");
const selectByUrlStmt = db.prepare("SELECT * FROM bookmarks WHERE url = ?");
const selectByIdStmt = db.prepare("SELECT * FROM bookmarks WHERE id = ?");
const selectTagsStmt = db.prepare(
  "SELECT tag FROM bookmark_tags WHERE bookmark_id = ?",
);
const insertTagStmt = db.prepare(
  "INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag) VALUES (?, ?)",
);
const deleteTagsStmt = db.prepare(
  "DELETE FROM bookmark_tags WHERE bookmark_id = ?",
);
const getIdByUrlStmt = db.prepare("SELECT id FROM bookmarks WHERE url = ?");
const deleteByUrlStmt = db.prepare("DELETE FROM bookmarks WHERE url = ?");

// Get all bookmarks
export function getAllBookmarks(): Bookmark[] {
  const rows = selectAllStmt.all() as unknown as BookmarkRow[];

  return rows.map((row) => {
    const tags = (selectTagsStmt.all(row.id) as { tag: string }[]).map(
      (t) => t.tag,
    );
    return rowToBookmark(row, tags);
  });
}

// Get bookmark by URL
export function getBookmarkByUrl(url: string): Bookmark | null {
  const row = selectByUrlStmt.get(url) as BookmarkRow | undefined;
  if (!row) return null;

  const tags = (selectTagsStmt.all(row.id) as { tag: string }[]).map(
    (t) => t.tag,
  );
  return rowToBookmark(row, tags);
}

// Get bookmark by ID
export function getBookmarkById(id: number): Bookmark | null {
  const row = selectByIdStmt.get(id) as BookmarkRow | undefined;
  if (!row) return null;

  const tags = (selectTagsStmt.all(row.id) as { tag: string }[]).map(
    (t) => t.tag,
  );
  return rowToBookmark(row, tags);
}

// Create a new bookmark
export function createBookmark(bookmark: Bookmark): Bookmark {
  const stmt = db.prepare(`
    INSERT INTO bookmarks (
      url, title, description,
      research_raw, exa_content, researched_at,
      stars, reading_time_min, language, icon,
      insight_dev, insight_founder, insight_investor,
      classified_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    bookmark.url,
    bookmark.title || null,
    bookmark.description || null,
    bookmark.research_raw || null,
    bookmark.exa_content || null,
    bookmark.researched_at || null,
    bookmark.stars || null,
    bookmark.reading_time_min || null,
    bookmark.language || null,
    bookmark.icon || null,
    bookmark.insight_dev || null,
    bookmark.insight_founder || null,
    bookmark.insight_investor || null,
    bookmark.classified_at || null,
  );

  const bookmarkId = Number(result.lastInsertRowid);

  // Insert tags
  if (bookmark.tags && bookmark.tags.length > 0) {
    for (const tag of bookmark.tags) {
      insertTagStmt.run(bookmarkId, tag);
    }
  }

  return { ...bookmark, id: bookmarkId };
}

// Update an existing bookmark
export function updateBookmark(
  url: string,
  updates: Partial<Bookmark>,
): Bookmark | null {
  const existing = getBookmarkByUrl(url);
  if (!existing || !existing.id) return null;

  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  // Build dynamic update query
  type SQLValue = string | number | null | undefined;
  const fieldMap: Record<string, SQLValue> = {
    title: updates.title,
    description: updates.description,
    research_raw: updates.research_raw,
    exa_content: updates.exa_content,
    researched_at: updates.researched_at,
    stars: updates.stars,
    reading_time_min: updates.reading_time_min,
    language: updates.language,
    icon: updates.icon,
    insight_dev: updates.insight_dev,
    insight_founder: updates.insight_founder,
    insight_investor: updates.insight_investor,
    classified_at: updates.classified_at,
  };

  for (const [field, value] of Object.entries(fieldMap)) {
    if (value !== undefined) {
      fields.push(`${field} = ?`);
      values.push(value ?? null);
    }
  }

  if (fields.length > 0) {
    fields.push("updated_at = datetime('now')");
    values.push(url);

    const stmt = db.prepare(
      `UPDATE bookmarks SET ${fields.join(", ")} WHERE url = ?`,
    );
    stmt.run(...values);
  }

  // Update tags if provided
  if (updates.tags !== undefined) {
    deleteTagsStmt.run(existing.id);
    if (updates.tags.length > 0) {
      for (const tag of updates.tags) {
        insertTagStmt.run(existing.id, tag);
      }
    }
  }

  return getBookmarkByUrl(url);
}

// Delete a bookmark
export function deleteBookmark(url: string): boolean {
  const result = deleteByUrlStmt.run(url);
  return result.changes > 0;
}

// Get counts and stats
export function getBookmarkStats() {
  const total = (
    db.prepare("SELECT COUNT(*) as count FROM bookmarks").get() as {
      count: number;
    }
  ).count;
  const enriched = (
    db
      .prepare(
        "SELECT COUNT(*) as count FROM bookmarks WHERE classified_at IS NOT NULL",
      )
      .get() as { count: number }
  ).count;
  const pending = total - enriched;

  const tagCounts = db
    .prepare(`
    SELECT tag, COUNT(*) as count
    FROM bookmark_tags
    GROUP BY tag
    ORDER BY count DESC
  `)
    .all() as { tag: string; count: number }[];

  return { total, enriched, pending, tagCounts };
}

// Bulk insert (for migration)
export function bulkInsertBookmarks(bookmarks: Bookmark[]): number {
  const insertBookmark = db.prepare(`
    INSERT OR REPLACE INTO bookmarks (
      url, title, description,
      research_raw, exa_content, researched_at,
      stars, reading_time_min, language, icon,
      insight_dev, insight_founder, insight_investor,
      classified_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let count = 0;

  for (const bookmark of bookmarks) {
    insertBookmark.run(
      bookmark.url,
      bookmark.title || null,
      bookmark.description || null,
      bookmark.research_raw || null,
      bookmark.exa_content || null,
      bookmark.researched_at || null,
      bookmark.stars || null,
      bookmark.reading_time_min || null,
      bookmark.language || null,
      bookmark.icon || null,
      bookmark.insight_dev || null,
      bookmark.insight_founder || null,
      bookmark.insight_investor || null,
      bookmark.classified_at || null,
    );

    const row = getIdByUrlStmt.get(bookmark.url) as { id: number } | undefined;
    if (row && bookmark.tags) {
      for (const tag of bookmark.tags) {
        insertTagStmt.run(row.id, tag);
      }
    }
    count++;
  }

  return count;
}

export { db, DB_PATH };
