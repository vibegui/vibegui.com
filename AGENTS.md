# Agent Instructions for vibegui.com

This document instructs AI agents (Claude, Cursor, etc.) on how to work effectively within this repository.

## Daily Learnings System

**You have access to a local memory system for recording learnings.** Use it proactively!

### When to Record Learnings

Call `LEARNINGS_RECORD` whenever:

1. **Bug fixes** — What caused the bug? How was it fixed? What was the root cause analysis?
2. **Architecture decisions** — Why was this approach chosen? What were the alternatives?
3. **Tool discoveries** — New tools, libraries, or techniques that proved useful
4. **Debugging insights** — Non-obvious debugging steps that led to a solution
5. **Accomplishments** — Features shipped, milestones reached, improvements made
6. **Cost insights** — API costs, optimization opportunities, pricing discoveries
7. **Process improvements** — Better workflows, automation ideas, efficiency gains

### Categories

Use these categories when recording:
- `bug_fix` — Bugs found and fixed
- `architecture` — Design decisions and patterns
- `tool` — Tools, libraries, CLI tricks
- `insight` — General technical insights
- `accomplishment` — Things shipped or completed
- `debugging` — Debugging techniques and discoveries
- `optimization` — Performance improvements
- `feature` — New feature implementations
- `process` — Workflow improvements
- `cost` — API costs, pricing, budget insights

### Importance Levels

- `low` — Minor details, might be useful later
- `normal` — Standard learning, good to remember
- `high` — Important insight, likely to come up again
- `critical` — Must not forget, fundamental to how things work

### Example Usage

```
Call LEARNINGS_RECORD with:
- summary: "PostgreSQL dollar-quoting avoids SQL escaping issues"
- content: "When inserting text with backslashes and quotes into PostgreSQL, using dollar-quoting ($$text$$) is safer than escaping quotes. The escapeSQL function was causing truncated inserts because backslash-quote (\\') was being interpreted as an escape sequence."
- category: "bug_fix"
- project: "vibegui-bookmarks"
- importance: "high"
- tags: ["postgresql", "sql", "escaping"]
- publishable: true
```

### Before Writing Blog Posts

1. Call `LEARNINGS_TODAY` to see what was learned today
2. Call `LEARNINGS_PUBLISHABLE` to find content marked for sharing
3. Group related learnings into coherent narratives
4. After publishing, call `LEARNINGS_MARK_PUBLISHED` to link learnings to the article

## Projects

Current projects in the vibegui ecosystem (see `/roadmap` for full details):

| Project | Status | Description |
|---------|--------|-------------|
| vibegui.com | ✅ Shipped | Personal website with blog |
| vibegui Bookmarks | ✅ Shipped | AI-enriched bookmark manager |
| anjo.chat | 🚧 In Progress | Brazilian angel investor collective |
| Bookmarks WhatsApp Submit | 💡 Planned | WhatsApp bot for forwarding links |
| Bookmarks on MCP Studio | 💡 Planned | Port enrichment to MCP Workflows |
| WhatsApp MCP Bridge | 💡 Planned | Complete MCP-to-WhatsApp integration |

Projects are stored in the content database. Use these tools:

- `PROJECTS_LIST` — List all projects (filter by status)
- `PROJECTS_GET` — Get a single project (includes `notes` field with rich context)
- `PROJECTS_CREATE` — Create a new project
- `PROJECTS_UPDATE` — Update a project (use `notes` field to store original prompts, vision docs, technical specs)
- `PROJECTS_MARK_COMPLETE` — Mark a project as completed

### Project Notes

Each project has a `notes` field for storing rich context that doesn't belong in the public description:
- Original vision prompts
- Technical specifications
- V1 requirements
- Architecture decisions
- Links to related resources

When starting work on a project, call `PROJECTS_GET` to read its notes for full context.

When recording learnings, always specify the `project` field so learnings can be grouped.

## Content Management

This repo uses an MCP server for content management. Key tools:

- `COLLECTION_ARTICLES_*` — CRUD for blog posts
- `COLLECTION_DRAFTS_*` — CRUD for drafts
- `CONTENT_SEARCH_REPLACE` — Edit content without full rewrites
- `SEARCH_CONTENT` / `SEARCH_CONTEXT` — Find references

## Best Practices

1. **Record learnings in real-time** — Don't wait until the end of a session
2. **Be specific** — Include code snippets, file paths, and concrete details
3. **Mark publishable content** — If a learning could make a good blog post, flag it
4. **Use tags** — They help with filtering and finding patterns later
5. **Link related files** — Makes it easier to trace back to source code

## Repository Structure

```
vibegui.com/
├── src/                    # React frontend (Vite)
│   └── pages/              # Page components
├── lib/                    # Shared libraries
│   └── db/                 # Database modules
│       ├── content.ts      # Blog content (versioned)
│       └── learnings.ts    # Daily learnings (local only)
├── data/                   # Local databases
│   ├── content.db          # Versioned content
│   └── learnings.db        # NOT versioned - local memory
├── context/                # Reference materials
├── content/                # Exported markdown (for static site)
├── mcp-server.ts           # MCP tools server
└── vite.config.ts          # Vite + custom dev server
```

