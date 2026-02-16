-- Migration: Create articles, tags, and article_tags tables with indexes
-- Phase 03, Plan 01, Task 1

-- Articles table
CREATE TABLE articles (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published')),
  date DATE NOT NULL,
  cover_image TEXT,
  search_vector TSVECTOR,
  created_by TEXT NOT NULL DEFAULT 'unknown',
  updated_by TEXT NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tags table (normalized tag names)
CREATE TABLE tags (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- Junction table (composite PK, no separate ID)
CREATE TABLE article_tags (
  article_id BIGINT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, tag_id)
);

-- Indexes
CREATE INDEX articles_slug_idx ON articles (slug);
CREATE INDEX articles_status_idx ON articles (status);
CREATE INDEX articles_date_idx ON articles (date DESC);
CREATE INDEX articles_search_vector_idx ON articles USING GIN (search_vector);
CREATE INDEX article_tags_article_id_idx ON article_tags (article_id);
CREATE INDEX article_tags_tag_id_idx ON article_tags (tag_id);
