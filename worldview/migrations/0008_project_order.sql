-- Deliberate project order.
--
-- Not a priority label — lifecycle stays the only categorical state a project
-- has. This is an explicit sequence the owner sets, which is a decision they
-- made rather than a category the system invented. Projects with no position
-- fall to the end and keep sorting by name, so this needs no backfill.

ALTER TABLE projects ADD COLUMN position INTEGER;

CREATE INDEX IF NOT EXISTS projects_position_idx
  ON projects(position, name);
