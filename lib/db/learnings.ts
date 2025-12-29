/**
 * Daily Learnings Database
 *
 * A local-only SQLite database for recording learnings, accomplishments,
 * and insights as we work together. NOT versioned - purely local memory.
 */

import { Database } from "bun:sqlite";
import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

// Ensure data directory exists
const dataDir = join(process.cwd(), "data");
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const DB_PATH = join(dataDir, "learnings.db");
const db = new Database(DB_PATH);

// Initialize schema
db.run(`
  CREATE TABLE IF NOT EXISTS learnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    -- Context
    repo TEXT,                    -- Which repository/workspace
    project TEXT,                 -- Which project (e.g., "vibegui-bookmarks", "anjo.chat")
    session_id TEXT,              -- Optional: group learnings from same session
    
    -- Classification
    category TEXT NOT NULL,       -- bug_fix, architecture, tool, insight, accomplishment, debugging, optimization, feature
    importance TEXT DEFAULT 'normal', -- low, normal, high, critical
    
    -- Content
    summary TEXT NOT NULL,        -- One-line summary (for quick scanning)
    content TEXT NOT NULL,        -- Full learning with details
    
    -- Metadata
    tags TEXT,                    -- JSON array of tags for filtering
    related_files TEXT,           -- JSON array of file paths involved
    related_urls TEXT,            -- JSON array of relevant URLs
    
    -- For blog posts / public sharing
    publishable INTEGER DEFAULT 0,  -- 1 if this could be shared publicly
    published_in TEXT               -- Slug of article if already published
  )
`);

db.run(
  `CREATE INDEX IF NOT EXISTS idx_learnings_date ON learnings(created_at)`,
);
db.run(
  `CREATE INDEX IF NOT EXISTS idx_learnings_project ON learnings(project)`,
);
db.run(
  `CREATE INDEX IF NOT EXISTS idx_learnings_category ON learnings(category)`,
);

// Types
export interface Learning {
  id: number;
  created_at: string;
  repo: string | null;
  project: string | null;
  session_id: string | null;
  category: string;
  importance: string;
  summary: string;
  content: string;
  tags: string[] | null;
  related_files: string[] | null;
  related_urls: string[] | null;
  publishable: boolean;
  published_in: string | null;
}

export interface CreateLearningInput {
  repo?: string;
  project?: string;
  session_id?: string;
  category: string;
  importance?: string;
  summary: string;
  content: string;
  tags?: string[];
  related_files?: string[];
  related_urls?: string[];
  publishable?: boolean;
}

// Helper to parse JSON fields
function parseLearning(row: Record<string, unknown>): Learning {
  return {
    id: row.id as number,
    created_at: row.created_at as string,
    repo: row.repo as string | null,
    project: row.project as string | null,
    session_id: row.session_id as string | null,
    category: row.category as string,
    importance: row.importance as string,
    summary: row.summary as string,
    content: row.content as string,
    tags: row.tags ? JSON.parse(row.tags as string) : null,
    related_files: row.related_files
      ? JSON.parse(row.related_files as string)
      : null,
    related_urls: row.related_urls
      ? JSON.parse(row.related_urls as string)
      : null,
    publishable: (row.publishable as number) === 1,
    published_in: row.published_in as string | null,
  };
}

// CRUD Operations

