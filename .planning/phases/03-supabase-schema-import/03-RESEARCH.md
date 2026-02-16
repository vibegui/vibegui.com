# Phase 3: Supabase Schema & Import - Research

**Researched:** 2026-02-16
**Domain:** PostgreSQL schema design, full-text search, RLS policies, Supabase client operations
**Confidence:** HIGH

## Summary

This phase creates the articles table in Supabase, sets up a junction-table tags system, configures full-text search with weighted tsvector and GIN index, applies RLS policies, and imports all 52 markdown articles. The existing codebase already has `@supabase/supabase-js` v2.89.0 installed, a working Supabase client pattern in `lib/supabase.ts`, a bookmark_tags junction table pattern to reuse, and a validated article parser (`lib/articles.ts`) with Zod schema that reads all 52 articles cleanly.

A critical finding: PostgreSQL generated columns CANNOT reference other tables or use subqueries. Since tags live in a junction table and the user wants tags included in `search_vector`, the search_vector column MUST use a trigger-based approach rather than the simpler `GENERATED ALWAYS AS` pattern shown in Supabase docs. Two triggers are needed: one on the articles table (for title/description/content changes) and one on the article_tags table (for tag changes).

**Primary recommendation:** Use a custom trigger function for search_vector that aggregates tags from the junction table via subquery, with setweight() for title(A) > description(B) > content(C) > tags(D) ranking. Use supabase-js upsert with `onConflict: 'slug'` for the import script.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
#### Column design & types
- Tags stored in a **junction table** (separate `tags` table + `article_tags` join table), not a text[] array
- Article status is a simple **draft / published** enum (no archived state)
- Cover image stored as a **URL string column** (text field with image path), not Supabase Storage
- Date field is **date only** (no time component) -- matches current frontmatter format (YYYY-MM-DD)

#### Import behavior
- Validation failures: **skip and log** -- bad articles are skipped with error logged, rest continue importing
- Re-run behavior: **upsert** -- match by slug, update if exists, insert if new. Safe to re-run anytime
- Import target: **direct to Supabase** -- script connects via client library and inserts rows (no SQL file generation)
- Status mapping: **infer from frontmatter** -- check if frontmatter has a draft/status field and map accordingly

#### Search & indexing
- search_vector feeds from **title + description + content + tags** (all textual fields)
- Search weights: **title > description > content** (title matches rank highest)
- Language config: **'simple' (language-agnostic)** -- no stemming, works with any language
- Vector updates: **database trigger** on INSERT/UPDATE -- search_vector always in sync automatically

#### RLS & access control
- Draft articles: **authenticated only** -- drafts hidden from public, only logged-in users/agents can see them
- Write access: **service role only** -- only server-side code (scripts, edge functions) can write articles
- AI agent identification: **agent name** in audit columns (e.g., 'claude-code') -- distinguishes different AI tools
- Tags table RLS: **service role only for all operations** -- tags managed internally through the sync pipeline

