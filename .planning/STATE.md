# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-16)

**Core value:** The site builds and deploys cleanly on Cloudflare Pages with zero SQLite dependencies. Supabase is the single source of truth for both articles and bookmarks.
**Current focus:** Phase 5 in progress — article helpers verified, MCP integration next

## Current Position

Phase: 5 of 5 (Integration Verification)
Plan: 2 of 3 in current phase (COMPLETE)
Status: Executing Phase 5
Last activity: 2026-02-16 — Executed 05-02-PLAN.md (article CRUD helpers for AI agents)

Progress: [█████████░] 93%

## Performance Metrics

**Velocity:**
- Total plans completed: 7
- Average duration: 4 min
- Total execution time: 0.48 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-migration-cleanup | 1 | 3 min | 3 min |
| 02-parser-foundation | 1 | 8 min | 8 min |
| 03-supabase-schema-import | 2 | 10 min | 5 min |
| 04-sync-pipeline | 1 | 2 min | 2 min |
| 05-integration-verification | 2 | 6 min | 3 min |

**Recent Trend:**
- Last 5 plans: 02-01 (8 min), 03-01 (7 min), 03-02 (3 min), 04-01 (2 min), 05-02 (3 min)
- Trend: Consistent 2-8 min per plan

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Supabase as article source of truth — Agents interact with DB directly; sync script exports to markdown for builds (Pending)
- Markdown files as build artifact (not source) — Generated from Supabase, committed for deploy. Git tracks output, not input. (Pending)
- Firefox bookmarks SQLite references kept intact — They read FROM Firefox places.sqlite, not project storage (01-01)
- gray-matter with yaml.JSON_SCHEMA as sole parser — Prevents date coercion, handles 100% of YAML (02-01)
- Numeric tags coerced to strings via Zod transform — yaml.JSON_SCHEMA still parses bare numbers as numbers (02-01)
- Schema validated at parse time — ArticleFrontmatterSchema.parse() called in readArticle() (02-01)
- Supabase CLI migrations for schema management — Local files tracked in git, pushed via `supabase db push` (03-01)
- Repaired remote migration history — Pre-existing migrations marked as reverted to align local/remote state (03-01)
- Service role client for scripts uses SUPABASE_URL + SUPABASE_SERVICE_KEY with manual .env loading (03-02)
- Tag management via delete + re-insert pattern on article_tags junction table (03-02)
- SHA-256 hash comparison for write gating in sync — only writes when content actually changed (04-01)
- Orphan files warned but never auto-deleted — safe by default (04-01)
- Tags sorted alphabetically for deterministic frontmatter output (04-01)
- Article helpers created in 05-01 ahead of schedule, verified in 05-02 — required createdBy/updatedBy params enforce audit trail (05-02)
- Warning hook is non-blocking (exits 0) to avoid disrupting commit flow (05-01)
- README.md in blog/articles/ requires excluding from article parser and constraint tests (05-01)

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-16 (plan execution)
Stopped at: Completed 05-01-PLAN.md — Direction enforcement (lefthook warning + docs)
Resume file: None
