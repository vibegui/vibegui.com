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

### Articles (DB-first workflow)

Articles are managed in **Supabase** (source of truth). The markdown files in `blog/articles/` are **build artifacts** -- do not edit them directly. Changes will be overwritten on the next sync.

**Helper functions** (`lib/article-helpers.ts`):
- `createArticle(data)` -- Create a new article in Supabase
- `updateArticle(slug, data)` -- Update an existing article
- `getArticleBySlug(slug)` -- Fetch a single article by slug

**Workflow:**
1. Use helper functions or Supabase MCP tools to create/edit articles in the database
2. Run `bun run sync` to export articles from Supabase to `blog/articles/*.md`
3. Run `bun run build` to regenerate the site
4. Run `bun run preview` to verify locally

**Important:**
- Articles should follow the tone in `context/GUILHERME_TONE_OF_VOICE.md`
- Don't publish articles without user review
- The sync script uses SHA-256 hash comparison and only writes changed files
- A lefthook pre-commit hook warns if `blog/articles/*.md` files are manually staged

### Bookmarks

- Use the MCP tools for bookmark CRUD operations.

## Code Style

- Follow existing patterns in the codebase.
- Prefer simplicity over abstraction.
- No unnecessary dependencies.
