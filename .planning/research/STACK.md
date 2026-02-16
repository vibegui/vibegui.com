# Stack Research: Supabase-First Article Management

**Research Type:** Project Research — Stack dimension
**Date:** 2026-02-16
**Status:** Complete

## Executive Summary

This research evaluates tools and patterns for adding Supabase-backed article management to vibegui.com, with a sync pipeline that exports articles to markdown files for static site generation. The site already uses Bun, Vite 6, React 19, Tailwind CSS 4, and Supabase (for bookmarks). This research focuses specifically on the **DB→markdown sync pipeline** and **database-as-source-of-truth patterns** for static sites.

**Key Finding:** The existing stack already contains most needed dependencies. We need minimal additions: just database schema management and a robust sync script. No new heavy dependencies required.

---

## Current Stack Analysis

### Existing Dependencies (Relevant to Articles)
```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.89.0"  // Already installed for bookmarks
  },
  "devDependencies": {
    "gray-matter": "^4.0.3",             // YAML frontmatter parsing
    "marked": "^15.0.7",                 // Markdown rendering
    "zod": "^3.25.76",                   // Runtime validation
    "typescript": "^5.7.2",              // Type safety
    "bun-types": "^1.3.5"                // Bun runtime types
  }
}
```

### Current Article Flow
1. **Source:** `blog/articles/*.md` (52 files with YAML frontmatter)
2. **Parser:** `lib/articles.ts` - custom frontmatter parser (no gray-matter usage yet)
3. **Generator:** `scripts/generate.ts` - builds manifest.json + SSG HTML
4. **Build:** Vite → dist/ for Cloudflare Pages

**Status:** File-first architecture. Articles are the source of truth as markdown files.

### Target Article Flow
1. **Source:** Supabase `articles` table (single source of truth)
2. **Sync:** Script exports Supabase articles → `blog/articles/*.md`
3. **Parser:** Same `lib/articles.ts` (unchanged)
4. **Generator:** Same `scripts/generate.ts` (unchanged)
5. **Build:** Same Vite pipeline (unchanged)

**Key Insight:** The sync script is the only new component. Everything else stays the same.

---

## Recommended Stack

### 1. Database Client: @supabase/supabase-js

**Version:** `^2.89.0` (already installed)
**Purpose:** Query/write articles to Supabase PostgreSQL

**Rationale:**
- Already in use for bookmarks — proven working pattern
- TypeScript-native with excellent type inference
- Supports RLS (Row Level Security) for safe client-side queries
- Works in both Node.js (scripts) and browser (React components)
- Auto-reconnects, handles pagination, supports real-time subscriptions

**What NOT to use:**
- `postgres` package directly — more verbose, no RLS support
- `pg` package — callback-based API, harder to use with Bun
- `prisma` — overkill for this use case, adds build complexity

**Confidence:** 95% (already working, battle-tested in production)

**Example Usage:**
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // Service key for sync script
);

// Fetch all published articles
const { data: articles } = await supabase
  .from('articles')
  .select('*')
  .eq('status', 'published')
  .order('date', { ascending: false });
```

---

### 2. Frontmatter Generation: gray-matter

**Version:** `^4.0.3` (already installed)
**Purpose:** Generate YAML frontmatter + markdown content

**Rationale:**
- Industry standard for frontmatter parsing/generation
- Bidirectional: `stringify()` for DB→file, `parse()` for file→DB
- Handles all YAML types (strings, arrays, nulls, dates)
- Zero dependencies, fast, stable (v4 since 2018)
- Currently installed but not used — custom parser in `lib/articles.ts`

**Migration Path:**
1. Replace custom frontmatter parser in `lib/articles.ts` with gray-matter
2. Use `matter.stringify()` in sync script to generate markdown files
3. Keep same article format — gray-matter handles existing structure

**What NOT to use:**
- Custom parser (current) — reinventing the wheel, fragile edge cases
- `front-matter` package — deprecated, gray-matter is the successor
- `yaml` + manual string concatenation — error-prone, doesn't handle markdown escaping

**Confidence:** 90% (proven tool, already installed, safe migration)

**Example Usage:**
```typescript
import matter from 'gray-matter';

