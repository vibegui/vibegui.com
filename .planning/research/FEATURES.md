# Feature Landscape

**Domain:** Supabase-backed Content Management with DB→File Sync
**Researched:** 2026-02-16
**Confidence:** MEDIUM (based on training data + project context; web research tools restricted)

## Table Stakes

Features users expect. Missing = pipeline breaks or feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Bidirectional sync detection** | Know if .md changed vs DB changed to avoid data loss | Medium | Compare timestamps, detect conflicts |
| **Frontmatter preservation** | Existing 52 articles have frontmatter structure | Low | Parse/serialize YAML frontmatter |
| **Schema validation** | Ensure required fields (slug, title, date, status) exist before sync | Low | Validate on write to Supabase |
| **Slug uniqueness** | Prevents routing conflicts in static site | Low | Unique constraint on slug column |
| **Status field** | Draft/published workflow (existing field in frontmatter) | Low | Enum or varchar in DB |
| **Atomic sync operations** | Prevent partial writes that corrupt .md files | Medium | Transaction support or rollback on error |
| **Sync idempotency** | Running sync multiple times produces same result | Low | Compare content hash before writing |
| **Metadata sync** | title, description, date, coverImage, tags must round-trip | Low | Map DB columns ↔ frontmatter fields |
| **Content preservation** | Markdown body must not lose formatting/structure | Low | Store as text, preserve exactly |
| **Error handling** | Failed sync shouldn't delete files or corrupt DB | Medium | Validation before write, backup strategy |
| **Sync direction clarity** | Clear which direction sync runs (DB→file only vs bidirectional) | Low | Document + enforce in code |
| **Tag preservation** | Existing articles have tags array | Low | Store as jsonb array or separate tags table |

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Conflict resolution UI** | When file & DB both changed, show diff and choose version | High | Requires web UI or CLI prompts |
| **Auto-slug generation** | Generate URL-friendly slug from title | Low | Useful for AI agents creating articles |
| **Revision history** | Track changes to articles over time | Medium | Supabase doesn't have built-in versioning |
| **Scheduled publishing** | Set future publish dates | Medium | Cron job checking status + date |
| **AI agent audit log** | Track which agent edited what article when | Low | Add created_by, updated_by columns |
| **Sync dry-run mode** | Preview what would change without executing | Low | Compare mode before write |
| **Partial sync** | Sync only changed articles, not all 52 every time | Low | Track last_synced timestamp |
| **Image asset sync** | Sync coverImage files, not just paths | High | Would need file storage integration |
| **Multi-author support** | Track article authors separately from AI agents | Low | Add author_id column |
| **Category/series support** | Group related articles | Low | Add category field or series_id |
| **Related articles** | Link articles to each other | Medium | Junction table or jsonb array |
| **Search indexing** | Full-text search in Supabase (similar to bookmarks) | Medium | Create tsvector column, GIN index |
| **Webhook notifications** | Notify external systems when article synced | Medium | Supabase webhooks on row change |
| **Sync status dashboard** | Show last sync time, errors, pending changes | Medium | Requires UI + status tracking |
| **Content linting** | Check for broken links, formatting issues before sync | Medium | Run linters during validation |
| **SEO metadata validation** | Warn if description too long, missing meta fields | Low | Validate against SEO best practices |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **WYSIWYG editor in Supabase** | Markdown is source of truth, not rich text | Let AI agents write markdown directly, humans edit .md files if needed |
| **Custom Supabase UI** | Supabase Studio already exists | Use Supabase Studio for manual DB edits |
| **Real-time collaborative editing** | Over-engineered for single-author + AI agents | Simple last-write-wins with optional conflict detection |
| **File → DB sync (reverse direction)** | Adds complexity, unclear which is source of truth | DB is source of truth. If editing .md, manually update DB |
| **Custom auth for article management** | Supabase RLS handles this | Use Supabase auth + RLS policies |
| **GraphQL API** | Supabase PostgREST is sufficient | Use Supabase's REST API |
| **Media management system** | Out of scope for article sync | Store coverImage as path/URL string only |
| **Comment system** | Not part of article management pipeline | Separate feature if needed |
| **Analytics/view tracking** | Orthogonal to content management | Separate analytics service |
| **Multi-language support** | Adds significant complexity | Single language (English) for now |
| **Workflow/approval system** | Over-engineered for personal site + AI agents | Simple draft/published status sufficient |

## Feature Dependencies

