# Phase 2: Parser Foundation - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the custom YAML frontmatter parser in lib/articles.ts with gray-matter. Validate roundtrip fidelity for all 52 existing articles. Define and enforce a canonical frontmatter schema. Reformat all articles to canonical YAML.

</domain>

<decisions>
## Implementation Decisions

### Roundtrip fidelity rules
- Semantic equivalence is the bar — same data, formatting can differ
- Markdown body: trimmed match (allow leading/trailing whitespace differences)
- Roundtrip validation is a permanent test in the test suite, runs on every CI build
- If gray-matter produces semantically different data for an article, fix the article (not the parser)

### Frontmatter schema
- Define a canonical schema with required vs optional fields
- Required fields: title, slug, date, status (published/draft) at minimum — Claude surveys existing articles and proposes the full required/optional split
- Schema is enforced at parse time — parser throws on missing required fields
- Schema definition approach must be compatible with the blocks pattern used in anjo.chat, hypercouple, and mesh site editor plugin (researcher should investigate these projects)

### Edge case handling
- Malformed frontmatter: best-effort recovery (parse what you can)
- Missing required fields after parse: flag for manual review (don't auto-fill defaults)
- YAML style variants (inline arrays vs block arrays): accept both on read, normalize to canonical style on write
- Date handling: Claude's discretion — pick what avoids roundtrip issues

### Migration behavior
- Reformat all 52 articles to canonical YAML frontmatter in one pass
- Single swap: one commit removes old parser and adds gray-matter (no gradual migration)
- Full build verification (bun run pages:build) + tests after migration
- File organization for gray-matter integration: Claude's discretion based on current file size

### Claude's Discretion
- Date parsing strategy (strings vs Date objects — whatever avoids roundtrip issues)
- Whether to extract parser to separate module or keep in lib/articles.ts
- Exact canonical YAML formatting choices (key order, quoting style)

</decisions>

<specifics>
## Specific Ideas

- Schema approach must be compatible with the "blocks" pattern from anjo.chat, hypercouple, and mesh site editor plugin — researcher should look at how those projects define content schemas
- Articles that fail roundtrip or schema validation should be fixed at the source, not worked around

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-parser-foundation*
*Context gathered: 2026-02-16*
