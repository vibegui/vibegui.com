# vibegui.com

> Personal blog, experiments sandbox, and learning resource by Guilherme Rodrigues (@vibegui)

A minimal, high-performance static site managed entirely through MCP (Model Context Protocol). This project serves as both a personal platform and an educational reference for building MCP-first applications.

---

## Current Status 🚧

**Phase 1 Complete** — Minimal working setup:

- ✅ Vite + React + Tailwind v4 configured
- ✅ Green theme (terminal green dark, forest green light)
- ✅ Mobile-first responsive layout
- ✅ Client-side routing (Home, Commitment, Integrity, Alignment, deco)
- ✅ Dark/light theme toggle with persistence
- ✅ MCP server with content collection tools
- ✅ Bindings for OpenRouter, Perplexity, MCP Studio (configured, not yet connected)
- ✅ Content directory structure ready

**Next Steps:**
- Connect to MCP Mesh
- Create first article using MCP tools
- Configure Cloudflare Pages deployment
- Add build manifest for article list

---

## Quick Start

```bash
# Install dependencies
bun install

# Start MCP server (for content management via AI)
bun run mcp:dev

# Start frontend dev server
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview
```

---

## What This Is

**vibegui.com** is:

1. **A personal blog** — Articles about technology, entrepreneurship, and Brazil's tech future
2. **An MCP showcase** — The entire content lifecycle (ideas → research → drafts → articles) is managed through MCP tools
3. **A learning resource** — Simple, readable code that demonstrates modern web architecture

### Key Principles

- **MCP-first**: All content management happens through MCP tools, not direct file editing
- **Static-first**: Pre-generated HTML for core pages, lazy-loaded MD for articles
- **Minimal**: No unnecessary abstractions, no heavy frameworks
- **Educational**: Every architectural decision is documented and explained

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
│   mcp-server.ts — running locally on your machine               │
│                                                                 │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│   │   IDEAS     │  │  RESEARCH   │  │   DRAFTS    │  ───────▶   │
│   │ Collection  │  │  Collection │  │  Collection │   ARTICLES  │
│   └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  Bindings: OpenRouter (AI) + Filesystem (content)       │   │
│   └─────────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STATIC SITE (dist/)                          │
│                                                                 │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│   │  index   │  │ articles │  │   about  │  │   ...    │        │
│   │  .html   │  │ [slug]   │  │  pages   │  │          │        │
│   └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│                                                                 │
│   Assets: content-hash URLs, immutable cache                    │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CLOUDFLARE PAGES                              │
│                                                                 │
│   CDN-cached at edge, < 100KB initial payload                   │
│   index.html: 30s cache, 1h stale-while-revalidate              │
│   Assets: 1 year immutable cache                                │
└─────────────────────────────────────────────────────────────────┘
```

### Why This Architecture?

| Decision | Why |
|----------|-----|
| **MCP for content** | AI-assisted writing with full control. No vendor lock-in. Works with any MCP client (Cursor, Claude, etc.) |
| **Static generation** | Instant loads, SEO-friendly, works without JavaScript |
| **SPA for articles** | Templates are cached once; only MD content changes. Maximum cache efficiency |
| **Local builds** | No CI build minutes. Full control. Versioned dist/ means reproducible deploys |
| **Cloudflare Pages** | Free tier is generous. Edge caching. Simple push-to-deploy |

---

## Project Structure

```
vibegui.com/
├── mcp-server.ts              # MCP server — the control plane
├── CONSTRAINTS.md             # Project axioms (read this first!)
├── PLAN.md                    # Implementation roadmap
│
├── content/                   # All content lives here (managed via MCP)
│   ├── ideas/                 # Raw thoughts and sparks
│   │   └── *.md
│   ├── research/              # Deep research documents
│   │   └── *.md
│   ├── drafts/                # Article outlines
│   │   └── *.md
│   └── articles/              # Published articles
│       └── *.md
│
├── src/                       # Frontend source
│   ├── main.tsx               # Entry point
│   ├── app.tsx                # Root component with routing
│   ├── components/            # Shared UI components
│   │   ├── header.tsx         # Top bar (logo, menu, theme)
│   │   ├── theme-toggle.tsx   # Light/dark mode switch
│   │   └── article-card.tsx   # Article preview card
│   ├── pages/                 # Page components
│   │   ├── home.tsx           # Home with article list
│   │   ├── article.tsx        # Single article view
│   │   ├── commitment.tsx     # Brazil tech vision
│   │   ├── integrity.tsx      # Werner Erhard's integrity
│   │   ├── alignment.tsx      # Actions from the future
│   │   └── deco.tsx           # deco CMS journey
│   ├── lib/                   # Utilities
│   │   ├── markdown.ts        # MD parsing and rendering
│   │   └── content.ts         # Content loading utilities
│   └── styles/                # Global styles
│       └── main.css           # Tailwind + custom CSS
│
├── public/                    # Static assets (copied as-is)
│   ├── fonts/
│   └── images/
│
├── dist/                      # Generated output (versioned!)
│   ├── index.html
│   ├── assets/
│   └── content/               # Pre-processed article MD files
│
├── vite.config.ts             # Vite configuration
├── tailwind.config.ts         # Tailwind v4 configuration
├── tsconfig.json
├── package.json
└── _headers                   # Cloudflare Pages headers config
```

---

## MCP Server

The heart of this project is `mcp-server.ts`. It's a single file that exposes all the tools needed to manage content and the development lifecycle.

### Tools Overview

#### Content Collections

Each collection represents a stage in the content pipeline:

| Collection | Purpose | Tools |
|------------|---------|-------|
| **Ideas** | Quick thoughts, sparks | `COLLECTION_IDEAS_*` |
| **Research** | Deep AI-powered research | `COLLECTION_RESEARCH_*` |
| **Drafts** | Article outlines | `COLLECTION_DRAFTS_*` |
| **Articles** | Published content | `COLLECTION_ARTICLES_*` |

Each collection has: `LIST`, `GET`, `CREATE`, `UPDATE`, `DELETE`

#### Content Transformation Tools

| Tool | Description |
|------|-------------|
| `IDEA_TO_DRAFT` | Transform an idea into a draft outline using AI |
| `RESEARCH_TOPIC` | Deep research on a topic using Firecrawl/Apify |
| `ENHANCE_DRAFT` | Improve draft with research and AI assistance |
| `DRAFT_TO_ARTICLE` | Polish and publish a draft as article |

#### Development Tools

| Tool | Description |
|------|-------------|
| `DEV_SERVER_START` | Start Vite dev server |
| `DEV_SERVER_STOP` | Stop dev server |
| `BUILD` | Run production build |
| `GENERATE_COMMIT` | AI-generated commit message |
| `COMMIT` | Stage and commit changes |
| `PUSH` | Push to remote |

### Bindings

The MCP server connects to external services through bindings:

```typescript
// OpenRouter for AI capabilities
const OPENROUTER_BINDING = {
  __type: "@deco/openrouter",
  value: "openrouter-connection-id"
};
```

### Example: Creating an Article

```
You: "I have an idea about how Brazil can become a tech powerhouse"

