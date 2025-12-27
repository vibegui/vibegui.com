/**
 * SQLite Database for Research
 *
 * Uses better-sqlite3 for synchronous, embedded SQLite operations.
 * Database file is stored in data/research.db
 */

import Database from "better-sqlite3";
import { join, dirname } from "node:path";
import { mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "..", "data");
const DB_PATH = join(DATA_DIR, "research.db");

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize database
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS research (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS research_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    research_id INTEGER NOT NULL,
    tag TEXT NOT NULL,
    FOREIGN KEY (research_id) REFERENCES research(id) ON DELETE CASCADE,
    UNIQUE(research_id, tag)
  );

  CREATE INDEX IF NOT EXISTS idx_research_slug ON research(slug);
  CREATE INDEX IF NOT EXISTS idx_research_status ON research(status);
  CREATE INDEX IF NOT EXISTS idx_research_date ON research(date);
  CREATE INDEX IF NOT EXISTS idx_research_tags_research ON research_tags(research_id);
  CREATE INDEX IF NOT EXISTS idx_research_tags_tag ON research_tags(tag);
`);

export interface ResearchRow {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  content: string;
  date: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Research {
  id?: number;
  slug: string;
  title: string;
  description?: string;
  content: string;
  date: string;
  status: "draft" | "published";
  tags?: string[];
}

// Convert database row to Research object
function rowToResearch(row: ResearchRow, tags: string[]): Research {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description || undefined,
    content: row.content,
    date: row.date,
    status: row.status as "draft" | "published",
    tags: tags.length > 0 ? tags : undefined,
  };
}

// Prepared statements
const selectAllStmt = db.prepare("SELECT * FROM research ORDER BY date DESC");
const selectByStatusStmt = db.prepare(
  "SELECT * FROM research WHERE status = ? ORDER BY date DESC",
);
const selectBySlugStmt = db.prepare("SELECT * FROM research WHERE slug = ?");
const selectByIdStmt = db.prepare("SELECT * FROM research WHERE id = ?");
const selectTagsStmt = db.prepare(
  "SELECT tag FROM research_tags WHERE research_id = ?",
);
const insertTagStmt = db.prepare(
  "INSERT OR IGNORE INTO research_tags (research_id, tag) VALUES (?, ?)",
);
const deleteTagsStmt = db.prepare(
  "DELETE FROM research_tags WHERE research_id = ?",
);
const getIdBySlugStmt = db.prepare("SELECT id FROM research WHERE slug = ?");
const deleteBySlugStmt = db.prepare("DELETE FROM research WHERE slug = ?");

// Get all research
export function getAllResearch(): Research[] {
  const rows = selectAllStmt.all() as ResearchRow[];

  return rows.map((row) => {
    const tags = (selectTagsStmt.all(row.id) as { tag: string }[]).map(
      (t) => t.tag,
    );
    return rowToResearch(row, tags);
  });
}

// Get research by status
export function getResearchByStatus(status: "draft" | "published"): Research[] {
  const rows = selectByStatusStmt.all(status) as ResearchRow[];

  return rows.map((row) => {
    const tags = (selectTagsStmt.all(row.id) as { tag: string }[]).map(
      (t) => t.tag,
    );
    return rowToResearch(row, tags);
  });
}

// Get research by slug
export function getResearchBySlug(slug: string): Research | null {
  const row = selectBySlugStmt.get(slug) as ResearchRow | undefined;
  if (!row) return null;

  const tags = (selectTagsStmt.all(row.id) as { tag: string }[]).map(
    (t) => t.tag,
  );
  return rowToResearch(row, tags);
}

// Get research by ID
export function getResearchById(id: number): Research | null {
  const row = selectByIdStmt.get(id) as ResearchRow | undefined;
  if (!row) return null;

  const tags = (selectTagsStmt.all(row.id) as { tag: string }[]).map(
    (t) => t.tag,
  );
  return rowToResearch(row, tags);
}

// Create new research
export function createResearch(research: Research): Research {
  const stmt = db.prepare(`
    INSERT INTO research (slug, title, description, content, date, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    research.slug,
    research.title,
    research.description || null,
    research.content,
    research.date,
    research.status,
  );

  const researchId = result.lastInsertRowid as number;

  // Insert tags
  if (research.tags && research.tags.length > 0) {
    for (const tag of research.tags) {
      insertTagStmt.run(researchId, tag);
    }
  }

  return { ...research, id: researchId };
}

// Update existing research
export function updateResearch(
  slug: string,
  updates: Partial<Research>,
): Research | null {
  const existing = getResearchBySlug(slug);
  if (!existing || !existing.id) return null;

  const fields: string[] = [];
  const values: unknown[] = [];

  const fieldMap: Record<string, unknown> = {
    title: updates.title,
    description: updates.description,
    content: updates.content,
    date: updates.date,
    status: updates.status,
  };

  for (const [field, value] of Object.entries(fieldMap)) {
    if (value !== undefined) {
      fields.push(`${field} = ?`);
      values.push(value);
    }
  }

  if (fields.length > 0) {
    fields.push("updated_at = datetime('now')");
    values.push(slug);

    const stmt = db.prepare(
      `UPDATE research SET ${fields.join(", ")} WHERE slug = ?`,
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

  // Handle slug change
  if (updates.slug && updates.slug !== slug) {
    const updateSlugStmt = db.prepare(
      "UPDATE research SET slug = ? WHERE slug = ?",
    );
    updateSlugStmt.run(updates.slug, slug);
    return getResearchBySlug(updates.slug);
  }

  return getResearchBySlug(slug);
}

// Delete research
export function deleteResearch(slug: string): boolean {
  const result = deleteBySlugStmt.run(slug);
  return result.changes > 0;
}

// Get stats
export function getResearchStats() {
  const total = (
    db.prepare("SELECT COUNT(*) as count FROM research").get() as {
      count: number;
    }
  ).count;
  const published = (
    db
      .prepare(
        "SELECT COUNT(*) as count FROM research WHERE status = 'published'",
      )
      .get() as { count: number }
  ).count;
  const draft = total - published;

  const tagCounts = db
    .prepare(`
    SELECT tag, COUNT(*) as count
    FROM research_tags
    GROUP BY tag
    ORDER BY count DESC
  `)
    .all() as { tag: string; count: number }[];

  return { total, published, draft, tagCounts };
}

// Bulk insert (for migration)
export function bulkInsertResearch(items: Research[]): number {
  const insertResearch = db.prepare(`
    INSERT OR REPLACE INTO research (slug, title, description, content, date, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  let count = 0;

  const transaction = db.transaction(() => {
    for (const item of items) {
      insertResearch.run(
        item.slug,
        item.title,
        item.description || null,
        item.content,
        item.date,
        item.status,
      );

      const row = getIdBySlugStmt.get(item.slug) as { id: number } | undefined;
      if (row && item.tags) {
        deleteTagsStmt.run(row.id);
        for (const tag of item.tags) {
          insertTagStmt.run(row.id, tag);
        }
      }
      count++;
    }
  });

  transaction();
  return count;
}

export { db, DB_PATH };
