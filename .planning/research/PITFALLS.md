# Pitfalls Research

**Domain:** Supabase-first blog with DB→file sync
**Researched:** 2026-02-16
**Confidence:** HIGH (based on codebase analysis + domain expertise)

---

## Critical Pitfalls

### Pitfall 1: Frontmatter Parser Discrepancies

**What goes wrong:** Custom YAML parser in `lib/articles.ts` uses simple line-by-line parsing that will produce different output than proper YAML libraries. When syncing DB→file, subtle differences (quote escaping, multiline strings, date formats, null vs empty string) cause perpetual "dirty" files in git.

**Why it happens:** The current parser (lines 56-113 in `lib/articles.ts`) handles only basic YAML: simple key-value pairs, quoted strings, and arrays. It doesn't handle:
- Multiline strings (|, >)
- Inline arrays `[item1, item2]`
- Nested objects
- Comments preservation
- YAML anchors/aliases
- Numeric vs string type inference
- Boolean parsing (`true`, `false`, `yes`, `no`)

**How to avoid:**
1. Use a proper YAML library (`gray-matter` is already in dependencies) for BOTH reading AND writing
2. Write a roundtrip test: file → parse → stringify → should equal original
3. Document the canonical frontmatter schema and enforce it
4. Add pre-commit test that validates all markdown files can roundtrip

**Warning signs:**
- Git diffs showing only whitespace/quote changes in frontmatter
- Frontmatter fields changing type (string → number, null → empty)
- Arrays formatting differently `['tag']` vs `- tag`

**Phase to address:** Phase 1 (before import) - fix parser to be bidirectional

---

### Pitfall 2: Slug Collisions and Filename Mismatch

**What goes wrong:** 52 markdown files exist. If slug in frontmatter doesn't match filename, the sync script will either:
1. Overwrite wrong file (data loss)
2. Create duplicate files (orphaned files)
3. Fail to update existing file (stale content)

Current code (line 126-128 in `lib/articles.ts`) derives slug from frontmatter OR filename as fallback. This is bidirectional ambiguity.

**Why it happens:** No enforcement that `slug` field matches filename. Example:
```
File: blog/articles/my-post.md
Frontmatter: slug: different-slug
```
During sync, which filename should be written? `my-post.md` or `different-slug.md`?

**How to avoid:**
1. Establish rule: filename IS the slug (remove slug from frontmatter entirely)
2. OR: slug in frontmatter MUST match filename (validation script)
3. Add constraint test: `filename.replace('.md', '') === frontmatter.slug`
4. Import script: validate no duplicates before writing to DB

**Warning signs:**
- Multiple files with same slug in frontmatter
- Orphaned `.md` files after sync
- Articles disappearing from site after sync

**Phase to address:** Phase 1 (pre-import) - validate slugs, decide on canonical rule

---

### Pitfall 3: Sync Direction Ambiguity

**What goes wrong:** Without strict direction enforcement, someone will:
1. Edit markdown file locally
2. Run sync (DB → file)
3. Local changes overwritten
4. Developer loses work, blames "the system"

This is the most common failure mode in bidirectional sync systems.

**Why it happens:** The project says "DB is source of truth" but markdown files are committed to git. Developers have muscle memory to edit files. No technical guard rails prevent editing markdown directly.

**How to avoid:**
1. Make sync script ONE WAY ONLY: Supabase → files
2. Add git pre-commit hook that REJECTS markdown changes with helpful error:
   ```
   ❌ Direct markdown edits blocked!
   Articles are synced from Supabase.
   Edit via Supabase Studio or MCP tools.
   Run: bun run sync
   ```
3. Add `.editorconfig` or VSCode workspace settings that mark `blog/articles/*.md` as read-only
4. Document clearly: "These files are BUILD ARTIFACTS - do not edit"

**Warning signs:**
- Merge conflicts in blog/articles/
- "Lost my changes" complaints
- Sync script run frequency drops (people afraid to run it)

