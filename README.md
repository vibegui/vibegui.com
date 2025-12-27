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
# Development mode with hot reload
bun run mcp:dev

# Production mode (for MCP clients)
bun run mcp:serve
```

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
│                     EXPORT PIPELINE                             │
│                                                                 │
│   bun run export                                                │
│   ├── export-content.ts  → public/content/*.json               │
│   └── export-bookmarks.ts → public/bookmarks/data.json         │
│                                                                 │
│   Uses Node 22 native sqlite (--experimental-sqlite)           │
│   Zero npm dependencies for build!                             │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BUILD PIPELINE                               │
│                                                                 │
│   vite build → hash-content.ts → dist/                          │
│                                                                 │
│   • Content/context files renamed with content-hash             │
│   • Manifest generated with hashed paths                        │
│   • Manifest hash injected into index.html                      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CLOUDFLARE PAGES                              │
│                                                                 │
│   • pages:build runs export + vite build + hash                 │
│   • No npm install needed (SKIP_DEPENDENCY_INSTALL=true)        │
│   • index.html: 30s cache, 1h stale-while-revalidate            │
│   • Assets/content: 1 year immutable cache                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## SQLite-First Content Management

### Why SQLite?

Instead of managing markdown files in folders, all content lives in SQLite databases:

| Database | Purpose |
|----------|---------|
| `data/content.db` | Articles and drafts with tags |
| `data/bookmarks.db` | 400+ curated links with AI enrichment |

**Benefits:**
- **Version-controlled** — Database files committed to git
- **Zero-dependency export** — Node 22's native `node:sqlite` (no npm install)
- **Structured data** — Tags, ratings, timestamps in proper columns
- **Fast builds** — Cloudflare build completes in seconds

### Export Scripts

At dev/build time, export scripts extract data to JSON:

```bash
# Export all content to public/
bun run export

# Individual exports
node --experimental-strip-types --experimental-sqlite scripts/export-content.ts
node --experimental-strip-types --experimental-sqlite scripts/export-bookmarks.ts
```

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

## Content Hashing System

All content is served with immutable, content-based URLs for optimal caching:

```
# Source files (from export)
public/content/hello-world.json
public/bookmarks/data.json

# After build (dist/)
content/hello-world.json (copied as-is, manifest tracks it)
context/leadership/05_future_as_context.85ee9229.md (hashed)
content/manifest.fb504092.json (hashed)
```

### Cache Headers (`_headers`)

```
/index.html
  Cache-Control: public, max-age=30, stale-while-revalidate=3600

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/content/*
  Cache-Control: public, max-age=31536000, immutable

/context/*
  Cache-Control: public, max-age=31536000, immutable
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
├── mcp-server.ts              # MCP server entry point
├── main.ts                    # MCP server with tool definitions
├── CONSTRAINTS.md             # Project axioms (read this first!)
│
├── data/                      # SQLite databases (version-controlled)
│   ├── content.db             # Articles and drafts
│   └── bookmarks.db           # Curated links with AI enrichment
│
├── lib/db/                    # Database modules (Node 22 native sqlite)
│   ├── index.ts               # Bookmarks database
│   └── content.ts             # Content database
│
├── scripts/
│   ├── export-content.ts      # SQLite → public/content/*.json
│   ├── export-bookmarks.ts    # SQLite → public/bookmarks/data.json
│   ├── hash-content.ts        # Post-build content hashing
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

| Command | Description |
|---------|-------------|
| `bun run dev` | Export + start Vite dev server |
| `bun run build` | Export + Vite build + content hashing |
| `bun run export` | Export SQLite databases to JSON |
| `bun run preview` | Preview production build |
| `bun run precommit` | Run all checks (format, lint, type, build, test) |
| `bun run test:e2e` | Run Playwright E2E tests |
| `bun run test:constraints` | Verify build constraints |
| `bun run mcp:dev` | Start MCP server (dev mode) |
| `bun run mcp:serve` | Start MCP server (production) |

---

## MCP Tools

The MCP server exposes tools for AI-assisted content management:

### Content Collections

Each collection has: `LIST`, `GET`, `CREATE`, `UPDATE`, `DELETE`

| Collection | Purpose |
|------------|---------|
| **Drafts** | Work in progress articles |
| **Articles** | Published content |

### Development Tools

| Tool | Description |
|------|-------------|
| `DEV_SERVER_START/STOP` | Control Vite dev server |
| `SCRIPT_BUILD` | Run production build |
| `GIT_STATUS` | Show changed files |
| `COMMIT` | Stage and commit changes |
| `PUSH` | Push to remote |

### Search Tools

| Tool | Description |
|------|-------------|
| `SEARCH_CONTEXT` | Search reference materials |
| `SEARCH_CONTENT` | Search content collections |
| `SEARCH_ALL` | Search everything |

### AI Integration (via MCP Mesh gateway)

| Tool | Description |
|------|-------------|
| `ASK_PERPLEXITY` | Research queries |
| `web_search_exa` | Content scraping |
| `LLM_DO_GENERATE` | Claude classification |

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

The `pages:build` script uses Node 22's native SQLite:

```bash
node --experimental-strip-types --experimental-sqlite scripts/export-content.ts && \
node --experimental-strip-types --experimental-sqlite scripts/export-bookmarks.ts && \
node --experimental-strip-types scripts/hash-content.ts
```

### Why Zero Dependencies?

- **Faster builds** — No npm install (saves 30+ seconds)
- **Simpler deploys** — Just Node 22 built-ins
- **No native modules** — No `better-sqlite3` compilation issues

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
