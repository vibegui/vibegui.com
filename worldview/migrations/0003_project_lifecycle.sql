-- The body of this migration was edited after it had already been applied, to
-- remove one instance's project ids. Wrangler tracks migrations by filename, so
-- the edit is a no-op for a database that already ran it and clean for a new
-- one. The ADD COLUMN default already places existing rows in 'active'.

ALTER TABLE projects
  ADD COLUMN lifecycle TEXT NOT NULL DEFAULT 'active'
  CHECK (lifecycle IN ('draft', 'active', 'archived'));

DROP TABLE IF EXISTS focus_declarations;
DROP INDEX IF EXISTS projects_mode_idx;

ALTER TABLE projects DROP COLUMN investment_mode;
ALTER TABLE projects DROP COLUMN status;

CREATE INDEX IF NOT EXISTS projects_lifecycle_idx
  ON projects(lifecycle, name);
