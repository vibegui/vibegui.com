---
slug: hello-world-building-an-mcp-native-blog
title: "Hello World: Building an MCP-Native Blog"
description: Welcome to vibegui.com — a personal blog built entirely through MCP, served at the edge with sub-100KB payloads.
date: 2025-12-21
status: published
coverImage: null
tags:
  - hello-world
  - mcp
  - architecture
  - edge
  - performance
---
# Hello World: Building an MCP-Native Blog

Welcome to **vibegui.com** — my personal blog, experiment sandbox, and a demonstration of what's possible when you build content-first with MCP (Model Context Protocol).

This post documents what we actually built: a fully MCP-native publishing platform where every piece of content flows through AI-accessible tools, deploys to Cloudflare Pages in under 20 seconds, and respects strict performance constraints verified by automated tests.

## The Stack

- **Vite + React 19** — with React Compiler
- **Tailwind CSS v4** — utility-first styling with design tokens
- **Bun** — fast runtime and test runner
- **Playwright** — E2E tests for accessibility, responsive design, and performance
- **MCP Server** — local TypeScript server exposing tools for content management
- **Cloudflare Pages** — edge deployment with intelligent caching

## Architecture: MCP All The Way Down

```
┌─────────────────────────────────────────────────────────────────┐
│                    MCP Server (main.ts)                         │
├─────────────────────────────────────────────────────────────────┤
│  COLLECTIONS                                                    │
│  ├── Ideas      → Quick thoughts, captured in seconds           │
│  ├── Research   → Deep dives, LLM-generated topic stubs         │
│  ├── Drafts     → Work in progress                              │
│  └── Articles   → Published content (you're reading one!)       │
├─────────────────────────────────────────────────────────────────┤
│  DEV TOOLS (auto-generated from package.json)                   │
│  ├── SCRIPT_DEV      → Start Vite dev server                    │
│  ├── SCRIPT_BUILD    → Production build                         │
│  ├── SCRIPT_TEST     → Run unit tests                           │
│  ├── SCRIPT_TEST_E2E → Run Playwright tests                     │
│  └── SCRIPT_PRECOMMIT → Full CI pipeline locally                │
├─────────────────────────────────────────────────────────────────┤
│  SEARCH TOOLS (ripgrep-powered)                                 │
│  ├── SEARCH_CONTENT  → Find patterns in articles                │
│  ├── SEARCH_CONTEXT  → Search reference materials               │
│  └── SEARCH_ALL      → Search everything                        │
├─────────────────────────────────────────────────────────────────┤
│  GIT TOOLS                                                      │
│  ├── GIT_STATUS      → See what changed                         │
│  ├── COMMIT          → Stage all + commit                       │
│  └── PUSH            → Push to remote                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Cloudflare Pages (Edge)                       │
│   • Pre-built dist/ folder (no npm install on CF!)              │
│   • Content-hash URLs → 1 year immutable cache                  │
│   • HTML → 30s cache, 1h stale-while-revalidate                 │
└─────────────────────────────────────────────────────────────────┘
```

## Resilient Deploys: No npm, No Problem

I've grown paranoid about non-reproducible builds.

npm registries go down. esm.sh has outages. Package versions get yanked. Transitive dependencies break in ways you didn't expect. I've seen production deploys fail because a CDN couldn't resolve a package that worked fine 10 minutes ago.

For a personal blog that I want to last for years, I wanted **complete resilience**. No external dependencies at deploy time. No network calls to package registries. Just static files.

The solution: **build locally, commit the `dist/` folder, deploy only what's already built.**

### How It Works

1. **Pre-commit hook** (via Lefthook) runs the full CI pipeline locally:
   - Format with Biome
   - Lint with oxlint
   - TypeScript check
   - Vite build → produces `dist/`
   - Stage `dist/` automatically
   - Run constraint tests
   - Run E2E tests with Playwright

2. **Everything is verified before it leaves my machine.** If the E2E tests fail, the commit is rejected. No broken deploys.

3. **Cloudflare Pages config**:
   - Build command: `npm run pages:build` (just copies markdown files to `dist/`)
   - Build output: `dist`
   - Environment variable: `SKIP_DEPENDENCY_INSTALL=true`

The key insight: since `dist/` is already complete and tested, Cloudflare doesn't need to run npm install at all. I can skip dependency installation entirely. The deploy becomes a simple file copy.