### Claude's Discretion
- Exact column types and constraints beyond what's specified
- Junction table design details (composite primary key vs separate ID)
- Trigger function implementation details
- Import script error message formatting
- Dry-run output format

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SUPA-01 | Supabase MCP configured with vibegui database credentials | Existing `.env` has `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`. Supabase MCP agent available but requires re-authorization. Import script uses service role client directly. |
| SUPA-02 | Articles table with slug, title, description, content, status, date, cover_image, tags columns | Schema design in Architecture Patterns section. Tags via junction table (not column). All other columns mapped directly from frontmatter. |
| SUPA-03 | Slug uniqueness enforced via database constraint | `UNIQUE` constraint on slug column. Used as `onConflict` target for upsert. |
| SUPA-04 | Full-text search via tsvector + GIN index | MUST use trigger (not generated column) because tags are in junction table. Custom trigger function with setweight(). GIN index on search_vector. |
| SUPA-05 | Audit columns: created_by, updated_by, created_at, updated_at | Standard pattern: `created_at TIMESTAMPTZ DEFAULT now()`, `updated_at` via trigger, text columns for created_by/updated_by with agent name. |
| SUPA-06 | RLS policies (public read published, authenticated write) | Per decisions: anon SELECT published only, authenticated SELECT all, service_role bypasses RLS for writes. Tags table: service_role only. |
| SUPA-07 | Zod schema validates article data at write boundaries | Existing `ArticleFrontmatterSchema` in `lib/articles.ts` validates at parse time. Import script validates before insert. |
| IMPT-01 | Import script reads all 52 articles and inserts into Supabase | Uses `readAllArticles()` from `lib/articles.ts`, then supabase-js `upsert()` with service role client. |
| IMPT-02 | Import validates required fields and reports errors before inserting | Zod parse in `readArticle()` catches validation errors. Import wraps in try/catch, logs failures, continues. |
| IMPT-03 | Import includes dry-run mode | `--dry-run` flag: parse all articles, validate, report what would be inserted, but skip DB operations. |
| IMPT-04 | All 52 articles verified present in Supabase after import | Post-import count query: `SELECT COUNT(*) FROM articles`. Script verifies count matches expected. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | 2.89.0 | Supabase client for upsert/query | Already installed, existing patterns in `lib/supabase.ts` |
| zod | 3.25.76 | Schema validation at write boundaries | Already installed, `ArticleFrontmatterSchema` exists |
| gray-matter | 4.0.3 | Parse markdown frontmatter | Already installed, `readArticle()` uses it |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none needed) | - | - | All dependencies already in project |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| supabase-js upsert | Raw SQL via postgres driver | supabase-js handles auth, RLS bypass with service key, simpler API |
| Trigger for search_vector | Generated column | Generated columns CANNOT reference other tables -- triggers required for junction table tags |
| Composite PK on article_tags | Separate serial ID | Composite PK (article_id, tag) is simpler, prevents duplicates at DB level, no wasted ID sequence |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
lib/
  articles.ts          # Existing parser (Phase 2) -- reuse readAllArticles()
  supabase.ts          # Existing client (anon key) -- reference pattern
scripts/
  import-articles.ts   # NEW: Import script using service role client
```

### Pattern 1: Service Role Client for Scripts
**What:** Create a separate Supabase client with service_role key for server-side scripts that need write access.
**When to use:** Import scripts, sync scripts, any server-side DB mutation.
**Example:**
```typescript
// Source: Existing pattern in codebase + Supabase docs
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
```
**Confidence:** HIGH -- existing `SUPABASE_SERVICE_KEY` in `.env`, same pattern documented in Supabase official docs.

### Pattern 2: Upsert with onConflict on Slug
**What:** Use supabase-js `.upsert()` with `onConflict: 'slug'` for idempotent import.
**When to use:** Import script re-runs.
**Example:**
```typescript
// Source: https://supabase.com/docs/reference/javascript/upsert
const { data, error } = await supabaseAdmin
  .from("articles")
  .upsert(
    {
      slug: article.slug,
      title: article.title,
      description: article.description,
      content: article.content,
      status: article.status,
      date: article.date,
      cover_image: article.coverImage,
      created_by: "import-script",
      updated_by: "import-script",
    },
    { onConflict: "slug" }
  )
  .select("id, slug")
  .single();
```
**Confidence:** HIGH -- verified in Supabase docs. Primary key or unique constraint must exist on `slug`.

### Pattern 3: Junction Table Tag Management
**What:** After upserting articles, delete existing tags and re-insert from frontmatter.
**When to use:** Every article upsert (tags may have changed).
**Example:**
```typescript
// Delete existing tags for this article
await supabaseAdmin
  .from("article_tags")
  .delete()
  .eq("article_id", articleId);

// Insert new tags (if any)
if (article.tags.length > 0) {
  // Ensure tags exist in tags table
  const tagRows = article.tags.map((name) => ({ name }));
  await supabaseAdmin
    .from("tags")
    .upsert(tagRows, { onConflict: "name" });

  // Get tag IDs
  const { data: tagData } = await supabaseAdmin
    .from("tags")
    .select("id, name")
    .in("name", article.tags);

  // Insert junction rows
  const junctionRows = (tagData ?? []).map((t) => ({
    article_id: articleId,
    tag_id: t.id,
  }));
  await supabaseAdmin.from("article_tags").insert(junctionRows);
}
```
**Confidence:** HIGH -- mirrors existing `bookmark_tags` pattern in `vite.config.ts`.

### Pattern 4: Search Vector Trigger with Weights
**What:** Custom trigger function that builds search_vector from article columns + aggregated tags.
**When to use:** Must be a trigger, not a generated column, because tags are in a junction table.
**Example:**
```sql
-- Source: PostgreSQL docs + Supabase full-text search guide
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
```
**Confidence:** HIGH -- standard PostgreSQL pattern, verified against official docs.

**IMPORTANT:** A second trigger is needed on `article_tags` to update the parent article's search_vector when tags change:
```sql
CREATE OR REPLACE FUNCTION update_article_search_on_tag_change()
RETURNS trigger AS $$
DECLARE
  affected_article_id BIGINT;