// DB → File (sync script)
const markdown = matter.stringify(articleContent, {
  slug: article.slug,
  title: article.title,
  description: article.description,
  date: article.date,
  status: article.status,
  coverImage: article.coverImage,
  tags: article.tags
});

await Bun.write(`blog/articles/${article.slug}.md`, markdown);

// File → Object (existing parser, migrate to this)
const { data: frontmatter, content } = matter.read('blog/articles/my-post.md');
```

---

### 3. Schema Validation: Zod

**Version:** `^3.25.76` (already installed)
**Purpose:** Validate article data structure at DB boundaries

**Rationale:**
- Already in dependency tree — used for type safety elsewhere
- Runtime validation catches schema drift between DB and code
- Generates TypeScript types automatically (`z.infer<typeof schema>`)
- Excellent error messages for debugging sync issues
- Integrates with Supabase via `zod-to-json-schema` (also installed)

**Usage Pattern:**
```typescript
import { z } from 'zod';

export const ArticleSchema = z.object({
  id: z.number().int().positive().optional(),
  slug: z.string().min(1).max(255),
  title: z.string().min(1),
  description: z.string(),
  content: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['draft', 'published']),
  coverImage: z.string().nullable(),
  tags: z.array(z.string()),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional()
});

export type Article = z.infer<typeof ArticleSchema>;

// Validate in sync script
const article = ArticleSchema.parse(dbRow);
```

**What NOT to use:**
- `yup` — slower, less TypeScript-native
- `joi` — Node.js-centric, verbose API
- `io-ts` — functional programming style, steeper learning curve
- Manual type guards — error-prone, verbose, no automatic types

**Confidence:** 95% (already installed, proven in ecosystem)

---

### 4. Database Schema Management: Supabase Migrations

**Tool:** `supabase` CLI
**Version:** Latest from Homebrew/npm
**Purpose:** Version-controlled database schema changes

**Rationale:**
- Official Supabase tool for schema management
- Generates SQL migration files with timestamps
- Tracks applied migrations in `supabase_migrations.schema_migrations` table
- Works with local dev database and production Supabase project
- Supports rollbacks, dry-runs, and migration diffs

**Installation:**
```bash
# Homebrew (recommended)
brew install supabase/tap/supabase

# Or npm
npm install -g supabase
```

**Usage Pattern:**
```bash
# Initialize (creates supabase/migrations/ directory)
supabase init

# Create articles table migration
supabase migration new create_articles_table

