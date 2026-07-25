# blog/articles/

These Markdown files are the canonical source of truth for articles.

## Edit directly

Create and update articles in this directory. There is no parallel article
database and no synchronization step. Published Markdown may be mirrored to R2
for retrieval, but the committed file remains canonical.

## Workflow

1. Create or edit `blog/articles/{slug}.md`.
2. Run `bun run build`.
3. Run `bun run preview` to verify locally.
4. Commit and push after review to publish through Cloudflare Pages.

See `AGENTS.md` for frontmatter, article skills, and publishing rules.
