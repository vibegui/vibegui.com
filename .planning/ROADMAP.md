# Roadmap: vibegui.com Migration Completion & Supabase-First Articles

## Overview

This roadmap completes the vibegui.com migration from SQLite to Supabase-first architecture. It starts by cleaning up the half-done migration artifacts, then establishes a reliable parser foundation to ensure frontmatter fidelity. With that foundation, we create the Supabase articles table and import 52 existing articles from markdown. Next, we build the critical sync pipeline that exports database articles to markdown files with smart diffing to minimize git noise. Finally, we enforce unidirectional data flow with hooks and documentation, integrate AI agent tooling, and verify the complete pipeline works end-to-end.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Migration Cleanup** - Review and commit Feb 9 changes, remove SQLite artifacts, verify builds and tests pass (2026-02-16)
- [x] **Phase 2: Parser Foundation** - Replace custom YAML parser with gray-matter, validate roundtrip fidelity for all 52 articles (2026-02-16)
- [ ] **Phase 3: Supabase Schema & Import** - Create articles table with search/audit columns, import markdown articles to database
- [x] **Phase 4: Sync Pipeline** - Build DB→file sync script with hash-based diffing and deterministic formatting (completed 2026-02-16)
- [x] **Phase 5: Integration & Verification** - Enforce direction with hooks, add AI agent tools, verify E2E pipeline (completed 2026-02-17)

## Phase Details

### Phase 1: Migration Cleanup
**Goal**: Repository is clean with all migration changes committed, SQLite artifacts removed, and builds/tests passing without SQLite dependencies
**Depends on**: Nothing (first phase)
**Requirements**: MIGR-01, MIGR-02, MIGR-03, MIGR-04, MIGR-05, MIGR-06, MIGR-07, MIGR-08
**Success Criteria** (what must be TRUE):
  1. All unstaged changes from Feb 9 migration are reviewed and committed to git
  2. No SQLite references exist in codebase (data/ directory deleted, documentation updated)
  3. Build command `bun run pages:build` succeeds without `--experimental-sqlite` flag
  4. All existing tests pass (E2E and constraint tests)
  5. Pre-commit hook stages the correct files (blog/articles/ included)
**Plans:** 1 plan

Plans:
- [x] 01-01-PLAN.md -- Delete SQLite artifacts, fix stale references, verify build/tests, commit cleanup

### Phase 2: Parser Foundation
**Goal**: Frontmatter parsing is reliable and bidirectional using gray-matter, validated against all existing articles
**Depends on**: Phase 1
**Requirements**: PARS-01, PARS-02, PARS-03
**Success Criteria** (what must be TRUE):
  1. Custom YAML parser in lib/articles.ts is replaced with gray-matter library
  2. Roundtrip test (file → parse → stringify → compare) passes for all 52 articles without data loss
  3. Canonical frontmatter schema is documented with required fields and types
**Plans:** 1 plan

Plans:
- [x] 02-01-PLAN.md — Replace custom parser with gray-matter + Zod schema, reformat articles, add roundtrip tests

### Phase 3: Supabase Schema & Import
**Goal**: Articles table exists in Supabase with proper schema, all 52 markdown articles successfully imported and verified
**Depends on**: Phase 2
**Requirements**: SUPA-01, SUPA-02, SUPA-03, SUPA-04, SUPA-05, SUPA-06, SUPA-07, IMPT-01, IMPT-02, IMPT-03, IMPT-04
**Success Criteria** (what must be TRUE):
  1. Supabase MCP is configured and can query the vibegui database
  2. Articles table exists with columns: slug, title, description, content, status, date, cover_image, tags, search_vector, created_by, updated_by, created_at, updated_at
  3. Database enforces slug uniqueness constraint and has GIN index on search_vector
  4. RLS policies allow public read for published articles, authenticated write for all articles
  5. Import script successfully loads all 52 articles with validation (dry-run tested first)
  6. Query confirms exactly 52 articles exist in Supabase after import
**Plans:** 2 plans

Plans:
- [ ] 03-01-PLAN.md — Create articles, tags, article_tags tables with indexes, triggers, and RLS policies
- [ ] 03-02-PLAN.md — Write and execute import script for all 52 articles with dry-run and tag management

### Phase 4: Sync Pipeline
**Goal**: Sync script exports Supabase articles to markdown files with smart diffing, only writing changed files to minimize git noise
**Depends on**: Phase 3
**Requirements**: SYNC-01, SYNC-02, SYNC-03, SYNC-04, SYNC-05, SYNC-06
**Success Criteria** (what must be TRUE):
  1. Script `scripts/sync-articles.ts` exports articles from Supabase to blog/articles/*.md
  2. Sync uses content hash comparison and only writes files that actually changed
  3. Frontmatter formatting is deterministic (sorted keys, consistent YAML structure)
  4. Dry-run mode shows proposed changes without writing files
  5. Sync handles errors gracefully (one failed article doesn't abort entire sync)
  6. Articles without slugs get auto-generated slugs from titles
**Plans:** 1/1 plans complete

Plans:
- [ ] 04-01-PLAN.md — Build sync-articles.ts script with hash-based diffing, dry-run mode, and package.json wiring

### Phase 5: Integration & Verification
**Goal**: Direction is enforced (DB is source of truth), AI agents can create/edit articles via MCP, and complete pipeline works E2E
**Depends on**: Phase 4
**Requirements**: ENFC-01, ENFC-02, AINT-01, AINT-02, E2EV-01, E2EV-02
**Success Criteria** (what must be TRUE):
  1. Pre-commit hook warns developers when blog/articles/*.md files are edited directly
  2. Documentation clearly states markdown files are build artifacts synced from Supabase
  3. MCP helper functions exist for createArticle, updateArticle, getArticleBySlug
  4. Audit columns (created_by, updated_by) are populated on all database writes
  5. Full pipeline works: edit article in Supabase → sync-articles.ts → generate.ts → vite build → dist/
  6. Local preview server (`bun run preview`) correctly serves all articles from built site
**Plans:** 3/3 plans complete

Plans:
- [ ] 05-01-PLAN.md — Direction enforcement: lefthook warning + documentation updates
- [ ] 05-02-PLAN.md — Article helper functions with CRUD and audit trail
- [ ] 05-03-PLAN.md — E2E pipeline verification tests + human verification

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Migration Cleanup | 1/1 | Complete | 2026-02-16 |
| 2. Parser Foundation | 1/1 | Complete | 2026-02-16 |
| 3. Supabase Schema & Import | 0/2 | Not started | - |
| 4. Sync Pipeline | 0/TBD | Complete    | 2026-02-16 |
| 5. Integration & Verification | 0/3 | Complete    | 2026-02-17 |

---
*Roadmap created: 2026-02-16*
