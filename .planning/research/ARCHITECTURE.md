# Architecture Research

**Domain:** Supabase-first blog with DB→file sync
**Researched:** 2026-02-16
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          SUPABASE (Source of Truth)                     │
├─────────────────────────────────────────────────────────────────────────┤
│  articles table:                                                        │
│    - id, slug, title, description, content (markdown)                   │
│    - status (draft/published), date, cover_image, tags (jsonb)          │
│    - created_at, updated_at, created_by, updated_by                     │
│    - search_vector (tsvector, generated)                                │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ sync-articles.ts
                                   │ (DB → File)
                                   ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                        MARKDOWN FILES (Build Artifact)                  │
├─────────────────────────────────────────────────────────────────────────┤
│  blog/articles/*.md                                                     │
│    - YAML frontmatter (slug, title, description, date, status, etc.)    │
│    - Markdown body (article content)                                    │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ scripts/generate.ts
                                   │ (Existing build step)
                                   ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                            BUILD PIPELINE                               │
├─────────────────────────────────────────────────────────────────────────┤
│  1. generate.ts:                                                        │
│     - Read blog/articles/*.md                                           │
│     - Parse frontmatter + markdown                                      │
│     - Generate public/content/manifest.json                             │
│     - Generate .build/article/{slug}/index.html (SSG)                   │
│                                                                         │
│  2. vite build:                                                         │
│     - Bundle React SPA (src/main.tsx)                                   │
│     - Output to dist/ with content-hashed assets                        │
│                                                                         │
│  3. finalize.ts:                                                        │
│     - Copy manifest to dist/content/                                    │
│     - Process SSG HTML (replace dev scripts with prod assets)           │
│     - Embed manifest JSON into index.html                               │
│     - Output final dist/ ready for Cloudflare Pages                     │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ Deploy
                                   ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                         CLOUDFLARE PAGES (Edge)                         │
├─────────────────────────────────────────────────────────────────────────┤
│  - /article/{slug} → Serve SSG HTML (instant load, SEO-optimized)       │
│  - / → Serve SPA index.html with embedded manifest (no fetch needed)    │
│  - Content-hashed assets cached indefinitely                            │
└─────────────────────────────────────────────────────────────────────────┘

AI AGENTS ──┐
            │ MCP tools (execute_sql)
            ↓
        SUPABASE ──→ sync-articles.ts ──→ MARKDOWN ──→ BUILD ──→ DEPLOY
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Supabase articles table** | Single source of truth for article content | PostgreSQL with RLS, full-text search (tsvector), audit columns |
| **AI agents** | Write/edit articles directly in Supabase | MCP tools calling `execute_sql` (existing pattern from bookmarks) |
| **sync-articles.ts** | Export DB → markdown files | Bun script, queries Supabase, writes .md with frontmatter |
| **blog/articles/*.md** | Build artifacts for static site generation | YAML frontmatter + markdown body, git-tracked for history |
| **generate.ts** | Parse markdown → SSG HTML + manifest | Existing script, reads .md files, outputs .build/ + public/content/ |
| **build.ts** | Orchestrate entire build pipeline | Existing script, runs generate → vite → finalize in sequence |
| **finalize.ts** | Post-process build artifacts | Existing script, copies manifest, injects assets into SSG HTML |
| **Cloudflare Pages** | Edge deployment with instant routing | Existing deploy target, serves SSG + SPA with content-hashing |

## Data Flow

### Key Data Flows

#### 1. Content Creation Flow (AI Agent → Published Article)

```
AI Agent (Claude)
  │
  │ 1. execute_sql("INSERT INTO articles ...")
  ↓
Supabase articles table (source of truth)
  │
  │ 2. Manual trigger: bun scripts/sync-articles.ts
  ↓
blog/articles/new-article.md (created/updated)
  │
  │ 3. Auto-trigger (file watcher) or manual: bun scripts/build.ts --mode=prod
  ↓
Build Pipeline (generate.ts → vite → finalize.ts)
  │
  │ 4. git commit && git push (manual or CI)
  ↓
Cloudflare Pages (auto-deploy on push to main)
  │
  │ 5. User visits /article/new-article
  ↓
Instant SSG HTML served from edge
```

#### 2. Content Update Flow (Edit Existing Article)

```
AI Agent or Human (via Supabase Studio)
  │
  │ 1. execute_sql("UPDATE articles SET ... WHERE slug = '...'")
  ↓
Supabase articles table
  │
  │ 2. bun scripts/sync-articles.ts (overwrites existing .md)
  ↓
blog/articles/existing-article.md (updated)
  │
  │ 3. git diff shows changes, commit if satisfied
  ↓
Build + Deploy (same as creation flow)
```

#### 3. Dev Mode Flow (Local Development)

```
Option A: Work with existing markdown (no sync needed)
  blog/articles/*.md → bun scripts/build.ts --mode=dev → Vite dev server
  │
  │ File watcher auto-rebuilds on .md changes
  ↓
  Browser auto-reloads (HMR for code, full reload for content)

Option B: Test sync script changes
  1. bun scripts/sync-articles.ts (pull latest from Supabase)
  2. bun scripts/build.ts --mode=dev (start dev server)
  3. Edit articles in Supabase Studio
  4. Re-run sync script to pull changes
  5. Dev server auto-rebuilds on file change
```

#### 4. CI/CD Flow (Production Build)

```
git push to main
  │
  │ Cloudflare Pages webhook triggered
  ↓
Cloudflare Build Environment
  │
  │ 1. bun scripts/sync-articles.ts (optional: pull latest from Supabase)
  │    OR: Use existing .md files (faster, db already synced)
  │
  │ 2. bun scripts/build.ts --mode=pages
  │    - generate.ts (markdown → SSG HTML + manifest)
  │    - finalize.ts (process SSG, copy to dist/)
  │    (Note: vite build already done locally, dist/ committed)
  │
  ↓
Cloudflare Pages (deploy dist/, <20s deploy time)
```

## Architectural Patterns

### Use Supabase as Single Source of Truth

**Pattern:** Database-first content management, files are build artifacts.

**Why:** AI agents need structured data to query/edit. Markdown files are great for git history and static builds, but terrible for programmatic access. Supabase provides:
- Full-text search (tsvector)
- Structured queries (filter by status, tags, date)
- Audit trail (created_by, updated_by, timestamps)
- RLS for access control
- Webhooks for automation (future)

**Example from bookmarks:**
- Bookmarks are queried client-side via Supabase anon key
- Edit operations use Vite dev server API proxy with Supabase MCP
- No manual .json file management

**Apply to articles:**
- Articles queried via MCP execute_sql during authoring
- Sync script exports to .md for static build
- Git history tracks changes to .md files (human-readable diffs)

### Unidirectional Sync (DB → File Only)

**Pattern:** One-way sync from database to files, never reverse.

**Why:** Avoids conflict resolution complexity. If file and DB both changed, which wins? With unidirectional sync:
- DB is always correct
- Files are regenerated from DB
- Conflicts impossible (no "file → DB" path)

**Implementation:**
```typescript
// sync-articles.ts
const articles = await supabase
  .from('articles')
  .select('*')
  .eq('status', 'published') // or include drafts in dev mode
  .order('date', { ascending: false })

for (const article of articles) {
  const filepath = `blog/articles/${article.slug}.md`
  const content = serializeMarkdown(article) // frontmatter + body
  await writeFile(filepath, content)
}
```

**NOT bidirectional:**
```typescript
// ❌ DON'T DO THIS - creates conflict potential
if (fileModifiedAfter(dbModified)) {
  syncFileToDb(file) // conflicts if both changed
} else {
  syncDbToFile(article)
}
```

### Integrate Sync Before Build, Not During

**Pattern:** Sync is a separate pre-build step, not integrated into generate.ts.

**Why:**
1. Separation of concerns: sync pulls data, generate builds static site
2. Flexibility: Can run builds without sync (use existing .md files)
3. Speed: CI can skip sync if .md files already up-to-date
4. Debugging: Easier to test sync script independently

**Build order:**
```bash
# Option 1: Sync first (get latest from DB)
bun scripts/sync-articles.ts
bun scripts/build.ts --mode=prod

# Option 2: Skip sync (use existing .md, faster)
bun scripts/build.ts --mode=prod
```

**Where sync fits:**
```
BEFORE BUILD:
  sync-articles.ts → Supabase → blog/articles/*.md

EXISTING BUILD (unchanged):
  generate.ts → .md files → SSG HTML + manifest
  vite build → React SPA → dist/
  finalize.ts → process SSG → final dist/
```

### Reuse Existing Patterns (Bookmarks as Template)

**Pattern:** Article management mirrors bookmark management architecture.

**Why:** Bookmarks already demonstrate:
- Supabase client-side queries (anon key)
- Vite dev server API proxy for writes (Supabase MCP)
- Full-text search with tsvector
- Tags as separate table + jsonb array
- Modal for viewing full content

**Bookmarks pattern:**
```typescript
// Client-side: lib/supabase.ts (read-only via anon key)
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Server-side (dev): vite.config.ts API proxy with MCP execute_sql
async function executeSupabaseSql(query: string) {
  return callMcpTool('execute_sql', { query })
}
```

**Apply to articles:**
- Articles table schema mirrors bookmarks (id, created_at, updated_at, search_vector)
- AI agents use same MCP execute_sql pattern
- Full-text search reuses tsvector + GIN index
- Tags stored as jsonb (simpler than separate table for articles)

### Preserve Git History with Meaningful Commits

**Pattern:** .md files are git-tracked, sync creates readable diffs.

**Why:** Even though DB is source of truth, git history provides:
- Human-readable diffs of article changes
- Rollback capability (revert .md, then sync to DB)
- Blame/annotation for tracking who changed what
- CI/CD integration (deploy on push to main)

**Implementation:**
- Sync script preserves consistent formatting (deterministic YAML serialization)
- Frontmatter fields in fixed order (slug, title, description, date, status, coverImage, tags)
- Git commit message includes which articles changed:
  ```
  git commit -m "Sync articles: updated 'my-article', added 'new-article'"
  ```

### Validate Before Write (Schema Enforcement)

**Pattern:** Validate article data before writing to DB or file.

**Why:** Prevents corrupt data from breaking builds or requiring manual fixes.

**Validation rules:**
- Required fields: slug, title, content, status, date
- Slug format: lowercase, hyphens only, no spaces (URL-safe)
- Slug uniqueness: Check before INSERT (DB constraint)
- Status enum: 'draft' or 'published' only
- Date format: ISO 8601 (YYYY-MM-DD)
- Tags: Array of strings, no duplicates

**Implementation:**
```typescript
// In Supabase schema
create table articles (
  slug text unique not null check (slug ~ '^[a-z0-9-]+$'),
  status text not null check (status in ('draft', 'published')),
  -- ...
);

// In sync script
function validateArticle(article) {
  if (!article.slug || !article.title || !article.content) {
    throw new Error('Missing required fields')
  }
  if (!/^[a-z0-9-]+$/.test(article.slug)) {
    throw new Error('Invalid slug format')
  }
  // ...
}
```

## Anti-Patterns to Avoid

### Don't Build Bidirectional Sync (File ↔ DB)

**Why:** Creates conflict resolution complexity. Which source wins if both changed?

**Instead:** Enforce unidirectional flow (DB → file). If editing .md files:
1. Edit in Supabase Studio (or via MCP)
2. Run sync script to update .md
3. Commit .md changes

**Acceptable exception:** Bulk migration script (one-time .md → DB import for 52 existing articles).

### Don't Integrate Sync into generate.ts

**Why:** Violates separation of concerns. generate.ts reads files, doesn't fetch from DB.

**Instead:** Sync is a separate pre-build step. generate.ts remains unchanged.

### Don't Store Rendered HTML in Database

**Why:** Markdown is source format. Rendering happens at build time (SSG) or client-side (React).

**Instead:** Store markdown content in DB, render during build pipeline.

### Don't Use Real-Time Sync in Dev Mode

**Why:** Over-engineered for single author + AI agents. Adds complexity (polling, webhooks, websockets).

**Instead:** Manual sync trigger or pre-build sync. Dev mode uses file watcher on .md files.

### Don't Create Custom Supabase Admin UI

**Why:** Supabase Studio already exists and works well.

**Instead:** Use Supabase Studio for manual DB edits. AI agents use MCP execute_sql.

### Don't Duplicate Manifest Generation

**Why:** generate.ts already creates manifest.json from .md files. Don't create a second "db manifest."

**Instead:** Sync DB → .md, then existing build pipeline handles manifest generation.

## Integration Points

### How Sync Integrates with Existing Build Pipeline

**No changes required to existing scripts:**
- `generate.ts` - unchanged, still reads .md files
- `build.ts` - unchanged, orchestrates generate → vite → finalize
- `finalize.ts` - unchanged, processes SSG HTML
- `vite.config.ts` - unchanged, article file watcher still works

**New script added:**
- `scripts/sync-articles.ts` - pulls from Supabase, writes .md files
  - Location: /Users/guilherme/Projects/vibegui.com/scripts/sync-articles.ts
  - Invoked: Manually (`bun scripts/sync-articles.ts`) or in CI before build
  - Dependencies: Supabase MCP (execute_sql), lib/articles.ts (for validation)

**Integration touchpoints:**

1. **Before build (manual or CI):**
   ```bash
   bun scripts/sync-articles.ts  # NEW: pull from DB
   bun scripts/build.ts --mode=prod  # EXISTING: build static site
   ```

2. **Dev mode (file watcher):**
   ```bash
   # Terminal 1: Sync on demand
   bun scripts/sync-articles.ts

   # Terminal 2: Dev server (watches .md files)
   bun scripts/build.ts --mode=dev
   ```

3. **CI/CD (Cloudflare Pages):**
   ```bash
   # Option A: Sync in CI (always fresh from DB)
   bun scripts/sync-articles.ts
   bun scripts/build.ts --mode=pages

   # Option B: Sync locally, commit .md files (faster CI)
   # (sync already done, just run build)
   bun scripts/build.ts --mode=pages
   ```

### MCP Integration Pattern (Reuse Bookmarks Architecture)

**Existing MCP usage (bookmarks):**
```typescript
// vite.config.ts - bookmarksApiPlugin
async function executeSupabaseSql(query: string) {
  const result = await callMcpTool('execute_sql', { query })
  // Parse MCP response, extract JSON from <untrusted-data> tags
  return parseSupabaseResult(result)
}

// API endpoint: /api/bookmarks/update
const { url, tags, ...updates } = req.body
await executeSupabaseSql(`
  UPDATE bookmarks SET ... WHERE url = ${escapeSQL(url)}
`)
```

**Apply to articles (sync script):**
```typescript
// scripts/sync-articles.ts
import { executeSupabaseSql } from './lib/mcp-helpers.ts'

async function syncArticles() {
  const articles = await executeSupabaseSql(`
    SELECT * FROM articles
    WHERE status = 'published'
    ORDER BY date DESC
  `)

  for (const article of articles) {
    const filepath = `blog/articles/${article.slug}.md`
    const content = serializeToMarkdown(article)
    await fs.writeFile(filepath, content)
  }
}
```

### Supabase Schema (Proposed)

```sql
-- Articles table (mirrors bookmarks pattern)
create table articles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]+$'),
  title text not null,
  description text,
  content text not null, -- markdown body
  status text not null default 'draft' check (status in ('draft', 'published')),
  date timestamptz not null default now(),
  cover_image text, -- path or URL
  tags jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by text, -- AI agent name or user
  updated_by text,

  -- Full-text search (generated column, same as bookmarks)
  search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'C')
  ) stored
);

-- Indexes
create index articles_search_idx on articles using gin(search_vector);
create index articles_status_idx on articles(status);
create index articles_date_idx on articles(date desc);
create index articles_slug_idx on articles(slug); -- for fast slug lookups

-- RLS policies (example - adjust based on auth requirements)
alter table articles enable row level security;

-- Public read for published articles
create policy "Published articles are viewable by everyone"
  on articles for select
  using (status = 'published');

-- Authenticated users can CRUD (or use service role key for AI agents)
create policy "Authenticated users can manage articles"
  on articles for all
  using (auth.role() = 'authenticated');
```

### Frontmatter Mapping (DB ↔ Markdown)

| Markdown Frontmatter | Supabase Column | Type | Notes |
|---------------------|-----------------|------|-------|
| slug | slug | text | URL-safe identifier |
| title | title | text | Article title |
| description | description | text | SEO description |
| date | date | timestamptz | Published date (ISO 8601) |
| status | status | text | 'draft' or 'published' |
| coverImage | cover_image | text | Path like /images/articles/slug.png |
| tags | tags | jsonb | Array of strings |
| - | id | uuid | DB primary key (not in frontmatter) |
| - | created_at | timestamptz | Audit field (not in frontmatter) |
| - | updated_at | timestamptz | Audit field (not in frontmatter) |
| - | created_by | text | Audit field (not in frontmatter) |
| - | updated_by | text | Audit field (not in frontmatter) |
| - | search_vector | tsvector | Generated for full-text search |

**Serialization example:**
```typescript
// DB → Markdown
function serializeToMarkdown(article: Article): string {
  const frontmatter = {
    slug: article.slug,
    title: article.title,
    description: article.description,
    date: article.date.toISOString().split('T')[0], // YYYY-MM-DD
    status: article.status,
    coverImage: article.cover_image,
    tags: article.tags,
  }

  return `---
${Object.entries(frontmatter)
  .filter(([_, v]) => v != null)
  .map(([k, v]) => {
    if (Array.isArray(v)) {
      return `${k}:\n${v.map(item => `  - ${item}`).join('\n')}`
    }
    return `${k}: ${JSON.stringify(v)}`
  })
  .join('\n')}
---

${article.content}
`
}
```

## Suggested Build Order (MVP Implementation)

### Phase 1: Core Sync Pipeline (Day 1-2)

**Goal:** Get basic DB → file sync working, no bells and whistles.

1. **Create Supabase schema** (1 hour)
   - Run SQL to create articles table
   - Add indexes (slug, status, date)
   - Skip RLS for now (use service key)

2. **Migrate existing articles to Supabase** (2 hours)
   - Script: `scripts/migrate-articles-to-db.ts`
   - Read all 52 .md files from blog/articles/
   - Parse frontmatter + content
   - INSERT into Supabase articles table
   - Validate all articles imported successfully

3. **Implement sync script** (3 hours)
   - Script: `scripts/sync-articles.ts`
   - Query Supabase for published articles (or all in dev mode)
   - Serialize each article to .md with frontmatter
   - Write to blog/articles/{slug}.md
   - Handle overwrites (delete old files not in DB)
   - Add --dry-run flag for previewing changes

4. **Test sync → build pipeline** (1 hour)
   - Run: `bun scripts/sync-articles.ts`
   - Run: `bun scripts/build.ts --mode=dev`
   - Verify articles render correctly
   - Check manifest.json includes all articles

5. **Document workflow** (1 hour)
   - Update README with new workflow:
     - How to sync articles
     - How to create/edit articles (Supabase Studio or MCP)
     - How to deploy

### Phase 2: AI Agent Integration (Day 3)

**Goal:** Enable AI agents to create/edit articles via MCP.

1. **Create MCP helper library** (1 hour)
   - File: `lib/mcp-helpers.ts`
   - Extract executeSupabaseSql from vite.config.ts
   - Add helper functions:
     - `createArticle(data)`
     - `updateArticle(slug, data)`
     - `getArticleBySlug(slug)`
     - `searchArticles(query)`

2. **Test AI agent workflow** (2 hours)
   - Use Claude to create a test article via MCP
   - Verify article appears in Supabase
   - Run sync script
   - Verify .md file created correctly
   - Build and check rendered output

3. **Add validation** (2 hours)
   - Validate required fields before INSERT/UPDATE
   - Check slug format (lowercase, hyphens only)
   - Check slug uniqueness (handle conflicts gracefully)
   - Validate status enum
   - Validate date format

### Phase 3: Polish & Automation (Day 4)

**Goal:** Smooth workflow, automation, CI integration.

1. **Integrate sync into build script** (1 hour)
   - Add `--sync` flag to build.ts
   - `bun scripts/build.ts --sync --mode=prod` runs sync first
   - Default: skip sync (use existing .md files)

2. **Add CI sync option** (1 hour)
   - Cloudflare Pages build command:
     ```bash
     bun scripts/sync-articles.ts && bun scripts/build.ts --mode=pages
     ```
   - OR: Keep sync manual, commit .md files (faster CI)

3. **Improve sync script** (2 hours)
   - Add --status flag: `--status=published` or `--status=all`
   - Add --watch flag: Watch DB for changes (polling every 10s)
   - Add change detection: Only write files if content changed (hash comparison)
   - Add summary output: "Synced 3 articles (2 updated, 1 new, 0 deleted)"

4. **Add audit trail** (1 hour)
   - When syncing, log to .sync-log.json:
     - Timestamp
     - Articles synced
     - Changes made (created/updated/deleted)
   - Helps debug sync issues

### Phase 4: Advanced Features (Week 2+)

**Optional enhancements, prioritize based on actual needs.**

1. **Full-text search UI** (3 hours)
   - Add /articles/search page
   - Use tsvector search similar to bookmarks
   - Client-side via Supabase anon key (if RLS allows)

2. **Conflict detection** (4 hours)
   - Compare .md file hash with last_synced hash
   - If both DB and file changed since last sync, flag conflict
   - Provide resolution options (choose DB, choose file, merge manually)

3. **Revision history** (8 hours)
   - Create articles_revisions table
   - Trigger on UPDATE to save previous version
   - UI to view/restore old versions

4. **Scheduled publishing** (2 hours)
   - Add publish_at timestamp
   - Cron job checks for articles where publish_at <= now() and status = 'scheduled'
   - Update status to 'published'

## Sources

**Project analysis:**
- /Users/guilherme/Projects/vibegui.com/scripts/generate.ts - Current build pipeline
- /Users/guilherme/Projects/vibegui.com/scripts/build.ts - Build orchestration
- /Users/guilherme/Projects/vibegui.com/scripts/finalize.ts - Post-build processing
- /Users/guilherme/Projects/vibegui.com/lib/articles.ts - Article parsing (frontmatter + markdown)
- /Users/guilherme/Projects/vibegui.com/vite.config.ts - Supabase MCP integration pattern (bookmarks)
- /Users/guilherme/Projects/vibegui.com/lib/supabase.ts - Supabase client usage examples
- /Users/guilherme/Projects/vibegui.com/blog/articles/*.md - 52 existing articles with frontmatter

**Existing patterns reused:**
- Bookmarks table schema (id, created_at, updated_at, search_vector, tags)
- MCP execute_sql via vite.config.ts bookmarksApiPlugin
- SSG HTML generation with embedded data (generate.ts pattern)
- File watcher + auto-rebuild in dev mode (articleWatcherPlugin)
- Content-hashed assets + Cloudflare Pages deploy

**Architecture decisions:**
- Database-first: Supabase is source of truth (not markdown files)
- Unidirectional sync: DB → file only (prevents conflicts)
- Separation of concerns: Sync script separate from build pipeline
- Git history preserved: .md files tracked for readable diffs
- Reuse existing tools: No new frameworks, leverage Bun + existing scripts

**Confidence: HIGH**
- Existing codebase provides clear patterns (bookmarks already use Supabase + MCP)
- Build pipeline well-structured (generate → vite → finalize)
- Dev mode has file watching + auto-rebuild
- Supabase full-text search already implemented (bookmarks)
- Clear integration points (sync script before generate.ts)