BEGIN
  affected_article_id := COALESCE(NEW.article_id, OLD.article_id);
  -- Touch the article to fire the articles trigger
  UPDATE articles SET updated_at = now()
  WHERE id = affected_article_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER article_tags_search_update
  AFTER INSERT OR DELETE ON article_tags
  FOR EACH ROW
  EXECUTE FUNCTION update_article_search_on_tag_change();
```

### Anti-Patterns to Avoid
- **Generated column for search_vector when tags are in junction table:** PostgreSQL generated columns cannot reference other tables. This would silently exclude tags from search.
- **Using 'english' text search config for multilingual content:** User decided on 'simple' (language-agnostic). 'english' would apply stemming that breaks for Portuguese content.
- **Storing tags as text[] array on articles table:** User decided on junction table. Arrays lose referential integrity, can't enforce uniqueness, harder to query by tag.
- **Using anon key for import script:** Anon key respects RLS policies which block writes. Service role key bypasses RLS.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Article parsing | Custom YAML parser | `readAllArticles()` from `lib/articles.ts` | Already validated against all 52 articles in Phase 2 |
| DB client/auth | Custom HTTP calls | `@supabase/supabase-js` createClient | Handles auth headers, RLS, retries |
| Upsert logic | Custom INSERT ON CONFLICT SQL | supabase-js `.upsert()` | Handles serialization, error formatting, type safety |
| Search ranking | Custom scoring algorithm | PostgreSQL `ts_rank()` with setweight | Battle-tested, index-accelerated |

**Key insight:** The existing codebase already has every library needed. No new dependencies. Reuse `readAllArticles()` for parsing and follow the `bookmark_tags` junction table pattern for `article_tags`.

## Common Pitfalls

### Pitfall 1: Generated Column for Cross-Table Search Vector
**What goes wrong:** Using `GENERATED ALWAYS AS (to_tsvector(...))` for search_vector that needs tag data from junction table.
**Why it happens:** Supabase docs show generated columns as the "simple" approach for tsvector. Easy to miss that it cannot reference other tables.
**How to avoid:** Use trigger-based approach (documented in Architecture Patterns above).
**Warning signs:** search_vector never includes tag terms; tag searches return zero results.

### Pitfall 2: Upsert Without Returning ID
**What goes wrong:** supabase-js v2 `.upsert()` does NOT return rows by default. If you don't chain `.select()`, you get `null` data -- then can't get the article ID for tag insertion.
**Why it happens:** Breaking change from supabase-js v1 to v2.
**How to avoid:** Always chain `.select("id, slug")` after `.upsert()`.
**Warning signs:** `data` is null after successful upsert.

### Pitfall 3: RLS Blocking Service Role
**What goes wrong:** Service role client still gets RLS errors.
**Why it happens:** Using anon key instead of service_role key, or creating client incorrectly.
**How to avoid:** Verify `SUPABASE_SERVICE_KEY` is the service_role key (not anon key). Existing `.env` has it as `SUPABASE_SERVICE_KEY`.
**Warning signs:** 403 or empty results on insert/update operations.

### Pitfall 4: Date Type Mismatch
**What goes wrong:** PostgreSQL `date` column rejects string format from frontmatter.
**Why it happens:** Frontmatter stores dates as `YYYY-MM-DD` strings. PostgreSQL `date` type accepts this format natively.
**How to avoid:** This actually works fine -- PostgreSQL auto-casts `'2025-01-27'` string to date. Just ensure the column is `date` type, not `timestamp`.
**Warning signs:** No issue expected, but verify with a test insert.

### Pitfall 5: Tag Trigger Cascade Loop
**What goes wrong:** Tag change trigger updates article's `updated_at`, which fires article trigger, which tries to re-aggregate tags -- potential infinite loop.
**Why it happens:** The article trigger fires on UPDATE, and the tag trigger does an UPDATE on articles.
**How to avoid:** The article trigger uses `BEFORE INSERT OR UPDATE` and modifies `NEW.search_vector` -- it doesn't do another UPDATE. The tag trigger does `UPDATE articles SET updated_at = now()` which fires the article trigger once. No loop because the article trigger doesn't UPDATE itself.
**Warning signs:** Excessive trigger executions in Postgres logs.

### Pitfall 6: Forgetting to Enable RLS
**What goes wrong:** Tables without RLS are publicly accessible through the Supabase API (PostgREST). Anyone can read/write.
**Why it happens:** RLS is disabled by default on new tables.
**How to avoid:** Always `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` immediately after CREATE TABLE. Add policies AFTER enabling RLS.
**Warning signs:** Supabase dashboard shows "RLS disabled" warning on table.

## Code Examples

### Complete Schema DDL
```sql
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

