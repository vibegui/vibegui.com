# Project Research Summary

**Project:** Supabase-First Article Management with DB→File Sync
**Domain:** Content Management System / Static Site Generation
**Researched:** 2026-02-16
**Confidence:** HIGH

## Executive Summary

This project adds Supabase-backed article management to vibegui.com, transforming the current file-first architecture into a database-first system with a sync pipeline. The research reveals that the existing stack (Bun, Vite 6, React 19, Supabase) already contains all necessary dependencies—only a migration tool and sync script are needed. The recommended approach is unidirectional sync (DB→file) with markdown files as build artifacts, preserving git history while establishing Supabase as the single source of truth.

The core insight is that this migration requires minimal new dependencies but careful architectural discipline. The existing bookmarks feature demonstrates proven patterns for Supabase integration, full-text search, and MCP tools. The sync script becomes the critical component, bridging database-as-source-of-truth with the existing static site generation pipeline. Three critical pitfalls must be addressed: frontmatter parser discrepancies, sync direction ambiguity, and slug collision handling.

Success hinges on enforcing unidirectional data flow and reusing existing patterns. The migration can be staged incrementally using feature flags, with comprehensive validation at each step. Overall confidence is high due to existing infrastructure and clear architectural patterns, though parser validation and schema migration require careful execution to avoid data loss or build pipeline breakage.

## Key Findings

### Recommended Stack

The existing stack requires only one new tool: Supabase CLI for schema migrations. All runtime dependencies already exist.

**Core technologies:**
- **@supabase/supabase-js (2.89.0)**: Already installed for bookmarks, battle-tested for article queries and writes — 95% confidence
- **gray-matter (4.0.3)**: Already installed, industry standard for frontmatter parsing/generation in both directions — 90% confidence
- **Zod (3.25.76)**: Already installed, provides runtime validation for article schema at DB boundaries — 95% confidence
- **Supabase CLI**: Migration management with version control, official tool — 85% confidence (needs Bun compatibility verification)
- **Bun native APIs**: Fast file I/O with smart diffing (hash-based change detection) — 90% confidence

**Critical decision:** Replace custom YAML parser in `lib/articles.ts` with gray-matter for bidirectional consistency. Current parser handles only basic YAML and will cause roundtrip failures.

### Expected Features

**Must have (table stakes):**
- **Frontmatter preservation**: Parse/serialize all YAML fields without loss (slug, title, description, date, status, coverImage, tags)
- **Schema validation**: Enforce required fields and format rules before any write operation
- **Slug uniqueness**: Database constraint prevents routing conflicts
- **Sync idempotency**: Hash-based comparison only writes files that actually changed
- **Atomic sync operations**: Transaction support to prevent partial writes that corrupt files
- **Error handling**: Validation before write with clear error messages
- **Unidirectional sync**: DB→file only (eliminates conflict resolution complexity)

**Should have (differentiators):**
- **Auto-slug generation**: Generate URL-friendly slugs from titles for AI agents
- **AI agent audit log**: Track created_by/updated_by for accountability
- **Partial sync**: Only sync changed articles using timestamp comparison
- **Full-text search**: tsvector + GIN index reusing bookmarks pattern
- **Sync dry-run mode**: Preview changes before executing

**Defer (v2+):**
- **Conflict resolution UI**: Start with last-write-wins, add only if manual edits become common
- **Revision history**: Complex, use git history of markdown files instead
- **Scheduled publishing**: Add only if future-dated articles become a pattern
- **Image asset sync**: Out of scope, coverImage remains a path string

### Architecture Approach

The architecture follows database-first content management with files as build artifacts. Supabase is the single source of truth, with unidirectional sync to markdown files that feed the existing static site generation pipeline.

