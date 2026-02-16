# Phase 1: Migration Cleanup - Research

**Researched:** 2026-02-16
**Domain:** Git cleanup, SQLite removal, build verification (Bun + Node + Vite + Cloudflare Pages)
**Confidence:** HIGH

## Summary

This phase is a straightforward cleanup operation. The SQLite-to-markdown migration was performed on Feb 9 but left uncommitted. All diffs have been reviewed and are consistent with the migration intent -- removing SQLite dependencies (lib/db/, server/, old scripts) and replacing them with markdown-based article reading (lib/articles.ts). The codebase is already functionally migrated; the work is staging, cleaning stale references, and committing.

The main risks are: (1) stale SQLite references in comments, .gitignore, and docs that need manual cleanup beyond what the diff already covers, (2) the tunnel.ts script that needs removal along with its package.json scripts, (3) the SETUP_GUIDE.md which still has two SQLite mentions in the context of MCP Mesh (external tool, not this project), and (4) regenerating bun.lock fresh.

**Primary recommendation:** Execute as a single cleanup session -- review diffs, fix stale references, delete artifacts, regenerate lock file, verify build/tests, commit.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- All 6 deleted files are intentional removals: lib/db/ (content.ts, index.ts, learnings.ts), server/ (cli.ts, stdio.ts, tools.ts), scripts/ (import-social-posts.ts, seed-projects.ts)
- Claude reviews all modified file diffs autonomously -- no manual review needed
- If a diff looks questionable (unrelated to migration, wrong config): flag it and skip -- leave unstaged, note what was skipped
- Regenerate bun.lock fresh (delete existing, run bun install) instead of committing the stale lock file
- `.cursor/` -> Add to .gitignore (IDE-specific config)
- `blog/config.json`, `blog/tone-of-voice.md`, `blog/visual-style.md` -> Commit all three (project assets)
- `lib/articles.ts` -> Commit now (new article reading layer replacing old DB layer)
- `scripts/tunnel.ts` -> Remove (experimental tunnel script, not needed)
- Single cleanup commit for everything (deletions, config, docs, new files, .gitignore)
- Verify build and tests BEFORE committing -- don't commit broken state
- If build fails due to stale SQLite references, Claude fixes autonomously (obvious fixes like removing imports)
- Full sweep: find and remove ALL SQLite references across the codebase (imports, comments, configs)
- Search for and remove `--experimental-sqlite` flag from all scripts, configs, CI files
- `data/` directory: delete AND add to .gitignore
- Documentation: verify README, DEPLOY, SETUP_GUIDE accuracy post-cleanup (no stale SQLite setup steps, correct commands)

### Claude's Discretion
- Exact commit message wording
- Order of operations within the cleanup
- How to handle edge cases in stale reference removal
- Whether to group .gitignore additions (.cursor/, data/) or handle separately

### Deferred Ideas (OUT OF SCOPE)
- Seamless deco link integration for local dev tunneling -- future phase (replaces the removed scripts/tunnel.ts experiment)
</user_constraints>

## Inventory of All Changes

### Diff Review Results (HIGH confidence -- all diffs examined)

Every modified file diff has been reviewed. All changes are consistent with the SQLite-to-markdown migration. No questionable or unrelated changes found.

| File | Change Type | Status | Notes |
|------|------------|--------|-------|
| `lib/db/content.ts` | Deleted (804 lines) | Intentional | SQLite content layer, replaced by lib/articles.ts |
| `lib/db/index.ts` | Deleted (414 lines) | Intentional | SQLite DB initialization |
| `lib/db/learnings.ts` | Deleted (342 lines) | Intentional | SQLite learnings DB |
| `server/cli.ts` | Deleted (48 lines) | Intentional | MCP CLI entry point |
| `server/stdio.ts` | Deleted (48 lines) | Intentional | MCP STDIO transport |
| `server/tools.ts` | Deleted (1739 lines) | Intentional | MCP tool definitions |
| `scripts/import-social-posts.ts` | Deleted (408 lines) | Intentional | Used bun:sqlite directly |
| `scripts/seed-projects.ts` | Deleted (130 lines) | Intentional | SQLite seeder |
| `README.md` | Modified (~340 net lines removed) | Migration | Removed SQLite/MCP server docs, added markdown article docs |
| `DEPLOY.md` | Modified | Migration | Removed SQLite references, updated build docs |
| `SETUP_GUIDE.md` | Modified (1 line) | Migration | Removed Docker prerequisite line |
| `package.json` | Modified | Migration | Removed bin/mcp scripts, added deco-cli, added tunnel scripts |
| `scripts/build.ts` | Modified | Migration | Removed `--experimental-sqlite` from pages mode |
| `scripts/generate.ts` | Modified | Migration | Switched from lib/db/content.ts to lib/articles.ts |
| `vite.config.ts` | Modified (~60 lines) | Migration | Replaced databaseWatcherPlugin with articleWatcherPlugin |
| `lefthook.yml` | Modified | Migration | Changed staging from data/content.db to blog/articles/ |
| `bun.lock` | Modified (341 lines added) | Stale | Will be regenerated fresh per user decision |