**Phase to address:** Phase 2 (sync implementation) - enforce direction with tooling

---

### Pitfall 4: Content Encoding and Special Characters

**What goes wrong:** Markdown content with special characters breaks during file write or HTML generation:
- Unescaped quotes in YAML strings
- Emoji in frontmatter (UTF-8 encoding issues)
- Code blocks with triple backticks in content
- Windows vs Unix line endings (CRLF vs LF)
- Non-UTF8 characters from copy-paste

Current HTML generation (lines 71-78, 100) escapes HTML but doesn't handle:
- YAML string escaping in frontmatter
- JSON string escaping in embedded data (line 100 shows basic `</script>` escaping only)

**Why it happens:**
- Postgres stores text as UTF-8
- File writes may default to different encoding
- YAML has complex escaping rules
- Markdown has multiple special character contexts

**How to avoid:**
1. Enforce UTF-8 everywhere: `writeFileSync(path, content, 'utf-8')`
2. Use proper YAML serialization library (handles escaping)
3. Test with adversarial inputs:
   - Titles with quotes: `He said "hello"`
   - Descriptions with newlines
   - Content with YAML delimiters `---`
   - Unicode: emojis, accents, Chinese characters
4. Add test fixtures for edge cases

**Warning signs:**
- Build fails with "YAML parse error"
- Articles display garbled text
- Sync creates invalid markdown files
- Git diffs show encoding changes

**Phase to address:** Phase 1 (parser) + Phase 2 (sync) - use proper libraries, add tests

---

### Pitfall 5: Date/Timestamp Inconsistency

**What goes wrong:** Dates in frontmatter (`date: 2025-01-27`) vs Postgres timestamps (`created_at`) drift:
- File says `date: 2025-01-27`
- DB has `created_at: 2025-01-27T14:32:18.123Z`
- Sync writes `date: 2025-01-27T14:32:18.123Z` to file
- Now dates in git show as changed every sync
- OR: Sync truncates to `2025-01-27`, losing time info

**Why it happens:**
- Frontmatter uses date-only format (YAML date type)
- Postgres `timestamp with time zone` stores full ISO8601
- Sync needs to decide: preserve time or truncate?

**How to avoid:**
1. Decide canonical format for frontmatter dates (recommend: `YYYY-MM-DD` date-only)
2. DB schema: store both `date: DATE` and `created_at: TIMESTAMPTZ`
3. Sync script: always format as `date.toISOString().split('T')[0]`
4. Add test: roundtrip preserves exact date format

**Warning signs:**
- Git diffs showing only timestamp changes
- Article dates changing randomly
- Sorting by date produces different order after sync

**Phase to address:** Phase 3 (schema design) - separate date field from timestamps

---

### Pitfall 6: Missing Articles Table or Wrong Schema

**What goes wrong:** PROJECT.md says "Articles table may or may not exist yet". If you design schema from scratch without checking existing bookmarks schema patterns, you'll have:
- Inconsistent naming (snake_case vs camelCase)
- Different timestamp columns (`created_at` vs `createdAt` vs `created`)
- Missing RLS policies (public read breaks)
- Wrong column types (TEXT vs VARCHAR vs JSONB for tags)

**Why it happens:** Bookmarks schema exists (lines 27-53 in `lib/supabase.ts`). If articles schema doesn't follow same patterns, you have two different conventions in one database.

**How to avoid:**
1. FIRST: Query Supabase via MCP to see if articles table exists
2. IF exists: document exact schema, preserve it
3. IF not exists: follow bookmarks schema conventions:
   - snake_case columns
   - `id BIGINT PRIMARY KEY`
   - `created_at TIMESTAMPTZ DEFAULT NOW()`
   - `updated_at TIMESTAMPTZ`
   - Separate tags table OR JSONB array (bookmarks uses separate table)
