# Phase 3: Supabase Schema & Import - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Create articles table in Supabase with proper schema (including search and audit columns), set up a tags system, and import all 52 existing markdown articles into the database. This phase delivers the database as the source of truth for articles. The sync pipeline (DB to files) and enforcement hooks are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Column design & types
- Tags stored in a **junction table** (separate `tags` table + `article_tags` join table), not a text[] array
- Article status is a simple **draft / published** enum (no archived state)
- Cover image stored as a **URL string column** (text field with image path), not Supabase Storage
- Date field is **date only** (no time component) — matches current frontmatter format (YYYY-MM-DD)

### Import behavior
- Validation failures: **skip and log** — bad articles are skipped with error logged, rest continue importing
- Re-run behavior: **upsert** — match by slug, update if exists, insert if new. Safe to re-run anytime
- Import target: **direct to Supabase** — script connects via client library and inserts rows (no SQL file generation)
- Status mapping: **infer from frontmatter** — check if frontmatter has a draft/status field and map accordingly

### Search & indexing
- search_vector feeds from **title + description + content + tags** (all textual fields)
- Search weights: **title > description > content** (title matches rank highest)
- Language config: **'simple' (language-agnostic)** — no stemming, works with any language
- Vector updates: **database trigger** on INSERT/UPDATE — search_vector always in sync automatically

### RLS & access control
- Draft articles: **authenticated only** — drafts hidden from public, only logged-in users/agents can see them
- Write access: **service role only** — only server-side code (scripts, edge functions) can write articles
- AI agent identification: **agent name** in audit columns (e.g., 'claude-code') — distinguishes different AI tools
- Tags table RLS: **service role only for all operations** — tags managed internally through the sync pipeline

### Claude's Discretion
- Exact column types and constraints beyond what's specified
- Junction table design details (composite primary key vs separate ID)
- Trigger function implementation details
- Import script error message formatting
- Dry-run output format

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-supabase-schema-import*
*Context gathered: 2026-02-16*
