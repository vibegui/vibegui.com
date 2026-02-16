# Phase 4: Sync Pipeline - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a DB→file sync script (`scripts/sync-articles.ts`) that exports Supabase articles to `blog/articles/*.md` with smart diffing to minimize git noise. Only published articles are synced. The script is the single mechanism for getting data from Supabase into markdown files for the build pipeline.

</domain>

<decisions>
## Implementation Decisions

### Diffing strategy
- Hash the full generated output (frontmatter + content) and compare to existing file hash
- Only write files where the hash differs — skip unchanged files
- Always full sync (fetch all published articles), no partial/slug-based filtering
- Published articles only — drafts/unpublished are not synced to markdown
- DB is absolute source of truth — overwrite entire file from DB data, no merging of local-only fields
- Orphaned files (local .md with no matching DB article) are warned about but NOT deleted

### Operational modes
- Invoke via `bun run sync` (package.json script)
- `--dry-run` flag shows file-by-file list: each file with its action (write/skip/orphan) and reason
- Normal run always prints a summary line: "Synced 52 articles: 3 updated, 49 unchanged, 1 orphaned"

### Claude's Discretion
- Output formatting: frontmatter key ordering, YAML style, content structure
- Edge case handling: missing slugs, auto-slug generation approach
- Error handling strategy for individual article failures
- Hash algorithm choice (MD5, SHA-256, etc.)

</decisions>

<specifics>
## Specific Ideas

- "Always sync but sync only the changed stuff" — fetch everything, write only what changed
- Summary output should always appear so the user knows the script ran and what happened

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-sync-pipeline*
*Context gathered: 2026-02-16*
