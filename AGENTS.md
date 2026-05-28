# Agent Instructions

Guidelines for AI agents working on this repository.

## Git Operations

- **Never auto-push**, with one exception: `/article:publish` is authorized to push directly to origin — that skill *is* the publish action. For any other change, commit locally and wait for the user to push.
- **Commit often**: Small, focused commits with clear messages are preferred.
- **Use conventional commits**: `type(scope): message` format.

## Build & Deploy

- Always run `bun run fmt` after making code changes.
- Test locally with `bun run preview` before committing.
- The `pages:build` script is for Cloudflare — it doesn't run Vite.

## Content Management

### Articles

Markdown files in `blog/articles/` are the source of truth. Committing the file publishes the article — there is no parallel database, no sync step.

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

Bookmarks live in Supabase (separate from articles). Use the MCP tools for bookmark CRUD operations.

## Code Style

- Follow existing patterns in the codebase.
- Prefer simplicity over abstraction.
- No unnecessary dependencies.
