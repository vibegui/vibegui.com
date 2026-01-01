/**
 * SQLite Database for Articles
 *
 * Runtime-aware: uses bun:sqlite when running in Bun, node:sqlite in Node.
 * Database file is stored in data/content.db
 * Articles have a status field (draft/published) - no separate collections.
 */

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
  // Disable WAL mode - write directly to the db file like normal humans
  bunDb.exec("PRAGMA journal_mode = DELETE;");
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
  // Disable WAL mode - write directly to the db file like normal humans
  nodeDb.exec("PRAGMA journal_mode = DELETE;");
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

  -- Projects table for roadmap
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    tagline TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('completed', 'ongoing', 'future')),
    icon TEXT,
    cover_image TEXT,
    cover_gradient TEXT,
    url TEXT,
    start_date TEXT,
    target_date TEXT,
    completed_date TEXT,
    sort_order INTEGER DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS project_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    tag TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(project_id, tag)
  );

  CREATE TABLE IF NOT EXISTS project_action_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    task TEXT NOT NULL,
    owner TEXT NOT NULL DEFAULT 'me',
    due_date TEXT,
    completed INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
  CREATE INDEX IF NOT EXISTS idx_projects_sort ON projects(sort_order);
  CREATE INDEX IF NOT EXISTS idx_project_tags_project ON project_tags(project_id);
  CREATE INDEX IF NOT EXISTS idx_project_actions_project ON project_action_items(project_id);