# Write SQL in supabase/migrations/TIMESTAMP_create_articles_table.sql
# Then apply to remote
supabase db push
```

**Migration File Example:**
```sql
-- Create articles table
CREATE TABLE IF NOT EXISTS public.articles (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  cover_image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_articles_updated_at
  BEFORE UPDATE ON public.articles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create tags table (similar to bookmark_tags pattern)
CREATE TABLE IF NOT EXISTS public.article_tags (
  id BIGSERIAL PRIMARY KEY,
  article_id BIGINT NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  UNIQUE(article_id, tag)
);

-- Indexes
CREATE INDEX idx_articles_slug ON public.articles(slug);
CREATE INDEX idx_articles_status ON public.articles(status);
CREATE INDEX idx_articles_date ON public.articles(date DESC);
CREATE INDEX idx_article_tags_article_id ON public.article_tags(article_id);
CREATE INDEX idx_article_tags_tag ON public.article_tags(tag);

-- RLS Policies (public read, authenticated write)
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Articles are publicly readable"
  ON public.articles FOR SELECT
  USING (true);

CREATE POLICY "Articles are writable by authenticated users"
  ON public.articles FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Article tags are publicly readable"
  ON public.article_tags FOR SELECT
  USING (true);

CREATE POLICY "Article tags are writable by authenticated users"
  ON public.article_tags FOR ALL
  USING (auth.role() = 'authenticated');
```

**What NOT to use:**
- Handwritten SQL without migrations — no version control, hard to rollback
- Prisma Migrate — requires Prisma Client, heavy dependency, ORM lock-in
- TypeORM migrations — Node.js-centric, decorator-heavy, not Bun-optimized
- Kysely migrations — good but less Supabase-native
- Raw SQL in scripts — works but no tracking of what's applied

**Confidence:** 85% (official tool, but need to verify Bun compatibility)

---

### 5. Sync Script Pattern: Bun Script with File Diffing

**Tool:** Native Bun APIs + custom logic
**Pattern:** Smart sync (only write changed files)
**Purpose:** Export Supabase articles → `blog/articles/*.md` efficiently

**Rationale:**
- Bun provides fast file I/O: `Bun.write()`, `Bun.file().exists()`
- Avoid unnecessary file writes to prevent dev server thrashing
- Hash-based diffing: only write if content changed
- Delete orphaned markdown files (articles deleted from DB)
- Preserve file mtimes for unchanged articles (better for git, caching)

**Implementation Strategy:**
```typescript
#!/usr/bin/env bun
/**
 * Sync articles from Supabase to markdown files
 * Usage: bun scripts/sync-articles.ts
 */

import { createClient } from '@supabase/supabase-js';
import matter from 'gray-matter';
import { readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // Service role for full access
);

const ARTICLES_DIR = join(import.meta.dir, '../blog/articles');

// Hash content for change detection
function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

async function sync() {
  console.log('🔄 Syncing articles from Supabase...');

  // Fetch all articles from DB
  const { data: articles, error } = await supabase
    .from('articles')
    .select('*, article_tags(tag)')
    .order('date', { ascending: false });

  if (error) throw error;

  const synced = new Set<string>();
  let created = 0, updated = 0, unchanged = 0;

  for (const article of articles) {
    const filename = `${article.slug}.md`;
    const filepath = join(ARTICLES_DIR, filename);
    synced.add(filename);

    // Build markdown content
    const tags = article.article_tags?.map((t: any) => t.tag) || [];
    const markdown = matter.stringify(article.content, {
      slug: article.slug,
      title: article.title,
      description: article.description,
      date: article.date,
      status: article.status,
      coverImage: article.cover_image,
      tags
    });

    const contentHash = hashContent(markdown);

    // Check if file exists and has same content
    const file = Bun.file(filepath);
    if (await file.exists()) {
      const existing = await file.text();
      const existingHash = hashContent(existing);

      if (existingHash === contentHash) {
        unchanged++;
        continue;
      }
      updated++;
    } else {
      created++;
    }

    // Write file
    await Bun.write(filepath, markdown);
  }

  // Delete orphaned files (articles deleted from DB)
  const files = await readdir(ARTICLES_DIR);
  let deleted = 0;
  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    if (!synced.has(file)) {
      await unlink(join(ARTICLES_DIR, file));
      deleted++;
    }
  }

  console.log(`✅ Sync complete: ${created} created, ${updated} updated, ${unchanged} unchanged, ${deleted} deleted`);
}

sync().catch(err => {
  console.error('❌ Sync failed:', err);
  process.exit(1);
});
```

**Integration Points:**
1. **Manual sync:** `bun run sync` before build
2. **Pre-build hook:** Add to `scripts/build.ts` as first step
3. **Watch mode (optional):** Supabase Realtime subscription + debounced sync

**What NOT to use:**
- `fs-extra` — unnecessary, Bun has built-in promisified APIs
- `chokidar` for watching DB — overkill, Supabase Realtime exists
- `rsync` CLI — can't handle frontmatter transformation
- Git-based sync — wrong abstraction, DB is source of truth

**Confidence:** 90% (proven pattern, Bun APIs are stable)

---

### 6. Import Script: One-Time Migration Tool

**Tool:** Bun script using gray-matter + Supabase client
**Purpose:** Migrate existing 52 markdown files → Supabase articles table

**Rationale:**
- One-time operation, doesn't need production-grade tooling
- Inverse of sync script: File → DB instead of DB → File
- Use existing `lib/articles.ts` parser or gray-matter directly
- Handle duplicates gracefully (upsert by slug)
- Preserve dates, slugs, all metadata

**Implementation Strategy:**
```typescript
#!/usr/bin/env bun
/**
 * Import existing markdown articles to Supabase
 * One-time migration script
 * Usage: bun scripts/import-articles.ts
 */

import { createClient } from '@supabase/supabase-js';
import matter from 'gray-matter';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const ARTICLES_DIR = join(import.meta.dir, '../blog/articles');