### New Files to Commit

| File | Disposition | Notes |
|------|------------|-------|
| `lib/articles.ts` | Commit | New markdown article reader (181 lines, replaces lib/db/) |
| `blog/config.json` | Commit | Blog configuration (author, tags, style refs) |
| `blog/tone-of-voice.md` | Commit | Blog tone guide |
| `blog/visual-style.md` | Commit | Blog visual style guide |

### Files to Remove

| File/Dir | Action | Notes |
|----------|--------|-------|
| `scripts/tunnel.ts` | Delete from disk | Experimental, per user decision |
| `data/content.db` | Delete from disk | 1.9MB SQLite file, no longer needed |
| `data/learnings.db` | Delete from disk | 24KB SQLite file, no longer needed |
| `data/` directory | Delete entirely | Both .db files inside, then add to .gitignore |

### Package.json Scripts to Remove

The tunnel scripts were added in the migration diff but the file is being removed:

```json
"dev:tunnel": "bun scripts/tunnel.ts",
"preview:tunnel": "bun scripts/tunnel.ts --preview",
```

These two scripts must be removed from package.json since tunnel.ts is being deleted.

## Stale SQLite References (Full Sweep)

### Source Code References (must fix)

| File | Line | Reference | Action |
|------|------|-----------|--------|
| `src/lib/manifest.ts:4` | Comment | "generated from SQLite" | Update comment to "generated from markdown articles" |
| `src/pages/bookmarks-edit.tsx:95` | Comment | "loaded from SQLite via /api/bookmarks" | Update to "loaded from Supabase via /api/bookmarks" |
| `scripts/finalize.ts:9` | Comment | "Does NOT require SQLite" | Update to remove SQLite mention entirely |

### .gitignore References (must fix)