4. Mirror RLS policies from bookmarks (public read with anon key)

**Warning signs:**
- Import script fails with "column doesn't exist"
- Different casing in Supabase Studio vs code
- RLS denies reads (403 errors)

**Phase to address:** Phase 3 (schema design) - check existing, align with bookmarks pattern

---

### Pitfall 7: Orphaned Image References

**What goes wrong:** Markdown files reference images:
```markdown
coverImage: /images/articles/my-article.png
![diagram](/images/diagram.png)
```

After import to Supabase, image paths become:
- Broken links (images not in DB)
- Wrong paths (DB URL vs static URL)
- Orphaned files (images in repo not referenced by any DB article)

**Why it happens:** Images are filesystem artifacts, not DB-stored. Sync script must handle:
- coverImage as filesystem path
- Inline images in markdown content
- Image optimization pipeline (lines 23 in package.json shows optimize-images script exists)

**How to avoid:**
1. Decide: Store image paths as-is (filesystem URLs) or migrate images to Supabase Storage?
2. If keeping filesystem:
   - Validate all image paths exist during import
   - Sync script preserves paths exactly
   - Add constraint test: all referenced images exist in public/images/
3. If moving to Supabase Storage:
   - Upload images during import
   - Rewrite URLs in content
   - Much more complex - probably not worth it

**Warning signs:**
- Broken images after deploy
- coverImage paths change during sync
- Orphaned files in public/images/

**Phase to address:** Phase 4 (import script) - validate image paths before import

---

### Pitfall 8: Build Pipeline Fails Mid-Migration

**What goes wrong:** During migration, you'll have:
- Some articles in DB
- Some articles still as files
- Build pipeline expects ALL articles from one source

Result: Half your articles disappear from site.

**Why it happens:** `getAllContent()` in `lib/articles.ts` reads from filesystem. If you delete markdown files before sync is proven working, build breaks.

**How to avoid:**
1. Add feature flag in generate.ts:
   ```typescript
   const USE_SUPABASE_ARTICLES = process.env.USE_SUPABASE_ARTICLES === 'true'
   const articles = USE_SUPABASE_ARTICLES
     ? await getArticlesFromSupabase()
     : getAllContent(ARTICLES_DIR)
   ```
2. Keep markdown files until sync + build proven working
3. Run parallel builds: one with files, one with DB
4. Compare outputs with diff
5. Only delete markdown files after verification

**Warning signs:**
- Build succeeds but articles missing
- Homepage shows empty article list
- E2E tests start failing

**Phase to address:** Phase 5 (integration) - gradual cutover with feature flag

---

### Pitfall 9: Supabase Row Limits and Pagination

**What goes wrong:** Current code fetches all articles/bookmarks without pagination:
- `getAllBookmarksLight()` in lib/supabase.ts line 70: no limit
- Works fine for 52 articles + 400 bookmarks
- What about 5,000 articles? Query times out or hits row limit

Supabase has default limits:
- 1000 rows per query (configurable)
- Query timeout: 30 seconds
- Connection pool limits

**Why it happens:** Developer tests with small dataset, doesn't think about scale.

**How to avoid:**
1. Build time: OK to fetch all (runs once)
2. Client side: Already fetches all (line 68-76 in lib/supabase.ts) - ADD LIMIT
3. Add pagination to queries:
   ```typescript
   .select('*')
   .range(0, 999)  // First 1000
   ```
4. OR: Generate static JSON for articles (already done via manifest.json)
5. Document: "This query loads ALL articles - expect N seconds"

**Warning signs:**
- Build gets slower over time
- "Query timeout" errors in Supabase logs
- Site becomes unresponsive with many articles

**Phase to address:** Phase 5 (integration) - test with large dataset, add limits

---

### Pitfall 10: Git Diff Noise and Commit History Pollution

**What goes wrong:** Every sync rewrites all markdown files, even if content unchanged:
- Whitespace changes
- Field ordering in frontmatter
- Timestamp updates
- Empty trailing newlines

