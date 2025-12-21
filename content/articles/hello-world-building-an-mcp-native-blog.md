---
title: "Hello World: Building an MCP-Native Blog"
description: "Welcome to vibegui.com — a personal blog built entirely through MCP, served at the edge with sub-100KB payloads."
date: 2025-12-21
tags: ["hello-world","mcp","architecture","edge","performance"]
status: published
---

# Hello World: Building an MCP-Native Blog

Welcome to **vibegui.com** — my personal blog, experiment sandbox, and a demonstration of what's possible when you build content-first with MCP (Model Context Protocol).

## What Makes This Different?

This isn't just another static blog. It's a fully MCP-native publishing platform where every piece of content — from initial idea to published article — flows through a single protocol that AI agents can understand and manipulate.

### The Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     MCP Mesh (Self-Hosted)                  │
├─────────────────────────────────────────────────────────────┤
│   vibegui.com MCP Server                                    │
│   ├── Collections: Ideas → Research → Drafts → Articles    │
│   ├── Dev Tools: build, commit, push                        │
│   └── Research Tools: topic research stubs                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Cloudflare Pages (Edge)                   │
│   • Static HTML + SPA runtime                               │
│   • Content-hash URLs for immutable caching                 │
│   • 30s CDN cache, 1h stale-while-revalidate                │
└─────────────────────────────────────────────────────────────┘
```

### Why MCP-Native?

1. **AI-First Authoring**: I can write articles by chatting with an AI agent that has full access to my content collections. Ideas become drafts become articles — all through tool calls.

2. **Single Source of Truth**: The MCP server knows about every piece of content. No scattered markdown files or orphaned drafts.

3. **Programmatic Control**: Deploy, commit, push — all exposed as MCP tools. The entire publishing workflow is automatable.

### Why Edge Performance Matters

Every page load should feel instant. The constraints are strict:

- **< 100KB initial payload** — no bloated JavaScript frameworks
- **< 100KB per image** — Vite optimizes everything at build time
- **Content-hash URLs** — assets are cached forever until they change
- **Static-first** — HTML is pre-rendered, SPA hydrates only when needed

## The Journey Ahead

This blog will document:

- **Technical deep-dives** into MCP, AI agents, and edge computing
- **deco CMS** — the platform I'm building to democratize AI-powered software creation
- **Brazil's tech future** — my commitment to making Brazil a global technology protagonist

Every article you read here was created, edited, and published through the same MCP tools you could use yourself.

Welcome to the future of content management.

---

*This article was created using the `COLLECTION_ARTICLES_CREATE` tool via MCP.*