| Line | Current | Action |
|------|---------|--------|
| `# Generated from SQLite (regenerated at dev/build time)` | Stale comment | Update comment |
| `# SQLite WAL temp files` | Stale section | Remove entire section (data/*.db-shm, data/*.db-wal) |
| `# Bookmarks DB (now in Supabase, keep locally as backup)` | Stale | Remove data/bookmarks.db line |
| `data/learnings.db` | Stale | Remove specific line |

After cleanup, add these to .gitignore:
- `data/` (entire directory)
- `.cursor/` (IDE config)

### Documentation References (must fix)

| File | Reference | Action |
|------|-----------|--------|
| `SETUP_GUIDE.md:52` | "SQLite won't work for event-driven workflows" | This refers to MCP Mesh (external tool), NOT this project. Keep as-is -- it's accurate about Mesh's requirements. |
| `SETUP_GUIDE.md:90` | "This uses SQLite by default" | Same -- refers to `npx @decocms/mesh` default. Keep as-is. |

### Content References (do NOT touch)

Blog articles that mention SQLite are historical content describing the old architecture. These are published articles and should NOT be modified:
- `blog/articles/from-whatsapp-to-bookmarks-*.md` (describes old SQLite architecture)
- `blog/articles/the-great-ssg-simplification-*.md` (describes old build pipeline)
- `blog/articles/running-local-mcps-*.md` (describes Supabase migration)

### Planning/Docs References (do NOT touch)

Files in `.planning/`, `.cursor/` are planning artifacts, not shipped code. Leave them as-is.

### Firefox Bookmarks (do NOT touch)

`lib/bookmarks/firefox.ts` uses `better-sqlite3` to read Firefox's `places.sqlite`. This is reading FROM Firefox's database, not using SQLite as this project's storage. It's an optional feature and should remain.

## Architecture Patterns

### Pre-Commit Hook Flow (lefthook.yml)

The pre-commit hook runs in sequence:
1. `bun run fmt` (Biome format)
2. `bun run lint` (oxlint)
3. `bun run check` (TypeScript)
4. `bun run build` (full build)
5. `git add dist/index.html dist/assets/ dist/_headers dist/images/ blog/articles/` (stage build outputs)
6. `bun run test:constraints` (constraint tests)
7. `bun run test:e2e` (Playwright E2E tests)

The hook stages `blog/articles/` which ensures article changes get committed with their built outputs.

### Build Pipeline

```
blog/articles/*.md  -->  scripts/generate.ts  -->  public/content/manifest.json
                                               -->  .build/article/*/index.html
                                               -->  .build/context/*/index.html
                    -->  vite build            -->  dist/
                    -->  scripts/finalize.ts   -->  dist/ (final, with embedded manifest)
```

### Lock File Regeneration

User decided: delete bun.lock, run `bun install` to regenerate fresh. This avoids committing a potentially stale lock file from the migration session. The lock file diff shows 341 lines added (likely from adding `deco-cli` and other deps).

## Common Pitfalls

### Pitfall 1: SETUP_GUIDE.md False Positives
**What goes wrong:** Grep finds "SQLite" in SETUP_GUIDE.md and you remove it, but those references are about MCP Mesh (external tool), not this project.
**How to avoid:** The two SQLite mentions on lines 52 and 90 are about Mesh's PostgreSQL requirement. They are accurate and should stay.

### Pitfall 2: Blog Article Content
**What goes wrong:** Grep finds "SQLite" in blog articles and you modify published content.
**How to avoid:** Blog articles are historical content. Never modify article body text during cleanup.

### Pitfall 3: Firefox Bookmarks Module
**What goes wrong:** Removing `better-sqlite3` references from `lib/bookmarks/firefox.ts` thinking it's part of the migration.
**How to avoid:** This module reads FROM Firefox, it doesn't use SQLite as project storage. Leave it.

### Pitfall 4: Tunnel Script Removal Incomplete
**What goes wrong:** Deleting `scripts/tunnel.ts` but leaving `dev:tunnel` and `preview:tunnel` scripts in package.json.
**How to avoid:** Remove both the file AND the two package.json script entries.

### Pitfall 5: dist/index.html SQLite in Embedded Content
**What goes wrong:** Grep finds "SQLite" in dist/index.html (in the embedded manifest JSON) and you try to edit it.
**How to avoid:** This is article description text embedded in the built HTML. It will be correct after rebuild.

### Pitfall 6: Build Fails on Stale Import
**What goes wrong:** A file still imports from `lib/db/` which no longer exists.
**How to avoid:** Already verified -- no remaining imports from `lib/db/` exist in scripts/ or src/. The migration diff correctly updated `scripts/generate.ts` to import from `lib/articles.ts`.

## Execution Order (Recommended)

1. **Delete artifacts first:** `data/` directory, `scripts/tunnel.ts`
2. **Fix stale references:** comments in manifest.ts, bookmarks-edit.tsx, finalize.ts
3. **Update .gitignore:** remove SQLite-specific entries, add `data/` and `.cursor/`
4. **Remove tunnel scripts from package.json**
5. **Regenerate bun.lock:** `rm bun.lock && bun install`
6. **Verify build:** `bun run pages:build` (must succeed without --experimental-sqlite)
7. **Run tests:** `bun run test:constraints && bun run test:e2e`
8. **Stage and commit everything** in a single commit

## Open Questions

1. **SETUP_GUIDE.md completeness**
   - What we know: The diff only removed the Docker prerequisite. Two SQLite mentions remain but refer to external MCP Mesh, not this project.
   - What's unclear: Should the SETUP_GUIDE be further updated given MCP server code is being removed? The entire guide is about MCP Mesh setup, not this project's development.
   - Recommendation: The guide describes external tool setup. The removed MCP server (`server/`) was a separate concern. Leave SETUP_GUIDE as-is after the diff is applied -- its SQLite references are about Mesh, not this project.

2. **Optional dependencies in package.json**
   - What we know: `@decocms/bindings`, `@decocms/runtime`, `@modelcontextprotocol/sdk`, `plist` are in optionalDependencies. The server/ directory that used these is being deleted.
   - What's unclear: Are these still needed by anything else?
   - Recommendation: This is out of scope for Phase 1 (migration cleanup). The packages are optional and won't break anything. Flag for future cleanup if desired.

## Sources

### Primary (HIGH confidence)
- Direct examination of all git diffs (`git diff` for each modified file)
- Direct examination of all files referenced in grep results
- File system inspection of data/, blog/, scripts/ directories

### Confidence Breakdown
- Diff review: HIGH -- every diff examined line by line
- Stale reference inventory: HIGH -- full codebase grep with manual verification
- Build pipeline understanding: HIGH -- read build.ts, generate.ts, finalize.ts, vite.config.ts
- Pitfall identification: HIGH -- based on actual codebase examination

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable -- this is a one-time cleanup, not a moving target)