-- Enable RLS
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_tags ENABLE ROW LEVEL SECURITY;
```

### RLS Policies
```sql
-- Articles: public can read published
CREATE POLICY "Public can read published articles"
  ON articles FOR SELECT
  TO anon
  USING (status = 'published');

-- Articles: authenticated can read all (including drafts)
CREATE POLICY "Authenticated can read all articles"
  ON articles FOR SELECT
  TO authenticated
  USING (true);

-- Articles: only service_role can write (bypasses RLS automatically)
-- No explicit INSERT/UPDATE/DELETE policies needed for service_role
-- Service role has BYPASSRLS privilege

-- Tags: service_role only (no public or authenticated policies)
-- No policies = no access for anon/authenticated
-- Service role bypasses RLS

-- Article_tags: service_role only (same as tags)
-- No policies = no access for anon/authenticated

-- Tags: public can read (needed for article list views)
CREATE POLICY "Public can read tags"
  ON tags FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Authenticated can read tags"
  ON tags FOR SELECT
  TO authenticated
  USING (true);

-- Article_tags: public can read (needed to join tags with articles)
CREATE POLICY "Public can read article_tags"
  ON article_tags FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Authenticated can read article_tags"
  ON article_tags FOR SELECT
  TO authenticated
  USING (true);
```

### Updated_at Trigger
```sql
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
```

### Service Role Client for Import Script
```typescript
// scripts/import-articles.ts
import { createClient } from "@supabase/supabase-js";
import { readAllArticles } from "../lib/articles.ts";

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

const DRY_RUN = process.argv.includes("--dry-run");
const ARTICLES_DIR = "blog/articles";
const CREATED_BY = "import-script";
```

### Import Script Core Loop Pattern
```typescript
const articles = readAllArticles(ARTICLES_DIR);
let success = 0;
let skipped = 0;
const errors: { slug: string; error: string }[] = [];

for (const article of articles) {
  try {
    if (DRY_RUN) {
      console.log(`[DRY-RUN] Would upsert: ${article.slug}`);
      success++;
      continue;
    }

    // Upsert article
    const { data, error } = await supabaseAdmin
      .from("articles")
      .upsert(
        {
          slug: article.slug,
          title: article.title,
          description: article.description,
          content: article.content,
          status: article.status,
          date: article.date,
          cover_image: article.coverImage,
          created_by: CREATED_BY,
          updated_by: CREATED_BY,
        },
        { onConflict: "slug" }
      )
      .select("id, slug")
      .single();

    if (error) throw error;

    // Manage tags (delete + re-insert pattern)
    await supabaseAdmin
      .from("article_tags")
      .delete()
      .eq("article_id", data.id);

    if (article.tags.length > 0) {
      // Upsert tag names
      await supabaseAdmin
        .from("tags")
        .upsert(
          article.tags.map((name) => ({ name })),
          { onConflict: "name" }
        );

      // Fetch tag IDs
      const { data: tagRows } = await supabaseAdmin
        .from("tags")
        .select("id, name")
        .in("name", article.tags);

      // Insert junction rows
      if (tagRows && tagRows.length > 0) {
        await supabaseAdmin.from("article_tags").insert(
          tagRows.map((t) => ({
            article_id: data.id,
            tag_id: t.id,
          }))
        );
      }
    }

    success++;
    console.log(`Imported: ${article.slug}`);
  } catch (err) {
    skipped++;
    const msg = err instanceof Error ? err.message : String(err);
    errors.push({ slug: article.slug, error: msg });
    console.error(`SKIPPED: ${article.slug} - ${msg}`);
  }
}

