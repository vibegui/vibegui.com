---
slug: running-local-mcps-stdio-firecrawl-and-the-supabase-migration
title: "Running Local MCPs: STDIO, Firecrawl, and the Supabase Migration"
description: A Saturday coding session that started with wanting to track Perplexity API costs and ended with a complete infrastructure overhaul.
date: 2025-12-28
status: published
coverImage: null
tags:
  - tech:mcp
  - tech:supabase
  - tech:firecrawl
  - type:devlog
  - topic:vibecoding
---
# Running Local MCPs: STDIO, Firecrawl, and the Supabase Migration

Today's coding session started with a simple goal: I wanted to use my own Perplexity API key instead of our shared Perplexity MCP. I wanted to see exactly what the enrichment pipeline was costing me, token by token.

That innocent desire cascaded into implementing STDIO transport support, fixing a binary stream corruption bug in a community MCP, replacing Exa with Firecrawl, migrating 400+ bookmarks from SQLite to Supabase, and optimizing the entire enrichment pipeline for speed.

## Part 1: The Perplexity Problem

My [bookmark enrichment system](/bookmarks) uses Perplexity to research each URL before classifying it. Until now, I was using our shared Perplexity MCP hosted on Cloudflare. This worked, but I had no visibility into costs.

I wanted to run `@perplexity-ai/mcp-server` locally with my own API key. But our [MCP Mesh](https://github.com/deco-cx/mesh) only supported HTTP-based connections. Local MCP servers typically communicate over STDIO — standard input/output streams.

Time to add STDIO support.

## Part 2: Implementing STDIO Transport

STDIO is how most MCP servers work. The host spawns the server as a child process and communicates over stdin/stdout using JSON-RPC. It's simpler than HTTP — no ports to manage, no CORS, no authentication. Just pipes.

I opened [PR #2098](https://github.com/decocms/mesh/pull/2098) to add STDIO transport to Mesh:

```typescript
// StdioConnectionManager spawns and manages local MCP processes
const proc = spawn(command, args, {
  cwd: workingDirectory,
  env: { ...process.env, ...envVars },
  stdio: ["pipe", "pipe", "pipe"],
});

// Connect MCP client to the process streams
const transport = new StdioClientTransport({
  reader: proc.stdout,
  writer: proc.stdin,
});
```

The implementation includes:
- **Process lifecycle management** — spawn, monitor, restart on crash
- **NPX support** — enter `@perplexity-ai/mcp-server` and it handles the rest
- **Environment variables** — set API keys per connection
- **Log capture** — stderr streams to the Mesh UI for debugging

Now I could add any STDIO-based MCP server directly in the Mesh interface. Enter a command, set env vars, connect.

## Part 3: The subarray Bug

With STDIO support working, I tried adding `@stabgan/openrouter-mcp-multimodal` — a community MCP that wraps OpenRouter's API. But it crashed immediately:

```
TypeError: this._buffer.subarray is not a function
  at ReadBuffer.readMessage (stdio.js:18:37)
```

The stack trace pointed to the MCP SDK's STDIO transport. After digging through the code, I found the culprit: the OpenRouter MCP was calling `process.stdin.setEncoding('utf8')` during initialization.

This seems harmless, but it's not. The MCP protocol sends binary-framed messages over STDIO. When you set the encoding to UTF-8, Node.js starts decoding the stream as text before the MCP SDK can read it. The `_buffer` that should hold raw bytes gets converted to a string, and strings don't have a `subarray` method.

The fix was one line:

```diff
- process.stdin.setEncoding('utf8');
```

I forked the repo, removed the offending line, and published it as `@firstdoit/openrouter-mcp-multimodal`. Now I could run OpenRouter locally too, with my own API key.

## Part 4: Exa → Firecrawl

With local MCPs working, I turned back to my enrichment pipeline. The second step after Perplexity research was Exa content fetching. But Exa was giving me search results and snippets — not the full page content.

When the LLM classifies a bookmark, I want it to see the actual article text. A 200-word snippet isn't enough to generate meaningful developer, founder, and investor insights.

Firecrawl solves this. It scrapes the full page and returns clean markdown:

```typescript
const result = await callMeshTool("firecrawl_scrape", {
  url: bookmark.url,
  formats: ["markdown"],
  onlyMainContent: true,
});
```

Firecrawl also gives me metadata like `publishedTime`, which I now extract and display in the UI. The enrichment pipeline became:

1. **Perplexity** — quick research: what is this, who made it, is it still active?
2. **Firecrawl** — full page content in markdown
3. **Gemini 2.5 Flash** — classify, rate, generate three-perspective insights

Wait, Gemini? What happened to Claude Sonnet?

## Part 5: Speed Optimization

The enrichment pipeline was taking 40-50 seconds per bookmark. Perplexity's deep research mode was thorough but slow. Claude Sonnet 4.5 was expensive and not much better than alternatives for this task.

I made three changes:

1. **Perplexity: deep → quick** — Reduced the prompt, focused on key facts. Still useful research, but 3x faster.

2. **Claude Sonnet → Gemini 2.5 Flash** — For classification, Gemini is faster and cheaper. The three-perspective insights (developer, founder, investor) come out just as differentiated.

3. **Trimmed the prompts** — Less preamble, more direct instructions. The JSON parsing became more robust too — LLMs occasionally return malformed JSON, so I added regex extraction and comma fixes.

Result: **15-20 seconds per bookmark** instead of 40-50.

## Part 6: SQLite Was Getting Heavy

At this point I had 400+ bookmarks, about 50 of them enriched. The `bookmarks.db` file was already 1.6MB and growing fast. Every git operation touched this blob. Every deploy pushed it to Cloudflare.

The database was becoming a liability. I needed it somewhere else.

Supabase was the obvious choice: free tier with 500MB, managed PostgreSQL, RLS for access control, and — conveniently — an MCP server I could run locally.

I added `@supabase/mcp-server` as a STDIO connection in Mesh with my project credentials. Now I could run SQL queries, create tables, and set up RLS policies directly from Cursor. The migration took about 15 minutes:

### Schema improvements

```sql
-- Renamed fields for clarity
-- research_raw → perplexity_research
-- exa_content → firecrawl_content

-- Added full-text search
ALTER TABLE bookmarks ADD COLUMN search_vector TSVECTOR 
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) STORED;

-- Added notes for personal annotations
ALTER TABLE bookmarks ADD COLUMN notes TEXT;
```

### RLS for public read, private write

```sql
-- Anyone can read
CREATE POLICY "Public read access" ON bookmarks 
  FOR SELECT USING (true);

-- Only service role can write
CREATE POLICY "Service role full access" ON bookmarks 
  FOR ALL USING (auth.role() = 'service_role');
```

### Frontend reads directly from Supabase

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export async function getAllBookmarks() {
  const { data } = await supabase.from("bookmarks").select("*");
  return data;
}
```

### Writes go through MCP

In development, writes route through the local Mesh gateway → Supabase MCP → PostgreSQL. No service keys exposed to the frontend. I built a small Vite plugin that proxies API calls to the Mesh gateway:

```
Frontend → Vite Dev Server → Mesh Gateway → Supabase MCP → PostgreSQL
```

Production is read-only. The anon key only has SELECT permissions.

## Part 7: Back to a Lean Git

With bookmarks in Supabase, I could finally remove `bookmarks.db` from version control:

```bash
# .gitignore
data/bookmarks.db*
```

The git repo went from 1.6MB+ of database blobs back to lean source code. Deploys are faster. `git status` is instant again.

## Part 8: STDIO for vibegui.com

One last thing. I was still running `bun run mcp:dev` to start my blog's MCP server before using it in the mesh. Now that I had STDIO support, why not add a STDIO entry point to the blog itself?

I created `mcp-stdio.ts`:

```typescript
#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// ... 34 tools: content CRUD, search, git, bookmarks, dev server ...

const transport = new StdioServerTransport();
await server.connect(transport);
```

This will work once I extend PR #2098 to support commands beyond `npx` — that's on the list for this week. Then I'll be able to add vibegui.com as a STDIO connection in Mesh with no separate terminal window.

## The Results

| Before | After |
|--------|-------|
| Shared Perplexity API | Own API key, full cost visibility |
| HTTP-only MCP connections | STDIO support for local servers |
| Exa snippets | Firecrawl full page content |
| Claude Sonnet (40-50s/bookmark) | Gemini Flash (15-20s/bookmark) |
| 1.6MB SQLite in git | Supabase, zero database in git |

## What's Next

- **Vector embeddings** — Supabase has `pgvector`, I added the column, just need to populate it
- **Full-text search UI** — The `search_vector` column is ready
- **Notes feature** — Personal annotations per bookmark
- **Extend STDIO PR** — Support arbitrary commands, not just npx

The code is at [github.com/deco-cx/vibegui.com](https://github.com/deco-cx/vibegui.com). The Mesh STDIO PR is [#2098](https://github.com/decocms/mesh/pull/2098).

---

*Built with Claude Opus 4.5 via MCP.*