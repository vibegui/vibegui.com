---
slug: from-whatsapp-to-bookmarks-building-an-mcp-powered-link-aggregat
title: "From WhatsApp to Bookmarks: Building an MCP-Powered Link Aggregator"
description: Building a link aggregation system with AI enrichment — from WhatsApp scraping to SQLite databases to a searchable dashboard.
date: 2025-12-27
status: published
coverImage: null
tags:
  - mcp
  - whatsapp
  - bookmarks
  - chrome-extension
  - agentic-workflows
---
# From WhatsApp to Bookmarks: Building an MCP-Powered Link Aggregator

For the past 6 months, two WhatsApp groups at my company have been my primary source of interesting links. We have a general team chat and a developer-focused group where people regularly drop tools, articles, and GitHub repos worth checking out. The problem is that WhatsApp is terrible for this. Links disappear into endless scrolling. There's no search. No categorization. No way to revisit that article someone shared in March.

I took this as an opportunity to build something around our new [MCP mesh](https://github.com/deco-cx/mesh) — a personal link aggregation system with AI enrichment.

## Extracting Links from WhatsApp

WhatsApp Web doesn't have an API. It really doesn't want you to export data programmatically. But it's just a web page with a DOM.

I built a Chrome extension that:
1. Injects into WhatsApp Web
2. Auto-scrolls through conversation history to load older messages
3. Extracts all URLs from message text

I ran this manually on both our company groups — the general chat and the dev channel — and pulled out about 500 unique links. The extension dumps everything to a text file which I then processed into CSV.

The next step is wiring this up so agents can trigger scrapes directly via MCP. That's for another post.

## The CSV Phase (and Why It Failed)

My first approach was straightforward: parse the extracted links into a CSV file. Title, URL, maybe some tags. Easy to edit, version-controlled, done.

This lasted about 2 hours.

The problems started piling up:
- Parsing CSV reliably is surprisingly annoying (quotes inside fields, commas in URLs, newlines in descriptions)
- LLMs really struggle with CSV — they hallucinate column alignment, miss rows, duplicate entries
- No structured queries — filtering by tag meant grep or loading everything into a script
- Concurrent edits from different MCP tools caused merge conflicts

I was spending more time debugging CSV parsing than actually curating links. Time for something structured.

## The SQLite Migration

SQLite turned out to be exactly what I needed. Single file, no server, git-friendly, and LLMs handle SQL without the weird edge cases.

```sql
CREATE TABLE bookmarks (
  id INTEGER PRIMARY KEY,
  url TEXT UNIQUE NOT NULL,
  title TEXT,
  description TEXT,
  research_raw TEXT,
  exa_content TEXT,
  stars INTEGER,
  language TEXT,
  icon TEXT,
  insight_dev TEXT,
  insight_founder TEXT,
  insight_investor TEXT,
  classified_at TEXT,
  created_at TEXT,
  updated_at TEXT
);
```

Once I had bookmarks in SQLite, I looked at my blog content — articles, drafts — still sitting in markdown files with YAML frontmatter. Same problems: hard to query, awkward for MCP tools, no structured updates. So I migrated those too. Now everything lives in `data/bookmarks.db` and `data/content.db`.

## Browser Bookmarks

I also had years of curated folders in my browser: "Refs", "Must Read", "Watchlist", "Readlist". These needed to go into the same database.

Every browser stores bookmarks differently, which is annoying:
- **Chrome/Brave/Edge** — JSON file with Windows timestamps (microseconds since 1601, because why not)
- **Safari** — Binary plist
- **Firefox** — SQLite database with its own schema

I wrote readers for each format and exposed them as MCP tools:

| Tool | Description |
|------|-------------|
| `BOOKMARKS_DISCOVER_BROWSERS` | Find all browser profiles on the system |
| `BOOKMARKS_READ` | Read bookmarks from a specific browser |
| `BOOKMARKS_SEARCH` | Search across all browsers by URL or title |
| `BOOKMARKS_EXPORT_CSV` | Export to CSV format |

The discover tool returns something like:

```json
{
  "profiles": [
    { "browser": "chrome", "name": "Default", "path": "..." },
    { "browser": "brave", "name": "Profile 1", "path": "..." },
    { "browser": "comet", "name": "Default", "path": "..." }
  ]
}
```

From there I can read specific profiles or search across all of them. I merged everything into the main database — another 100+ links from my browser curation.

## AI Enrichment

At this point I had 400+ links, but most were just URLs with maybe a title scraped from the page. I wanted a way to quickly find which links are actually interesting, which ones relate to topics I care about (MCP, AI agents, TypeScript tooling), and which ones I can safely ignore.

Manual curation doesn't scale. So I built an enrichment pipeline that runs through each link:

```
Perplexity → Exa → Claude Sonnet
(research)   (content)   (classification)
```

**Step 1: Research.** Ask Perplexity what this URL is about — purpose, features, target audience. This gives context even for pages that are hard to scrape.

**Step 2: Content.** Use Exa to fetch the actual page content. Some pages block scrapers, but Exa usually gets through.

**Step 3: Classification.** Send both research and content to Claude Sonnet with a prompt asking for:
- Star rating (1-5)
- Improved title and description
- Tags by tech stack, type, and audience
- Three insights: one for developers, one for founders, one for investors

The rating prompt is important. I tell Claude to be harsh — most resources should be 2-3 stars. Only genuinely excellent content gets 4-5. This prevents the "everything is great" problem where ratings become meaningless.

The three insights let me browse the collection from different angles. Sometimes I want to know what's technically interesting. Sometimes I want to know what's relevant for the business.

## The Build Pipeline

For deployment, the database needs to become something the frontend can consume. Currently I export to JSON at build time:

```typescript
const rows = db.prepare("SELECT * FROM bookmarks").all();
writeFileSync("public/bookmarks/data.json", JSON.stringify(rows));
```

The build runs on Cloudflare Pages using Node 22's native `node:sqlite`. No npm install needed — the database is in git, the export script reads it directly.

### What's Not Great

This works, but the JSON file is getting large. 400 bookmarks with full enrichment data adds up. Loading it all upfront on page load isn't ideal, especially as the collection grows.

The next iteration will use [sql.js-httpvfs](https://github.com/nickreese/sql.js-httpvfs) to serve the SQLite database directly from R2. The frontend would make actual SQL queries over HTTP range requests — pagination, filtering, search, all without loading a giant JSON blob. That's on the roadmap.

## The WAL Gotcha

One thing that bit me: SQLite's Write-Ahead Logging. Writes go to a `.wal` file first, then get merged into the main `.db` during checkpoints. The WAL files are gitignored (they're ephemeral), so if you commit without checkpointing, your changes sit in the WAL and never make it to the repo.

I lost data to this twice before adding a pre-commit hook:

```yaml
# lefthook.yml
5_checkpoint_db:
  run: |
    sqlite3 data/bookmarks.db "PRAGMA wal_checkpoint(TRUNCATE);"
    sqlite3 data/content.db "PRAGMA wal_checkpoint(TRUNCATE);"
```

Now all writes get merged into the main database before every commit.

## The Dashboard

The final piece is a React page at `/bookmarks` with filtering:

- **By persona**: Developer, Founder, Investor
- **By tech stack**: TypeScript, React, AI, MCP, etc.
- **By type**: Tool, Article, Video, Repo
- **By platform**: GitHub, LinkedIn, Twitter, YouTube
- **By rating**: Minimum stars

Each bookmark shows an icon, title, description, star rating, and buttons to view the AI-generated insights. Clicking the stars opens the developer insight. The other insights are accessible via buttons.

## Current Numbers

| Metric | Value |
|--------|-------|
| Links from WhatsApp | ~500 |
| Links from browsers | ~100 |
| After deduplication | 400 |
| AI-enriched | 42 |
| Build time | ~3 seconds |

## What's Next

- **sql.js-httpvfs** for direct database queries from the browser
- **MCP control** for the WhatsApp extension so agents can trigger scrapes
- **Periodic sync** from browsers and chat groups
- **RSS feed** of new links

The code is at [github.com/deco-cx/vibegui.com](https://github.com/deco-cx/vibegui.com) and the dashboard is live at [vibegui.com/bookmarks](/bookmarks).

---

*Built with Claude Opus 4.5 via MCP.*