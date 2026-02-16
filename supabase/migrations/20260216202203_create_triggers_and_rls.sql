-- Migration: Create triggers (updated_at, search_vector, tag propagation) and RLS policies
-- Phase 03, Plan 01, Task 2

-- 1. updated_at trigger function and trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER articles_updated_at
  BEFORE UPDATE ON articles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 2. Search vector trigger function and trigger
CREATE OR REPLACE FUNCTION update_article_search_vector()
RETURNS trigger AS $$
DECLARE
  tag_text TEXT;
BEGIN
  -- Aggregate tags for this article
  SELECT COALESCE(string_agg(t.name, ' '), '') INTO tag_text
  FROM article_tags at
  JOIN tags t ON t.id = at.tag_id
  WHERE at.article_id = NEW.id;

  -- Build weighted search vector
  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.content, '')), 'C') ||
    setweight(to_tsvector('simple', tag_text), 'D');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER articles_search_vector_update
  BEFORE INSERT OR UPDATE ON articles
  FOR EACH ROW
  EXECUTE FUNCTION update_article_search_vector();

-- 3. Tag change propagation trigger function and trigger
CREATE OR REPLACE FUNCTION update_article_search_on_tag_change()
RETURNS trigger AS $$
DECLARE
  affected_article_id BIGINT;
BEGIN
  affected_article_id := COALESCE(NEW.article_id, OLD.article_id);
  -- Touch the article to fire the articles trigger (updates search_vector)
  UPDATE articles SET updated_at = now()
  WHERE id = affected_article_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER article_tags_search_update
  AFTER INSERT OR DELETE ON article_tags
  FOR EACH ROW
  EXECUTE FUNCTION update_article_search_on_tag_change();

-- 4. Enable RLS on all three tables
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_tags ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies

-- Articles: anon can read published only
CREATE POLICY "Public can read published articles"
  ON articles FOR SELECT
  TO anon
  USING (status = 'published');

-- Articles: authenticated can read all (including drafts)
CREATE POLICY "Authenticated can read all articles"
  ON articles FOR SELECT
  TO authenticated
  USING (true);

-- Tags: anon and authenticated can read (needed for article list views)
CREATE POLICY "Public can read tags"
  ON tags FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Authenticated can read tags"
  ON tags FOR SELECT
  TO authenticated
  USING (true);

-- Article_tags: anon and authenticated can read (needed to join tags with articles)
CREATE POLICY "Public can read article_tags"
  ON article_tags FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Authenticated can read article_tags"
  ON article_tags FOR SELECT
  TO authenticated
  USING (true);

-- Note: No INSERT/UPDATE/DELETE policies needed.
-- Service role key bypasses RLS automatically (BYPASSRLS privilege).
-- All writes go through service role client in import/sync scripts.
