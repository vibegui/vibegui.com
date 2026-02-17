# blog/articles/

These markdown files are **build artifacts** synced from Supabase. They are NOT source files.

## Do not edit directly

Supabase is the source of truth for all articles. Any direct edits to these files will be **overwritten** on the next sync.

## Workflow

1. Create or edit articles in **Supabase** (via helpers or MCP tools)
2. Run `bun run sync` to export from Supabase to markdown
3. Run `bun run build` to generate the site
4. Run `bun run preview` to verify locally

## Why are these committed to git?

Cloudflare Pages builds from the repo without database access. The markdown files must be present in git for the static site generator to produce article pages.
