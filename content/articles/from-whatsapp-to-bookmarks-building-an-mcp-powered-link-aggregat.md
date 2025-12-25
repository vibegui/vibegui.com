---
title: "From WhatsApp to Bookmarks: Building an MCP-Powered Link Aggregator"
description: "How I built a WhatsApp scraper extension, a browser bookmarks MCP, and aggregated 6 months of curated links into a public dashboard — all through AI-assisted vibe coding."
date: 2025-12-25
tags: ["mcp","whatsapp","bookmarks","chrome-extension","agentic-workflows"]
status: draft
---

# From WhatsApp to Bookmarks: Building an MCP-Powered Link Aggregator

For the past 6 months, a small WhatsApp group of developer friends has been my primary source of interesting links. Every day, someone drops a new tool, article, or GitHub repo worth checking out. The problem: WhatsApp is a black hole. Links disappear into endless scrolling. There's no search. No categorization. No way to revisit that amazing article someone shared in March.

So I did what any reasonable engineer would do: I built an entire system to extract, aggregate, and publish these links — using MCP tools all the way down.

## The Problem

My link curation was scattered across three places:

1. **WhatsApp group** — 6 months of links buried in chat history
2. **Browser bookmarks** — curated folders in Comet (my daily driver)
3. **My brain** — vague memories of "that thing someone shared"

None of these were searchable. None were shareable. And I kept losing gems.

## The Solution: Three Tools, One Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│  WhatsApp Web Extension                                         │
│  ├── Chrome extension with MCP bridge                           │
│  ├── WebSocket connection to local MCP server                   │
│  └── WHATSAPP_SCRAPE tool for full history extraction           │
├─────────────────────────────────────────────────────────────────┤
│  Bookmarks MCP                                                  │
│  ├── BOOKMARKS_DISCOVER_BROWSERS → Find all browser profiles    │
│  ├── BOOKMARKS_READ → Extract from Chrome/Brave/Safari/Firefox  │
│  ├── BOOKMARKS_SEARCH → Cross-browser search                    │
│  └── BOOKMARKS_EXPORT_CSV → CSV export for aggregation          │
├─────────────────────────────────────────────────────────────────┤
│  Bookmarks Dashboard                                            │
│  └── React page at /bookmarks/ with filtering and search        │
└─────────────────────────────────────────────────────────────────┘
```

## Part 1: The WhatsApp Scraper

WhatsApp Web doesn't have an API. It doesn't want you to export your data programmatically. But it's just a web page with a DOM.

I built a Chrome extension that:

1. **Injects into WhatsApp Web** and connects via WebSocket to my local MCP server
2. **Exposes scraping tools** as MCP commands the AI can call
3. **Auto-scrolls** through conversation history to load older messages
4. **Filters and extracts** URLs from message text

The key insight: by making it an MCP tool, I could simply tell Claude:

> "Scrape the full history of the Links group and extract all URLs"

And it would call `WHATSAPP_SCRAPE`, scroll through months of history, and return a structured list of links.

### The Architecture

```
┌─────────────────────┐     MCP      ┌──────────────────────┐
│   AI Agent          │◄────────────►│  vibegui.com MCP     │
│  (Cursor/Claude)    │   Protocol   │  Server (Bun)        │
└─────────────────────┘              └──────────┬───────────┘
                                                │
                                     WebSocket  │ :9999
                                                │
                                     ┌──────────▼───────────┐
                                     │  Chrome Extension    │
                                     │  (content.js)        │
                                     └──────────┬───────────┘
                                                │
                                       DOM      │
                                                │
                                     ┌──────────▼───────────┐
                                     │  WhatsApp Web        │
                                     │  (web.whatsapp.com)  │
                                     └──────────────────────┘
```

The extension maintains a persistent WebSocket connection. When the MCP server receives a `WHATSAPP_READ_MESSAGES` call, it forwards it to the extension, which queries the DOM, and returns structured data back through the chain.

## Part 2: The Bookmarks MCP

WhatsApp wasn't enough. I also had curated folders in my browser: "Refs", "Must Read", "Watchlist", "Readlist". These needed to be aggregated too.

The problem: every browser stores bookmarks differently.

- **Chrome/Brave/Edge** — JSON file at `~/Library/Application Support/Google/Chrome/.../Bookmarks`
- **Safari** — Binary plist at `~/Library/Safari/Bookmarks.plist`
- **Firefox** — SQLite database at `~/Library/.../places.sqlite`

So I built browser readers for all of them:

```typescript
// Discover all browsers on the system
const profiles = await discoverAllProfiles();
// Found 4 profiles: Chrome, Dia, Comet, Safari

