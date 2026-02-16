# Phase 4: Sync Pipeline - Research

**Researched:** 2026-02-16
**Domain:** Supabase-to-Markdown file sync with content hashing
**Confidence:** HIGH

## Summary

This phase builds a `scripts/sync-articles.ts` script that fetches all published articles from Supabase (with tags), generates deterministic markdown files, and writes only those that have actually changed. The codebase already contains all the building blocks: `lib/articles.ts` has `stringifyArticle()` with canonical key ordering and a custom YAML engine, `import-articles.ts` demonstrates the Supabase service-role client pattern with `.env` loading, and Bun provides `node:crypto` for SHA-256 hashing.

The script is the inverse of `import-articles.ts`. Where import reads markdown and pushes to Supabase, sync reads Supabase and writes markdown. The existing `stringifyArticle()` function already produces deterministic output (verified: calling it twice with the same input yields identical strings), so hash comparison is reliable without additional normalization work.

**Primary recommendation:** Build sync as a single-file script following the established `import-articles.ts` pattern, reusing `stringifyArticle()` from `lib/articles.ts` and `node:crypto` SHA-256 for content hashing. No new dependencies needed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Hash the full generated output (frontmatter + content) and compare to existing file hash
- Only write files where the hash differs — skip unchanged files
- Always full sync (fetch all published articles), no partial/slug-based filtering
- Published articles only — drafts/unpublished are not synced to markdown
- DB is absolute source of truth — overwrite entire file from DB data, no merging of local-only fields
- Orphaned files (local .md with no matching DB article) are warned about but NOT deleted
- Invoke via `bun run sync` (package.json script)
- `--dry-run` flag shows file-by-file list: each file with its action (write/skip/orphan) and reason
- Normal run always prints a summary line: "Synced 52 articles: 3 updated, 49 unchanged, 1 orphaned"

