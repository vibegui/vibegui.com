# vibegui.com

> Personal blog, experiments sandbox, and AI-curated bookmarks by Guilherme Rodrigues (@vibegui)

A minimal, high-performance static site with SQLite-powered content and bookmarks, all managed through MCP (Model Context Protocol). This project serves as both a personal platform and an educational reference for building MCP-first applications.

**Live at [vibegui.com](https://vibegui.com)**

---

## What's Been Built ✅

- **SQLite-First Architecture** — All content (articles, bookmarks) stored in SQLite databases, version-controlled in git
- **Zero-Dependency Build** — Uses Node 22's native `node:sqlite` for exports (no npm install needed on Cloudflare)
- **AI-Powered Bookmark Enrichment** — Perplexity research + Exa content + Claude Sonnet classification
- **Content Hashing System** — All content files get content-hash URLs for immutable caching (1-year TTL)
- **Context Library** — LLM-generated summaries from leadership papers used as context for AI-assisted writing
- **Comprehensive Testing** — E2E tests (Playwright), constraint tests, accessibility verification

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite, Tailwind CSS v4 |
| Database | SQLite (Node 22 native `node:sqlite`) |
| MCP Server | @decocms/runtime + custom tools |
| AI Enrichment | Perplexity + Exa + Claude Sonnet via MCP Mesh |
| Testing | Playwright (E2E), Bun test (unit/constraints) |
| Deployment | Cloudflare Pages (edge, zero-install build) |
| Quality | Biome (format), oxlint (lint), TypeScript strict |

---

## Quick Start

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Build for production (includes content hashing)
bun run build

# Run all checks (pre-commit)
bun run precommit
```

### MCP Server (for AI-assisted content management)

```bash
# HTTP transport (for MCP Mesh web connections)
bun run mcp:dev          # Development with hot reload
bun run mcp:serve        # Production mode

# STDIO transport (for MCP Mesh command connections)
bun run mcp:stdio        # Production mode
bun run mcp:stdio:dev    # Development with hot reload
```

**For Mesh integration** (add as custom STDIO command):
- Command: `bun`
- Args: `--watch /path/to/vibegui.com/server/stdio.ts`

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      SQLite DATABASES                           │
│                   (version-controlled in git)                   │
│                                                                 │
│   data/content.db          data/bookmarks.db                   │
│   ├── articles             ├── 400+ curated links              │
│   ├── drafts               ├── AI enrichment data              │
│   └── tags                 └── tags, ratings, insights         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│               STEP 1: scripts/generate.ts                       │
│                    (requires SQLite)                            │
│                                                                 │
│   Reads SQLite → writes:                                        │
│   • public/content/manifest.json   (article list)               │
│   • .build/article/{slug}/index.html (SSG pages)                │
│                                                                 │
│   Each article HTML has content embedded as JSON.               │
│   Uses Node 22 native sqlite (--experimental-sqlite)            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      vite build                                 │
│                                                                 │
│   Bundles React app → dist/                                     │
│   (Only runs locally, assets committed to git)                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│               STEP 2: scripts/finalize.ts                       │
│                  (does NOT require SQLite)                      │
│                                                                 │
│   Post-processing:                                              │
│   • Copy manifest, bookmarks to dist/                           │
│   • Process article HTML (inject prod assets)                   │
│   • Hash context files for immutable caching                    │
│   • Embed manifest directly into index.html                     │
│                                                                 │
│   Result: Zero fetches needed for article list!                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CLOUDFLARE PAGES                              │
│                                                                 │
│   pages:build = generate.ts + finalize.ts (no vite build!)     │
│   • No npm install (SKIP_DEPENDENCY_INSTALL=true)               │
│   • dist/assets/* committed to git                              │
│   • index.html: 30s cache + stale-while-revalidate              │
│   • Assets: 1 year immutable cache                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## SQLite-First Content Management

### Why SQLite?

Instead of managing markdown files in folders, all content lives in SQLite databases:

| Database | Purpose |
|----------|---------|
| `data/content.db` | Articles (with status: draft/published) |
| `data/bookmarks.db` | 400+ curated links with AI enrichment |

**Benefits:**
- **Version-controlled** — Database files committed to git
- **Zero-dependency export** — Node 22's native `node:sqlite` (no npm install)
- **Structured data** — Tags, ratings, timestamps in proper columns
- **Fast builds** — Cloudflare build completes in seconds

### Generate Script

At dev/build time, the generate script reads SQLite and creates static files:

```bash
# Runs automatically with dev/build, but can run manually:
bun scripts/generate.ts
```

This creates:
- `public/content/manifest.json` — Article metadata for the homepage
- `.build/article/{slug}/index.html` — SSG pages with embedded article content

### WAL Checkpoint on Commit

SQLite uses WAL mode for better concurrency, but WAL files are gitignored. The pre-commit hook automatically checkpoints:

```yaml
# lefthook.yml
5_checkpoint_db:
  run: |
    sqlite3 data/bookmarks.db "PRAGMA wal_checkpoint(TRUNCATE);" 2>/dev/null || true
    sqlite3 data/content.db "PRAGMA wal_checkpoint(TRUNCATE);" 2>/dev/null || true
```

This ensures all writes are in the main `.db` file before committing.

---

## Bookmarks System

### AI-Powered Enrichment

Each bookmark goes through a 3-step enrichment pipeline:

```
1. Research (Perplexity)     → What is this resource about?
2. Content (Exa)             → Fetch and parse page content
3. Classification (Claude)   → Stars, tags, insights for 3 personas
```

### Enrichment Output

| Field | Source |
|-------|--------|
| `title`, `description` | AI-generated (improved) |
| `stars` (1-5) | Claude rating |
| `icon` | Emoji representing the resource |
| `language` | Detected content language |
| `research_raw` | Full Perplexity research |
| `exa_content` | Scraped page content |
| `insight_dev` | Key insight for developers |
| `insight_founder` | Key insight for founders |
| `insight_investor` | Key insight for investors |
| `tags` | `tech:*`, `type:*`, `persona:*` |

### Filtering & Sorting

The `/bookmarks` page supports:
- **Persona filter** — Developer, Founder, Investor
- **Tech filter** — TypeScript, React, AI, etc.
- **Type filter** — Tool, Article, Video, etc.
- **Platform filter** — GitHub, LinkedIn, Twitter, YouTube, etc.
- **Rating filter** — Minimum stars (1-5)
- **Sort** — Default (enriched first) or by rating

---

## Static Site Generation (SSG)

Every article page is pre-rendered with content embedded directly in the HTML:

```html
<!-- dist/article/my-article/index.html -->
<div id="root"></div>
<script id="article-data" type="application/json">
  {"slug":"my-article","title":"My Article","content":"# Full markdown..."}
</script>
```

The homepage (`index.html`) also has the manifest embedded — **zero fetches needed**:

```html
<!-- dist/index.html -->
<div id="root"></div>
<script id="manifest-data" type="application/json">
  {"articles":[...],"projects":[...]}
</script>
```

### Cache Headers (`_headers`)

```
/index.html, /*.html
  Cache-Control: public, max-age=30, stale-while-revalidate=3600

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/context/*
  Cache-Control: public, max-age=31536000, immutable
```

Context files (leadership docs) are hashed for immutable caching:
```
context/05_future_as_context.md → context/05_future_as_context.85ee9229.md
```

---

## Testing

### E2E Tests (Playwright)

```bash
bun run test:e2e
```

Tests run against **production build** to exercise the full pipeline:

| Test Suite | What It Verifies |
|------------|------------------|
| `content.spec.ts` | All context/leadership pages load, articles render |
| `accessibility.spec.ts` | Semantic HTML, keyboard navigation, focus indicators |
| `responsive.spec.ts` | No horizontal scroll, touch targets ≥44px |
| `performance.spec.ts` | HTML < 100KB, DOM load < 3s |

### Constraint Tests (Bun)

```bash
bun run test:constraints
```

| Test | Constraint |
|------|------------|
| `build-size.test.ts` | Total JS < 300KB, HTML < 100KB |
| `image-size.test.ts` | Each image < 250KB |
| `cache-efficiency.test.ts` | Content-hash URLs, immutable cache headers |

---

## Project Structure

```
vibegui.com/
├── server/                    # MCP Server (STDIO transport)
│   ├── cli.ts                 # CLI entry point (--http flag support)
│   ├── stdio.ts               # STDIO transport entry point
│   └── tools.ts               # Shared tool definitions (McpServer)
│
├── mcp-server.ts              # MCP server (HTTP transport, @decocms/runtime)
├── main.ts                    # HTTP server entry point (with WhatsApp bridge)
├── CONSTRAINTS.md             # Project axioms (read this first!)
│
├── data/                      # SQLite databases (version-controlled)
│   ├── content.db             # Articles and drafts
│   ├── learnings.db           # Daily learnings (local only, gitignored)
│   └── bookmarks.db           # Curated links with AI enrichment
│
├── lib/
│   ├── db/                    # Database modules (Node 22 native sqlite)
│   │   ├── content.ts         # Content database
│   │   └── learnings.ts       # Learnings database
│   └── bookmarks/             # Browser bookmark readers
│
├── scripts/
│   ├── generate.ts            # SQLite → manifest.json + article HTML (Step 1)
│   ├── finalize.ts            # Post-build: embed manifest, hash context (Step 2)
│   ├── preview-server.ts      # Static server for production preview
│   └── optimize-images.ts     # Image optimization
│
├── context/                   # Reference material for AI writing
│   ├── leadership/*.md        # 11 leadership summaries
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
├── public/                    # Static assets (gitignored: content/, bookmarks/)
│   └── _headers               # Cloudflare cache headers
│
├── dist/                      # Build output (assets versioned in git)
│
├── vite.config.ts             # Vite + dev API endpoints
├── lefthook.yml               # Git hooks (checkpoint DB, stage dist)
└── package.json
```

---

## Commands Reference

### Core Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Generate content + start Vite dev server |
| `bun run build` | Generate + Vite build + finalize (full production build) |
| `bun run preview` | Build + serve locally (test production) |
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

### MCP Server

| Command | Description |
|---------|-------------|
| `bun run mcp:dev` | HTTP server with hot reload (includes WhatsApp bridge) |
| `bun run mcp:serve` | HTTP server production mode |
| `bun run mcp:stdio` | STDIO server for Mesh command connections |
| `bun run mcp:stdio:dev` | STDIO server with hot reload |

---

## MCP Tools

The MCP server exposes 50+ tools for AI-assisted content management. Both HTTP and STDIO transports share the same tools (except WhatsApp which requires HTTP).

### Content Management

| Tool | Description |
|------|-------------|
| `COLLECTION_ARTICLES_*` | CRUD for articles (LIST, GET, CREATE, UPDATE, DELETE) |
| `CONTENT_SEARCH_REPLACE` | Precise text replacement in content |
| `CONTENT_APPEND/PREPEND` | Add text to start/end of content |
| `CONTENT_INSERT_AFTER/BEFORE` | Insert text relative to a marker |

### Search

| Tool | Description |
|------|-------------|
| `SEARCH_CONTEXT` | Search reference materials (uses ripgrep) |
| `SEARCH_CONTENT` | Search articles and drafts |

### Development

| Tool | Description |
|------|-------------|
| `DEV_SERVER_START/STOP` | Control Vite dev server |
| `GIT_STATUS` | Show changed files |
| `COMMIT` | Stage and commit changes |
| `PUSH` | Push to remote |
| `SCRIPT_*` | Auto-generated from package.json (11 scripts) |

### Bookmarks

| Tool | Description |
|------|-------------|
| `BOOKMARKS_DISCOVER_BROWSERS` | Find browser profiles on system |
| `BOOKMARKS_READ` | Read bookmarks from a browser |
| `BOOKMARKS_SEARCH` | Search across all browsers |
| `BOOKMARKS_EXPORT_CSV` | Export to CSV format |

### Learnings (Local Memory)

| Tool | Description |
|------|-------------|
| `LEARNINGS_RECORD` | Record insights, bug fixes, accomplishments |
| `LEARNINGS_TODAY` | Get today's learnings |
| `LEARNINGS_BY_PROJECT` | Filter by project |
| `LEARNINGS_SEARCH` | Search learnings |
| `LEARNINGS_PUBLISHABLE` | Find content for blog posts |
| `LEARNINGS_STATS` | Get statistics |

### Projects (Roadmap)

| Tool | Description |
|------|-------------|
| `COLLECTION_PROJECTS_*` | CRUD for roadmap projects (LIST, GET, CREATE, UPDATE, DELETE) |
| `PROJECT_MARK_COMPLETE` | Mark project as completed |

### WhatsApp Bridge (HTTP only)

| Tool | Description |
|------|-------------|
| `WHATSAPP_STATUS` | Check extension connection |
| `WHATSAPP_LIST_CHATS` | List visible chats |
| `WHATSAPP_OPEN_CHAT` | Open a specific chat |
| `WHATSAPP_READ_MESSAGES` | Read visible messages |
| `WHATSAPP_SCRAPE` | Full chat history scrape |

---

## Deployment

### Cloudflare Pages (Zero-Install Build)

```bash
# Build command (in Cloudflare dashboard)
npm run pages:build

# Environment variables
SKIP_DEPENDENCY_INSTALL=true   # Skip npm install
CI=true                        # Skip drafts in production
```

The `pages:build` script runs:

```bash
# Step 1: Generate content from SQLite (requires node:sqlite)
node --experimental-strip-types --experimental-sqlite scripts/generate.ts

# Step 2: Finalize build (copy assets, embed manifest, hash context)
node --experimental-strip-types scripts/finalize.ts
```

**Note:** Vite build does NOT run on Cloudflare. The `dist/assets/*` are committed to git, so only content generation and post-processing is needed.

### Why Zero Dependencies?

- **Faster builds** — No npm install (saves 30+ seconds)
- **Simpler deploys** — Just Node 22 built-ins
- **No native modules** — No `better-sqlite3` compilation issues
- **No Vite on CI** — Assets committed, only content changes trigger rebuild

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
  <em>Built with MCP + SQLite · Made in Brazil 🇧🇷</em>
</p>
