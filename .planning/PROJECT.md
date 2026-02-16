# vibegui.com — Migration Completion

## What This Is

A personal website and blog (vibegui.com) that was migrated from SQLite-backed content to markdown files. The migration was started weeks ago but left half-done with broken references, deleted files still referenced in configs, and unstaged changes. This project finishes the job: verify everything works, clean up dead artifacts, update docs, set up Supabase MCP, and commit.

## Core Value

The site builds and deploys cleanly on Cloudflare Pages with zero SQLite dependencies — articles from markdown, bookmarks from Supabase.

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

### Out of Scope

- New features or functionality — this is purely migration completion
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
| Markdown files over SQLite for articles | Simpler deploys (no binary DB), git-trackable content, CF Pages compatible | — Pending (verifying) |
| Supabase for bookmarks | Already migrated, works well for dynamic data with client-side queries | ✓ Good |
| Keep backup/restore scripts | `scripts/backup-supabase.ts` and `scripts/restore-supabase.ts` still useful | ✓ Good |

---
*Last updated: 2026-02-16 after initialization*
