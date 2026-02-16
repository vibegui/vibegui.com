# Requirements: vibegui.com Migration Completion & Supabase-First Articles

**Defined:** 2026-02-16
**Core Value:** The site builds and deploys cleanly on Cloudflare Pages with zero SQLite dependencies. Supabase is the single source of truth for both articles and bookmarks.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Migration Cleanup

- [ ] **MIGR-01**: All unstaged migration changes from Feb 9 are reviewed, staged, and committed
- [ ] **MIGR-02**: `data/content.db` and `data/` directory are deleted from the repo
- [ ] **MIGR-03**: SETUP_GUIDE.md contains no SQLite references
- [ ] **MIGR-04**: README.md and DEPLOY.md accurately describe the markdown-based system
- [ ] **MIGR-05**: `bun run pages:build` succeeds locally without `--experimental-sqlite`
- [ ] **MIGR-06**: E2E tests pass (`bun run test:e2e`)
- [ ] **MIGR-07**: Constraint tests pass (`bun run test:constraints`)
- [ ] **MIGR-08**: Pre-commit hook correctly stages `blog/articles/` files

### Parser Foundation

- [ ] **PARS-01**: Custom YAML parser in `lib/articles.ts` replaced with gray-matter
- [ ] **PARS-02**: Roundtrip test validates file → parse → stringify → compare for all 52 articles
- [ ] **PARS-03**: Canonical frontmatter schema documented and enforced

### Supabase Schema

- [ ] **SUPA-01**: Supabase MCP configured with vibegui database credentials
- [ ] **SUPA-02**: Articles table created in Supabase with slug, title, description, content, status, date, cover_image, tags columns
- [ ] **SUPA-03**: Slug uniqueness enforced via database constraint
- [ ] **SUPA-04**: Full-text search via tsvector + GIN index (reuse bookmarks pattern)
- [ ] **SUPA-05**: Audit columns: created_by, updated_by, created_at, updated_at
- [ ] **SUPA-06**: RLS policies configured (public read for published, authenticated write)
- [ ] **SUPA-07**: Zod schema validates article data at write boundaries

### Import

- [ ] **IMPT-01**: Import script reads all 52 markdown articles and inserts into Supabase
- [ ] **IMPT-02**: Import validates required fields and reports errors before inserting
- [ ] **IMPT-03**: Import includes dry-run mode to preview without writing
- [ ] **IMPT-04**: All 52 articles verified present in Supabase after import

### Sync Pipeline

- [ ] **SYNC-01**: `scripts/sync-articles.ts` exports Supabase articles to `blog/articles/*.md`
- [ ] **SYNC-02**: Sync uses hash-based comparison to only write changed files
- [ ] **SYNC-03**: Frontmatter formatting is deterministic (sorted keys, consistent newlines)
- [ ] **SYNC-04**: Sync supports dry-run mode (preview changes without writing)
- [ ] **SYNC-05**: Sync handles errors gracefully (failed article doesn't abort entire sync)
- [ ] **SYNC-06**: Auto-slug generation from title for articles without slugs

### Direction Enforcement

- [ ] **ENFC-01**: Pre-commit hook warns when markdown files in `blog/articles/` are edited directly
- [ ] **ENFC-02**: Documentation states markdown files are build artifacts, not to be edited directly

### AI Agent Integration

- [ ] **AINT-01**: MCP helper functions for createArticle, updateArticle, getArticleBySlug
- [ ] **AINT-02**: Audit trail (created_by, updated_by) populated on all DB writes

### End-to-End Verification

- [ ] **E2EV-01**: Full pipeline works: Supabase → sync → generate → build → dist
- [ ] **E2EV-02**: Local preview (`bun run preview`) serves articles correctly

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Sync Enhancements

- **SYNC-07**: Partial sync — only sync articles changed since last sync (updated_at comparison)
- **SYNC-08**: Sync status dashboard showing last sync time, errors, pending changes

### Content Quality

- **QUAL-01**: Content linting (broken links, formatting issues) before sync
- **QUAL-02**: SEO metadata validation (description length, missing fields)

### Advanced Features

- **ADVN-01**: Scheduled publishing (future publish dates)
- **ADVN-02**: Revision history tracking in Supabase
- **ADVN-03**: Conflict resolution UI for bidirectional edits

## Out of Scope

| Feature | Reason |
|---------|--------|
| WYSIWYG editor | Markdown is source of truth, AI agents write markdown directly |
| Custom Supabase UI | Supabase Studio already exists for manual edits |
| Real-time collaborative editing | Over-engineered for single-author + AI agents |
| File → DB sync (reverse) | DB is source of truth, adds conflict complexity |
| GraphQL API | Supabase PostgREST is sufficient |
| Media management system | coverImage stored as path/URL string only |
| Comment system | Not part of article management pipeline |
| Multi-language support | Single language for now |
| Deploy to Cloudflare Pages | Just verify build works locally |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MIGR-01 | Phase 1 | Pending |
| MIGR-02 | Phase 1 | Pending |
| MIGR-03 | Phase 1 | Pending |
| MIGR-04 | Phase 1 | Pending |
| MIGR-05 | Phase 1 | Pending |
| MIGR-06 | Phase 1 | Pending |
| MIGR-07 | Phase 1 | Pending |
| MIGR-08 | Phase 1 | Pending |
| PARS-01 | Phase 2 | Pending |
| PARS-02 | Phase 2 | Pending |
| PARS-03 | Phase 2 | Pending |
| SUPA-01 | Phase 3 | Pending |
| SUPA-02 | Phase 3 | Pending |
| SUPA-03 | Phase 3 | Pending |
| SUPA-04 | Phase 3 | Pending |
| SUPA-05 | Phase 3 | Pending |
| SUPA-06 | Phase 3 | Pending |
| SUPA-07 | Phase 3 | Pending |
| IMPT-01 | Phase 3 | Pending |
| IMPT-02 | Phase 3 | Pending |
| IMPT-03 | Phase 3 | Pending |
| IMPT-04 | Phase 3 | Pending |
| SYNC-01 | Phase 4 | Pending |
| SYNC-02 | Phase 4 | Pending |
| SYNC-03 | Phase 4 | Pending |
| SYNC-04 | Phase 4 | Pending |
| SYNC-05 | Phase 4 | Pending |
| SYNC-06 | Phase 4 | Pending |
| ENFC-01 | Phase 5 | Pending |
| ENFC-02 | Phase 5 | Pending |
| AINT-01 | Phase 5 | Pending |
| AINT-02 | Phase 5 | Pending |
| E2EV-01 | Phase 5 | Pending |
| E2EV-02 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 34 total
- Mapped to phases: 34
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-16*
*Last updated: 2026-02-16 after roadmap creation*