// Read bookmarks from Comet
const data = await createReader("comet").readBookmarks(profiles[0]);
// 78 bookmarks in 18 folders
```

Then exposed them as MCP tools:

| Tool | Description |
|------|-------------|
| `BOOKMARKS_DISCOVER_BROWSERS` | Find all browser profiles on the system |
| `BOOKMARKS_READ` | Read bookmarks from a specific browser |
| `BOOKMARKS_SEARCH` | Search across all browsers |
| `BOOKMARKS_EXPORT_CSV` | Export to CSV format |

Now I could tell Claude:

> "Extract bookmarks from Comet, ignore the 'general', 'deco', and 'pending' folders, and add the rest to our CSV"

And it would:
1. Call `BOOKMARKS_READ` to get all bookmarks
2. Filter by folder
3. Append to the CSV, skipping duplicates

## Part 3: The Aggregation

After scraping WhatsApp and importing browser bookmarks, I had 300+ links in a CSV:

```csv
url,category,domain,content_type,relevance,title,description
https://dust.tt/,reference,dust,product,learning,Dust,Custom AI agents
https://leap.new/,reference,leap,product,learning,Leap,AI developer agent
...
```

The data needed cleaning. More MCP commands:

> "Remove internal Loom recordings, Instagram reels, and LinkedIn profile links"

```
Removed:
  Internal (Loom/Grain/Jam): 8
  Instagram reels: 11
  LinkedIn profiles: 8

Remaining rows: 297
```

Then:

> "Remove misc X/Twitter posts, keep only the learning ones"

```
Removed misc X/Twitter posts: 34
Remaining rows: 263
```

**Final result: 263 curated links**, cleaned and categorized.

## Part 4: The Dashboard

A CSV isn't a product. So I built a simple React page at `/bookmarks/`:

- **Category filters** — reference, tool, media, social
- **Relevance filters** — learning, ops, competitor
- **Domain grouping** — see all GitHub repos, all YouTube videos
- **Search** — full-text across titles and descriptions

It's intentionally minimal. No database. No backend. Just a CSV that gets bundled into the static build.

## What I Learned

### 1. MCP Makes Messy Data Work Tractable

Scraping WhatsApp, parsing browser bookmark formats, cleaning CSV data — these are all annoying tasks. But when they're exposed as tools, you can chain them conversationally:

> "Read bookmarks from Comet" → "Filter to these folders" → "Add to CSV" → "Remove duplicates"

Each step is atomic and inspectable.

### 2. Browser Bookmark Formats Are Wild

Chrome uses a custom timestamp format (microseconds since 1601 — thanks, Windows). Safari uses binary plists. Firefox uses SQLite with a complex schema. Building readers for all of them was a journey.

### 3. The WhatsApp DOM Is Fragile

WhatsApp updates their web client frequently. The selectors I use today might break tomorrow. The extension is inherently brittle — but that's fine for personal use.

### 4. CSV Is Underrated

For a personal link collection, CSV is perfect:
- Version controlled in git
- Human-editable
- Easy to parse in any language
- No database to maintain

## The Numbers

| Metric | Value |
|--------|-------|
| WhatsApp messages scraped | ~2,000 |
| Browser profiles discovered | 4 |
| Raw links extracted | 400+ |
| After deduplication | 324 |
| After cleanup | 263 |
| Categories | 7 |
| Relevance tags | 8 |

## Try It Yourself

The bookmarks dashboard is live at [vibegui.com/bookmarks/](/bookmarks/).

The code is open source:
- **WhatsApp extension**: `extensions/whatsapp-scraper/`
- **Bookmarks MCP**: `lib/bookmarks/` + tools in `mcp-server.ts`
- **Dashboard**: `src/pages/bookmarks.tsx`

All at [github.com/vibegui/vibegui.com](https://github.com/vibegui/vibegui.com).

## What's Next

This is just the start. Future ideas:

- **Auto-categorization** using LLMs to analyze page content
- **Periodic sync** from WhatsApp and browsers
- **RSS feed** of new links
- **Collaborative curation** — let others submit links

For now, I finally have a searchable, shareable collection of the best links from my dev community. And I built it in a weekend of vibe coding.

---

*Built with Claude Opus 4.5 via MCP. The WhatsApp scraper, bookmarks reader, cleanup scripts, and this article were all created through conversational tool calls.*