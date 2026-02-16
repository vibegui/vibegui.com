# Phase 2: Parser Foundation - Research

**Researched:** 2026-02-16
**Domain:** YAML frontmatter parsing, roundtrip fidelity, content schema definition
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Roundtrip fidelity rules
- Semantic equivalence is the bar -- same data, formatting can differ
- Markdown body: trimmed match (allow leading/trailing whitespace differences)
- Roundtrip validation is a permanent test in the test suite, runs on every CI build
- If gray-matter produces semantically different data for an article, fix the article (not the parser)

#### Frontmatter schema
- Define a canonical schema with required vs optional fields
- Required fields: title, slug, date, status (published/draft) at minimum -- Claude surveys existing articles and proposes the full required/optional split
- Schema is enforced at parse time -- parser throws on missing required fields
- Schema definition approach must be compatible with the blocks pattern used in anjo.chat, hypercouple, and mesh site editor plugin (researcher should investigate these projects)

#### Edge case handling
- Malformed frontmatter: best-effort recovery (parse what you can)
- Missing required fields after parse: flag for manual review (don't auto-fill defaults)
- YAML style variants (inline arrays vs block arrays): accept both on read, normalize to canonical style on write
- Date handling: Claude's discretion -- pick what avoids roundtrip issues

#### Migration behavior
- Reformat all 52 articles to canonical YAML frontmatter in one pass
- Single swap: one commit removes old parser and adds gray-matter (no gradual migration)
- Full build verification (bun run pages:build) + tests after migration
- File organization for gray-matter integration: Claude's discretion based on current file size

### Claude's Discretion
- Date parsing strategy (strings vs Date objects -- whatever avoids roundtrip issues)
- Whether to extract parser to separate module or keep in lib/articles.ts
- Exact canonical YAML formatting choices (key order, quoting style)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Summary

The phase is well-scoped and technically straightforward. gray-matter 4.0.3 is already installed in devDependencies but unused -- the codebase currently uses a 113-line custom YAML parser in `lib/articles.ts` (lines 39-113) that handles only basic key-value pairs and block arrays. All 52 articles in `blog/articles/` use an identical field set: `slug`, `title`, `description`, `date`, `status`, `coverImage`, `tags`.

The critical technical finding is that gray-matter's default YAML engine (js-yaml) parses dates like `2025-12-21` into JavaScript `Date` objects, which stringify back as `2025-12-21T00:00:00.000Z`. This breaks roundtrip fidelity. The fix is to configure gray-matter with `yaml.JSON_SCHEMA` instead of the default `yaml.DEFAULT_SCHEMA`, which preserves dates as strings. With this configuration, **all 52 articles pass roundtrip testing** (verified empirically).

The "blocks pattern" from anjo.chat, hypercouple, and mesh site editor plugin defines content schemas using **JSON Schema** stored as `.json` definition files. The project already has `zod` (3.25.76) and `zod-to-json-schema` (3.25.1) installed. The compatible approach is: define the article frontmatter schema using Zod, with the ability to export to JSON Schema via `zod-to-json-schema` when needed for CMS/blocks integration.

**Primary recommendation:** Replace the custom parser with gray-matter configured to use `yaml.JSON_SCHEMA` (dates stay as strings), define the frontmatter schema in Zod, and reformat all articles in one pass using `js-yaml.dump()` with `lineWidth: -1`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| gray-matter | 4.0.3 | Parse and stringify YAML frontmatter | Industry standard, already installed, bidirectional support |
| js-yaml | 3.14.1 | YAML engine used by gray-matter | gray-matter's built-in dependency, direct access needed for `JSON_SCHEMA` |
| zod | 3.25.76 | Define and validate frontmatter schema | Already installed, TypeScript-native, composable, can export to JSON Schema |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod-to-json-schema | 3.25.1 | Export Zod schema to JSON Schema | Already installed; use when blocks/CMS integration needs JSON Schema format |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zod for schema | JSON Schema directly | Zod gives TypeScript type inference + runtime validation; JSON Schema is the output format for blocks compatibility |
| gray-matter | `yaml` + custom parsing | gray-matter handles delimiter detection, body extraction, stringify -- no reason to rebuild |

**Installation:**
```bash
# Nothing to install -- all dependencies already in package.json
bun install  # ensures node_modules are current
```

## Architecture Patterns

### Recommended File Organization

Keep parser in `lib/articles.ts`. The file is 180 lines currently, and after replacing the custom parser (75 lines of parsing code, lines 39-113) with gray-matter calls, the file will be roughly the same size or smaller. Extracting to a separate module creates unnecessary indirection for a single-file blog parser.

```
lib/
  articles.ts          # readArticle, readAllArticles, getAllContent (existing)
                       # + schema definition (Zod)
                       # + gray-matter config (engine options)
tests/
  constraints/
    articles.test.ts   # NEW: roundtrip fidelity + schema validation
```

### Pattern 1: gray-matter with JSON_SCHEMA Engine

**What:** Configure gray-matter to use `yaml.JSON_SCHEMA` to prevent YAML's implicit type coercion (dates, booleans, octals).

**When to use:** Always. This is the only configuration that preserves dates as strings.

**Example:**
```typescript
// Source: Verified empirically against all 52 articles (2026-02-16)
import matter from "gray-matter";
import yaml from "js-yaml";

const YAML_ENGINE = {
  parse: (str: string) => yaml.load(str, { schema: yaml.JSON_SCHEMA }) as Record<string, unknown>,
  stringify: (data: Record<string, unknown>) =>
    yaml.dump(data, {
      schema: yaml.JSON_SCHEMA,
      lineWidth: -1,       // no line wrapping
      quotingType: "'",    // single quotes when needed (js-yaml default)
      forceQuotes: false,  // only quote when YAML requires it
    }),
};

const GRAY_MATTER_OPTIONS = {
  engines: { yaml: YAML_ENGINE },
};

// Parse
const { data, content } = matter(fileContent, GRAY_MATTER_OPTIONS);

// Stringify
const output = matter.stringify(content, data, GRAY_MATTER_OPTIONS);
```

### Pattern 2: Zod Schema with JSON Schema Export

**What:** Define the canonical frontmatter schema in Zod. This gives TypeScript type inference, runtime validation, and can export to JSON Schema (matching the blocks pattern from anjo.chat/hypercouple/mesh).

**When to use:** For schema definition. The blocks pattern in the related projects uses JSON Schema stored in `.json` files (e.g., `.deco/blocks/sections--Hero.json` has a `schema` field containing JSON Schema). Zod + `zod-to-json-schema` bridges TypeScript validation and the JSON Schema format.

**Example:**
```typescript
import { z } from "zod";

// Source: Field survey of all 52 articles (2026-02-16)
export const ArticleFrontmatterSchema = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),  // YYYY-MM-DD
  status: z.enum(["published", "draft"]),
  coverImage: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
});

export type ArticleFrontmatter = z.infer<typeof ArticleFrontmatterSchema>;

// Validate parsed frontmatter
function validateFrontmatter(data: Record<string, unknown>): ArticleFrontmatter {
  return ArticleFrontmatterSchema.parse(data);
}

// Export JSON Schema (for blocks pattern compatibility)
// import { zodToJsonSchema } from "zod-to-json-schema";
// const jsonSchema = zodToJsonSchema(ArticleFrontmatterSchema);
```

### Pattern 3: Canonical YAML Key Ordering

**What:** Ensure all articles have frontmatter keys in a consistent order by constructing an ordered object before stringifying.

**When to use:** During the reformat migration and in any future write operations.

**Example:**
```typescript
// Source: Matches existing article convention (all 52 articles use this order)
const CANONICAL_KEY_ORDER = ["slug", "title", "description", "date", "status", "coverImage", "tags"] as const;

function toCanonicalOrder(data: Record<string, unknown>): Record<string, unknown> {
  const ordered: Record<string, unknown> = {};
  for (const key of CANONICAL_KEY_ORDER) {
    if (key in data) ordered[key] = data[key];
  }
  // Append any unknown keys at the end (future-proofing)
  for (const key of Object.keys(data)) {
    if (!(key in ordered)) ordered[key] = data[key];
  }
  return ordered;
}
```

### Anti-Patterns to Avoid
- **Custom YAML parsing regex:** The current parser cannot handle multi-line strings, nested objects, inline arrays `[a, b]`, or quoted values containing colons. gray-matter + js-yaml handle all of these.
- **Default yaml.DEFAULT_SCHEMA:** This coerces `2025-12-21` to a Date object, breaking roundtrip. Always use `yaml.JSON_SCHEMA`.
- **Storing Date objects in frontmatter data:** Keep dates as `YYYY-MM-DD` strings throughout. The `Article` interface already uses `date: string`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML parsing | Custom line-by-line parser | gray-matter + js-yaml | Current parser fails on multi-line values, nested YAML, inline arrays |
| Frontmatter delimiter detection | Regex `---` matching | gray-matter's built-in parser | Handles edge cases: CRLF, BOM, empty frontmatter, no-body files |
| Schema validation | Manual field checking with if/else | Zod `.parse()` | Type inference, structured errors, composable, JSON Schema export |
| YAML stringification | Template literals with manual escaping | `js-yaml.dump()` | Handles quoting, escaping, null serialization, array formatting |

**Key insight:** The current custom parser is 75 lines of code that handles 60% of YAML. gray-matter + js-yaml is 0 lines of custom code that handles 100% of YAML. The migration removes fragile code.

## Common Pitfalls

### Pitfall 1: YAML Date Auto-Coercion
**What goes wrong:** `date: 2025-12-21` gets parsed as a JavaScript `Date` object by js-yaml's default schema. When stringified back, it becomes `date: 2025-12-21T00:00:00.000Z`.
**Why it happens:** YAML 1.1 spec (which js-yaml follows by default) treats bare dates as timestamp type.
**How to avoid:** Use `yaml.JSON_SCHEMA` which only recognizes strings, numbers, booleans, and null. Dates stay as strings.
**Warning signs:** Date values in parsed data are `Date` instances instead of strings; `typeof data.date === 'object'`.

### Pitfall 2: Empty Tags Array vs Null
**What goes wrong:** Articles with `tags:` (no value) parse as `tags: null`, not `tags: []`. The current custom parser returns `tags: []` for empty tags.
**Why it happens:** In YAML, a key with no value is `null`. An empty array would be `tags: []`.
**How to avoid:** The Zod schema should accept `z.array(z.string()).nullable()`. The `Article` interface uses `tags: string[]`, so the parser layer should convert `null` to `[]` after validation. Currently 6 of 52 articles have `tags: null`.
**Warning signs:** Runtime errors from calling `.map()` or `.filter()` on null tags.

### Pitfall 3: Line Wrapping in Stringified YAML
**What goes wrong:** js-yaml's default `lineWidth` is 80 characters. Long descriptions get wrapped with `>-` (folded block scalar), creating multi-line YAML that looks different from the original single-line format.
**Why it happens:** js-yaml default configuration.
**How to avoid:** Set `lineWidth: -1` to disable line wrapping entirely.
**Warning signs:** Descriptions appearing as multi-line `>-` blocks in stringified output.

### Pitfall 4: Quoting Style Changes on Roundtrip
**What goes wrong:** `title: "Hello World"` (double-quoted in source) becomes `title: Hello World` (unquoted in output) or `title: 'Hello: World'` (single-quoted because of colon).
**Why it happens:** js-yaml normalizes quoting -- it only quotes when the YAML spec requires it.
**How to avoid:** This is expected behavior and matches the "semantic equivalence" bar. The roundtrip test should compare parsed data objects, not raw YAML strings. Accept that formatting will normalize on first reformat pass.
**Warning signs:** Git diffs showing quote changes on the reformat commit -- this is normal and expected.

### Pitfall 5: gray-matter Adds Trailing Newline
**What goes wrong:** `matter.stringify()` always ensures the output ends with `\n`. Content comparison may fail if using strict equality on raw strings.
**Why it happens:** gray-matter's `newline()` helper appends `\n` if not present.
**How to avoid:** Use `.trim()` on both sides of content comparison in roundtrip tests (already specified in user constraints: "Markdown body: trimmed match").
**Warning signs:** Content comparison failing due to trailing whitespace differences.

## Code Examples

### Complete Parser Module (Recommended Implementation)

```typescript
// Source: Verified against all 52 articles with roundtrip testing (2026-02-16)
import matter from "gray-matter";
import yaml from "js-yaml";
import { z } from "zod";

// -- Schema Definition --

export const ArticleFrontmatterSchema = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["published", "draft"]),
  coverImage: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
});

export type ArticleFrontmatter = z.infer<typeof ArticleFrontmatterSchema>;

// -- gray-matter Configuration --

const YAML_ENGINE = {
  parse: (str: string) =>
    yaml.load(str, { schema: yaml.JSON_SCHEMA }) as Record<string, unknown>,
  stringify: (data: Record<string, unknown>) =>
    yaml.dump(data, {
      schema: yaml.JSON_SCHEMA,
      lineWidth: -1,
    }),
};

export const GRAY_MATTER_OPTIONS = {
  engines: { yaml: YAML_ENGINE },
};

// -- Parse --

export function parseArticle(fileContent: string): {
  frontmatter: ArticleFrontmatter;
  content: string;
} {
  const { data, content } = matter(fileContent, GRAY_MATTER_OPTIONS);
  const frontmatter = ArticleFrontmatterSchema.parse(data);
  return { frontmatter, content };
}

// -- Stringify --

const CANONICAL_KEY_ORDER = [
  "slug", "title", "description", "date", "status", "coverImage", "tags"
] as const;

function toCanonicalOrder(data: Record<string, unknown>): Record<string, unknown> {
  const ordered: Record<string, unknown> = {};
  for (const key of CANONICAL_KEY_ORDER) {
    if (key in data) ordered[key] = data[key];
  }
  for (const key of Object.keys(data)) {
    if (!(key in ordered)) ordered[key] = data[key];
  }
  return ordered;
}

export function stringifyArticle(
  frontmatter: ArticleFrontmatter,
  content: string,
): string {
  const ordered = toCanonicalOrder(frontmatter as unknown as Record<string, unknown>);
  return matter.stringify(content, ordered, GRAY_MATTER_OPTIONS);
}
```

### Roundtrip Test (Permanent CI Test)

```typescript
// Source: Pattern verified against all 52 articles (2026-02-16)
import { describe, test, expect } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { GRAY_MATTER_OPTIONS, ArticleFrontmatterSchema } from "../../lib/articles";

const ARTICLES_DIR = join(import.meta.dir, "../../blog/articles");

describe("Article Roundtrip Fidelity", () => {
  const files = readdirSync(ARTICLES_DIR).filter((f) => f.endsWith(".md"));

  test("all articles exist", () => {
    expect(files.length).toBeGreaterThanOrEqual(52);
  });

  for (const file of files) {
    test(`roundtrip: ${file}`, () => {
      const content = readFileSync(join(ARTICLES_DIR, file), "utf-8");

      // Parse
      const parsed = matter(content, GRAY_MATTER_OPTIONS);

      // Stringify
      const output = matter.stringify(parsed.content, parsed.data, GRAY_MATTER_OPTIONS);

      // Re-parse
      const reparsed = matter(output, GRAY_MATTER_OPTIONS);

      // Semantic equivalence: data objects match
      expect(reparsed.data).toEqual(parsed.data);

      // Trimmed content match
      expect(reparsed.content.trim()).toEqual(parsed.content.trim());
    });

    test(`schema valid: ${file}`, () => {
      const content = readFileSync(join(ARTICLES_DIR, file), "utf-8");
      const parsed = matter(content, GRAY_MATTER_OPTIONS);

      const result = ArticleFrontmatterSchema.safeParse(parsed.data);
      if (!result.success) {
        throw new Error(
          `${file}: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`
        );
      }
    });
  }
});
```

### Migration Script (One-Pass Reformat)

```typescript
// Source: Approach verified with roundtrip testing (2026-02-16)
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
// import { GRAY_MATTER_OPTIONS, toCanonicalOrder } from "../lib/articles";

const ARTICLES_DIR = "blog/articles";
const files = readdirSync(ARTICLES_DIR).filter((f) => f.endsWith(".md"));

for (const file of files) {
  const filepath = join(ARTICLES_DIR, file);
  const content = readFileSync(filepath, "utf-8");

  const parsed = matter(content, GRAY_MATTER_OPTIONS);
  const ordered = toCanonicalOrder(parsed.data);
  const output = matter.stringify(parsed.content, ordered, GRAY_MATTER_OPTIONS);

  writeFileSync(filepath, output);
  console.log(`Reformatted: ${file}`);
}
```

## Frontmatter Field Survey

Survey conducted 2026-02-16 against all 52 articles in `blog/articles/`:

| Field | Present In | Types | Required? | Notes |
|-------|-----------|-------|-----------|-------|
| slug | 52/52 | string | YES | Always present, no empty values |
| title | 52/52 | string | YES | Always present, no empty values |
| description | 52/52 | string | YES | Present in all; 3 articles have empty string `""` |
| date | 52/52 | string | YES | Always `YYYY-MM-DD` format |
| status | 52/52 | string | YES | Values: `"published"` or `"draft"` only |
| coverImage | 52/52 | string or null | YES | 51 articles have `null`; 1 has a path string |
| tags | 52/52 | array or null | YES | 46 have string arrays; 6 have `null` (empty `tags:` in YAML) |

**Proposed schema:** All 7 fields are required (present in 100% of articles). The nullable types (`coverImage`, `tags`) are handled at the type level -- `null` is a valid value, but the key must exist.

## Blocks Pattern Compatibility

### How the Related Projects Define Schemas

All three projects (anjo.chat, hypercouple, mesh site editor plugin) use the same pattern:

1. **Schema format:** JSON Schema (Draft 7 style)
2. **Storage:** `.deco/blocks/{id}.json` files with a `schema` field
3. **Runtime validation:** Zod in tool definitions (mesh plugin uses `z.object()` in tool `inputSchema`)
4. **Type extraction:** `ts-morph` scans TypeScript component props, generates JSON Schema

**Key type from mesh plugin** (`packages/mesh-plugin-site-editor/server/scanner/types.ts`):
```typescript
interface BlockDefinition {
  id: string;
  schema: JSONSchema7;      // JSON Schema for props
  defaults: Record<string, unknown>;
  // ...
}
```

### Compatible Approach for vibegui.com

Define frontmatter schema in Zod (TypeScript-native validation), with the option to export as JSON Schema via the already-installed `zod-to-json-schema`:

```typescript
import { zodToJsonSchema } from "zod-to-json-schema";
const jsonSchema = zodToJsonSchema(ArticleFrontmatterSchema);
// Produces JSON Schema 7 compatible with BlockDefinition.schema
```

This means: if vibegui.com later adopts the blocks/CMS pattern (e.g., pages defined as block arrays, content managed through mesh plugin), the article frontmatter schema is already in a compatible format. No rework needed.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom regex/line-by-line YAML | gray-matter + js-yaml | gray-matter stable since 2018 | Correct parsing of all YAML features |
| No schema validation | Zod runtime validation | Zod 3.x (2022+) | Type-safe validation with structured errors |
| JSON Schema hand-written | Zod -> JSON Schema | zod-to-json-schema 3.x | Single source of truth for types + validation + schema |

**gray-matter status:** Version 4.0.3, last published 2018. Stable, no breaking changes expected. Uses js-yaml 3.x internally (js-yaml 4.x exists but is not used by gray-matter). This is fine -- js-yaml 3.x handles all YAML 1.1 features we need.

## Discretion Recommendations

### Date Parsing Strategy: Keep as Strings
**Recommendation:** Use `yaml.JSON_SCHEMA` to keep dates as `YYYY-MM-DD` strings.
**Rationale:** Empirically verified: all 52 articles pass roundtrip with this approach. Date objects cause roundtrip failures (`2025-12-21` becomes `2025-12-21T00:00:00.000Z`). The existing `Article` interface already types `date` as `string`. No code changes needed downstream.
**Confidence:** HIGH -- tested against all articles.

### File Organization: Keep in lib/articles.ts
**Recommendation:** Keep the parser, schema, and gray-matter config in `lib/articles.ts`.
**Rationale:** The file is 180 lines. After removing the 75-line custom parser and adding gray-matter config + Zod schema (~40 lines), the file will be ~145 lines. This is well within a single-module size. The file already exports `readArticle`, `readAllArticles`, `getAllContent` -- adding schema exports is natural.
**Confidence:** HIGH -- file size is manageable.

### Canonical YAML Formatting
**Recommendation:**
- **Key order:** `slug, title, description, date, status, coverImage, tags` (matches existing convention in all 52 articles)
- **Quoting:** Let js-yaml decide (quotes only when YAML spec requires it -- e.g., values containing colons)
- **Line width:** `-1` (no wrapping -- single-line values stay single-line)
- **Arrays:** Block style (each item on its own line with `- ` prefix) -- this is js-yaml's default
- **Null values:** Literal `null` keyword

**Rationale:** This produces output almost identical to the existing articles. Minimal diff on the reformat commit.
**Confidence:** HIGH -- verified with stringify testing.

## Open Questions

1. **Empty tags normalization**
   - What we know: 6 articles have `tags:` with no value, which parses as `null`. The `Article` interface types tags as `string[]`.
   - What's unclear: Should the reformat migration normalize these to `tags: []` or keep as `tags: null`?
   - Recommendation: Normalize to `tags: []` during the reformat pass. This makes the data consistent and avoids null-checking downstream. Update the Zod schema to `z.array(z.string()).default([])` with a `.transform()` or handle at the parser layer with `?? []`.

2. **Description empty strings**
   - What we know: 3 articles have `description: ""`. This is valid but may indicate incomplete articles.
   - What's unclear: Should these be flagged?
   - Recommendation: Allow empty strings in schema (they are valid). Don't flag -- these are likely drafts.

## Sources

### Primary (HIGH confidence)
- **gray-matter 4.0.3** -- README.md and TypeScript types in `node_modules/gray-matter/` (read directly)
- **js-yaml** -- `node_modules/gray-matter/node_modules/js-yaml/` (stringify.js, schema inspection)
- **All 52 articles** -- Direct field survey and roundtrip testing against `blog/articles/*.md`
- **lib/articles.ts** -- Current custom parser analysis (180 lines, lines 39-113 are the parser)
- **mesh site editor plugin** -- `packages/mesh-plugin-site-editor/server/scanner/types.ts` (BlockDefinition, JSONSchema7)
- **anjo.chat** -- `.deco/blocks/*.json` and `.deco/pages/*.json` (blocks pattern with JSON Schema)
- **hypercouple** -- `.deco/blocks/sections--TechStack.json` (same blocks pattern)

### Secondary (MEDIUM confidence)
- **gray-matter README** on GitHub -- Confirms API surface, stringify support, engine customization
- **zod-to-json-schema** -- Already installed (3.25.1), produces JSON Schema 7 from Zod schemas

### Tertiary (LOW confidence)
- None -- all findings verified against actual code and empirical testing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and verified working
- Architecture: HIGH -- patterns verified empirically against all 52 articles
- Pitfalls: HIGH -- date coercion issue discovered and solution verified; all edge cases tested
- Blocks compatibility: HIGH -- read actual block definitions from all three referenced projects

**Research date:** 2026-02-16
**Valid until:** 2026-04-16 (stable libraries, no version-sensitive findings)