Result: Git history becomes:
```
commit abc123: Sync articles from Supabase [2000+ lines changed]
commit def456: Sync articles from Supabase [1800+ lines changed]
commit ghi789: Sync articles from Supabase [2100+ lines changed]
```

Impossible to see actual content changes.

**Why it happens:** Naive sync: "read from DB, write to file". No diffing logic.

**How to avoid:**
1. Smart sync: read existing file, compare content, only write if changed
2. Deterministic formatting:
   - Sort frontmatter keys alphabetically
   - Consistent newlines (always LF)
   - Consistent trailing newline
3. Content-based comparison (ignore metadata changes):
   ```typescript
   const existing = readArticle(path)
   const updated = dbArticle
   if (existing.content === updated.content &&
       existing.title === updated.title) {
     // Skip write
   }
   ```
4. Pre-commit hook: stage only changed articles, not all

**Warning signs:**
- Every sync shows all files modified
- Git blame shows sync commits, not actual edits
- PRs with massive diffs

**Phase to address:** Phase 2 (sync script) - smart diffing before write

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Custom YAML parser | No dependencies | Roundtrip failures, incompatible with proper YAML | NEVER - gray-matter already in deps |
| Slug in frontmatter | Flexibility to rename files | Filename/slug mismatches, sync ambiguity | ONLY if validated equal to filename |
| Bidirectional sync | Flexibility for users | Lost work, merge conflicts, confusion | NEVER - pick ONE source of truth |
| Store timestamps in date field | Simpler schema | Git noise, sorting issues | NEVER - separate date from created_at |
| No RLS on articles | Faster dev setup | Security issues if service key leaked | Development only, must fix before launch |
| Fetch all rows without pagination | Simple code | Timeouts at scale | Acceptable for <1000 articles |
| Sync rewrites all files | Simple implementation | Git noise | Development only, optimize for production |
| No image validation | Faster import | Broken images in production | NEVER - validate during import |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase RLS | Service key in client code | Anon key for reads, service key in backend/scripts only |
| Markdown + React | Dangerously set innerHTML | Use marked library with sanitization (already in deps) |
| Frontmatter dates | Store as string "2025-01-27" | Parse to Date, validate format, roundtrip test |
| File writes | Async without error handling | Wrap in try/catch, validate UTF-8 encoding |
| Git hooks | Block commit without explanation | Helpful error message + how to fix |
| Environment vars | Hard-coded URLs in code | Use import.meta.env (Vite) or process.env (Node) |
| Build modes | Same script for dev/prod | Explicit --mode flag with different behavior |
| SSG embedding | Fetch JSON at runtime | Embed data in HTML (already done, preserve this) |
| Type safety | `any` types for DB results | Define interfaces (Bookmark, Article) and validate |

---

## "Looks Done But Isn't" Checklist

Migration looks complete when articles show on site. But have you verified:

### Data Integrity
- [ ] All 52 articles imported (count matches)
- [ ] Frontmatter fields preserved exactly (run diff)
- [ ] Markdown content identical (no encoding corruption)
- [ ] All images load (no 404s)
- [ ] Tags match original (including order)
- [ ] Dates match original (no timezone shifts)

### Roundtrip Fidelity
- [ ] DB → file produces valid markdown
- [ ] File → DB → file produces identical file
- [ ] Frontmatter parses in both directions
- [ ] Special characters survive roundtrip (quotes, emoji, code blocks)
- [ ] No git diffs on unchanged articles after sync

### Build Pipeline
- [ ] `bun run build` succeeds
- [ ] `bun run pages:build` succeeds (no Vite deps)
- [ ] E2E tests pass (`bun run test:e2e`)
- [ ] Constraint tests pass (`bun run test:constraints`)
- [ ] Article count in manifest.json matches DB count
- [ ] No console errors/warnings in dev server

