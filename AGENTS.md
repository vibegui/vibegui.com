# Agent Instructions

Guidelines for AI agents working on this repository.

## Git Operations

- **Ship finished work**: Once the user is satisfied and all checks pass, do not leave commits only local. Default to a feature branch → push → PR → merge into `main`. If the work is already committed on `main` and the user explicitly approves shipping it, push `main` directly. `/article:publish` remains authorized to commit and push as part of the publish action.
- **Never force-push `main`**.
- **Commit often**: Small, focused commits with clear messages are preferred.
- **Use conventional commits**: `type(scope): message` format.

## Build & Deploy

- Always run `bun run fmt` after making code changes.
- Test locally with `bun run preview` before committing.
- The `pages:build` script is for Cloudflare — it doesn't run Vite.
- Cloudflare Pages runs `pages` mode, which does **not** generate OG images. Commit `public/images/og/` (PNG + `manifest.json`) before a published article can deploy. Local `bun run build` / `bun run og:generate` writes those files; leave them uncommitted and Pages fails with `Missing OG image for …`.

## Content Management

### Articles

Markdown files in `blog/articles/` are the source of truth. Committing the file publishes the article — there is no parallel database, no sync step.

**Before publishing** (`status: published`):
1. Run `bun run og:generate` (or a full `bun run build`).
2. Stage `public/images/og/manifest.json` and the new `public/images/og/{en,pt}/{slug}.*.png` files alongside the article.
3. Cover images under `public/images/articles/` must also be committed if referenced.

**Skills** (`.claude/commands/article/`):

| Skill | Purpose |
|-------|---------|
| `/article:new <topic>` | Create brief + draft skeleton |
| `/article:research <slug>` | Deep research via Perplexity |
| `/article:outline <slug>` | Beat-by-beat structure |
| `/article:draft <slug>` | Write the full article |
| `/article:image <slug>` | Generate cover image |
| `/article:publish <slug>` | Flip frontmatter to published, commit, push |
| `/article:preview <slug>` | Build + serve locally |
| `/article:status` | Show all articles and progress |
| `/article:resume <slug>` | Pick up where you left off |
| `/article:quick <topic>` | Full pipeline in one session |

**File layout:**
- `content/briefs/{slug}/` — Planning artifacts (BRIEF.md, RESEARCH.md, OUTLINE.md)
- `blog/articles/{slug}.md` — The article (status: draft until published)
- `public/images/articles/` — Generated cover images
- `public/images/og/` — Social OG cards + `manifest.json` (required in git for published articles)

**Lifecycle:** new → research → outline → draft → image → publish

**MCPs used:**
- Nano Banana (`mcp__nano-banana-agent__GENERATE_IMAGE`) — Cover image generation
- Perplexity (`mcp__perplexity-ai-agent__ask`) — Research

**Rules:**
- Follow the tone in `blog/tone-of-voice.md`.
- Follow the visual style in `blog/visual-style.md`.
- Don't publish articles without user review.
- Edit `blog/articles/*.md` freely — these files are the source of truth, not build artifacts.

### Bookmarks

The public site reads bookmarks from `https://mcp.vibegui.com`. Use the MCP App
for bookmark CRUD operations; the website is read-only.

## Code Style

- Follow existing patterns in the codebase.
- Prefer simplicity over abstraction.
- No unnecessary dependencies.
