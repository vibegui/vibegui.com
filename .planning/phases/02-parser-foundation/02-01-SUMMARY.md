---
phase: 02-parser-foundation
plan: 01
subsystem: parsing
tags: [gray-matter, js-yaml, zod, yaml, frontmatter]

requires:
  - phase: 01-migration-cleanup
    provides: Clean codebase with no SQLite dependencies, all articles in blog/articles/
provides:
  - gray-matter parser with yaml.JSON_SCHEMA (dates as strings)
  - Zod schema for article frontmatter with 7 required fields
  - Canonical YAML formatting for all 52 articles
  - Permanent roundtrip fidelity + schema validation tests (105 tests)
  - stringifyArticle() and toCanonicalOrder() exports for sync pipeline
affects: [03-supabase-schema-import, 04-sync-pipeline]

tech-stack:
  added: [@types/js-yaml]
  patterns: [gray-matter with JSON_SCHEMA engine, Zod schema validation at parse time, canonical key ordering]

key-files:
  created:
    - tests/constraints/articles.test.ts
  modified:
    - lib/articles.ts
    - blog/articles/*.md (52 files)

key-decisions:
  - "Numeric tags coerced to strings via Zod transform (tag '2025' was parsed as number by JSON_SCHEMA)"
  - "YAML engine types use object instead of Record<string,unknown> for gray-matter compatibility"
  - "Tags schema accepts union of string|number with transform, not strict string-only"

patterns-established:
  - "gray-matter + yaml.JSON_SCHEMA: all YAML parsing uses this to prevent date coercion"
  - "Canonical key order: slug, title, description, date, status, coverImage, tags"
  - "Schema validation at parse time: ArticleFrontmatterSchema.parse(data) in readArticle()"

duration: 8min
completed: 2026-02-16
---

# Plan 02-01: Parser Foundation Summary

**gray-matter parser with yaml.JSON_SCHEMA replacing custom 75-line YAML parser, Zod schema validation, canonical YAML for all 52 articles, and 105 permanent roundtrip tests**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-16T15:50:00Z
- **Completed:** 2026-02-16T15:58:00Z
- **Tasks:** 2
- **Files modified:** 55 (lib/articles.ts + 52 articles + test file + package.json + bun.lock)

## Accomplishments
- Replaced custom 75-line YAML parser with gray-matter using yaml.JSON_SCHEMA (dates stay as strings)
- Defined Zod schema with all 7 required fields, validated at parse time
- Reformatted all 52 articles to canonical YAML (consistent key order, proper quoting)
- Added 105 permanent constraint tests: 52 roundtrip + 52 schema + 1 count check

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace custom parser + reformat articles** - `f87a839` (feat)
2. **Task 2: Add roundtrip fidelity and schema tests** - `56ce290` (test)

## Files Created/Modified
- `lib/articles.ts` - gray-matter + Zod schema parser, replacing custom parseFrontmatter()
- `tests/constraints/articles.test.ts` - Permanent roundtrip fidelity + schema validation tests
- `blog/articles/*.md` - 52 articles reformatted to canonical YAML frontmatter
- `package.json` / `bun.lock` - Added @types/js-yaml devDependency

## Decisions Made
- Numeric YAML tag values (e.g., `2025`) are coerced to strings via Zod transform, since yaml.JSON_SCHEMA still parses bare numbers as numbers
- YAML engine stringify function typed as `(data: object) => string` instead of `Record<string, unknown>` to satisfy gray-matter's type definitions
- Added @types/js-yaml for TypeScript type safety on the js-yaml import

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Numeric tag causing schema validation failure**
- **Found during:** Task 1 (build verification)
- **Issue:** Article `2025-a-year-worth-surviving.md` has tag `2025` which yaml.JSON_SCHEMA parses as number, failing `z.array(z.string())` validation
- **Fix:** Updated Zod schema to accept `z.union([z.string(), z.number()]).transform(v => String(v))` for tags. Re-ran reformat to quote the tag as `'2025'` in YAML.
- **Files modified:** lib/articles.ts, blog/articles/2025-a-year-worth-surviving.md
- **Verification:** Build passes, schema tests pass for all 52 articles
- **Committed in:** f87a839 (Task 1 commit)

**2. [Rule 3 - Blocking] TypeScript type errors with gray-matter engine config**
- **Found during:** Task 2 (pre-commit hook typecheck)
- **Issue:** gray-matter's GrayMatterOption type expects `stringify: (data: object) => string` but we had `(data: Record<string, unknown>) => any`
- **Fix:** Changed YAML_ENGINE types to use `object` parameter type. Added @types/js-yaml.
- **Files modified:** lib/articles.ts, package.json, bun.lock
- **Verification:** tsc --noEmit passes
- **Committed in:** 56ce290 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- gray-matter parser is the foundation for Supabase import (Phase 3) and sync pipeline (Phase 4)
- Exported `stringifyArticle()` and `toCanonicalOrder()` are ready for use by sync script
- All 52 articles have validated, canonical frontmatter ready for database import

---
*Phase: 02-parser-foundation*
*Completed: 2026-02-16*