**Major components:**
1. **Supabase articles table** — Single source of truth with RLS, full-text search (tsvector), and audit columns (created_by, updated_by, timestamps)
2. **sync-articles.ts script** — Exports DB to markdown files with frontmatter, smart diffing prevents unnecessary writes
3. **blog/articles/*.md** — Build artifacts committed to git for history, never edited directly
4. **Existing build pipeline** — Unchanged (generate.ts → vite → finalize.ts), reads markdown files as before
5. **AI agents via MCP** — Write/edit articles using execute_sql tool, reusing bookmarks pattern

**Data flow:** AI agent → execute_sql → Supabase → sync-articles.ts → blog/articles/*.md → generate.ts → build → deploy

**Key pattern:** Sync is a separate pre-build step, not integrated into generate.ts. This preserves separation of concerns and allows builds without sync (faster CI when markdown already up-to-date).

### Critical Pitfalls

1. **Frontmatter parser discrepancies** — Custom parser in lib/articles.ts produces different output than proper YAML libraries, causing perpetual git diffs. Solution: Replace with gray-matter for both reading and writing, add roundtrip tests.

2. **Sync direction ambiguity** — Without enforcement, developers will edit markdown files and lose work when sync overwrites them. Solution: Make sync strictly one-way (DB→file), add pre-commit hook that rejects markdown edits, document files as build artifacts.

3. **Slug collisions and filename mismatch** — Frontmatter slug may differ from filename, causing sync to overwrite wrong files. Solution: Establish rule that slug field must equal filename (minus .md), validate during import, enforce with constraint test.

4. **Date/timestamp inconsistency** — Postgres timestamps vs frontmatter date-only format causes git noise every sync. Solution: Store both date (DATE type) and created_at (TIMESTAMPTZ) in DB, sync always formats as YYYY-MM-DD.

5. **Git diff noise** — Naive sync rewrites all files even when unchanged, polluting history. Solution: Hash-based comparison before write, deterministic formatting (sorted keys, consistent newlines), only stage actually changed articles.

## Implications for Roadmap

Based on research, suggested phase structure prioritizes data integrity and architectural foundation before feature additions:

### Phase 1: Foundation & Parser Migration
**Rationale:** Must fix custom YAML parser before any DB migration to ensure bidirectional fidelity. This is blocking—if parser creates roundtrip failures, all subsequent work becomes unstable.

**Delivers:**
- Replace custom frontmatter parser with gray-matter
- Add roundtrip tests (file → parse → stringify → compare)
- Validate all 52 existing articles parse correctly
- Establish canonical frontmatter schema

**Addresses:** Pitfall #1 (parser discrepancies), Pitfall #4 (encoding issues)

**Critical dependency:** All subsequent phases assume parser handles bidirectional conversion without data loss.

### Phase 2: Schema Design & Migration Setup
**Rationale:** Database schema must align with existing bookmarks patterns for consistency. Schema mistakes are expensive to fix later due to migration complexity.

**Delivers:**
- Design articles table schema (follow bookmarks conventions: snake_case, search_vector, timestamps)
- Create Supabase migration with RLS policies
- Separate date (DATE) from created_at (TIMESTAMPTZ) to avoid timestamp drift
- Add indexes for slug, status, date, search_vector

**Uses:** Supabase CLI for migration management, zod for schema validation

**Addresses:** Pitfall #6 (schema mismatch), Pitfall #5 (date inconsistency)

### Phase 3: Import Script & Validation
**Rationale:** One-time migration of 52 articles from markdown to DB requires validation at every step. Data loss here is unrecoverable without backups.

**Delivers:**
- Import script (markdown → Supabase) with gray-matter parsing
- Slug uniqueness validation (ensure no collisions)
- Image path validation (all coverImage/inline images exist)
- Verify article count matches (52 articles)
- Add import dry-run mode

**Addresses:** Pitfall #2 (slug collisions), Pitfall #7 (orphaned images)

**Implements:** Database-first architecture, articles table becomes source of truth

### Phase 4: Sync Script with Smart Diffing
**Rationale:** Sync script is the critical bridge between DB and static site generation. Must prevent git noise and enforce unidirectional flow.

**Delivers:**
- sync-articles.ts script (DB → markdown) with hash-based change detection
- Deterministic frontmatter formatting (sorted keys, consistent newlines)
- Orphaned file deletion (articles deleted from DB)
- Sync dry-run mode
- Only write files that actually changed

**Addresses:** Pitfall #10 (git diff noise), Pitfall #3 (direction ambiguity prevention)

**Implements:** Unidirectional sync pattern, smart diffing to minimize git history pollution

### Phase 5: Direction Enforcement & Integration
**Rationale:** Prevent developers from editing markdown directly—most common failure mode in bidirectional systems. Integrate sync into existing build pipeline without breaking it.

**Delivers:**
- Pre-commit hook that rejects markdown edits with helpful error
- Feature flag in generate.ts for gradual cutover (USE_SUPABASE_ARTICLES)
- Sync integrated as pre-build step (optional flag)
- Documentation: markdown files are build artifacts, edit via Supabase Studio or MCP

**Addresses:** Pitfall #3 (direction ambiguity), Pitfall #8 (build pipeline breaks during migration)

**Implements:** Gradual cutover strategy, both modes work until migration proven

### Phase 6: AI Agent Integration & Polish
**Rationale:** With core sync working, enable AI agents to create/edit articles. Add quality-of-life improvements discovered during implementation.

**Delivers:**
- MCP helper functions (createArticle, updateArticle, getArticleBySlug)
- Auto-slug generation from title
- Audit columns populated (created_by, updated_by)
- Partial sync (only changed articles based on updated_at)
- Full-text search integration (reuse bookmarks pattern)

**Uses:** Existing MCP execute_sql pattern from bookmarks

**Implements:** AI agent workflow, quality improvements

### Phase Ordering Rationale

- **Parser first**: All other work depends on reliable frontmatter serialization. Fixing this later requires re-importing all articles.
- **Schema before import**: Can't import without schema. Schema mistakes are expensive to fix after data exists.
- **Import before sync**: Sync needs DB data to export. Validate import worked before building export logic.
- **Sync before enforcement**: Need working sync to test enforcement mechanisms. Can't enforce workflow without tooling.
- **Enforcement before AI integration**: Prevent bad habits forming. AI agents should start with correct patterns.

**Dependency chain:**
```
Parser → Schema → Import → Sync → Enforcement → AI Integration
  ↓        ↓        ↓        ↓         ↓            ↓
 Tests   Migration Validation Diffing  Hooks     MCP tools
```

### Research Flags

Phases with standard patterns (skip research-phase):
- **Phase 1-4**: Established patterns, existing code demonstrates approach (bookmarks integration, build pipeline, MCP usage)
- **Phase 5**: Git hooks are standard tooling, well-documented
- **Phase 6**: Reuses bookmarks MCP pattern exactly

**No phases require additional research.** Existing codebase provides all needed patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH (95%) | All dependencies already installed and proven working except Supabase CLI (needs Bun compatibility check) |
| Features | HIGH (90%) | Clear requirements from table stakes + existing architecture constraints. Defer list based on complexity vs. value. |
| Architecture | HIGH (95%) | Bookmarks feature demonstrates exact patterns needed. Build pipeline well-understood from code analysis. |
| Pitfalls | HIGH (95%) | All pitfalls grounded in actual codebase evidence. Custom parser analyzed, slug handling traced, sync patterns evaluated. |

**Overall confidence:** HIGH (94%)

### Gaps to Address

- **Supabase CLI + Bun compatibility**: Verify Supabase CLI works with Bun runtime. May need to use npm/npx if incompatibilities exist. Test during Phase 2.

- **gray-matter stringify API**: Confirm gray-matter.stringify() produces consistent output (field ordering, whitespace). Add roundtrip test in Phase 1 to validate.

- **Existing articles table**: PROJECT.md says "may or may not exist." Query Supabase in Phase 2 to check. If exists, document exact schema and align migration. If not exists, follow bookmarks pattern.

- **Image optimization pipeline**: Package.json shows optimize-images script exists. Verify it processes images in public/images/articles/ correctly. Document in Phase 3 (import validation).

- **RLS policy patterns**: Bookmarks show public read with anon key. Decide if articles need same pattern (likely yes for published status) or authenticated-only (drafts). Define in Phase 2.

## Sources

### Primary (HIGH confidence)
- `/Users/guilherme/Projects/vibegui.com/lib/articles.ts` — Current frontmatter parser implementation (lines 39-113), custom YAML parsing logic
- `/Users/guilherme/Projects/vibegui.com/lib/supabase.ts` — Bookmarks schema patterns (lines 27-53), MCP integration reference
- `/Users/guilherme/Projects/vibegui.com/scripts/generate.ts` — Build pipeline entry point, manifest generation
- `/Users/guilherme/Projects/vibegui.com/vite.config.ts` — MCP execute_sql pattern (bookmarksApiPlugin), file watcher configuration
- `/Users/guilherme/Projects/vibegui.com/blog/articles/*.md` — 52 existing articles with YAML frontmatter structure
- `/Users/guilherme/Projects/vibegui.com/.planning/PROJECT.md` — Migration requirements and goals
- Package.json dependencies — Existing stack verification (gray-matter, zod, @supabase/supabase-js all installed)

### Secondary (MEDIUM confidence)
- Supabase documentation (training data, Jan 2025) — tsvector full-text search patterns, RLS policy examples
- gray-matter documentation (training data) — Bidirectional frontmatter handling, stringify API
- Static site generator patterns (Jekyll, Hugo, Gatsby) — Common pitfalls in file-based content systems

### Tertiary (LOW confidence, needs validation)
- Supabase CLI + Bun compatibility — Not tested in codebase, assume works but verify during Phase 2
- Article count (52 articles) — Counted from file listing, validate during import that all parse successfully
- Build modes (dev/prod/pages) — Inferred from build.ts script, test each mode during Phase 5 integration

---
*Research completed: 2026-02-16*
*Ready for roadmap: yes*
