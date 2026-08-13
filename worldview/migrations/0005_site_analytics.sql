-- First-party site analytics (same pattern as holocard / awesome-ai-native):
-- events are plain rows, the worker is the collector (POST /e), MCP tools query.
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  value REAL NOT NULL DEFAULT 1,
  site TEXT,
  path TEXT,
  ref TEXT,
  visitor TEXT,
  country TEXT,
  dims TEXT,
  ts INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_name_ts ON events (name, ts);
CREATE INDEX IF NOT EXISTS idx_events_site_ts ON events (site, ts);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events (ts);
