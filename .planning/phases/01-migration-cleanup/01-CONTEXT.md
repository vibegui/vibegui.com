# Phase 1: Migration Cleanup - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Clean up the half-done SQLite→Supabase migration. All Feb 9 changes are committed, SQLite artifacts fully removed, builds and tests pass without SQLite dependencies. The repository is clean and ready for Phase 2 (Parser Foundation).

</domain>

<decisions>
## Implementation Decisions

### Change review scope
- All 6 deleted files are intentional removals: lib/db/ (content.ts, index.ts, learnings.ts), server/ (cli.ts, stdio.ts, tools.ts), scripts/ (import-social-posts.ts, seed-projects.ts)
- Claude reviews all modified file diffs autonomously — no manual review needed
- If a diff looks questionable (unrelated to migration, wrong config): flag it and skip — leave unstaged, note what was skipped
- Regenerate bun.lock fresh (delete existing, run bun install) instead of committing the stale lock file

### New file disposition
- `.cursor/` → Add to .gitignore (IDE-specific config)
- `blog/config.json`, `blog/tone-of-voice.md`, `blog/visual-style.md` → Commit all three (project assets)
- `lib/articles.ts` → Commit now (new article reading layer replacing old DB layer)
- `scripts/tunnel.ts` → Remove (experimental tunnel script, not needed — deco link integration in future)

### Commit organization
- Single cleanup commit for everything (deletions, config, docs, new files, .gitignore)
- Verify build and tests BEFORE committing — don't commit broken state
- If build fails due to stale SQLite references, Claude fixes autonomously (obvious fixes like removing imports)

### Cleanup boundary
- Full sweep: find and remove ALL SQLite references across the codebase (imports, comments, configs)
- Search for and remove `--experimental-sqlite` flag from all scripts, configs, CI files
- `data/` directory: delete AND add to .gitignore
- Documentation: verify README, DEPLOY, SETUP_GUIDE accuracy post-cleanup (no stale SQLite setup steps, correct commands)

### Claude's Discretion
- Exact commit message wording
- Order of operations within the cleanup
- How to handle edge cases in stale reference removal
- Whether to group .gitignore additions (.cursor/, data/) or handle separately

</decisions>

<specifics>
## Specific Ideas

- Lock file should be regenerated fresh from package.json, not committed from stale state
- Docs should reflect reality post-cleanup — actively verify, don't just commit what's there
- "Flag and skip" approach for questionable diffs — conservative, nothing gets committed that looks wrong

</specifics>

<deferred>
## Deferred Ideas

- Seamless deco link integration for local dev tunneling — future phase (replaces the removed scripts/tunnel.ts experiment)

</deferred>

---

*Phase: 01-migration-cleanup*
*Context gathered: 2026-02-16*
