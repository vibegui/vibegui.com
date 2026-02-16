# Phase 5: Integration & Verification - Research

**Researched:** 2026-02-16
**Domain:** Pre-commit hooks, MCP helper functions, E2E pipeline verification
**Confidence:** HIGH

## Summary

This phase ties together four completed phases into a verified, enforced pipeline. It has three distinct workstreams: (1) direction enforcement via a lefthook pre-commit warning and documentation updates, (2) AI agent integration via TypeScript helper functions for article CRUD with audit trail, and (3) end-to-end pipeline verification proving the full Supabase-to-dist flow works.

All building blocks exist. The `sync-articles.ts` script (Phase 4) exports Supabase to markdown. The `generate.ts` script reads markdown and produces SSG HTML + manifest. The `build.ts` orchestrator chains generate + vite build + finalize. The `preview-server.ts` serves the dist directory with SSG support. What remains is adding the enforcement layer, agent helpers, and proving it all works together.

**Primary recommendation:** Implement as three focused tasks: (1) lefthook warning command + docs update, (2) `lib/article-helpers.ts` with createArticle/updateArticle/getArticleBySlug using the established Supabase service-role pattern, (3) E2E pipeline test script that runs sync -> generate -> build -> preview and verifies articles render.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ENFC-01 | Pre-commit hook warns when markdown files in `blog/articles/` are edited directly | Lefthook `glob` filter on `blog/articles/*.md` with `{staged_files}`; script exits 0 (warn, not block) |
| ENFC-02 | Documentation states markdown files are build artifacts, not to be edited directly | Update README.md, AGENTS.md, and add notice to `blog/articles/` |
| AINT-01 | MCP helper functions for createArticle, updateArticle, getArticleBySlug | New `lib/article-helpers.ts` using `@supabase/supabase-js` service-role pattern from `import-articles.ts` |
| AINT-02 | Audit trail (created_by, updated_by) populated on all DB writes | DB schema already has `created_by`/`updated_by` columns with defaults; helpers must set them explicitly |
| E2EV-01 | Full pipeline works: Supabase -> sync -> generate -> build -> dist | Chain: `bun run sync && bun run build` then verify dist/article/*/index.html exists |
| E2EV-02 | Local preview (`bun run preview`) serves articles correctly | Preview server already exists at port 4002; verify HTTP 200 for known article slugs |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.89.0 | Article CRUD operations in helper functions | Already in `dependencies`; service-role pattern proven in `import-articles.ts` and `sync-articles.ts` |
| `lefthook` | ^1.10.10 | Pre-commit hook for direction enforcement | Already configured in `lefthook.yml` with 7 existing commands |
| `zod` | ^3.25.76 | Input validation for article helper functions | Already in `devDependencies`; `ArticleFrontmatterSchema` exists in `lib/articles.ts` |
| `@playwright/test` | ^1.49.1 | E2E verification of article pages in dist | Already configured with preview-server webServer |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:crypto` | (built-in) | SHA-256 hashing if needed in helpers | Only if helper functions need hash comparison |
| `node:child_process` | (built-in) | Pipeline orchestration in verification | Only for E2E pipeline test script |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Lefthook warning command | Git hook script directly | Lefthook is already managing hooks; adding custom .git/hooks would conflict |
| TypeScript helper functions | MCP Server with `@modelcontextprotocol/sdk` | Over-engineered; the SDK is in optionalDependencies but agents can call helpers directly or via Supabase MCP. Simple functions are sufficient for AINT-01 |
| Playwright for E2E verification | curl + shell script | Playwright already has webServer config that spins up preview-server; reuse existing infrastructure |

**Installation:**
No new packages needed. All dependencies already exist in `package.json`.

## Architecture Patterns

### Recommended File Structure
```
lib/
  articles.ts              # Existing: parse/stringify/schema
  article-helpers.ts       # NEW: createArticle, updateArticle, getArticleBySlug
blog/articles/
  README.md                # NEW: "These files are build artifacts" notice
scripts/
  sync-articles.ts         # Existing: DB -> markdown
  generate.ts              # Existing: markdown -> SSG HTML
  build.ts                 # Existing: orchestrator
  preview-server.ts        # Existing: serves dist/
lefthook.yml               # MODIFIED: add warning command
README.md                  # MODIFIED: document DB-first workflow
AGENTS.md                  # MODIFIED: document helper functions
tests/e2e/
  pipeline.spec.ts         # NEW: E2E pipeline verification test
```

### Pattern 1: Lefthook Warning Command (Non-Blocking)
**What:** A lefthook pre-commit command that detects staged `blog/articles/*.md` files and prints a warning, but exits 0 so it does NOT block the commit. This is because the build pipeline itself stages article files (step `5_stage` in lefthook.yml already stages `blog/articles/`), so the hook must distinguish between "human edited article directly" and "build regenerated articles."
**When to use:** ENFC-01 requirement.

**Critical insight:** The existing lefthook pipeline already runs `bun run build` (step 4) and then `git add blog/articles/` (step 5). This means article markdown files will ALWAYS be in the staged set by the time later hooks run. The warning must therefore run BEFORE the build step to catch manually-edited articles that were staged by the developer, not by the build.

**Example:**
```yaml
# In lefthook.yml, as the FIRST command (before format/lint/build)
pre-commit:
  commands:
    0_warn_articles:
      glob: "blog/articles/*.md"
      run: |
        echo ""
        echo "WARNING: You are committing changes to blog/articles/*.md"
        echo "These files are build artifacts synced from Supabase."
        echo "If you edited them directly, your changes will be overwritten on next sync."
        echo "Edit articles in Supabase instead, then run: bun run sync"
        echo ""
      # No fail_text - command always succeeds (exit 0)
```

**Why this works:** Lefthook's `glob` filter means this command only runs when `blog/articles/*.md` files are staged. Since it runs before the build step, it only triggers if the developer manually staged article files. The build step will re-stage them later, but by then the warning has already been shown.

**Alternative approach (simpler):** Since the existing pipeline always regenerates and stages articles, a simpler approach is a shell script that checks if articles were in the ORIGINAL staged set (before the pipeline ran). This can be done by checking `git diff --cached --name-only` at the start.

### Pattern 2: Article Helper Functions (Service-Role CRUD)
**What:** Standalone TypeScript functions for article CRUD that AI agents can import and call.
**When to use:** AINT-01 and AINT-02 requirements.

**Design decision: Helper functions, not MCP server.** The requirement says "MCP helper functions" but the architecture does not need a standalone MCP server. The existing setup uses Supabase MCP (via Mesh gateway in vite.config.ts) for database operations. What is needed are simple TypeScript functions that:
1. Can be imported by scripts or agents
2. Handle tag management (the delete + re-insert pattern from `import-articles.ts`)
3. Always populate `created_by` and `updated_by` audit columns

**Example:**
```typescript
// lib/article-helpers.ts
import { createClient } from "@supabase/supabase-js";
import { type ArticleFrontmatter, ArticleFrontmatterSchema } from "./articles";

interface CreateArticleInput {
  slug: string;
  title: string;
  description: string;
  content: string;
  date: string;
  status?: "draft" | "published";
  coverImage?: string | null;
  tags?: string[];
  createdBy: string;  // Required: who is creating this
}

interface UpdateArticleInput {
  title?: string;
  description?: string;
  content?: string;
  date?: string;
  status?: "draft" | "published";
  coverImage?: string | null;
  tags?: string[];
  updatedBy: string;  // Required: who is updating this
}

// Create Supabase client (reuse loadEnv pattern from sync/import scripts)
function getServiceClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY required");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function createArticle(input: CreateArticleInput) {
  const supabase = getServiceClient();
  const { tags, createdBy, ...articleData } = input;

  // Upsert article
  const { data, error } = await supabase
    .from("articles")
    .insert({
      ...articleData,
      cover_image: articleData.coverImage,
      created_by: createdBy,
      updated_by: createdBy,
    })
    .select("id, slug")
    .single();

  if (error) throw new Error(`Create failed: ${error.message}`);

  // Handle tags (same pattern as import-articles.ts)
  if (tags && tags.length > 0) {
    await upsertTags(supabase, data.id, tags);
  }

  return data;
}

export async function updateArticle(slug: string, input: UpdateArticleInput) {
  const supabase = getServiceClient();
  const { tags, updatedBy, ...updates } = input;

  const updateRow: Record<string, unknown> = { updated_by: updatedBy };
  if (updates.title !== undefined) updateRow.title = updates.title;
  if (updates.description !== undefined) updateRow.description = updates.description;
  if (updates.content !== undefined) updateRow.content = updates.content;
  if (updates.date !== undefined) updateRow.date = updates.date;
  if (updates.status !== undefined) updateRow.status = updates.status;
  if (updates.coverImage !== undefined) updateRow.cover_image = updates.coverImage;

  const { data, error } = await supabase
    .from("articles")
    .update(updateRow)
    .eq("slug", slug)
    .select("id, slug")
    .single();

  if (error) throw new Error(`Update failed: ${error.message}`);

  if (tags !== undefined) {
    await upsertTags(supabase, data.id, tags);
  }

  return data;
}

export async function getArticleBySlug(slug: string) {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("articles")
    .select("*, article_tags(tags(name))")
    .eq("slug", slug)
    .single();

  if (error) throw new Error(`Fetch failed: ${error.message}`);
  return data;
}
```

### Pattern 3: E2E Pipeline Verification
**What:** A test or script that runs the full pipeline: sync -> generate -> build -> verify dist output -> serve and check HTTP responses.
**When to use:** E2EV-01 and E2EV-02 requirements.

**Approach:** Add a Playwright test that relies on the existing webServer config (which runs `bun scripts/preview-server.ts`). The test verifies articles from the dist directory load correctly. The build must be run before the test (the existing pre-commit pipeline already does `bun run build` before `bun run test:e2e`).

**For E2EV-01 (pipeline works):** This is verified by the existing pre-commit pipeline: sync -> build -> test. Can also be a standalone script: `bun run sync && bun run build && bun run preview:build`.

**For E2EV-02 (preview serves articles):** Extend the existing `tests/e2e/content.spec.ts` or add a new spec that verifies multiple article pages return HTTP 200 with actual content.

### Anti-Patterns to Avoid
- **Building an MCP server for article CRUD:** Over-engineered. Simple exported functions are sufficient. Agents already have Supabase MCP access.
- **Making the pre-commit hook block on article changes:** The build pipeline itself stages articles. Blocking would break the normal commit flow.
- **Testing the pipeline by modifying Supabase data in tests:** E2E tests should verify what is already built, not modify the database. The sync/build is a pre-condition, not part of the test.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pre-commit file detection | Custom .git/hooks/pre-commit | Lefthook `glob` filter + `{staged_files}` | Lefthook already manages hooks; custom hooks conflict |
| Supabase client setup | Custom fetch wrapper | `@supabase/supabase-js` service-role client | Handles auth, RLS bypass, type inference |
| Tag management | Custom SQL | Delete + re-insert pattern from `import-articles.ts` | Proven pattern, handles all edge cases |
| Article validation | Custom field checks | Zod `ArticleFrontmatterSchema` | Already exists, enforces types at boundaries |
| E2E article serving | Custom test server | Playwright `webServer` + `preview-server.ts` | Already configured and working |

**Key insight:** Every infrastructure piece needed for this phase already exists in the codebase. The work is wiring them together and adding the thin enforcement/helper layers.

## Common Pitfalls

### Pitfall 1: Pre-commit Warning Runs After Build (False Positives)
**What goes wrong:** If the warning hook runs after `4_build` and `5_stage`, it will ALWAYS trigger because the build pipeline stages `blog/articles/`. Every commit would show the warning.
**Why it happens:** Lefthook commands run in order. The existing pipeline stages article files as part of the build.
**How to avoid:** Place the warning command as `0_warn_articles` -- before all other commands. At that point, only manually-staged articles are in the staged set.
**Warning signs:** Warning message appearing on every commit, not just when articles are manually edited.

### Pitfall 2: Audit Columns Not Set on Helper Functions
**What goes wrong:** If helper functions don't explicitly set `created_by`/`updated_by`, they default to `'unknown'` (from the DB schema default).
**Why it happens:** The DB has `DEFAULT 'unknown'` on these columns. Easy to forget to pass the value.
**How to avoid:** Make `createdBy`/`updatedBy` required parameters (not optional) in the helper function signatures. TypeScript will enforce this at compile time.
**Warning signs:** Audit columns showing `'unknown'` for agent-created articles.

### Pitfall 3: Tag Management Race Condition
**What goes wrong:** If `createArticle` is called concurrently for articles with overlapping tags, the `tags` table upsert could conflict.
**Why it happens:** Multiple concurrent inserts of the same tag name.
**How to avoid:** Use `ON CONFLICT (name) DO NOTHING` for tag upserts (already done in `import-articles.ts` pattern). This is idempotent.
**Warning signs:** "unique constraint violation" errors on the `tags` table.

### Pitfall 4: E2E Test Assumes Specific Articles Exist
**What goes wrong:** If the test hardcodes article slugs that don't exist in the database, sync produces no matching files.
**Why it happens:** Test data assumptions change when articles are added/removed.
**How to avoid:** Either use a known stable article (like `hello-world-building-an-mcp-native-blog` which is already in E2E tests) or dynamically read the manifest to pick an article.
**Warning signs:** E2E tests failing with 404 or "Article not found" on CI.

### Pitfall 5: Preview Server Port Conflict
**What goes wrong:** The preview server defaults to port 4002, but if another process uses it, tests fail silently.
**Why it happens:** Port 4002 hardcoded in `playwright.config.ts` and `preview-server.ts`.
**How to avoid:** Playwright config already has `reuseExistingServer: false` which should fail fast if port is taken. Ensure no dev server is running during E2E tests.
**Warning signs:** "EADDRINUSE" errors or tests hanging.

## Code Examples

### Lefthook Warning Configuration
```yaml
# Source: Lefthook docs (https://lefthook.dev/configuration/run.html)
# Add as FIRST command in pre-commit (before format/lint/build)
pre-commit:
  parallel: false
  piped: true
  commands:
    0_warn_articles:
      glob: "blog/articles/*.md"
      run: |
        echo ""
        echo "WARNING: blog/articles/*.md files are staged."
        echo "These are build artifacts synced from Supabase."
        echo "Direct edits will be overwritten on next sync."
        echo "Edit in Supabase, then: bun run sync"
        echo ""

    1_format:
      # ... existing commands
```

### Article Helper - Tag Upsert Pattern
```typescript
// Source: Verified pattern from scripts/import-articles.ts (lines 123-158)
async function upsertTags(
  supabase: ReturnType<typeof createClient>,
  articleId: number,
  tags: string[]
): Promise<void> {
  // Delete existing tag associations
  const { error: deleteError } = await supabase
    .from("article_tags")
    .delete()
    .eq("article_id", articleId);
  if (deleteError) throw new Error(`Tag delete failed: ${deleteError.message}`);

  if (tags.length === 0) return;

  // Upsert tag names
  const { error: tagError } = await supabase
    .from("tags")
    .upsert(tags.map(name => ({ name })), { onConflict: "name" });
  if (tagError) throw new Error(`Tag upsert failed: ${tagError.message}`);

  // Fetch tag IDs
  const { data: tagData, error: fetchError } = await supabase
    .from("tags")
    .select("id, name")
    .in("name", tags);
  if (fetchError) throw new Error(`Tag fetch failed: ${fetchError.message}`);

  // Insert junction rows
  const junctionRows = (tagData || []).map(tag => ({
    article_id: articleId,
    tag_id: tag.id,
  }));
  if (junctionRows.length > 0) {
    const { error: junctionError } = await supabase
      .from("article_tags")
      .insert(junctionRows);
    if (junctionError) throw new Error(`Junction insert failed: ${junctionError.message}`);
  }
}
```

### E2E Pipeline Verification Test
```typescript
// Source: Pattern from existing tests/e2e/content.spec.ts
import { test, expect } from "@playwright/test";

test.describe("E2E Pipeline Verification", () => {
  test("article pages are served from built dist (E2EV-02)", async ({ page }) => {
    // Use a known article that exists in Supabase
    const response = await page.goto("/article/hello-world-building-an-mcp-native-blog");
    expect(response?.status()).toBe(200);

    // Should have article content, not SPA fallback with missing data
    await expect(page.locator("article")).toBeVisible();
    await expect(page.locator("text=Article not found")).not.toBeVisible();
  });

  test("content index shows articles from manifest (E2EV-01)", async ({ page }) => {
    await page.goto("/content");
    await page.waitForLoadState("domcontentloaded");

    // Manifest should have articles (proves generate.ts ran successfully)
    const articles = page.locator("[data-testid='article-card'], a[href*='/article/']");
    const count = await articles.count();
    expect(count).toBeGreaterThan(0);
  });
});
```

### Documentation Notice for blog/articles/
```markdown
# blog/articles/

> **These files are build artifacts. Do not edit directly.**
>
> Articles are managed in Supabase (source of truth).
> These markdown files are generated by `bun run sync`.
> Any manual edits will be overwritten on the next sync.
>
> To create or edit articles:
> 1. Edit in Supabase (via Supabase Studio or MCP helpers)
> 2. Run `bun run sync` to export to markdown
> 3. Run `bun run build` to generate the site
> 4. Run `bun run preview` to verify locally
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct markdown editing | Supabase-first with sync | Phase 3-4 | Markdown files are now outputs, not inputs |
| No audit trail | `created_by`/`updated_by` columns | Phase 3 | Every write is attributed to a source |
| No enforcement | Pre-commit warning + docs | This phase | Developers warned when editing artifacts |
| Manual pipeline steps | `bun run sync && bun run build` | Phase 4 + this phase | Full pipeline is a single command chain |

**Deprecated/outdated:**
- Direct article editing in `blog/articles/*.md`: These are now generated artifacts. The pre-commit hook warns about this.
- The `import-articles.ts` script: Still exists for initial migration but is superseded by the helper functions for ongoing CRUD.

## Open Questions

1. **Should helper functions load .env themselves or expect env vars to be set?**
   - What we know: `sync-articles.ts` and `import-articles.ts` both have their own `loadEnv()`. Duplicating this in helpers is messy.
   - What's unclear: Whether to extract `loadEnv()` to a shared utility or have callers set env vars.
   - Recommendation: Extract `loadEnv()` to a small shared module (e.g., `lib/env.ts`) or have the helper accept a Supabase client as parameter. The latter is more testable. LOW risk either way.

2. **Should the E2E pipeline test run `bun run sync` as part of the test?**
   - What we know: Sync requires Supabase credentials. E2E tests run in pre-commit and CI.
   - What's unclear: Whether CI has Supabase credentials available.
   - Recommendation: Do NOT run sync in E2E tests. The pipeline test verifies what is already built. Sync is a separate manual/CI step. The pre-commit pipeline already runs `build` which exercises generate + vite build.

3. **How should the warning hook handle the build pipeline's own article staging?**
   - What we know: Step `5_stage` in lefthook.yml runs `git add blog/articles/`. The warning hook needs to fire only for manually-staged articles.
   - What's unclear: Whether lefthook re-evaluates `glob` matches after each step.
   - Recommendation: Place warning as step 0 (before build). At that point, only manually-staged files are in the index. After step 5, newly-staged files are there but the warning already ran. Verified: lefthook evaluates `glob` once per command at the time it runs.

## Sources

### Primary (HIGH confidence)
- `lefthook.yml` -- Existing 7-command pre-commit pipeline with piped execution
- `scripts/sync-articles.ts` -- Verified sync script with loadEnv, Supabase client, hash diffing (226 lines)
- `scripts/import-articles.ts` -- Verified import script with tag management pattern (201 lines)
- `scripts/generate.ts` -- Verified content generation from markdown to SSG HTML (318 lines)
- `scripts/build.ts` -- Verified build orchestrator: generate -> vite build -> finalize (131 lines)
- `scripts/preview-server.ts` -- Verified static file server with SSG support on port 4002 (89 lines)
- `lib/articles.ts` -- Verified ArticleFrontmatter type, stringifyArticle, Zod schema (173 lines)
- `supabase/migrations/20260216202024_create_articles_schema.sql` -- Verified `created_by`/`updated_by` columns with DEFAULT 'unknown'
- `supabase/migrations/20260216202203_create_triggers_and_rls.sql` -- Verified RLS policies, triggers, service role bypass
- `tests/e2e/content.spec.ts` -- Verified existing E2E tests for article pages
- `playwright.config.ts` -- Verified webServer config using preview-server on port 4002
- `package.json` -- Verified scripts: sync, build, preview, test:e2e

### Secondary (MEDIUM confidence)
- [Lefthook run configuration](https://lefthook.dev/configuration/run.html) -- `glob`, `{staged_files}`, command ordering
- [Lefthook GitHub](https://github.com/evilmartians/lefthook) -- General hook manager behavior

### Tertiary (LOW confidence)
- None -- all findings verified against codebase or official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All libraries already in use; zero new dependencies
- Architecture: HIGH -- All patterns derived from existing codebase code; no novel patterns needed
- Pitfalls: HIGH -- Derived from direct inspection of lefthook.yml pipeline ordering and DB schema
- Direction enforcement: HIGH -- Lefthook glob + command ordering verified against existing config
- MCP helpers: HIGH -- Tag management pattern copied from working import-articles.ts
- E2E verification: HIGH -- Existing Playwright + preview-server infrastructure fully verified

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable domain, all infrastructure already in place)