AI (via MCP):
1. COLLECTION_IDEAS_CREATE → Saves idea to content/ideas/brazil-tech-powerhouse.md
2. RESEARCH_TOPIC → Fetches data about Brazil's tech ecosystem
3. IDEA_TO_DRAFT → Creates outline in content/drafts/brazil-tech-powerhouse.md
4. ENHANCE_DRAFT → Adds research insights, improves structure
5. DRAFT_TO_ARTICLE → Polishes and moves to content/articles/

You: "Looks good, let's publish"

AI (via MCP):
1. BUILD → Regenerates dist/
2. GENERATE_COMMIT → "feat(article): add Brazil tech powerhouse article"
3. COMMIT → Stages and commits
4. PUSH → Deploys to Cloudflare
```

---

## Frontend Architecture

### SPA Runtime for Articles

The site uses a hybrid approach:

1. **Static HTML shell**: `index.html` contains the app skeleton
2. **Lazy templates**: React components for each page type
3. **Dynamic content**: Article MD files fetched on navigation

This means:
- Template code changes rarely → long cache TTL
- Article content changes often → separate cache
- Most deploys only change 1-2 files

### Routing

Simple client-side routing:

```
/                    → Home (article list)
/article/:slug       → Article view
/commitment          → Brazil vision page
/integrity           → Werner Erhard's integrity
/alignment           → Actions from the future
/deco               → deco CMS journey
```

### Theme System

```typescript
// Theme is stored in localStorage and synced to <html> attribute
type Theme = 'light' | 'dark' | 'system';

// CSS variables adapt to theme
:root {
  --bg: #F5F5F5;
  --fg: #1a1a1a;
  --accent: #1B4332;  /* Dark forest green */
}

[data-theme="dark"] {
  --bg: #0D1117;
  --fg: #e6edf3;
  --accent: #00FF41;  /* Terminal green */
}
```

---

## Content Format

All content uses Markdown with YAML frontmatter:

```markdown
---
title: "Brazil as a Global Tech Protagonist"
description: "Why I believe Brazil can lead the next wave of technology innovation"
date: 2024-12-20
tags: [brazil, technology, entrepreneurship]
status: published
---

# Brazil as a Global Tech Protagonist

