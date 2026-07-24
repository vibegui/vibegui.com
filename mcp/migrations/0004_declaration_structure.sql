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

INSERT OR IGNORE INTO strategic_results (
  id, position, title, narrative, acceptance_criteria, metrics,
  progress_percent, progress_note
) VALUES
(
  'agency', 1, 'My projects move as one portfolio',
  'Every active personal project is visible in one map, connected to an explicit outcome and the evidence of whether it is moving.',
  '["Every active project has a goal, success criteria, state, and next review","A useful daily brief is reviewed at least five times per week","The agent surfaces stale commitments and recommends concrete next steps"]',
  '[{"label":"Active projects with goals","current":1,"target":4,"unit":"projects"},{"label":"Daily briefs reviewed","current":0,"target":5,"unit":"per week"}]',
  35, 'The project map, goals, memory, GitHub evidence, and briefing workflow exist; the daily operating rhythm is not established yet.'
),
(
  'understanding', 2, 'Important distinctions can be gotten through conversation',
  'VibeGui is a navigable graph of distinctions with essays, sources, and guided paths that create a genuine change in perspective.',
  '["Twelve distinctions have an essay, graph position, sources, and guided path","Readers complete real guided conversations","Repeatable paths that help people get a distinction are identified"]',
  '[{"label":"Structured distinctions","current":0,"target":12,"unit":"distinctions"},{"label":"Validated conversation paths","current":0,"target":12,"unit":"paths"}]',
  10, 'The public writing corpus and semantic retrieval exist; the distinction graph and guided paths do not.'
),
(
  'compounding', 3, 'My library and conversations make each other better',
  'Books and source materials are mapped to concepts and distinctions, while conversations reveal what remains unclear and what deserves development.',
  '["Twenty books or primary sources are mapped","Conversation signals enter a private review pipeline","No model output becomes public truth without review"]',
  '[{"label":"Mapped sources","current":0,"target":20,"unit":"sources"},{"label":"Reviewed conversation signals","current":0,"target":1,"unit":"working loop"}]',
  5, 'The R2 corpus and AutoRAG foundation exist; the library map and learning loop do not.'
),
(
  'multiplication', 4, 'A personal AI agent is available to anyone who wants one',
  'The VibeGui MCP is a documented Personal AI OS template that another person can deploy, connect to Studio, and make their own.',
  '["A new user reaches a useful first daily brief from the documentation alone","Ten independent deployments are connected to Studio","Three independent maintainers contribute"]',
  '[{"label":"Independent deployments","current":1,"target":10,"unit":"deployments"},{"label":"Independent maintainers","current":0,"target":3,"unit":"maintainers"}]',
  10, 'The first deployment and setup documentation exist; independent adoption has not started.'
),
(
  'expression', 5, 'Conversations become artifacts worth sharing',
  'A reader can turn an important shift into a beautiful, consented, cited artifact that brings another person into the conversation.',
  '["A conversation can produce a redacted and consented artifact","Every artifact cites its sources and map location","Organic sharing happens repeatedly and establishes a baseline"]',
  '[{"label":"Shareable artifact flow","current":0,"target":1,"unit":"working flow"},{"label":"Share-rate baseline","current":0,"target":1,"unit":"measured baseline"}]',
  0, 'Not started.'
),
(
  'relationships', 6, 'Important connections do not disappear',
  'I have a trustworthy map of the people who matter, grounded in evidence from sources I control.',
  '["The first trusted circle is mapped with provenance","Identity merges and relationship claims are reviewable","The agent can explain why a person may help and where I can help first"]',
  '[{"label":"Trusted circle mapped","current":0,"target":1,"unit":"complete circle"},{"label":"Verified relationship records","current":0,"target":1,"unit":"working set"}]',
  0, 'Not started.'
),
(
  'order', 7, 'My personal files form a usable library',
  'Files across my Mac, iCloud, and Google Drive are searchable as one private map and can be organized through reversible operations.',
  '["Mac, iCloud, and Google Drive are indexed","Canonical and duplicate candidates are visible","Every move or archive operation has a dry run, audit trail, and recovery path"]',
  '[{"label":"Storage sources indexed","current":0,"target":3,"unit":"sources"},{"label":"Reversible organization flow","current":0,"target":1,"unit":"working flow"}]',
  0, 'Not started.'
);

INSERT OR IGNORE INTO scorecard_items (
  id, position, label, kind, current_value, target_value, unit,
  boolean_value, note
) VALUES
  ('project-coverage', 1, 'Active projects with a complete operating state', 'metric', 1, 4, 'projects', NULL, 'Goal, success criteria, state, and next review'),
  ('daily-briefs', 2, 'Useful daily briefs reviewed', 'metric', 0, 5, 'per week', NULL, ''),
  ('distinctions', 3, 'Structured distinctions', 'metric', 0, 12, 'distinctions', NULL, ''),
  ('sources', 4, 'Books and primary sources mapped', 'metric', 0, 20, 'sources', NULL, ''),
  ('deployments', 5, 'Personal AI OS deployments', 'metric', 1, 10, 'deployments', NULL, ''),
  ('maintainers', 6, 'Independent maintainers', 'metric', 0, 3, 'maintainers', NULL, ''),
  ('guided-paths', 7, 'Repeatable ''got it'' paths identified', 'boolean', NULL, NULL, '', 0, ''),
  ('shareable-artifacts', 8, 'Consented shareable artifacts working', 'boolean', NULL, NULL, '', 0, ''),
  ('trusted-circle', 9, 'First trusted relationship circle mapped', 'boolean', NULL, NULL, '', 0, ''),
  ('storage-map', 10, 'Mac, iCloud, and Drive visible in one map', 'boolean', NULL, NULL, '', 0, ''),
  ('privacy', 11, 'Zero private-data exposure incidents', 'boolean', NULL, NULL, '', 1, 'Permanent condition');
