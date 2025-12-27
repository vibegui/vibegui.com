/**
 * SQLite Database for Articles and Drafts
 *
 * Uses Node 22's native node:sqlite for zero-dependency SQLite operations.
 * Database file is stored in data/content.db
 * Articles and drafts are in the same table, differentiated by status field.
 */

import { DatabaseSync } from "node:sqlite";
import { join, dirname } from "node:path";
import { mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "..", "data");
const DB_PATH = join(DATA_DIR, "content.db");

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize database
const db = new DatabaseSync(DB_PATH);

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS content (
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

  CREATE TABLE IF NOT EXISTS content_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content_id INTEGER NOT NULL,
    tag TEXT NOT NULL,
    FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE,
    UNIQUE(content_id, tag)
  );

  CREATE INDEX IF NOT EXISTS idx_content_slug ON content(slug);
  CREATE INDEX IF NOT EXISTS idx_content_status ON content(status);
  CREATE INDEX IF NOT EXISTS idx_content_date ON content(date);
  CREATE INDEX IF NOT EXISTS idx_content_tags_content ON content_tags(content_id);
  CREATE INDEX IF NOT EXISTS idx_content_tags_tag ON content_tags(tag);
`);

export interface ContentRow {
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

export interface Content {
  id?: number;
  slug: string;
  title: string;
  description?: string;
  content: string;
  date: string;
  status: "draft" | "published";
  tags?: string[];
}

// Convert database row to Content object
function rowToContent(row: ContentRow, tags: string[]): Content {
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
const selectAllStmt = db.prepare("SELECT * FROM content ORDER BY date DESC");
const selectByStatusStmt = db.prepare(
  "SELECT * FROM content WHERE status = ? ORDER BY date DESC",
);
const selectBySlugStmt = db.prepare("SELECT * FROM content WHERE slug = ?");
const selectByIdStmt = db.prepare("SELECT * FROM content WHERE id = ?");
const selectTagsStmt = db.prepare(
  "SELECT tag FROM content_tags WHERE content_id = ?",
);
const insertTagStmt = db.prepare(
  "INSERT OR IGNORE INTO content_tags (content_id, tag) VALUES (?, ?)",
);
const deleteTagsStmt = db.prepare(
  "DELETE FROM content_tags WHERE content_id = ?",
);
const getIdBySlugStmt = db.prepare("SELECT id FROM content WHERE slug = ?");
const deleteBySlugStmt = db.prepare("DELETE FROM content WHERE slug = ?");

// Get all content
export function getAllContent(): Content[] {
  const rows = selectAllStmt.all() as unknown as ContentRow[];

  return rows.map((row) => {
    const tags = (selectTagsStmt.all(row.id) as { tag: string }[]).map(
      (t) => t.tag,
    );
    return rowToContent(row, tags);
  });
}

// Get content by status (articles = published, drafts = draft)
export function getContentByStatus(status: "draft" | "published"): Content[] {
  const rows = selectByStatusStmt.all(status) as unknown as ContentRow[];

  return rows.map((row) => {
    const tags = (selectTagsStmt.all(row.id) as { tag: string }[]).map(
      (t) => t.tag,
    );
    return rowToContent(row, tags);
  });
}

// Get published articles
export function getArticles(): Content[] {
  return getContentByStatus("published");
}

// Get drafts
export function getDrafts(): Content[] {
  return getContentByStatus("draft");
}

// Get content by slug
export function getContentBySlug(slug: string): Content | null {
  const row = selectBySlugStmt.get(slug) as ContentRow | undefined;
  if (!row) return null;

  const tags = (selectTagsStmt.all(row.id) as { tag: string }[]).map(
    (t) => t.tag,
  );
  return rowToContent(row, tags);
}

// Get content by ID
export function getContentById(id: number): Content | null {
  const row = selectByIdStmt.get(id) as ContentRow | undefined;
  if (!row) return null;

  const tags = (selectTagsStmt.all(row.id) as { tag: string }[]).map(
    (t) => t.tag,
  );
  return rowToContent(row, tags);
}

// Create new content
export function createContent(content: Content): Content {
  const stmt = db.prepare(`
    INSERT INTO content (slug, title, description, content, date, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    content.slug,
    content.title,
    content.description || null,
    content.content,
    content.date,
    content.status,
  );

  const contentId = Number(result.lastInsertRowid);

  // Insert tags
  if (content.tags && content.tags.length > 0) {
    for (const tag of content.tags) {
      insertTagStmt.run(contentId, tag);
    }
  }

  return { ...content, id: contentId };
}

// Update existing content
export function updateContent(
  slug: string,
  updates: Partial<Content>,
): Content | null {
  const existing = getContentBySlug(slug);
  if (!existing || !existing.id) return null;

  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  type SQLValue = string | number | null | undefined;
  const fieldMap: Record<string, SQLValue> = {
    title: updates.title,
    description: updates.description,
    content: updates.content,
    date: updates.date,
    status: updates.status,
  };

  for (const [field, value] of Object.entries(fieldMap)) {
    if (value !== undefined) {
      fields.push(`${field} = ?`);
      values.push(value ?? null);
    }
  }

  if (fields.length > 0) {
    fields.push("updated_at = datetime('now')");
    values.push(slug);

    const stmt = db.prepare(
      `UPDATE content SET ${fields.join(", ")} WHERE slug = ?`,
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
      "UPDATE content SET slug = ? WHERE slug = ?",
    );
    updateSlugStmt.run(updates.slug, slug);
    return getContentBySlug(updates.slug);
  }

  return getContentBySlug(slug);
}

// Delete content
export function deleteContent(slug: string): boolean {
  const result = deleteBySlugStmt.run(slug);
  return result.changes > 0;
}

// Get stats
export function getContentStats() {
  const total = (
    db.prepare("SELECT COUNT(*) as count FROM content").get() as {
      count: number;
    }
  ).count;
  const articles = (
    db
      .prepare(
        "SELECT COUNT(*) as count FROM content WHERE status = 'published'",
      )
      .get() as { count: number }
  ).count;
  const drafts = (
    db
      .prepare("SELECT COUNT(*) as count FROM content WHERE status = 'draft'")
      .get() as { count: number }
  ).count;

  const tagCounts = db
    .prepare(`
    SELECT tag, COUNT(*) as count
    FROM content_tags
    GROUP BY tag
    ORDER BY count DESC
  `)
    .all() as { tag: string; count: number }[];

  return { total, articles, drafts, tagCounts };
}

// Bulk insert (for migration)
export function bulkInsertContent(items: Content[]): number {
  const insertContent = db.prepare(`
    INSERT OR REPLACE INTO content (slug, title, description, content, date, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  let count = 0;

  for (const item of items) {
    insertContent.run(
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

  return count;
}

export { db, DB_PATH };
