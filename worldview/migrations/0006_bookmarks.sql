PRAGMA foreign_keys = ON;

-- Bookmark metadata and enrichment live in D1. Full Firecrawl Markdown lives
-- in R2; only its key, digest, size, and a bounded search excerpt live here.
CREATE TABLE IF NOT EXISTS bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL UNIQUE CHECK (length(trim(url)) > 0),
  title TEXT,
  description TEXT,
  icon TEXT,
  stars INTEGER CHECK (stars IS NULL OR stars BETWEEN 1 AND 5),
  language TEXT,
  reading_time_min INTEGER
    CHECK (reading_time_min IS NULL OR reading_time_min >= 0),
  perplexity_research TEXT,
  insight_dev TEXT,
  insight_founder TEXT,
  insight_investor TEXT,
  notes TEXT,
  researched_at TEXT,
  classified_at TEXT,
  published_at TEXT,
  firecrawl_key TEXT,
  firecrawl_sha256 TEXT,
  firecrawl_bytes INTEGER
    CHECK (firecrawl_bytes IS NULL OR firecrawl_bytes >= 0),
  content_excerpt TEXT NOT NULL DEFAULT '',
  search_tags TEXT NOT NULL DEFAULT '',
  insights_search TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookmark_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  tag TEXT NOT NULL CHECK (length(trim(tag)) > 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(bookmark_id, tag)
);

CREATE INDEX IF NOT EXISTS bookmarks_classified_idx
  ON bookmarks(classified_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS bookmarks_stars_idx
  ON bookmarks(stars DESC, classified_at DESC);
CREATE INDEX IF NOT EXISTS bookmark_tags_tag_idx
  ON bookmark_tags(tag, bookmark_id);

CREATE VIRTUAL TABLE IF NOT EXISTS bookmarks_fts USING fts5(
  title,
  description,
  url,
  search_tags,
  perplexity_research,
  insights_search,
  content_excerpt,
  content = 'bookmarks',
  content_rowid = 'id',
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TRIGGER IF NOT EXISTS bookmarks_fts_insert
AFTER INSERT ON bookmarks
BEGIN
  INSERT INTO bookmarks_fts(
    rowid, title, description, url, search_tags, perplexity_research,
    insights_search, content_excerpt
  ) VALUES (
    new.id, new.title, new.description, new.url, new.search_tags,
    new.perplexity_research, new.insights_search, new.content_excerpt
  );
END;

CREATE TRIGGER IF NOT EXISTS bookmarks_fts_delete
AFTER DELETE ON bookmarks
BEGIN
  INSERT INTO bookmarks_fts(
    bookmarks_fts, rowid, title, description, url, search_tags,
    perplexity_research, insights_search, content_excerpt
  ) VALUES (
    'delete', old.id, old.title, old.description, old.url, old.search_tags,
    old.perplexity_research, old.insights_search, old.content_excerpt
  );
END;

CREATE TRIGGER IF NOT EXISTS bookmarks_fts_update
AFTER UPDATE ON bookmarks
BEGIN
  INSERT INTO bookmarks_fts(
    bookmarks_fts, rowid, title, description, url, search_tags,
    perplexity_research, insights_search, content_excerpt
  ) VALUES (
    'delete', old.id, old.title, old.description, old.url, old.search_tags,
    old.perplexity_research, old.insights_search, old.content_excerpt
  );
  INSERT INTO bookmarks_fts(
    rowid, title, description, url, search_tags, perplexity_research,
    insights_search, content_excerpt
  ) VALUES (
    new.id, new.title, new.description, new.url, new.search_tags,
    new.perplexity_research, new.insights_search, new.content_excerpt
  );
END;

INSERT INTO bookmarks_fts(bookmarks_fts) VALUES ('rebuild');
