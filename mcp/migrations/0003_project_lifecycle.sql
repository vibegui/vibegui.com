ALTER TABLE projects
  ADD COLUMN lifecycle TEXT NOT NULL DEFAULT 'active'
  CHECK (lifecycle IN ('draft', 'active', 'archived'));

UPDATE projects
SET lifecycle = CASE
  WHEN id IN ('personal-crm', 'personal-files', 'anjo-chat') THEN 'draft'
  ELSE 'active'
END;

DROP TABLE IF EXISTS focus_declarations;
DROP INDEX IF EXISTS projects_mode_idx;

ALTER TABLE projects DROP COLUMN investment_mode;
ALTER TABLE projects DROP COLUMN status;

CREATE INDEX IF NOT EXISTS projects_lifecycle_idx
  ON projects(lifecycle, name);