Article content here...
```

### Frontmatter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `title` | Yes | Article title |
| `description` | No | Meta description for SEO |
| `date` | Yes | Publication date (YYYY-MM-DD) |
| `tags` | No | Array of topic tags |
| `status` | Yes | `draft` or `published` |

---

## Deployment

### Local Build + Push

1. Make changes (via MCP or direct edit)
2. Run `bun run build`
3. Commit everything including `dist/`
4. Push to `main`
5. Cloudflare Pages auto-deploys

### Cloudflare Pages Setup

1. Connect GitHub repo to Cloudflare Pages
2. **Build command**: (empty — we don't build on CF)
3. **Build output directory**: `dist`
4. Add `_headers` file for cache control:

```
# _headers file for Cloudflare Pages

/index.html
  Cache-Control: public, max-age=30, stale-while-revalidate=3600, stale-if-error=10800

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/content/*
  Cache-Control: public, max-age=3600, stale-while-revalidate=86400
```

### Why No CI Build?

- **Full control**: You see exactly what gets deployed
- **Reproducibility**: Same build on any machine
- **Speed**: No waiting for CI
- **Cost**: Zero build minutes consumed

---

## Development Workflow

### Starting Development

```bash
# Terminal 1: MCP server (for AI-assisted content management)
bun run mcp:dev

# Terminal 2: Frontend dev server
bun run dev
```

### Using with Cursor/Claude

Add to your MCP client config:

```json
{
  "mcpServers": {
    "vibegui": {
      "command": "bun",
      "args": ["run", "mcp:server"],
      "cwd": "/path/to/vibegui.com"
    }
  }
}
```

Now you can manage your blog through natural conversation:

- "Create an idea about [topic]"
- "Research [topic] for my next article"
- "Turn my latest draft into an article"
- "Build and deploy the site"

---

## Commands Reference

| Command | Description |
|---------|-------------|
| `bun run dev` | Start Vite dev server (port 4000) |
| `bun run build` | Production build to dist/ |
| `bun run preview` | Preview production build |
| `bun run mcp:dev` | Start MCP server (development) |
| `bun run mcp:server` | Start MCP server (for clients) |
| `bun run lint` | Run linter |
| `bun run fmt` | Format code |

---

## Learning from This Codebase

This project is intentionally simple and documented. Here's what you can learn:

### 1. MCP Server Development

See `mcp-server.ts` for:
- How to use `@decocms/runtime` to create an MCP server
- Defining tools with Zod schemas
- Implementing collection bindings
- Connecting to external AI services

### 2. Static Site Architecture

See `vite.config.ts` and `src/` for:
- Hybrid static + SPA approach
- Content-hash based asset naming
- Lazy loading strategies

### 3. Modern CSS

See `src/styles/` for:
- Tailwind v4 usage
- CSS custom properties for theming
- Mobile-first responsive design

### 4. Performance Optimization

See `CONSTRAINTS.md` for:
- Image optimization strategy
- Caching policies
- Bundle size management

---

## About the Author

**Guilherme Rodrigues** is a software engineer and entrepreneur from Rio de Janeiro. After 9 years at VTEX leading high-performance e-commerce projects (including their NYSE IPO), he founded [deco CMS](https://decocms.com) — a platform democratizing the creation of governable AI agents.

He's also a co-founder of [Movimento Tech](https://movimentotech.org.br), a coalition that has impacted over 3 million young Brazilians in technology, including the Maratona Tech — Brazil's largest technology olympiad.

### Contact

- **Website**: [vibegui.com](https://vibegui.com)
- **GitHub**: [@vibegui](https://github.com/vibegui)
- **Twitter/X**: [@vibegui](https://twitter.com/vibegui)
- **deco CMS**: [decocms.com](https://decocms.com)

---

## Pages

### Home (`/`)

The home page shows:
- A minimal banner: "Personal blog of Guilherme Rodrigues, co-founder of decocms.com, RJ ↔ NY"
- Latest article prominently displayed with title, date, and excerpt
- Scrolling list of older articles as cards

### Commitment (`/commitment`)

This page explains my top-level commitment: **making Brazil a global technology protagonist**. This means:
- GDP growth through technology
- Massive productive inclusion
- Brazilians participating in the global creative economy

*Full content explores the journey from Sweden back to Brazil, VTEX, Movimento Tech, Maratona Tech, and deco CMS.*

### Integrity (`/integrity`)

Based on Werner Erhard's distinction of integrity as a performance factor. 

*TODO: Expand with full content*

### Alignment (`/alignment`)

My understanding that our actions derive from the future we're committed to.

*TODO: Expand with full content*

### deco (`/deco`)

The journey of deco CMS — from founding to where we are today. An invitation to try our software or join us in building it.

*TODO: Expand with full content*

---

## License

Content (articles, ideas) © Guilherme Rodrigues. All rights reserved.

Code (everything else) is MIT licensed.

---

<p align="center">
  <em>Built with MCP · Served by Cloudflare · Made in Brazil 🇧🇷</em>
</p>

