# vibegui.com

> Guilherme Rodrigues' Personal AI OS, public ideas, and AI-curated library.

A minimal, high-performance public site plus one copyable MCP that becomes a persistent personal agent in deco Studio. Articles are Markdown files in the repo; published Markdown is mirrored to R2 only for AutoRAG. Public bookmarks are served by the Worker API; private projects, goals, memory, decisions, captures, and daily briefs live in D1.

**Live at [vibegui.com](https://vibegui.com)**

---

## Quick Start

```bash
# Install dependencies
bun install

# Start development server (generate + vite dev)
bun run dev

# Build for production (generate + vite build + finalize)
bun run build

# Preview production build locally
bun run preview:build

# Run all checks (pre-commit)
bun run precommit
```

---

## Personal AI OS

`mcp/` is a separate Cloudflare Worker with one public endpoint and two capability levels:

- Without authentication: published writing tools.
- With the private Studio token: project map, goals, memory, decisions, captures, GitHub evidence, daily briefs, and the Personal AI OS MCP App.

The implementation is public and copyable; personal state and credentials stay in D1 and Worker secrets. See [`mcp/README.md`](./mcp/README.md).

The December 2026 project charter, outcomes, conditions of satisfaction, and scorecard live in [`DECLARATION.md`](./DECLARATION.md).

```bash
bun run mcp:check
bun run mcp:test
bun run mcp:build
bun run mcp:dev
```

---

## Content Management

### Articles

Markdown files in `blog/articles/` are the source of truth. Edit, commit, push — Cloudflare Pages builds and deploys. There is no parallel database for articles.

**Workflow:**
1. Edit (or create) `blog/articles/{slug}.md`.
2. `git commit && git push` — or run `/article:publish <slug>` to flip frontmatter to published, commit, and push in one shot.
3. Cloudflare picks up the push and deploys.

Article frontmatter:

| Field | Notes |
|-------|-------|
| `slug` | unique, matches filename |
| `title` | display title |
| `description` | shown on home + meta description |
| `date` | `YYYY-MM-DD`, used for ordering |
| `status` | `published` (live) or `draft` (dev-only, hidden when `CI=true`) |
| `coverImage` | path under `public/images/articles/`, or `null` |
| `tags` | array of strings, optional |

For authoring assistance, use the `/article:*` skills (see `AGENTS.md`).

### Bookmarks

The `/bookmarks` page reads the public, read-only API at
`https://mcp.vibegui.com`. Bookmark administration lives in the MCP App rather
than the public site.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     CONTENT SOURCES                              │
│                                                                  │
│   blog/articles/*.md          Public Worker API                  │
│   ├── Source of truth         └── Curated bookmarks              │
│   └── YAML frontmatter + md       (read-only HTTP endpoints)     │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              scripts/build.ts --mode=X                           │
│                                                                  │
│   One unified entrypoint with three modes:                       │
│                                                                  │
│   --mode=dev   → generate + vite dev server                      │
│   --mode=prod  → generate + vite build + finalize                │
│   --mode=pages → generate + finalize (for Cloudflare)            │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│            GENERATE (scripts/generate.ts)                        │
│                                                                  │
│   Reads blog/articles/*.md → writes:                             │
│   • public/content/manifest.json   (article list)                │
│   • .build/article/{slug}/index.html (SSG pages)                 │
│   • .build/context/{path}/index.html (SSG context)               │
│                                                                  │
│   Content embedded as JSON. Zero runtime fetches!                │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│            FINALIZE (scripts/finalize.ts)                         │
│                                                                  │
│   Post-processing (no database needed):                          │
│   • Copy generated manifests and public assets to dist/          │
│   • Process SSG HTML (inject prod assets)                        │
│   • Embed manifest directly into index.html                      │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CLOUDFLARE PAGES                                │
│                                                                  │
│   pages:build runs --mode=pages (no Vite, no npm install!)       │
│   • SKIP_DEPENDENCY_INSTALL=true in Cloudflare settings          │
│   • dist/assets/* pre-built and committed to git                 │
│   • index.html: 30s cache + stale-while-revalidate               │
│   • Assets: 1 year immutable cache                               │
└──────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite, Tailwind CSS v4 |
| Articles | Markdown files in `blog/articles/`, committed to the repo |
| Article retrieval | Published Markdown mirror in R2 + Cloudflare AI Search |
| Bookmarks | Public Worker API + MCP App administration |
| Personal AI OS | Cloudflare Worker, D1, MCP App |
| Testing | Playwright (E2E), Bun test (unit/constraints) |
| Deployment | Cloudflare Pages + Worker |
| Quality | Biome (format), oxlint (lint), TypeScript strict |

---

## Build Modes

| Command | Mode | What It Does |
|---------|------|--------------|
| `bun run dev` | dev | Generate content + Vite dev server |
| `bun run build` | prod | Generate + Vite build + Finalize |
| `npm run pages:build` | pages | Generate + Finalize (for Cloudflare) |

---

## Static Site Generation (SSG)

All content pages are pre-rendered with data embedded directly in the HTML — **zero fetches needed**:

| Page | Embedded Data |
|------|---------------|
| Homepage | `manifest-data` (article list) |
| Article pages | `article-data` (full markdown) |
| Context pages | `context-data` (leadership summaries) |

---

## Project Structure

```
vibegui.com/
├── blog/
│   └── articles/              # Markdown articles (source of truth)
│       ├── my-article.md
│       └── ...
│
├── lib/
│   ├── articles.ts            # Markdown parser (frontmatter + body)
│   ├── articles-reader.ts     # Zero-dep parser used by Cloudflare Pages build
│   └── bookmarks-api.ts       # Public read-only bookmarks client
│
├── scripts/
│   ├── build.ts               # Unified build script (dev/prod/pages)
│   ├── generate.ts            # Markdown → manifest.json + article HTML
│   ├── finalize.ts            # Post-build: embed manifest, process SSG
│   ├── preview-server.ts      # Static server for production preview
│   └── optimize-images.ts     # Image optimization
│
├── context/                   # Reference material for AI writing
│   ├── leadership/*.md        # Leadership summaries
│   └── LINKEDIN_PROFILE.md    # Author context
│
├── mcp/                       # Personal AI OS Worker and MCP App
│   ├── src/                   # Public/private tools, state, auth, GitHub sync
│   ├── web/                   # Private Studio MCP App
│   ├── migrations/            # Private D1 schema
│   └── wrangler.jsonc         # Worker configuration
│
├── src/                       # Frontend source
│   ├── main.tsx               # Entry point
│   ├── app.tsx                # Router and layout
│   ├── pages/                 # Home, Article, Bookmarks, etc.
│   └── lib/                   # Utilities (manifest, markdown)
│
├── tests/
│   ├── e2e/                   # Playwright E2E tests
│   └── constraints/           # Build constraint verification
│
├── public/                    # Static assets
│   └── _headers               # Cloudflare cache headers
│
├── dist/                      # Build output (assets versioned in git)
│
├── vite.config.ts             # Vite SSG support + article watcher
├── lefthook.yml               # Git hooks (stage dist + articles)
└── package.json
```

---

## Commands Reference

### Core Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Generate content + start Vite dev server |
| `bun run build` | Generate + Vite build + finalize (full production build) |
| `bun run preview` | Serve existing production build locally |
| `bun run preview:build` | Build + serve locally (test production) |
| `bun run pages:build` | Cloudflare Pages build (no Vite, no npm deps) |

### Quality & Testing

| Command | Description |
|---------|-------------|
| `bun run precommit` | All checks (format, lint, type, build, test) |
| `bun run test:e2e` | Playwright E2E tests |
| `bun run test:constraints` | Verify build constraints |
| `bun run check` | TypeScript type checking |
| `bun run lint` | oxlint linting |
| `bun run fmt` | Biome formatting |
| `bun run mcp:check` | Type-check the Personal AI OS |
| `bun run mcp:test` | Test public/private MCP isolation |
| `bun run mcp:build` | Build the single-file Studio MCP App |

---

## Deployment

See [DEPLOY.md](./DEPLOY.md) for Cloudflare Pages deployment details.

---

## About the Author

**Guilherme Rodrigues** is a software engineer and entrepreneur from Rio de Janeiro. After 9 years at VTEX leading high-performance e-commerce projects (including their NYSE IPO), he founded [deco CMS](https://decocms.com) — a platform democratizing the creation of governable AI agents.

He's also a co-founder of [Movimento Tech](https://www.movtech.org), a coalition that has impacted over 3 million young Brazilians in technology.

### Contact

- **Website**: [vibegui.com](https://vibegui.com)
- **GitHub**: [@vibegui](https://github.com/vibegui)
- **Twitter/X**: [@vibegui_](https://x.com/vibegui_)
- **deco CMS**: [decocms.com](https://decocms.com)

---

## License

Content (articles, bookmarks) © Guilherme Rodrigues. All rights reserved.

Code (everything else) is MIT licensed.

---

<p align="center">
  <em>Built with Markdown + Vite · Made in Brazil</em>
</p>