### Claude's Discretion
- Output formatting: frontmatter key ordering, YAML style, content structure
- Edge case handling: missing slugs, auto-slug generation approach
- Error handling strategy for individual article failures
- Hash algorithm choice (MD5, SHA-256, etc.)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SYNC-01 | `scripts/sync-articles.ts` exports Supabase articles to `blog/articles/*.md` | Supabase service-role client pattern from `import-articles.ts`; `stringifyArticle()` from `lib/articles.ts` for deterministic output; file naming as `{slug}.md` matching existing convention |
| SYNC-02 | Sync uses hash-based comparison to only write changed files | `node:crypto` SHA-256 verified working in Bun; hash generated output string, compare to hash of existing file content |
| SYNC-03 | Frontmatter formatting is deterministic (sorted keys, consistent newlines) | `stringifyArticle()` already uses `toCanonicalOrder()` with fixed key order + `js-yaml` JSON_SCHEMA engine; verified deterministic in testing |
| SYNC-04 | Sync supports dry-run mode (preview changes without writing) | `--dry-run` flag pattern established in `import-articles.ts`; show per-file action (write/skip/orphan) with reason |
| SYNC-05 | Sync handles errors gracefully (failed article doesn't abort entire sync) | Try/catch per-article pattern from `import-articles.ts`; collect errors, report at end |
| SYNC-06 | Auto-slug generation from title for articles without slugs | Simple slugify function: lowercase, replace non-alphanumeric with hyphens, collapse, trim |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.89.0 | Query articles + tags from Supabase | Already in `dependencies`; service-role pattern established in `import-articles.ts` |
| `gray-matter` | ^4.0.3 | Stringify frontmatter + content to markdown | Already in `devDependencies`; `stringifyArticle()` uses it with custom YAML engine |
| `js-yaml` | (gray-matter dep) | YAML serialization with `JSON_SCHEMA` | Prevents date coercion; configured in `lib/articles.ts` YAML_ENGINE |
| `node:crypto` | (built-in) | SHA-256 hashing for file comparison | Built into Bun runtime; `createHash('sha256')` verified working |
| `node:fs` | (built-in) | Read existing files, write updated files | Standard Node.js; `writeFileSync`, `readFileSync`, `readdirSync`, `existsSync` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | ^3.25.76 | Validate DB response shape | Already in devDependencies; optional but useful for runtime safety on Supabase response |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `node:crypto` SHA-256 | `Bun.hash()` | Bun.hash returns BigInt (not hex string), less readable in logs; SHA-256 is standard and debuggable |
| `node:crypto` SHA-256 | MD5 | MD5 is slightly faster but cryptographically broken; SHA-256 is standard for content integrity; performance difference negligible for ~50 files |

**Installation:**
No new packages needed. All dependencies already exist in `package.json`.

## Architecture Patterns

### Recommended Script Structure
```
scripts/
└── sync-articles.ts     # New: DB → markdown sync script
lib/
└── articles.ts          # Existing: stringifyArticle(), toCanonicalOrder(), schema
blog/articles/
└── *.md                 # Output target (existing files)
```

### Pattern 1: Fetch-Transform-Diff-Write Pipeline
**What:** Linear pipeline: fetch all published articles from DB with tags, transform each to markdown string, diff against existing file hash, write only changed files.
**When to use:** Always (this is the core sync pattern).
**Example:**
```typescript
// 1. Fetch all published articles with tags (single query with join)
const { data, error } = await supabase
  .from("articles")
  .select("*, article_tags(tag_id, tags(name))")
  .eq("status", "published");

// 2. Transform DB row → Article shape
const article: Article = {
  slug: row.slug,
  title: row.title,
  description: row.description,
  content: row.content,
  date: row.date,  // DB stores as DATE, comes back as "YYYY-MM-DD" string
  status: row.status,
  coverImage: row.cover_image,
  tags: row.article_tags.map(at => at.tags.name).sort(),
};

// 3. Generate markdown string (deterministic)
const markdown = stringifyArticle(article, article.content);

// 4. Hash and compare
const newHash = createHash("sha256").update(markdown).digest("hex");
const filePath = join(articlesDir, `${article.slug}.md`);
const existingHash = existsSync(filePath)
  ? createHash("sha256").update(readFileSync(filePath, "utf-8")).digest("hex")
  : null;

// 5. Write only if changed
if (newHash !== existingHash) {
  writeFileSync(filePath, markdown);
}
```

### Pattern 2: Orphan Detection via Set Difference
**What:** Compare set of DB slugs against set of local `.md` filenames to find orphans.
**When to use:** After syncing all articles.
**Example:**
```typescript
const dbSlugs = new Set(articles.map(a => a.slug));
const localFiles = readdirSync(articlesDir).filter(f => f.endsWith(".md"));
const localSlugs = new Set(localFiles.map(f => f.replace(/\.md$/, "")));

for (const localSlug of localSlugs) {
  if (!dbSlugs.has(localSlug)) {
    console.warn(`ORPHAN: ${localSlug}.md (exists locally but not in DB)`);
  }
}
```

### Pattern 3: Auto-Slug Generation
**What:** Generate URL-safe slug from article title when slug is missing or empty.
**When to use:** For SYNC-06 requirement.
**Example:**
```typescript
function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")  // Remove diacritics
    .replace(/[^a-z0-9]+/g, "-")       // Non-alphanumeric → hyphens
    .replace(/^-+|-+$/g, "")           // Trim leading/trailing hyphens
    .slice(0, 80);                      // Reasonable length limit
}
```

### Anti-Patterns to Avoid
- **Partial syncing by updated_at timestamp:** Fragile; clock skew, missed updates. Full sync with hash comparison is simple and reliable for ~50 files.
- **Reading frontmatter to merge local fields:** DB is source of truth. Never merge — always overwrite entire file.
- **Using Bun.write() for file operations:** While available, `writeFileSync` from `node:fs` matches the existing codebase pattern and is more portable.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter serialization | Custom YAML formatter | `stringifyArticle()` from `lib/articles.ts` | Already handles canonical key ordering, JSON_SCHEMA engine, deterministic output |
| Supabase client setup | Custom HTTP client | `@supabase/supabase-js` with service role key | Handles auth, RLS bypass, nested joins; pattern in `import-articles.ts` |
| .env loading | Custom parser or `dotenv` | Copy `loadEnv()` from `import-articles.ts` | Already works, no new dependency needed |
| Content hashing | Custom comparison logic | `node:crypto` createHash | Standard, proven, available in Bun |

**Key insight:** This script is the mirror of `import-articles.ts`. Nearly every infrastructure concern (Supabase client, env loading, error handling, dry-run mode) has a working reference implementation in the existing codebase.

## Common Pitfalls

### Pitfall 1: Date Format Mismatch
**What goes wrong:** Supabase DATE columns return `"YYYY-MM-DD"` as a string, but some DB clients or edge cases could return full ISO timestamps. If the date format changes, the hash changes, causing unnecessary file writes.
**Why it happens:** Supabase returns DATE as a string, but the exact format depends on the column type and PostgREST behavior.
**How to avoid:** Explicitly extract only the date portion: `row.date.slice(0, 10)` or validate with regex. The existing `ArticleFrontmatterSchema` requires `YYYY-MM-DD` format.
**Warning signs:** All files being rewritten on every sync despite no content changes.

### Pitfall 2: Tag Ordering Non-Determinism
**What goes wrong:** Tags from the DB join come back in arbitrary order. Different tag order means different YAML output, different hash, unnecessary file writes.
**Why it happens:** SQL joins don't guarantee ordering unless explicitly specified.
**How to avoid:** Always `.sort()` the tags array before passing to `stringifyArticle()`.
**Warning signs:** Files showing as "updated" when only tag order changed.

### Pitfall 3: Content Trailing Whitespace
**What goes wrong:** DB content may have different trailing whitespace than the `.trim()` in `stringifyArticle()`. If not handled consistently, hash comparison fails.
**Why it happens:** Content may be stored with trailing newlines in DB but trimmed on output.
**How to avoid:** Always `.trim()` content before passing to `stringifyArticle()`, matching how `readArticle()` does `content.trim()`.
**Warning signs:** Files being rewritten with identical visible content.

### Pitfall 4: Supabase Nested Join Response Shape
**What goes wrong:** The nested join `article_tags(tag_id, tags(name))` returns tags as an array of objects, not flat strings. Incorrect destructuring breaks tag extraction.
**Why it happens:** Supabase PostgREST nested selects return nested objects.
**How to avoid:** Map explicitly: `row.article_tags.map(at => at.tags.name)`. The `tags` inside each `article_tags` row is a single object (not array) because it's a many-to-one relationship from `article_tags` to `tags`.
**Warning signs:** Tags showing as `[object Object]` or empty arrays.

### Pitfall 5: Null vs Empty String in coverImage
**What goes wrong:** DB returns `null` for `cover_image`, but YAML serialization of `null` vs omitting the key vs empty string produce different outputs.
**Why it happens:** `js-yaml` with `JSON_SCHEMA` serializes `null` as `null` (literal). This matches existing articles.
**How to avoid:** Pass `coverImage: row.cover_image` directly — the existing `stringifyArticle()` already handles null correctly with `JSON_SCHEMA`.
**Warning signs:** coverImage showing as `'null'` (string) instead of `null` (YAML null).

## Code Examples

### Complete Supabase Query for Articles with Tags
```typescript
// Source: Verified against existing schema (20260216202024_create_articles_schema.sql)
// and Supabase PostgREST nested select pattern
const { data: rows, error } = await supabase
  .from("articles")
  .select(`
    slug, title, description, content, status, date, cover_image,
    article_tags ( tags ( name ) )
  `)
  .eq("status", "published");

if (error) throw new Error(`Supabase query failed: ${error.message}`);

// Transform rows to Article shape
const articles = (rows ?? []).map(row => ({
  slug: row.slug,
  title: row.title,
  description: row.description,
  content: (row.content ?? "").trim(),
  date: row.date,  // Already "YYYY-MM-DD" from DATE column
  status: row.status as "published" | "draft",
  coverImage: row.cover_image,
  tags: (row.article_tags ?? [])
    .map((at: { tags: { name: string } }) => at.tags.name)
    .sort(),  // CRITICAL: sort for deterministic output
}));
```

### Hash Comparison and Conditional Write
```typescript
// Source: node:crypto (verified in Bun runtime)
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

function fileHash(filePath: string): string | null {
  if (!existsSync(filePath)) return null;
  return createHash("sha256")
    .update(readFileSync(filePath, "utf-8"))
    .digest("hex");
}

function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

// Usage
const markdown = stringifyArticle(frontmatter, article.content);
const newHash = contentHash(markdown);
const oldHash = fileHash(filePath);

if (newHash !== oldHash) {
  writeFileSync(filePath, markdown);
  // action: "write", reason: oldHash ? "content changed" : "new file"
} else {
  // action: "skip", reason: "unchanged"
}
```

### Summary Output Pattern
```typescript
// Matches the requested format: "Synced 52 articles: 3 updated, 49 unchanged, 1 orphaned"
interface SyncStats {
  updated: number;
  unchanged: number;
  created: number;
  orphaned: number;
  errors: number;
}

function printSummary(stats: SyncStats, dryRun: boolean): void {
  const total = stats.updated + stats.unchanged + stats.created;
  const prefix = dryRun ? "Dry run" : "Synced";
  const parts = [
    stats.created > 0 ? `${stats.created} created` : null,
    stats.updated > 0 ? `${stats.updated} updated` : null,
    `${stats.unchanged} unchanged`,
    stats.orphaned > 0 ? `${stats.orphaned} orphaned` : null,
    stats.errors > 0 ? `${stats.errors} errors` : null,
  ].filter(Boolean);

  console.log(`${prefix} ${total} articles: ${parts.join(", ")}`);
}
```

### Slugify Function
```typescript
function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")  // Strip diacritics (é→e, ã→a)
    .replace(/[^a-z0-9]+/g, "-")       // Non-alphanumeric runs → single hyphen
    .replace(/^-+|-+$/g, "")           // Trim edge hyphens
    .slice(0, 80);                      // Reasonable filename length
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manually authored markdown files | DB→markdown sync script | This phase | Markdown files become build artifacts, not source |
| `import-articles.ts` (one-way: file→DB) | `sync-articles.ts` (reverse: DB→file) | This phase | Completes the bidirectional workflow |

**Deprecated/outdated:**
- Manual article editing in markdown: After this phase, the DB is the canonical source. Markdown files are generated output.

## Open Questions

1. **Supabase DATE column return format**
   - What we know: PostgreSQL DATE type, PostgREST returns it as a string. Tested that `"YYYY-MM-DD"` is the expected format.
   - What's unclear: Whether edge cases (timezone settings, etc.) could ever alter the format.
   - Recommendation: Add a defensive `row.date.slice(0, 10)` or validate with the existing Zod schema regex. LOW risk.

2. **Articles with very long titles producing long slugs**
   - What we know: Existing articles have slugs truncated to reasonable lengths (filenames like `beyond-make-something-people-want-building-what-people-would-kil.md`).
   - What's unclear: Whether the DB has articles with slugs longer than filesystem limits.
   - Recommendation: The slugify function truncates to 80 chars. Existing slugs are already within limits. LOW risk.

## Sources

### Primary (HIGH confidence)
- `lib/articles.ts` — Verified `stringifyArticle()`, `toCanonicalOrder()`, `YAML_ENGINE`, `ArticleFrontmatterSchema`
- `scripts/import-articles.ts` — Verified Supabase client pattern, `.env` loading, dry-run, error handling
- `supabase/migrations/20260216202024_create_articles_schema.sql` — Verified table schema: articles, tags, article_tags
- `supabase/migrations/20260216202203_create_triggers_and_rls.sql` — Verified RLS policies (service role bypasses)
- `tests/constraints/articles.test.ts` — Verified roundtrip fidelity test exists for article parsing/stringify
- Bun runtime testing — Verified `node:crypto` SHA-256 and `stringifyArticle()` determinism

### Secondary (MEDIUM confidence)
- `@supabase/supabase-js` PostgREST nested select syntax — Verified query builder produces correct URL for nested joins

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All libraries already in use; no new dependencies
- Architecture: HIGH — Mirror of existing `import-articles.ts`; `stringifyArticle()` verified deterministic
- Pitfalls: HIGH — Derived from direct codebase inspection and runtime testing

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable domain, no external dependency changes expected)