```bash
# What happens on every commit
$ git commit -m "New article"

╭───────────────────────────────────────╮
│ 🥊 lefthook v1.13.6  hook: pre-commit │
╰───────────────────────────────────────╯
✔️ 1_format (0.05s)
✔️ 2_lint (0.06s)
✔️ 3_typecheck (1.31s)
✔️ 4_build (0.72s)      ← Vite builds in <1s
✔️ 5_stage (0.01s)      ← dist/ is staged
✔️ 6_constraints (0.03s)
✔️ 7_e2e (6.47s)

# Push → CF deploys in ~15s (just copies files, no npm)
```

The side effect is speed — deploys take 15-20 seconds instead of 2-3 minutes — but the real win is reliability. My blog will deploy correctly even if npm is having a bad day.

## Constraint-Driven Development

Performance isn't aspirational — it's enforced. We have automated tests that fail the build if constraints are violated:

### Build Size Constraints

```typescript
// tests/constraints/build-size.test.ts
test("index.html compressed size < 100KB", async () => {
  const html = await Bun.file("dist/index.html").text();
  const compressed = Bun.gzipSync(new TextEncoder().encode(html));
  expect(compressed.length).toBeLessThan(100 * 1024);
});

test("app code (non-vendor) < 50KB", async () => {
  // Ensures our actual code stays small
  // Vendor chunks (React, markdown parser) are separate
});
```

### Image Constraints

Every image in `public/` and `content/` must be under 250KB. A pre-commit optimization script runs Sharp to resize and compress.

### Content-Hash Everything

Every asset is named with a content hash — not just JS and CSS, but **articles and markdown too**:

- `index.A1B2C3D4.js` — app bundle
- `hello-world.5de02914.md` — article content
- `manifest.215efd59.json` — content manifest

If the content doesn't change, the hash doesn't change, and the filename stays the same. This means **deploys only invalidate what actually changed**. Publish a new article? Only the manifest and that article get new hashes. Everything else stays cached.

The manifest hash is injected into `index.html` at build time:

```html
<script>window.__MANIFEST_PATH__="/content/manifest.215efd59.json";</script>
```

The app reads this on load, fetches the manifest, and uses the hashed article paths. Everything except `index.html` gets `Cache-Control: public, max-age=31536000, immutable`.

Here's the clever part: we don't commit the hashed content files. The source markdown lives in `content/` and `context/`, and the Vite plugin generates a manifest with pre-computed hashes. On Cloudflare Pages, the `pages:build` script reads those hashes and copies files to `dist/` with hashed names. No duplication in git, and the hashing is deterministic — same content always produces the same hash.

## The Context System

Beyond articles, the site includes a **Context** section: LLM-generated summaries of papers and books that inform my thinking. These aren't reproductions — they're interpretive notes that help me internalize concepts.

The MCP server exposes `SEARCH_CONTEXT` to find relevant references while writing:

```typescript
// Find references to "integrity" across all context files
SEARCH_CONTEXT({ pattern: "integrity", contextLines: 5 })
```

This powers AI-assisted writing where the agent can pull in relevant context from my reading notes.

## What I Learned

### 1. Pre-built Deploys Are Underrated

The mental model shift: treat `dist/` as a first-class artifact. Version it. Test it. Deploy it directly. Your CI becomes your local machine, and deploys become file copies.

### 2. MCP Makes AI-First Natural

When every action is a tool call, there's no context switching. Write prose → call `COLLECTION_ARTICLES_CREATE` → call `COMMIT` → call `PUSH`. The agent does it all. This entire article was written through MCP tools.

### 3. Cloudflare's JSON and MD Caching Quirk

JSON and Markdown files return `Cf-Cache-Status: DYNAMIC` by default, even with proper `Cache-Control` headers. The fix: setup a Cache Rule in the dashboard with the correct path and mark "eligible for cache".

## The Road Ahead

This blog will document:

- **MCP patterns** — what works, what doesn't, how to structure agent-first applications
- **Agentic workflows** — connecting Exa, Perplexity and others in my MCP Mesh to create powerful workflows
- **deco CMS** — the platform I'm building to democratize AI-powered software creation  
- **Brazil's tech future** — my commitment to making Brazil a global technology protagonist
- **The meta-journey** — building in public, with AI, through MCP

Every article you read here was created, edited, and published through the same MCP tools you could use yourself.

The source is at [github.com/vibegui/vibegui.com](https://github.com/vibegui/vibegui.com). Star it, fork it, make it yours.

This is a living experiment! I will write more on it as it evolves.

---

*This article and blog was authored collaboratively with Claude Opus 4.5 via MCP. Total time from idea to published: ~6 hours of vibe coding.*