export function createLearning(input: CreateLearningInput): Learning {
  const stmt = db.prepare(`
    INSERT INTO learnings (
      repo, project, session_id, category, importance,
      summary, content, tags, related_files, related_urls, publishable
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    input.repo ?? null,
    input.project ?? null,
    input.session_id ?? null,
    input.category,
    input.importance ?? "normal",
    input.summary,
    input.content,
    input.tags ? JSON.stringify(input.tags) : null,
    input.related_files ? JSON.stringify(input.related_files) : null,
    input.related_urls ? JSON.stringify(input.related_urls) : null,
    input.publishable ? 1 : 0,
  );

  return getLearningById(Number(result.lastInsertRowid))!;
}

export function getLearningById(id: number): Learning | null {
  const row = db
    .query("SELECT * FROM learnings WHERE id = ?")
    .get(id) as Record<string, unknown> | null;
  return row ? parseLearning(row) : null;
}

export function getLearningsToday(): Learning[] {
  const rows = db
    .query(`
    SELECT * FROM learnings 
    WHERE date(created_at) = date('now', 'localtime')
    ORDER BY created_at DESC
  `)
    .all() as Record<string, unknown>[];
  return rows.map(parseLearning);
}

export function getLearningsByDateRange(
  startDate: string,
  endDate: string,
): Learning[] {
  const rows = db
    .query(`
    SELECT * FROM learnings 
    WHERE date(created_at) >= ? AND date(created_at) <= ?
    ORDER BY created_at DESC
  `)
    .all(startDate, endDate) as Record<string, unknown>[];
  return rows.map(parseLearning);
}

export function getLearningsByProject(project: string): Learning[] {
  const rows = db
    .query(`
    SELECT * FROM learnings 
    WHERE project = ?
    ORDER BY created_at DESC
  `)
    .all(project) as Record<string, unknown>[];
  return rows.map(parseLearning);
}

export function getLearningsByCategory(category: string): Learning[] {
  const rows = db
    .query(`
    SELECT * FROM learnings 
    WHERE category = ?
    ORDER BY created_at DESC
  `)
    .all(category) as Record<string, unknown>[];
  return rows.map(parseLearning);
}

export function getPublishableLearnings(): Learning[] {
  const rows = db
    .query(`
    SELECT * FROM learnings 
    WHERE publishable = 1 AND published_in IS NULL
    ORDER BY created_at DESC
  `)
    .all() as Record<string, unknown>[];
  return rows.map(parseLearning);
}

export function searchLearnings(query: string, limit = 50): Learning[] {
  const rows = db
    .query(`
    SELECT * FROM learnings 
    WHERE summary LIKE ? OR content LIKE ?
    ORDER BY created_at DESC
    LIMIT ?
  `)
    .all(`%${query}%`, `%${query}%`, limit) as Record<string, unknown>[];
  return rows.map(parseLearning);
}

export function getAllLearnings(limit = 100, offset = 0): Learning[] {
  const rows = db
    .query(`
    SELECT * FROM learnings 
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `)
    .all(limit, offset) as Record<string, unknown>[];
  return rows.map(parseLearning);
}

export function updateLearning(
  id: number,
  updates: Partial<CreateLearningInput>,
): Learning | null {
  const existing = getLearningById(id);
  if (!existing) return null;

  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.project !== undefined) {
    fields.push("project = ?");
    values.push(updates.project);
  }
  if (updates.category !== undefined) {
    fields.push("category = ?");
    values.push(updates.category);
  }
  if (updates.importance !== undefined) {
    fields.push("importance = ?");
    values.push(updates.importance);
  }
  if (updates.summary !== undefined) {
    fields.push("summary = ?");
    values.push(updates.summary);
  }
  if (updates.content !== undefined) {
    fields.push("content = ?");
    values.push(updates.content);
  }
  if (updates.tags !== undefined) {
    fields.push("tags = ?");
    values.push(JSON.stringify(updates.tags));
  }
  if (updates.publishable !== undefined) {
    fields.push("publishable = ?");
    values.push(updates.publishable ? 1 : 0);
  }

  if (fields.length === 0) return existing;

  values.push(id);
  db.run(`UPDATE learnings SET ${fields.join(", ")} WHERE id = ?`, ...values);

  return getLearningById(id);
}

export function markAsPublished(id: number, articleSlug: string): boolean {
  const result = db.run(
    "UPDATE learnings SET published_in = ? WHERE id = ?",
    articleSlug,
    id,
  );
  return result.changes > 0;
}

export function deleteLearning(id: number): boolean {
  const result = db.run("DELETE FROM learnings WHERE id = ?", id);
  return result.changes > 0;
}

// Stats
export function getStats(): {
  total: number;
  today: number;
  thisWeek: number;
  byCategory: Record<string, number>;
  byProject: Record<string, number>;
} {
  const total = (
    db.query("SELECT COUNT(*) as count FROM learnings").get() as {
      count: number;
    }
  ).count;
  const today = (
    db
      .query(
        "SELECT COUNT(*) as count FROM learnings WHERE date(created_at) = date('now', 'localtime')",
      )
      .get() as { count: number }
  ).count;
  const thisWeek = (
    db
      .query(
        "SELECT COUNT(*) as count FROM learnings WHERE created_at >= datetime('now', '-7 days')",
      )
      .get() as { count: number }
  ).count;

  const categoryRows = db
    .query(
      "SELECT category, COUNT(*) as count FROM learnings GROUP BY category",
    )
    .all() as { category: string; count: number }[];
  const byCategory: Record<string, number> = {};
  for (const row of categoryRows) {
    byCategory[row.category] = row.count;
  }

  const projectRows = db
    .query(
      "SELECT project, COUNT(*) as count FROM learnings WHERE project IS NOT NULL GROUP BY project",
    )
    .all() as { project: string; count: number }[];
  const byProject: Record<string, number> = {};
  for (const row of projectRows) {
    byProject[row.project] = row.count;
  }

  return { total, today, thisWeek, byCategory, byProject };
}
