---
slug: the-great-ssg-simplification-killing-json-fetches-one-page-at-a-
title: "SEO-First SSG: From Social Embeds to Zero-Fetch Pages"
description: How adding proper SEO meta tags led me to embed everything — articles, context pages, and the manifest — directly into static HTML. The journey from broken social previews to sub-15-second deploys.
date: 2026-01-01
status: published
coverImage: null
tags:
  - tech:ssg
  - tech:vite
  - tech:cloudflare
  - topic:architecture
  - topic:performance
  - type:devlog
---
# SEO-First SSG: From Social Embeds to Zero-Fetch Pages

It started with a LinkedIn preview.

I shared a blog post and got... nothing. No image, no description, just a bare URL. The kind of link people scroll past without a second thought.

Five hours later, I'd rebuilt how this entire blog generates and serves content.

## The Social Preview Problem

When you share a link on LinkedIn, Twitter, or WhatsApp, these platforms fetch your page and look for Open Graph meta tags:

```html
<meta property="og:title" content="My Article Title" />
<meta property="og:description" content="A compelling summary..." />
<meta property="og:image" content="https://example.com/og-image.png" />
```

My blog had none of this. Every article was a React SPA that fetched content at runtime. By the time the JavaScript loaded the article data, the social crawler had already given up.

The fix was obvious: generate static HTML with proper meta tags.

## Generating the OG Image

First, I needed an image. I used our MCP Mesh to call [Gemini 2.5 Flash Image Preview (Nano Banana)](https://openrouter.ai/google/gemini-2.5-flash-image-preview) via OpenRouter — a state-of-the-art image generation model with contextual understanding:

![OG Image](/images/og-default.png)

One tool call, one image. Saved to `public/images/og-default.png` and ready for all articles to reference.

## From SEO Tags to Full SSG

Here's where it got interesting.

To generate proper SEO tags, I needed to create individual HTML files for each article:

```html
<!-- dist/article/my-post/index.html -->
<title>My Post | vibegui</title>
<meta property="og:title" content="My Post" />
<meta property="og:description" content="Post description..." />
<meta property="og:image" content="https://vibegui.com/images/og-default.png" />
```

But wait — if I'm already generating an HTML file for each article with its title and description... why am I still fetching the article content at runtime?

The answer: I shouldn't be.

## Embed Everything

Instead of generating HTML shells that fetch JSON, I now embed the full article content directly:

```html
<div id="root"></div>
<script id="article-data" type="application/json">
  {"slug":"my-post","title":"My Post","content":"# Full markdown here..."}
</script>
```

React reads this on hydration. Zero fetches.

Same pattern for the homepage — the article manifest is embedded in `index.html`:

```html
<script id="manifest-data" type="application/json">
  {"articles":[...],"projects":[...]}
</script>
```

And for context pages (my leadership notes):

```html
<script id="context-data" type="application/json">
  {"path":"leadership/01_integrity","title":"Integrity","content":"# Full markdown..."}
</script>
```

Every page loads with **zero API calls**. The data is just... there.

## The Dev Experience: Vite Middleware

SSG in production is easy. The tricky part is development.

In dev mode, I want hot reload. But the SSG HTML files are pre-generated. How do I serve them through Vite with HMR?

The solution: a custom Vite middleware that intercepts article and context routes, reads the pre-generated HTML, extracts the embedded data, injects it into the main `index.html`, and transforms it through Vite:

```typescript
// vite.config.ts
function ssgDevMiddleware(): Plugin {
  return {
    name: "ssg-dev-middleware",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // Intercept /article/* and /context/* routes
        // Read SSG HTML from .build/
        // Extract embedded data script
        // Inject into main index.html
        // Transform through Vite (adds HMR client)
        const transformed = await server.transformIndexHtml(url, html);
        res.end(transformed);
      });
    },
  };
}
```

Now I get the best of both worlds: SSG content with full hot reload.

## Simplified Cloudflare Build

The old build had too many steps. Now it's two scripts:

**Step 1: `generate.ts`** (needs SQLite)
- Reads content from SQLite database
- Writes `manifest.json`
- Generates article HTML files to `.build/article/`
- Generates context HTML files to `.build/context/`

**Step 2: `finalize.ts`** (no SQLite needed)
- Runs after Vite build
- Copies SSG pages to `dist/`
- Injects production asset references
- Embeds manifest into `index.html`

On Cloudflare Pages:
- No `npm install` (SKIP_DEPENDENCY_INSTALL=true)
- No Vite build (assets committed to git)
- Just two Node.js scripts
- **~15 second deploys**

## Context Pages Get Full SEO

While I was at it, I gave context pages the same treatment:

```html
<title>Integrity: The First Foundation | vibegui</title>
<meta name="description" content="Integrity means nothing is hidden..." />
<meta property="og:title" content="Integrity: The First Foundation" />
<meta name="twitter:card" content="summary" />
```

The description is auto-extracted from the first paragraph of the markdown — no more lazy "LLM-generated summary" placeholders.

## The Architecture Now

```
┌─────────────────────────────────────────────────────────────────┐
│               scripts/generate.ts                               │
│                                                                 │
│   SQLite → manifest.json                                        │
│          → .build/article/{slug}/index.html (embedded content)  │
│          → .build/context/{path}/index.html (embedded content)  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│               vite build (local only)                           │
│                                                                 │
│   In dev: middleware serves SSG pages with HMR                  │
│   In prod: bundles React app → dist/                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│               scripts/finalize.ts                               │
│                                                                 │
│   • Embed manifest into index.html                              │
│   • Copy SSG pages to dist/                                     │
│   • Inject production assets into SSG HTML                      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│               Cloudflare Pages                                  │
│                                                                 │
│   • No npm install needed                                       │
│   • ~15 second deploys                                          │
│   • Every page has full SEO meta tags                           │
│   • Zero runtime fetches                                        │
└─────────────────────────────────────────────────────────────────┘
```

## What I Learned

**1. SEO requirements lead to better architecture**

Wanting proper social previews forced me to generate real HTML. Once I had real HTML, embedding data was obvious.

**2. Dev experience matters**

SSG is useless if it kills your dev workflow. The Vite middleware keeps hot reload working while serving pre-generated content.

**3. Simplify relentlessly**

Three build scripts became two. Runtime fetches became zero. Cloudflare deploys went from minutes to seconds.

**4. Embed beats fetch for static content**

If the data doesn't change between page loads, it shouldn't require a network request. Put it in the HTML.

## What's Next

The architecture is finally simple enough that I understand every step. No magic, no fetches, no surprises.

Share this post on LinkedIn. Check the preview. It works now.

---

*Five hours of vibe coding with Claude. Every change documented through MCP tools.*