// Summary
console.log(`\nImport complete: ${success} success, ${skipped} skipped`);
if (errors.length > 0) {
  console.log("Errors:");
  for (const e of errors) {
    console.log(`  - ${e.slug}: ${e.error}`);
  }
}

// Verify count
if (!DRY_RUN) {
  const { count } = await supabaseAdmin
    .from("articles")
    .select("*", { count: "exact", head: true });
  console.log(`\nVerification: ${count} articles in database`);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Generated tsvector columns | Still valid for single-table search | PostgreSQL 12+ (2019) | Cannot use for cross-table search (our case needs triggers) |
| supabase-js v1 insert returns rows | v2 requires `.select()` chain | supabase-js v2 (2022) | Must always add `.select()` after upsert to get data back |
| Custom RLS with auth.uid() | Same, plus service_role bypass | Ongoing | Service role key bypasses all RLS -- no write policies needed |

**Deprecated/outdated:**
- supabase-js v1 `.upsert()` API: v2 changed return behavior (no rows by default).
- `tsvector_update_trigger` built-in: Only works for single-table columns, cannot handle junction table aggregation.

## Open Questions

1. **Supabase MCP re-authorization**
   - What we know: The Supabase MCP agent returns "requires re-authorization (token expired)" when called.
   - What's unclear: Whether this will be resolved before phase execution, or if we should use the Supabase dashboard for DDL.
   - Recommendation: Apply migrations via Supabase MCP `apply_migration` tool if re-authorized; otherwise use Supabase SQL Editor in dashboard. The import script uses supabase-js directly and does not depend on MCP.

2. **tags and article_tags read access for anonymous users**
   - What we know: User said "Tags table RLS: service role only for all operations." But if anon users query articles with tags (e.g., for the blog list), they need SELECT on tags and article_tags.
   - What's unclear: Whether "service role only for all operations" means reads too, or just writes.
   - Recommendation: Add SELECT policies for anon/authenticated on tags and article_tags. Without this, the public blog cannot display tags. The "service role only" likely refers to write operations (INSERT/UPDATE/DELETE). Flag this for user confirmation during planning if needed.

3. **Handling `cover_image: null` in frontmatter**
   - What we know: Most articles have `coverImage: null`. PostgreSQL column should be `TEXT` nullable.
   - What's unclear: Nothing -- this is straightforward.
   - Recommendation: Column `cover_image TEXT` (nullable by default). Map `null` from frontmatter to SQL NULL.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `lib/articles.ts` (Phase 2 parser), `lib/supabase.ts` (Supabase client pattern), `vite.config.ts` (bookmark_tags junction table pattern)
- [Supabase Full Text Search Guide](https://supabase.com/docs/guides/database/full-text-search) -- tsvector, GIN index, setweight
- [Supabase RLS Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security) -- policy syntax, roles, service_role bypass
- [Supabase JavaScript Upsert API](https://supabase.com/docs/reference/javascript/upsert) -- onConflict, .select() chaining
- [PostgreSQL Generated Columns Documentation](https://www.postgresql.org/docs/current/ddl-generated-columns.html) -- confirmed cannot reference other tables

### Secondary (MEDIUM confidence)
- [Supabase service_role troubleshooting](https://supabase.com/docs/guides/troubleshooting/performing-administration-tasks-on-the-server-side-with-the-servicerole-secret-BYM4Fa) -- createClient with service key pattern
- [Optimizing Full Text Search with tsvector Triggers](https://thoughtbot.com/blog/optimizing-full-text-search-with-postgres-tsvector-columns-and-triggers) -- trigger-based tsvector pattern

### Tertiary (LOW confidence)
- None -- all findings verified against official docs or existing codebase patterns.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed, patterns exist in codebase
- Architecture: HIGH -- schema is standard PostgreSQL, trigger pattern well-documented
- Pitfalls: HIGH -- generated column limitation verified in official PostgreSQL docs
- Import script: HIGH -- supabase-js upsert API verified, article parser already tested

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable -- PostgreSQL and supabase-js are mature)
