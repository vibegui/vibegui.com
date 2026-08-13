-- Structure only. This migration originally also seeded one instance's seven
-- strategic results and eleven scorecard items; those rows were the owner's
-- declaration, not schema, and every fresh database inherited them.
--
-- The declared structure now lives in worldview.json (git) and D1 keeps only the
-- measurement, so a result declared in git with no row here reads 0% and needs
-- no migration. Wrangler tracks migrations by filename rather than content, so
-- removing those INSERTs is a no-op for any database that already applied this
-- file — the existing rows stay exactly where they are.
--
-- Do NOT "finish the job" with a later migration that deletes them. It would run
-- against live databases and destroy real progress. See 0007 for the two scores.

CREATE TABLE IF NOT EXISTS strategic_results (
  id TEXT PRIMARY KEY,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  narrative TEXT NOT NULL,
  acceptance_criteria TEXT NOT NULL DEFAULT '[]',
  metrics TEXT NOT NULL DEFAULT '[]',
  progress_percent INTEGER NOT NULL DEFAULT 0
    CHECK (progress_percent >= 0 AND progress_percent <= 100),
  progress_note TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scorecard_items (
  id TEXT PRIMARY KEY,
  position INTEGER NOT NULL,
  label TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('metric', 'boolean')),
  current_value REAL,
  target_value REAL,
  unit TEXT NOT NULL DEFAULT '',
  boolean_value INTEGER CHECK (boolean_value IN (0, 1)),
  note TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
