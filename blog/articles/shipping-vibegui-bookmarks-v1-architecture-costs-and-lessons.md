---
slug: shipping-vibegui-bookmarks-v1-architecture-costs-and-lessons
title: "Shipping vibegui Bookmarks v1: Architecture, Costs, and Lessons"
description: How I built an AI-enriched bookmark manager using MCP, Gemini Flash, Firecrawl, and Perplexity — and what it cost to enrich 305 bookmarks.
date: 2025-12-29
status: published
coverImage: null
tags:
  - tech:llm
  - tech:mcp
  - tech:supabase
  - topic:ai-tools
  - topic:architecture
  - type:launch
---
# Shipping vibegui Bookmarks v1: Architecture, Costs, and Lessons

I just shipped [vibegui Bookmarks](/bookmarks) — an AI-enriched bookmark manager that analyzes every link I save and generates tailored insights for three personas: developers, founders, and investors.

Here's what I built, how much it cost, and what I learned.

## What It Does

Every bookmark goes through an enrichment pipeline:

1. **URL saved** → stored in Supabase (PostgreSQL)
2. **Content scraped** → Firecrawl extracts the full page content
3. **Context added** → Perplexity searches for additional info (author background, related projects)
4. **Analysis generated** → Gemini Flash 2.5 produces structured insights

The output includes:
- Title, description, and icon
- 1-5 star rating
- Tags for filtering (type, tech stack, platform, topic)
- Tailored insights for each persona

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│  MCP Mesh   │────▶│  Supabase   │
│  Extension  │     │   Gateway   │     │  PostgreSQL │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ Firecrawl│ │Perplexity│ │OpenRouter│
        │  (scrape)│ │ (search) │ │ (analyze)│
        └──────────┘ └──────────┘ └──────────┘
```

**Services:**
- [MCP Mesh](https://github.com/decocms/mesh) — MCP gateway for orchestrating AI tools
- [Firecrawl](https://firecrawl.dev) — Web scraping API
- [Perplexity](https://perplexity.ai) — Search API for context enrichment
- [OpenRouter](https://openrouter.ai) — Multi-model LLM gateway (using Gemini Flash 2.5)

The frontend is a React SPA with:
- Filterable table (by track, tech, type, platform, rating)
- Full-text search
- Modal detail view with insights per persona
- Mobile-friendly card layout
- Bulk re-enrichment controls

Everything runs through MCP (Model Context Protocol) via a custom gateway, letting me orchestrate tool calls between Firecrawl, Perplexity, and OpenRouter from a single interface.

## The Cost Breakdown

For 305 enriched bookmarks:

| Service | Usage | Cost |
|---------|-------|------|
| **OpenRouter (Gemini Flash)** | 358 calls, 5.3M tokens | $2.64 |
| **Firecrawl** | 395 of 3,000 credits/mo | ~$2.50 (of $19/mo) |
| **Perplexity** | 488 requests, 354K tokens | $7.56 |
| **Total** | — | **~$12.70** |

That's **$0.04 per bookmark** for full page scraping, web search context, and LLM analysis.

Gemini Flash 2.5 is absurdly cheap for structured output. Most calls used 10-15K input tokens (scraped page content) and generated ~1K output tokens (JSON with insights). The largest single call processed 612K input tokens for $0.19.

## What I Delivered

- ✅ Browser extension to save bookmarks
- ✅ Enrichment pipeline (scrape → search → analyze)
- ✅ Structured output with persona-specific insights
- ✅ Filterable/searchable web UI
- ✅ Mobile-responsive card layout
- ✅ 305 bookmarks enriched and ready to browse

## Bugs Squashed Along the Way

Building this wasn't smooth. A few issues I fixed today:

**SQL Escaping** — Insights with backslashes broke PostgreSQL queries. Switched from manual quote escaping to dollar-quoting (`$$text$$`).

**LLM Output Truncation** — Some insights ended mid-sentence. The OpenRouter MCP didn't expose `max_tokens`, so I forked the package, added the parameter, and published v1.6.0 to npm. Set it to 16K for Gemini Flash.

**JSON Parsing Failures** — The LLM sometimes returned malformed JSON (literal newlines in strings, unescaped quotes). Instead of patching with regex, I simplified the prompt to request arrays instead of complex pipe-separated strings:

```json
// Before: fragile
{ "insight_dev": "- Bullet 1. | - Bullet 2. | - Bullet 3." }

// After: robust
{ "insight_dev": ["Paragraph 1.", "Paragraph 2.", "Paragraph 3."] }
```

**Prompt Sharpening** — The original prompt was verbose. I condensed the JSON rules, added "CRITICAL" emphasis for key constraints, and shortened paragraph targets from 3-5 sentences to 2-4. Result: denser, sharper insights.

## Lessons Learned

1. **LLM output is never guaranteed** — Even with strict prompts, you need parsing fallbacks and retry logic. But don't over-engineer regex fixes; simplify the output format instead.

2. **Own your dependencies** — Forking the OpenRouter MCP meant I could add `max_tokens` in 10 minutes instead of waiting for an upstream PR.

3. **Token costs are predictable** — Gemini Flash at $0.075/M input and $0.30/M output means I can estimate costs before running batch jobs.

4. **MCP orchestration is powerful** — Having Firecrawl, Perplexity, and OpenRouter as tools in a unified gateway makes building AI pipelines feel like composing functions.

5. **Start with the data** — The bookmark database schema came first. Everything else (scraping, enrichment, UI) was built to serve that data model.

## What's Next

- RSS feed integration for auto-importing links
- Embedding-based semantic search
- Weekly digest emails with top bookmarks
- Public sharing for curated collections

For now, v1 is live at [/bookmarks](/bookmarks). Browse away.