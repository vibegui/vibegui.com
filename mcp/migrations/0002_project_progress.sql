ALTER TABLE projects
  ADD COLUMN progress_percent INTEGER
  CHECK (progress_percent IS NULL OR (progress_percent >= 0 AND progress_percent <= 100));

ALTER TABLE projects
  ADD COLUMN progress_note TEXT NOT NULL DEFAULT '';