`);

export interface ContentRow {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  content: string;
  date: string;
  status: string;
  from_social_post_id: number | null;
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
  fromSocialPostId?: number;
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
    fromSocialPostId: row.from_social_post_id || undefined,
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
    INSERT INTO content (slug, title, description, content, date, status, from_social_post_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    content.slug,
    content.title,
    content.description || null,
    content.content,
    content.date,
    content.status,
    content.fromSocialPostId || null,
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

// ============================================================================
// Projects (Roadmap)
// ============================================================================

export interface ActionItem {
  id?: number;
  task: string;
  owner: string;
  dueDate?: string;
  completed?: boolean;
  sortOrder?: number;
}

export interface Project {
  id: string;
  title: string;
  tagline: string;
  description: string;
  status: "completed" | "ongoing" | "future";
  icon?: string;
  coverImage?: string;
  coverGradient?: string;
  url?: string;
  startDate?: string;
  targetDate?: string;
  completedDate?: string;
  sortOrder?: number;
  notes?: string;
  tags?: string[];
  actionPlan?: ActionItem[];
}

interface ProjectRow {
  id: string;
  title: string;
  tagline: string;
  description: string;
  status: string;
  icon: string | null;
  cover_image: string | null;
  cover_gradient: string | null;
  url: string | null;
  start_date: string | null;
  target_date: string | null;
  completed_date: string | null;
  sort_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Helper to convert row to Project
function rowToProject(
  row: ProjectRow,
  tags: string[],
  actionItems: ActionItem[],
): Project {
  return {
    id: row.id,
    title: row.title,
    tagline: row.tagline,
    description: row.description,
    status: row.status as "completed" | "ongoing" | "future",
    icon: row.icon || undefined,
    coverImage: row.cover_image || undefined,
    coverGradient: row.cover_gradient || undefined,
    url: row.url || undefined,
    startDate: row.start_date || undefined,
    targetDate: row.target_date || undefined,
    completedDate: row.completed_date || undefined,
    sortOrder: row.sort_order,
    notes: row.notes || undefined,
    tags: tags.length > 0 ? tags : undefined,
    actionPlan: actionItems.length > 0 ? actionItems : undefined,
  };
}

// Get all projects
export function getAllProjects(): Project[] {
  const rows = db
    .prepare("SELECT * FROM projects ORDER BY sort_order ASC, created_at ASC")
    .all() as ProjectRow[];

  return rows.map((row) => {
    const tags = (
      db
        .prepare("SELECT tag FROM project_tags WHERE project_id = ?")
        .all(row.id) as { tag: string }[]
    ).map((t) => t.tag);
    const actionRows = db
      .prepare(
        "SELECT * FROM project_action_items WHERE project_id = ? ORDER BY sort_order ASC",
      )
      .all(row.id) as Array<{
      id: number;
      task: string;
      owner: string;
      due_date: string | null;
      completed: number;
      sort_order: number;
    }>;
    const actionItems: ActionItem[] = actionRows.map((a) => ({
      id: a.id,
      task: a.task,
      owner: a.owner,
      dueDate: a.due_date || undefined,
      completed: a.completed === 1,
      sortOrder: a.sort_order,
    }));
    return rowToProject(row, tags, actionItems);
  });
}

// Get projects by status
export function getProjectsByStatus(
  status: "completed" | "ongoing" | "future",
): Project[] {
  const rows = db
    .prepare("SELECT * FROM projects WHERE status = ? ORDER BY sort_order ASC")
    .all(status) as ProjectRow[];

  return rows.map((row) => {
    const tags = (
      db
        .prepare("SELECT tag FROM project_tags WHERE project_id = ?")
        .all(row.id) as { tag: string }[]
    ).map((t) => t.tag);
    const actionRows = db
      .prepare(
        "SELECT * FROM project_action_items WHERE project_id = ? ORDER BY sort_order ASC",
      )
      .all(row.id) as Array<{
      id: number;
      task: string;
      owner: string;
      due_date: string | null;
      completed: number;
      sort_order: number;
    }>;
    const actionItems: ActionItem[] = actionRows.map((a) => ({
      id: a.id,
      task: a.task,
      owner: a.owner,
      dueDate: a.due_date || undefined,
      completed: a.completed === 1,
      sortOrder: a.sort_order,
    }));
    return rowToProject(row, tags, actionItems);
  });
}

// Get project by ID
export function getProjectById(id: string): Project | null {
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as
    | ProjectRow
    | undefined;
  if (!row) return null;

  const tags = (
    db
      .prepare("SELECT tag FROM project_tags WHERE project_id = ?")
      .all(row.id) as { tag: string }[]
  ).map((t) => t.tag);
  const actionRows = db
    .prepare(
      "SELECT * FROM project_action_items WHERE project_id = ? ORDER BY sort_order ASC",
    )
    .all(row.id) as Array<{
    id: number;
    task: string;
    owner: string;
    due_date: string | null;
    completed: number;
    sort_order: number;
  }>;
  const actionItems: ActionItem[] = actionRows.map((a) => ({
    id: a.id,
    task: a.task,
    owner: a.owner,
    dueDate: a.due_date || undefined,
    completed: a.completed === 1,
    sortOrder: a.sort_order,
  }));
  return rowToProject(row, tags, actionItems);
}

// Create project
export function createProject(project: Project): Project {
  const stmt = db.prepare(`
    INSERT INTO projects (id, title, tagline, description, status, icon, cover_image, cover_gradient, url, start_date, target_date, completed_date, sort_order, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    project.id,
    project.title,
    project.tagline,
    project.description,
    project.status,
    project.icon || null,
    project.coverImage || null,
    project.coverGradient || null,
    project.url || null,
    project.startDate || null,
    project.targetDate || null,
    project.completedDate || null,
    project.sortOrder || 0,
    project.notes || null,
  );

  // Insert tags
  if (project.tags && project.tags.length > 0) {
    const tagStmt = db.prepare(
      "INSERT OR IGNORE INTO project_tags (project_id, tag) VALUES (?, ?)",
    );
    for (const tag of project.tags) {
      tagStmt.run(project.id, tag);
    }
  }

  // Insert action items
  if (project.actionPlan && project.actionPlan.length > 0) {
    const actionStmt = db.prepare(`
      INSERT INTO project_action_items (project_id, task, owner, due_date, completed, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    project.actionPlan.forEach((item, index) => {
      actionStmt.run(
        project.id,
        item.task,
        item.owner || "me",
        item.dueDate || null,
        item.completed ? 1 : 0,
        item.sortOrder ?? index,
      );
    });
  }

  return getProjectById(project.id)!;
}

// Update project
export function updateProject(
  id: string,
  updates: Partial<Project>,
): Project | null {
  const existing = getProjectById(id);
  if (!existing) return null;

  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (updates.title !== undefined) {
    fields.push("title = ?");
    values.push(updates.title);
  }
  if (updates.tagline !== undefined) {
    fields.push("tagline = ?");
    values.push(updates.tagline);
  }
  if (updates.description !== undefined) {
    fields.push("description = ?");
    values.push(updates.description);
  }
  if (updates.status !== undefined) {
    fields.push("status = ?");
    values.push(updates.status);
  }
  if (updates.icon !== undefined) {
    fields.push("icon = ?");
    values.push(updates.icon || null);
  }
  if (updates.coverImage !== undefined) {
    fields.push("cover_image = ?");
    values.push(updates.coverImage || null);
  }
  if (updates.coverGradient !== undefined) {
    fields.push("cover_gradient = ?");
    values.push(updates.coverGradient || null);
  }
  if (updates.url !== undefined) {
    fields.push("url = ?");
    values.push(updates.url || null);
  }
  if (updates.startDate !== undefined) {
    fields.push("start_date = ?");
    values.push(updates.startDate || null);
  }
  if (updates.targetDate !== undefined) {
    fields.push("target_date = ?");
    values.push(updates.targetDate || null);
  }
  if (updates.completedDate !== undefined) {
    fields.push("completed_date = ?");
    values.push(updates.completedDate || null);
  }
  if (updates.sortOrder !== undefined) {
    fields.push("sort_order = ?");
    values.push(updates.sortOrder);
  }
  if (updates.notes !== undefined) {
    fields.push("notes = ?");
    values.push(updates.notes || null);
  }

  if (fields.length > 0) {
    fields.push("updated_at = datetime('now')");
    values.push(id);
    db.prepare(`UPDATE projects SET ${fields.join(", ")} WHERE id = ?`).run(
      ...values,
    );
  }

  // Update tags if provided
  if (updates.tags !== undefined) {
    db.prepare("DELETE FROM project_tags WHERE project_id = ?").run(id);
    if (updates.tags.length > 0) {
      const tagStmt = db.prepare(
        "INSERT OR IGNORE INTO project_tags (project_id, tag) VALUES (?, ?)",
      );
      for (const tag of updates.tags) {
        tagStmt.run(id, tag);
      }
    }
  }

  // Update action items if provided
  if (updates.actionPlan !== undefined) {
    db.prepare("DELETE FROM project_action_items WHERE project_id = ?").run(id);
    if (updates.actionPlan.length > 0) {
      const actionStmt = db.prepare(`
        INSERT INTO project_action_items (project_id, task, owner, due_date, completed, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      updates.actionPlan.forEach((item, index) => {
        actionStmt.run(
          id,
          item.task,
          item.owner || "me",
          item.dueDate || null,
          item.completed ? 1 : 0,
          item.sortOrder ?? index,
        );
      });
    }
  }

  return getProjectById(id);
}

// Delete project
export function deleteProject(id: string): boolean {
  const result = db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  return result.changes > 0;
}

// Seed projects (insert or update)
export function seedProjects(projects: Project[]): number {
  let count = 0;
  for (const project of projects) {
    const existing = getProjectById(project.id);
    if (existing) {
      updateProject(project.id, project);
    } else {
      createProject(project);
    }
    count++;
  }
  return count;
}

export { db, DB_PATH };
