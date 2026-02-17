# vibegui.com

> Personal blog, experiments sandbox, and AI-curated bookmarks by Guilherme Rodrigues (@vibegui)

A minimal, high-performance static site with markdown-based articles and Supabase-powered bookmarks. This project serves as both a personal platform and an educational reference for building MCP-first applications.

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

## Content Management

### Articles

Articles are managed in **Supabase** (source of truth) and synced to `blog/articles/` as markdown build artifacts via `bun run sync`. The sync uses SHA-256 hash comparison to only write files when content has actually changed.

**Workflow:**
1. Create or edit articles in Supabase (via helper functions or MCP tools)
2. Run `bun run sync` to export markdown files
3. Run `bun run build` to generate the site

> **Do not edit `blog/articles/*.md` directly** -- changes will be overwritten on next sync. A pre-commit hook warns if these files are manually staged.

Article frontmatter includes: `slug`, `title`, `description`, `date`, `status`, `coverImage`, and `tags`.

- **status: published** -- Visible in production
- **status: draft** -- Visible in dev only (hidden when `CI=true`)

### Bookmarks

Bookmarks are stored in **Supabase** (PostgreSQL) and managed via MCP tools in the Vite dev server. The `/bookmarks` page supports filtering by persona, tech, type, platform, and rating.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     CONTENT SOURCES                              │
│                                                                  │
│   Supabase (PostgreSQL)       blog/articles/*.md (build artifacts)│
│   ├── Articles (source)       ├── Synced via: bun run sync      │
│   ├── 400+ curated bookmarks  └── YAML frontmatter + markdown   │
│   └── AI enrichment data                                         │
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
│   • Copy manifest, bookmarks to dist/                            │
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
| Content | Supabase (articles + bookmarks), synced to markdown |
| Bookmarks | Supabase (PostgreSQL) via MCP Mesh |
| Testing | Playwright (E2E), Bun test (unit/constraints) |
| Deployment | Cloudflare Pages (edge, zero-install build) |
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
│   └── articles/              # Markdown articles (build artifacts from Supabase)
│       ├── my-article.md
│       └── ...
│
├── lib/
│   ├── articles.ts            # Markdown parser (frontmatter + body)
│   └── supabase.ts            # Supabase client (bookmarks)
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
├── vite.config.ts             # Vite + dev API endpoints + article watcher
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