```
Schema validation → Atomic sync (validate before transaction)
Slug uniqueness → Auto-slug generation (uniqueness check when generating)
Metadata sync → Frontmatter preservation (frontmatter contains metadata)
Partial sync → Sync idempotency (need to know what changed)
AI agent audit log → Multi-author support (both track who changed what)
Search indexing → Tag preservation (search should include tags)
```

## MVP Recommendation

**Phase 1: Core Sync Pipeline (Table Stakes)**
1. Schema validation (required fields)
2. Frontmatter preservation (parse/serialize)
3. Metadata sync (all frontmatter fields ↔ DB columns)
4. Content preservation (markdown body)
5. Slug uniqueness (DB constraint)
6. Sync idempotency (hash-based comparison)
7. Error handling (validation + logging)
8. Sync direction: **DB → file only** (simplifies initial implementation)

**Phase 2: AI Agent Integration (Differentiators)**
1. AI agent audit log (created_by, updated_by)
2. Auto-slug generation (for AI-written articles)
3. Partial sync (only changed articles)
4. Search indexing (match bookmarks pattern)

**Phase 3: Quality & Observability (Nice-to-have)**
1. Sync dry-run mode
2. Sync status tracking
3. Content linting
4. SEO metadata validation

**Defer:**
- **Conflict resolution UI**: Start with last-write-wins, add only if needed
- **Revision history**: Complex, use git history for .md files instead
- **Scheduled publishing**: Add if future-dated articles become common
- **Image asset sync**: Out of scope, coverImage is just a path

## Rationale for MVP Ordering

**DB → file only (not bidirectional):**
- Supabase is declared source of truth
- Simplifies conflict detection (no conflicts if sync is unidirectional)
- AI agents write to DB directly
- Humans can edit DB via Supabase Studio
- .md files become build artifacts, not primary source

**Why not file → DB:**
- Would require file watching or manual trigger
- Conflict detection becomes necessary (did DB change too?)
- Violates "Supabase is source of truth" principle
- Adds complexity without clear benefit given AI agent use case

**Partial sync before conflict resolution:**
- Syncing all 52 articles every time is wasteful
- If sync is DB→file only, conflicts are rare
- Can add conflict detection later if needed

**Search indexing early:**
- Bookmarks already have full-text search pattern
- Reuse existing knowledge and patterns
- Valuable for finding articles to edit

## Implementation Notes

### Supabase Schema (Proposed)

```sql
create table articles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  content text not null, -- markdown body
  status text not null default 'draft', -- draft | published
  date timestamptz not null default now(),
  cover_image text,
  tags jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by text, -- AI agent name or user
  updated_by text,
  search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'C')
  ) stored
);

create index articles_search_idx on articles using gin(search_vector);
create index articles_status_idx on articles(status);
create index articles_date_idx on articles(date desc);
```

### Frontmatter Mapping

| Frontmatter | Supabase Column | Type |
|-------------|-----------------|------|
| slug | slug | text |
| title | title | text |
| description | description | text |
| date | date | timestamptz |
| status | status | text |
| coverImage | cover_image | text |
| tags | tags | jsonb |

### Sync Algorithm (DB → File)

```typescript
// Simplified logic
for each article in supabase where status = 'published' {
  const filePath = `blog/${article.slug}.md`
  const frontmatter = {
    slug: article.slug,
    title: article.title,
    description: article.description,
    date: article.date,
    status: article.status,
    coverImage: article.cover_image,
    tags: article.tags
  }
  const fileContent = `---\n${yaml.stringify(frontmatter)}---\n${article.content}`

  // Idempotency check
  if (fileExists(filePath)) {
    const existingHash = hash(readFile(filePath))
    const newHash = hash(fileContent)
    if (existingHash === newHash) continue // skip unchanged
  }

  writeFile(filePath, fileContent)
}
```

## Sources

**Note:** Research tools (WebSearch, WebFetch, Read, Bash) were restricted during this research session. Findings are based on:

- Training data on Supabase features (as of Jan 2025 knowledge cutoff)
- Training data on CMS best practices and DB→file sync patterns
- Project context provided (52 existing articles, frontmatter schema, bookmarks integration)
- Standard patterns for static site generation with database backing

**Confidence levels:**
- **Table stakes features:** HIGH confidence (standard requirements for any sync system)
- **Differentiators:** MEDIUM confidence (common features but implementation varies)
- **Anti-features:** HIGH confidence (based on stated project goals and simplicity principles)
- **Schema/implementation notes:** MEDIUM confidence (based on Supabase documentation in training data)

**Recommended verification:**
- Check Supabase documentation for current tsvector/full-text search syntax
- Verify jsonb array handling for tags
- Confirm RLS policy patterns for multi-user scenarios if needed
