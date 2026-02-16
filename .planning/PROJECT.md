# vibegui.com — Migration Completion & Supabase-First Articles

## What This Is

A personal website and blog (vibegui.com) completing its migration from SQLite to a Supabase-first architecture. Articles live in Supabase as the source of truth (agents read/write there), with a sync script exporting to markdown files for the static build and deploy pipeline. This project finishes the half-done migration cleanup, sets up Supabase MCP access, establishes the DB→file sync pipeline, and verifies everything works end-to-end.

## Core Value

The site builds and deploys cleanly on Cloudflare Pages with zero SQLite dependencies. Supabase is the single source of truth for both articles and bookmarks. Markdown files are a build artifact synced from the database.

## Requirements

### Validated

- ✓ Articles read from `blog/articles/*.md` with YAML frontmatter — existing
- ✓ Build pipeline: generate.ts → vite build → finalize.ts — existing
- ✓ Bookmarks served from Supabase (PostgreSQL) via `@supabase/supabase-js` — existing
- ✓ SSG for article and context pages with embedded data — existing
- ✓ Cloudflare Pages deployment target — existing
- ✓ Vite dev server with article file watcher for hot reload — existing

### Active

- [ ] All unstaged migration changes reviewed, staged, and committed
- [ ] `data/content.db` and `data/` directory removed (no longer referenced)
- [ ] SETUP_GUIDE.md updated to remove any SQLite references
- [ ] README.md and DEPLOY.md verified accurate post-migration
- [ ] Local build (`bun run pages:build`) succeeds without `--experimental-sqlite`
- [ ] E2E tests pass (`bun run test:e2e`)
- [ ] Constraint tests pass (`bun run test:constraints`)
- [ ] Pre-commit hook (`lefthook.yml`) stages correct files
- [ ] Supabase MCP configured with vibegui database credentials
- [ ] Supabase database explored — confirm what tables exist and their current state
- [ ] Articles table in Supabase verified/created as source of truth
- [ ] Sync script: Supabase articles → `blog/articles/*.md` for build pipeline
- [ ] Existing markdown articles imported to Supabase (if not already there)
- [ ] Build pipeline works end-to-end: Supabase → sync → generate → build → dist

### Out of Scope

- New features beyond what's needed for the Supabase-first pipeline
- Deploying to Cloudflare Pages — just verify the build works locally
- Migrating bookmarks away from Supabase — they stay in Supabase

## Context

- **Stack:** Bun + Vite + React 19 + Tailwind CSS 4 + Supabase
- **Content flow:** `blog/articles/*.md` → `scripts/generate.ts` → `.build/` + `public/content/manifest.json` → `scripts/finalize.ts` → `dist/`
- **Bookmarks:** Supabase PostgreSQL with tables `bookmarks` and `bookmark_tags`, queried client-side via anon key (RLS)
- **Previous state:** SQLite (`data/content.db`) was the content store. Migration moved articles to markdown files. Old `lib/db/`, `server/`, and migration scripts were deleted but left dangling references.
- **Feb 9 cleanup:** Modified `package.json`, `vite.config.ts`, `lefthook.yml`, `scripts/build.ts`, `scripts/generate.ts`, `README.md`, `DEPLOY.md`. Deleted `scripts/seed-projects.ts`, `scripts/import-social-posts.ts`, `scripts/migrate-to-markdown.ts`. All changes are unstaged.
- **Supabase:** May contain articles table in addition to bookmarks — needs investigation once MCP is connected.

## Constraints

- **No SQLite:** The entire point of the migration. No `bun:sqlite`, no `--experimental-sqlite`, no `.db` files.
- **Cloudflare Pages compatible:** Build must work in CF Pages environment (no native modules, no SQLite).
- **Existing tests:** Must pass — don't break what's already verified working.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase as article source of truth | Agents interact with DB directly; sync script exports to markdown for builds | — Pending |
| Markdown files as build artifact (not source) | Generated from Supabase, committed for deploy. Git tracks output, not input. | — Pending |
| Supabase for bookmarks | Already migrated, works well for dynamic data with client-side queries | ✓ Good |
| Keep backup/restore scripts | `scripts/backup-supabase.ts` and `scripts/restore-supabase.ts` still useful | ✓ Good |

---
*Last updated: 2026-02-16 after initialization*
