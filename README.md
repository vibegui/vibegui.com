# vibegui.com

> Personal blog, experiments sandbox, and learning resource by Guilherme Rodrigues (@vibegui)

A minimal, high-performance static site managed entirely through MCP (Model Context Protocol). This project serves as both a personal platform and an educational reference for building MCP-first applications.

**Live at [vibegui.com](https://vibegui.com)**

---

## What's Been Built ✅

- **MCP-Native Content Management** — Full content pipeline (ideas → research → drafts → articles) managed through MCP tools
- **Content Hashing System** — All content files get content-hash URLs for immutable caching (1-year TTL)
- **Context Library** — LLM-generated summaries from leadership papers (Werner Erhard et al.) used as context for AI-assisted writing
- **Production Deployment** — Live on Cloudflare Pages with edge caching
- **Comprehensive Testing** — E2E tests (Playwright), constraint tests, accessibility verification
- **Pre-commit Pipeline** — Automated formatting, linting, type-checking, build, and testing

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite, Tailwind CSS v4 |
| Content | Markdown with YAML frontmatter |
| MCP Server | @decocms/runtime + custom tools |
| Testing | Playwright (E2E), Bun test (unit/constraints) |
| Deployment | Cloudflare Pages (edge) |
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
│                         YOUR MIND                               │
│                     (Ideas, thoughts)                           │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MCP SERVER                                 │
│   main.ts — exposes tools for content lifecycle                 │
│                                                                 │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│   │   IDEAS     │  │  RESEARCH   │  │   DRAFTS    │  ───────▶   │
│   │ Collection  │  │  Collection │  │  Collection │   ARTICLES  │
│   └─────────────┘  └─────────────┘  └─────────────┘             │
│         │                │                │              │      │
│         ▼                ▼                ▼              ▼      │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  content/           (filesystem = database)             │   │
│   │  ├── ideas/*.md     ← raw thoughts                      │   │
│   │  ├── research/*.md  ← deep research                     │   │
│   │  ├── drafts/*.md    ← work in progress                  │   │
│   │  └── articles/*.md  ← published content                 │   │
│   └─────────────────────────────────────────────────────────┘   │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  context/           (reference material for writing)    │   │
│   │  ├── leadership/*.md   ← Erhard leadership model        │   │
│   │  └── *.md              ← profile, integrity summary     │   │
│   └─────────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BUILD PIPELINE                               │
│                                                                 │
│   vite build → hash-content.ts → dist/                          │
│                                                                 │
│   • Content files renamed with content-hash                     │
│   • Manifest generated with hashed paths                        │
│   • Manifest hash injected into index.html                      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CLOUDFLARE PAGES                              │
│                                                                 │
│   • index.html: 30s cache, 1h stale-while-revalidate            │
│   • Assets/content: 1 year immutable cache                      │
│   • Edge-cached worldwide, < 100KB initial payload              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Content Hashing System

All content is served with immutable, content-based URLs for optimal caching:

```
# Source files
content/articles/hello-world.md
context/leadership/05_future_as_context.md

# After build (dist/)
content/articles/hello-world.285bf264.md
context/leadership/05_future_as_context.85ee9229.md
content/manifest.fb504092.json
```

### How It Works

1. **Vite build** generates the app with hashed JS/CSS assets
2. **hash-content.ts** post-processes content files:
   - Computes SHA-256 hash of each file's content
   - Copies files with hash in filename
   - Generates manifest mapping original → hashed paths
   - Hashes the manifest itself
   - Injects manifest path into `index.html`

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

The project has comprehensive testing to verify constraints:

### E2E Tests (Playwright)

```bash
bun run test:e2e
```

Tests run against **production build** to exercise the full pipeline:

| Test Suite | What It Verifies |
|------------|------------------|
| `content.spec.ts` | All context/leadership pages load, articles render, manifest works |
| `accessibility.spec.ts` | Semantic HTML, keyboard navigation, focus indicators |
| `responsive.spec.ts` | No horizontal scroll, touch targets ≥44px, readable text |
| `performance.spec.ts` | HTML < 100KB, DOM load < 3s, no layout shift |

### Constraint Tests (Bun)

```bash
bun run test:constraints
```

| Test | Constraint |
|------|------------|
| `build-size.test.ts` | Total dist/ < 500KB, HTML < 100KB |
| `image-size.test.ts` | Each image < 250KB |
| `cache-efficiency.test.ts` | Content-hash URLs, immutable cache headers |

### Pre-commit Pipeline

```bash
bun run precommit
```

Runs in order:
1. `bun run fmt` — Biome formatting
2. `bun run lint` — oxlint
3. `bun run check` — TypeScript type-check
4. `bun run build` — Production build with content hashing
5. `bun run test:constraints` — Verify constraints
6. `bun run test:e2e` — Full E2E verification

---

## Project Structure

```
vibegui.com/
├── mcp-server.ts              # MCP server entry point
├── main.ts                    # MCP server with tool definitions
├── CONSTRAINTS.md             # Project axioms (read this first!)
│
├── content/                   # Content (managed via MCP)
│   ├── ideas/*.md             # Raw thoughts
│   ├── research/*.md          # Deep research
│   ├── drafts/*.md            # Work in progress
│   └── articles/*.md          # Published articles
│
├── context/                   # Reference material for AI writing
│   ├── leadership/*.md        # 11 leadership summaries
│   ├── integrity_*.md         # Integrity model summary
│   └── LINKEDIN_PROFILE.md    # Author context
│
├── src/                       # Frontend source
│   ├── main.tsx               # Entry point
│   ├── app.tsx                # Router and layout
│   ├── components/            # Header, theme toggle, etc.
│   ├── pages/                 # Home, Article, Context, etc.
│   ├── lib/                   # Utilities (manifest, markdown)
│   └── styles/                # Tailwind + custom CSS
│
├── scripts/
│   ├── hash-content.ts        # Post-build content hashing
│   └── optimize-images.ts     # Image optimization
│
├── tests/
│   ├── e2e/                   # Playwright E2E tests
│   └── constraints/           # Build constraint verification
│
├── public/                    # Static assets
│   ├── _headers               # Cloudflare cache headers
│   └── images/
│
├── dist/                      # Build output (partially versioned in git)
│
├── vite.config.ts             # Vite + manifest plugin
├── playwright.config.ts       # E2E test configuration
├── biome.json                 # Code formatting
├── lefthook.yml               # Git hooks
└── package.json
```

---

## Commands Reference

| Command | Description |
|---------|-------------|
| `bun run dev` | Start Vite dev server (port 4001) |
| `bun run build` | Production build + content hashing |
| `bun run preview` | Preview production build |
| `bun run precommit` | Run all checks (format, lint, type, build, test) |
| `bun run test:e2e` | Run Playwright E2E tests |
| `bun run test:constraints` | Verify build constraints |
| `bun run mcp:dev` | Start MCP server (dev mode) |
| `bun run mcp:serve` | Start MCP server (production) |
| `bun run fmt` | Format code with Biome |
| `bun run lint` | Lint with oxlint |
| `bun run check` | TypeScript type-check |
| `bun run optimize:images` | Optimize images with Sharp |

---

## MCP Tools

The MCP server exposes tools for AI-assisted content management:

### Content Collections

Each collection has: `LIST`, `GET`, `CREATE`, `UPDATE`, `DELETE`

| Collection | Purpose |
|------------|---------|
| **Ideas** | Quick thoughts, sparks |
| **Research** | Deep AI-powered research |
| **Drafts** | Article outlines |
| **Articles** | Published content |

### Development Tools

| Tool | Description |
|------|-------------|
| `DEV_SERVER_START/STOP` | Control Vite dev server |
| `SCRIPT_BUILD` | Run production build |
| `SCRIPT_PRECOMMIT` | Run all pre-commit checks |
| `GIT_STATUS` | Show changed files |
| `COMMIT` | Stage and commit changes |
| `PUSH` | Push to remote |

### Search Tools

| Tool | Description |
|------|-------------|
| `SEARCH_CONTEXT` | Search reference materials |
| `SEARCH_CONTENT` | Search content collections |
| `SEARCH_ALL` | Search everything |

---

## Context Library

The `context/` directory contains LLM-generated summaries used as context for AI-assisted writing:

### Leadership (Werner Erhard et al.)

10 summaries from "Being a Leader and the Effective Exercise of Leadership":

1. Integrity
2. Authenticity
3. Committed to Something Bigger
4. Being Cause in the Matter
5. Future as Context
6. Already-Always Listening
7. Rackets
8. Authentic Listening
9. Contextual Framework
10. Power

### Integrity Model

Summary of "Integrity: A Positive Model" — integrity as wholeness, separate from morality.

---

## Deployment

### Local Build + Push

```bash
# 1. Make changes (via MCP or direct edit)
# 2. Run pre-commit checks
bun run precommit

# 3. Commit and push
git add -A && git commit -m "feat: your changes"
git push origin main

# 4. Cloudflare Pages auto-deploys from dist/
```

### Why No CI Build?

- **Full control**: You see exactly what gets deployed
- **Reproducibility**: Same build on any machine
- **Speed**: No waiting for CI runners
- **Cost**: Zero build minutes consumed

---

## Design Philosophy

### Constraints-Driven Development

Every feature must satisfy [CONSTRAINTS.md](./CONSTRAINTS.md):

- **Performance**: < 100KB initial payload, content-hash caching
- **UX**: Mobile-first, WCAG AA accessibility, dark/light themes
- **Architecture**: Static-first, MCP-managed content, versioned builds
- **Quality**: TypeScript strict, comprehensive testing

### Why This Architecture?

| Decision | Why |
|----------|-----|
| **MCP for content** | AI-assisted writing with full control. No vendor lock-in. |
| **Content hashing** | Immutable URLs enable aggressive caching (1 year TTL) |
| **Local builds** | No CI dependency, reproducible, instant feedback |
| **Cloudflare Pages** | Free tier, edge caching, simple push-to-deploy |
| **E2E on prod build** | Tests exercise the full pipeline, catch real issues |

---

## About the Author

**Guilherme Rodrigues** is a software engineer and entrepreneur from Rio de Janeiro. After 9 years at VTEX leading high-performance e-commerce projects (including their NYSE IPO), he founded [deco CMS](https://decocms.com) — a platform democratizing the creation of governable AI agents.

He's also a co-founder of [Movimento Tech](https://www.movtech.org), a coalition that has impacted over 3 million young Brazilians in technology, including the Maratona Tech — Brazil's largest technology olympiad.

### Contact

- **Website**: [vibegui.com](https://vibegui.com)
- **GitHub**: [@vibegui](https://github.com/vibegui)
- **Twitter/X**: [@vibegui_](https://x.com/vibegui_)
- **deco CMS**: [decocms.com](https://decocms.com)

---

## License

Content (articles, ideas) © Guilherme Rodrigues. All rights reserved.

Code (everything else) is MIT licensed.

---

<p align="center">
  <em>Built with decoCMS · Made in Brazil 🇧🇷</em>
</p>