async function importArticles() {
  console.log('📥 Importing articles to Supabase...');

  const files = await readdir(ARTICLES_DIR);
  let imported = 0, skipped = 0;

  for (const file of files) {
    if (!file.endsWith('.md')) continue;

    const filepath = join(ARTICLES_DIR, file);
    const { data: frontmatter, content } = matter.read(filepath);

    // Upsert article (insert or update if slug exists)
    const { error: articleError } = await supabase
      .from('articles')
      .upsert({
        slug: frontmatter.slug,
        title: frontmatter.title,
        description: frontmatter.description || '',
        content,
        date: frontmatter.date,
        status: frontmatter.status || 'published',
        cover_image: frontmatter.coverImage || null
      }, { onConflict: 'slug' });

    if (articleError) {
      console.error(`❌ Failed to import ${file}:`, articleError);
      skipped++;
      continue;
    }

    // Fetch article ID for tags
    const { data: article } = await supabase
      .from('articles')
      .select('id')
      .eq('slug', frontmatter.slug)
      .single();

    if (!article) {
      console.error(`❌ Article ${file} not found after insert`);
      skipped++;
      continue;
    }

    // Import tags
    const tags = frontmatter.tags || [];
    if (tags.length > 0) {
      // Delete existing tags first
      await supabase
        .from('article_tags')
        .delete()
        .eq('article_id', article.id);

      // Insert new tags
      const tagRows = tags.map((tag: string) => ({
        article_id: article.id,
        tag
      }));

      await supabase
        .from('article_tags')
        .insert(tagRows);
    }

    imported++;
    console.log(`✅ Imported: ${frontmatter.title}`);
  }

  console.log(`\n🎉 Import complete: ${imported} imported, ${skipped} skipped`);
}

importArticles().catch(err => {
  console.error('❌ Import failed:', err);
  process.exit(1);
});
```

**Confidence:** 95% (straightforward, gray-matter + Supabase client proven)

---

## Database-as-Source-of-Truth Patterns

### Pattern 1: Sync-Before-Build (Recommended)

**Flow:**
```
[Supabase DB] → sync script → [markdown files] → generate.ts → vite build → dist/
```

**Pros:**
- Simple: existing build pipeline unchanged
- Works with Cloudflare Pages (no DB access needed at build time)
- Markdown files committed to git (reviewable, diffable)
- Fast builds (no network calls during Vite build)
- Dev server works offline after sync

**Cons:**
- Markdown files are "cache" but committed to git (feels weird)
- Two-step process: sync then build
- Need to remember to sync before committing article changes

**Implementation:**
```json
// package.json
{
  "scripts": {
    "sync": "bun scripts/sync-articles.ts",
    "build": "bun run sync && bun scripts/build.ts --mode=prod",
    "pages:build": "bun run sync && node --no-warnings --experimental-strip-types scripts/build.ts --mode=pages"
  }
}
```

**Best For:** Static-first sites like vibegui.com where markdown files are valuable as a fallback and git history is important.

---

### Pattern 2: Build-Time DB Query (Alternative)

**Flow:**
```
[Supabase DB] → generate.ts (fetches from DB) → vite build → dist/
```

**Pros:**
- No markdown files in git (cleaner, DB is pure source of truth)
- Always fresh: build pulls latest from DB
- No sync script needed

**Cons:**
- Requires DB access at build time (need env vars in CI)
- Slower builds (network calls for every article)
- Cloudflare Pages needs Supabase credentials
- Dev server needs DB connection (no offline work)
- Breaking change to existing pipeline

**Implementation:**
```typescript
// scripts/generate.ts (modified)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY! // Use anon key with RLS
);

// Replace readAllArticles() call
const { data: articles } = await supabase
  .from('articles')
  .select('*, article_tags(tag)')
  .order('date', { ascending: false });