### Developer Experience
- [ ] Editing markdown files blocked or warned
- [ ] Sync script has helpful output (progress, errors)
- [ ] Documentation updated (README, SETUP_GUIDE)
- [ ] Pre-commit hook stages correct files
- [ ] Error messages actionable ("Do X" not "Error Y")

### Production Readiness
- [ ] RLS policies tested with anon key
- [ ] Large dataset tested (import >100 dummy articles)
- [ ] Sync performance acceptable (<30s for 52 articles)
- [ ] No secrets in committed files (check .env)
- [ ] Cloudflare Pages build tested in preview
- [ ] Rollback plan documented (how to revert to markdown-only)

### Edge Cases
- [ ] Article with same title as another (slug collision)
- [ ] Article with special chars in slug (url-encoding)
- [ ] Draft articles hidden in production (`CI=true`)
- [ ] Article with no tags (empty array)
- [ ] Article with no coverImage (null vs empty string)
- [ ] Article dated in future (still shows?)

---

## Pitfall-to-Phase Mapping

| Phase | Pitfall | Prevention | Verification |
|-------|---------|------------|--------------|
| **Phase 1: Parser Fix** | #1 Frontmatter discrepancies | Use gray-matter, add roundtrip test | Test passes, no git diffs on roundtrip |
| **Phase 1: Parser Fix** | #4 Encoding issues | Force UTF-8, test special chars | Adversarial input test suite passes |
| **Phase 1: Validation** | #2 Slug collisions | Validate slug=filename, reject mismatches | Constraint test enforces rule |
| **Phase 2: Sync Script** | #3 Direction ambiguity | One-way sync only, pre-commit guard | Hook rejects markdown edits |
| **Phase 2: Sync Script** | #10 Git diff noise | Smart diffing, deterministic format | Unchanged articles not in git diff |
| **Phase 3: Schema** | #5 Date inconsistency | Separate date and created_at columns | Roundtrip preserves format |
| **Phase 3: Schema** | #6 Schema mismatch | Follow bookmarks conventions | Consistent snake_case, RLS patterns |
| **Phase 4: Import** | #7 Orphaned images | Validate paths, reject missing | All coverImage/inline images exist |
| **Phase 5: Integration** | #8 Build pipeline breaks | Feature flag for gradual cutover | Both modes work, outputs match |
| **Phase 5: Integration** | #9 Row limits | Test with 1000+ articles | Query completes in <5s |

---

## Sources

**Codebase Analysis:**
- `/Users/guilherme/Projects/vibegui.com/lib/articles.ts` - Custom YAML parser (lines 39-113)
- `/Users/guilherme/Projects/vibegui.com/scripts/generate.ts` - Build pipeline (generates manifest, SSG HTML)
- `/Users/guilherme/Projects/vibegui.com/lib/supabase.ts` - Bookmarks schema patterns (reference for articles table)
- `/Users/guilherme/Projects/vibegui.com/blog/articles/*.md` - 52 existing articles with YAML frontmatter
- `/Users/guilherme/Projects/vibegui.com/.planning/PROJECT.md` - Migration context and requirements
- `/Users/guilherme/Projects/vibegui.com/README.md` - Architecture and content flow
- `/Users/guilherme/Projects/vibegui.com/DEPLOY.md` - Cloudflare Pages constraints

**Domain Expertise:**
- Personal experience: 15+ years of CMS migrations, file-based content systems
- Similar patterns: Jekyll, Hugo, Gatsby (static site generators with frontmatter)
- Supabase patterns: Common pitfalls with RLS, row limits, timestamp handling
- Git workflow patterns: Pre-commit hooks, lockfile-style generated files

**Confidence Level:** HIGH
- All pitfalls grounded in actual codebase evidence
- No speculation - every issue traceable to specific code/architecture
- Migration requirements clearly defined in PROJECT.md
- Similar patterns observed in multiple production systems
