PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  spirit TEXT NOT NULL DEFAULT '',
  repository TEXT,
  investment_mode TEXT NOT NULL DEFAULT 'incubate'
    CHECK (investment_mode IN ('focus', 'maintain', 'incubate', 'archive')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  current_outcome TEXT NOT NULL DEFAULT '',
  success_criteria TEXT NOT NULL DEFAULT '',
  next_review TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_sources (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  locator TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, kind, locator)
);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  parent_goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  desired_outcome TEXT NOT NULL,
  success_criteria TEXT NOT NULL DEFAULT '',
  horizon TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  current_assessment TEXT NOT NULL DEFAULT '',
  next_review TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL
    CHECK (kind IN ('fact', 'observation', 'preference', 'lesson', 'reflection')),
  content TEXT NOT NULL,
  source TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 1
    CHECK (confidence >= 0 AND confidence <= 1),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'superseded', 'forgotten')),
  supersedes_id TEXT REFERENCES memories(id) ON DELETE SET NULL,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  decision TEXT NOT NULL,
  rationale TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'studio',
  decided_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS decisions_prevent_update
BEFORE UPDATE ON decisions
BEGIN
  SELECT RAISE(ABORT, 'decisions are immutable');
END;

CREATE TRIGGER IF NOT EXISTS decisions_prevent_delete
BEFORE DELETE ON decisions
BEGIN
  SELECT RAISE(ABORT, 'decisions are immutable');
END;

CREATE TABLE IF NOT EXISTS captures (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'idea'
    CHECK (kind IN ('idea', 'distinction', 'project', 'task', 'source', 'note')),
  content TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'studio',
  status TEXT NOT NULL DEFAULT 'inbox'
    CHECK (status IN ('inbox', 'reviewed', 'developed', 'archived')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS focus_declarations (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  statement TEXT NOT NULL,
  starts_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ends_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_events (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  kind TEXT NOT NULL,
  summary TEXT NOT NULL,
  url TEXT,
  confidence REAL NOT NULL DEFAULT 1
    CHECK (confidence >= 0 AND confidence <= 1),
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source, kind, url, occurred_at)
);

CREATE TABLE IF NOT EXISTS work_items (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'github',
  kind TEXT NOT NULL CHECK (kind IN ('issue', 'pull_request')),
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  state TEXT NOT NULL,
  url TEXT NOT NULL,
  author TEXT,
  labels TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source, project_id, kind, number)
);

CREATE TABLE IF NOT EXISTS daily_briefs (
  id TEXT PRIMARY KEY,
  brief_date TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  source_snapshot TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sync_state (
  source TEXT PRIMARY KEY,
  cursor TEXT,
  last_attempt_at TEXT,
  last_success_at TEXT,
  last_error TEXT
);

CREATE INDEX IF NOT EXISTS projects_mode_idx
  ON projects(investment_mode, status);
CREATE INDEX IF NOT EXISTS goals_scope_idx
  ON goals(project_id, status, next_review);
CREATE INDEX IF NOT EXISTS memories_scope_idx
  ON memories(project_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS captures_inbox_idx
  ON captures(status, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_project_date_idx
  ON activity_events(project_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS work_items_project_state_idx
  ON work_items(project_id, state, updated_at DESC);
CREATE INDEX IF NOT EXISTS decisions_project_date_idx
  ON decisions(project_id, decided_at DESC);
