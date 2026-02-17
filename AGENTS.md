# Agent Instructions

Guidelines for AI agents working on this repository.

## Git Operations

- **Never auto-push**: After committing changes, wait for the user to review and push manually. Only push when explicitly requested.
- **Commit often**: Small, focused commits with clear messages are preferred.
- **Use conventional commits**: `type(scope): message` format.

## Build & Deploy

- Always run `bun run fmt` after making code changes.
- Test locally with `bun run preview` before committing.
- The `pages:build` script is for Cloudflare — it doesn't run Vite.

## Content Management

### Articles

Two workflows coexist for article management:

#### DB-first workflow (existing articles, sync)

Articles managed in **Supabase** (source of truth). The markdown files in `blog/articles/` are **build artifacts** for these — do not edit them directly. Changes will be overwritten on the next sync.

**Helper functions** (`lib/article-helpers.ts`):
- `createArticle(data)` -- Create a new article in Supabase
- `updateArticle(slug, data)` -- Update an existing article
- `getArticleBySlug(slug)` -- Fetch a single article by slug

**Workflow:**
1. Use helper functions or Supabase MCP tools to create/edit articles in the database
2. Run `bun run sync` to export articles from Supabase to `blog/articles/*.md`
3. Run `bun run build` to regenerate the site
4. Run `bun run preview` to verify locally

#### File-first workflow (new articles, `/article:*` skills)

New articles are authored locally using the `/article:*` skill pipeline, then published to Supabase.

**Skills** (`.claude/commands/article/`):

| Skill | Purpose |
|-------|---------|
| `/article:new <topic>` | Create brief + draft skeleton |
| `/article:research <slug>` | Deep research via Perplexity |
| `/article:outline <slug>` | Beat-by-beat structure |
| `/article:draft <slug>` | Write the full article |
| `/article:image <slug>` | Generate cover image |
| `/article:publish <slug>` | Upsert to Supabase |
| `/article:preview <slug>` | Build + serve locally |
| `/article:status` | Show all articles and progress |
| `/article:resume <slug>` | Pick up where you left off |
| `/article:quick <topic>` | Full pipeline in one session |

**File layout:**
- `content/briefs/{slug}/` — Planning artifacts (BRIEF.md, RESEARCH.md, OUTLINE.md)
- `blog/articles/{slug}.md` — The article (status: draft until published)
- `public/images/articles/` — Generated cover images

**Lifecycle:** new → research → outline → draft → image → publish

**MCPs used:**
- Supabase (`mcp__supabase-agent__execute_sql`) — Article CRUD on `juzhkuutiuqkyuwbcivk`
- Nano Banana (`mcp__nano-banana-agent__GENERATE_IMAGE`) — Cover image generation
- Perplexity (`mcp__perplexity-ai-agent__ask`) — Research

#### Shared rules

- Articles should follow the tone in `blog/tone-of-voice.md`
- Images should follow the style in `blog/visual-style.md`
- Don't publish articles without user review
- The sync script uses SHA-256 hash comparison and only writes changed files
- A lefthook pre-commit hook warns if `blog/articles/*.md` files are manually staged

### Bookmarks

- Use the MCP tools for bookmark CRUD operations.

## Code Style

- Follow existing patterns in the codebase.
- Prefer simplicity over abstraction.
- No unnecessary dependencies.