// Transform to Article[] format...
```

**Best For:** Sites with frequent article updates, where markdown files are purely temporary artifacts and DB is the only source of truth.

---

### Pattern 3: Hybrid (Query + Cache)

**Flow:**
```
[Supabase DB] → generate.ts (query with cache) → vite build → dist/
```

**Pros:**
- Fast builds (cache hit most of the time)
- Always fresh (cache invalidation on DB changes)
- Works offline after first build

**Cons:**
- Complex: need cache invalidation logic
- Still requires DB access at build time
- Harder to debug (cache staleness issues)

**Best For:** Large sites with 100+ articles where network overhead matters.

---

### Recommended Pattern: Sync-Before-Build

**Rationale:**
1. **Minimal migration risk:** Existing pipeline unchanged (generate.ts, build.ts, finalize.ts)
2. **Cloudflare Pages compatible:** No DB credentials needed in CF environment
3. **Markdown files as cache:** Committed to git, reviewable, works offline
4. **Fast builds:** No network overhead during Vite build
5. **Simple debugging:** Can inspect markdown files directly
6. **Rollback-friendly:** Git history shows article content changes

**Migration Path:**
1. Create articles table in Supabase
2. Run import script (markdown → DB)
3. Verify DB contains all articles
4. Test sync script (DB → markdown)
5. Add sync to build scripts
6. Update documentation

**Confidence:** 90% (aligns with project constraints, proven pattern)

---

## Additional Tooling

### 7. MCP Integration (Already Exists)

**Tool:** `@modelcontextprotocol/sdk` (already in optionalDependencies)
**Purpose:** Let Claude agents query/write articles directly to Supabase

**Current Status:** MCP server likely needs updating to include articles table

**Integration:**
```typescript
// Add to MCP server tools
{
  name: "create_article",
  description: "Create a new article in Supabase",
  inputSchema: {
    type: "object",
    properties: {
      slug: { type: "string" },
      title: { type: "string" },
      content: { type: "string" },
      // ...other fields
    }
  }
}
```

**No new dependencies needed.**

---

### 8. Backup/Restore (Already Exists)

**Tool:** `scripts/backup-supabase.ts` and `scripts/restore-supabase.ts`
**Status:** Already implemented, work for entire DB including articles

**No changes needed.** Articles are automatically backed up with bookmarks.

---

## Version Matrix

| Package | Current | Needed | Notes |
|---------|---------|--------|-------|
| @supabase/supabase-js | 2.89.0 | ✅ Keep | Latest stable as of Jan 2025 |
| gray-matter | 4.0.3 | ✅ Keep | Stable since 2018 |
| marked | 15.0.7 | ✅ Keep | Latest as of Jan 2025 |
| zod | 3.25.76 | ✅ Keep | Latest stable |
| bun-types | 1.3.5 | ✅ Keep | Matches Bun runtime |
| supabase CLI | — | ⚠️ Add | Install via Homebrew/npm |

**Key Insight:** No package.json changes needed for sync functionality. Only new tool is Supabase CLI for migrations.

---

## Anti-Recommendations

### What NOT to Add

1. **Prisma** — ORM lock-in, heavy build, slow Bun support
2. **TypeORM** — decorator-heavy, Node.js-centric, complex migrations
3. **Contentlayer** — abandoned project (last update 2023)
4. **Contentful/Sanity SDKs** — vendor lock-in, not needed with Supabase
5. **GraphQL layer** — overkill for simple CRUD operations
6. **Redis/caching** — premature optimization, 52 articles is tiny
7. **Full-text search engine** — Postgres FTS is sufficient

### What NOT to Change

1. **Keep Vite 6** — no reason to downgrade or switch to other bundlers
2. **Keep React 19** — not relevant to article management
3. **Keep Bun** — excellent for scripting (file I/O, TypeScript, speed)
4. **Keep existing `lib/articles.ts` interface** — downstream code stays compatible

---

## Migration Risks

### Risk 1: Data Loss During Import
**Likelihood:** Low
**Mitigation:**
- Backup existing markdown files before import
- Test import script on staging DB first
- Verify article count matches: `ls blog/articles/*.md | wc -l` vs `SELECT COUNT(*) FROM articles`

### Risk 2: Sync Script Bugs
**Likelihood:** Medium
**Mitigation:**
- Hash-based change detection prevents unnecessary writes
- Test with single article first
- Add `--dry-run` flag for preview mode

### Risk 3: Cloudflare Pages Build Failure
**Likelihood:** Low
**Mitigation:**
- Sync script runs locally before git push
- Markdown files committed to git (CF Pages just runs vite build)
- No CF Pages config changes needed

### Risk 4: Dev Server Hot Reload Thrashing
**Likelihood:** Medium
**Mitigation:**
- Only write files that changed (hash diffing)
- Don't run sync script in watch mode (manual trigger only)
- Existing Vite file watcher handles markdown changes fine

---

## Open Questions

### Q1: Should sync script run automatically in CI/CD?
**Answer:** No. Run sync locally before committing. Keeps markdown files as git artifacts.

### Q2: What about article images?
**Answer:** Keep images in `public/images/articles/` as before. Store paths in DB (cover_image column). Sync script doesn't manage images.

### Q3: Need article versioning/history?
**Answer:** Not in scope. Git history of markdown files provides versioning. Supabase stores current version only.

### Q4: Authentication for article writes?
**Answer:** RLS policies require `auth.role() = 'authenticated'`. MCP server uses service key (full access). Client-side apps would need auth flow.

---

## Success Criteria

### Phase 1: Schema Setup
- [ ] Supabase CLI installed
- [ ] Migration created: `articles` + `article_tags` tables
- [ ] Migration applied to production DB
- [ ] Indexes and RLS policies active

### Phase 2: Import
- [ ] Import script written
- [ ] All 52 markdown articles imported to Supabase
- [ ] Verification: DB count == file count
- [ ] Spot-check: 5 random articles match markdown content

### Phase 3: Sync
- [ ] Sync script written with hash diffing
- [ ] Test: DB → markdown produces identical files
- [ ] Test: Orphan file deletion works
- [ ] Test: Dev server hot reload after sync

### Phase 4: Integration
- [ ] `bun run sync` script added to package.json
- [ ] Sync integrated into `build` script
- [ ] Build succeeds: `bun run pages:build`
- [ ] Dist output verified (articles present)

### Phase 5: Validation
- [ ] E2E tests pass
- [ ] Constraint tests pass
- [ ] Manual QA: 5 articles render correctly
- [ ] MCP server updated (if needed)

---

## Confidence Levels

| Component | Confidence | Notes |
|-----------|------------|-------|
| @supabase/supabase-js | 95% | Already working for bookmarks |
| gray-matter | 90% | Industry standard, need to verify stringify() API |
| Zod validation | 95% | Already in use, straightforward |
| Supabase CLI | 85% | Official tool, need to verify Bun compat |
| Sync script pattern | 90% | Proven approach, Bun APIs stable |
| Import script | 95% | Inverse of sync, straightforward |
| Sync-before-build | 90% | Best fit for project constraints |
| Migration risks | 80% | Need staging DB testing first |

**Overall Confidence:** 88%

---

## Next Steps

1. **Immediate:** Install Supabase CLI (`brew install supabase/tap/supabase`)
2. **Database:** Create migration for articles schema
3. **Import:** Write import script, test with 1 article, then full batch
4. **Sync:** Write sync script with hash diffing, test thoroughly
5. **Integration:** Add sync to build pipeline, update docs
6. **Validation:** Run full test suite, manual QA

**Estimated Time:** 4-6 hours (assuming no Supabase schema surprises)

---

## References

### Documentation
- Supabase JS Client: https://supabase.com/docs/reference/javascript/introduction
- Supabase CLI: https://supabase.com/docs/reference/cli/introduction
- gray-matter: https://github.com/jonschlinkert/gray-matter
- Zod: https://zod.dev

### Existing Code
- `/Users/guilherme/Projects/vibegui.com/lib/supabase.ts` — Supabase client pattern
- `/Users/guilherme/Projects/vibegui.com/lib/articles.ts` — Current article parser
- `/Users/guilherme/Projects/vibegui.com/scripts/generate.ts` — Build pipeline entry
- `/Users/guilherme/Projects/vibegui.com/scripts/backup-supabase.ts` — DB backup pattern

### Migration Context
- `/Users/guilherme/Projects/vibegui.com/.planning/PROJECT.md` — Project goals
- 52 existing markdown articles in `blog/articles/*.md`
- Bookmarks already in Supabase (proven working pattern)

---

*Research completed: 2026-02-16*
*Confidence: 88% — Ready for implementation*
