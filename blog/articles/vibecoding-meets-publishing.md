---
slug: vibecoding-meets-publishing
title: Vibecoding Meets Publishing
description: How MCP mesh and custom skills turned Claude Code into an end-to-end agentic blog pipeline
date: 2026-02-17
status: published
coverImage: /images/articles/vibecoding-meets-publishing.png
tags: null
---
I typed `/article:new` into my terminal. Five minutes later — researched, illustrated, published. I never left the terminal.

The blog is vibecoded now.

I chose the topic, the angle, the audience. The agent handled the research, the structuring, the image generation, the database publishing — all through natural language commands in Claude Code. Two patterns made this possible, and most people building agentic workflows are missing at least one of them.

## Why most AI content pipelines fail

The skeptics have a point.

Industry analysts call agentic AI content "a 65% solution — impressive in demos but messy in real-world deployment." Gartner projects 40% of agentic AI projects will be scrapped by 2027. I get it.

I've lived this. You give an LLM access to ten tools and it flails. Calls the wrong one. Forgets the sequence. Produces confident-sounding text that misses the voice, the angle, the point.

Most of these systems fail because they're missing one of two things. Usually both.

## MCP Mesh — the tool layer

MCP — the Model Context Protocol — is an open standard for connecting AI agents to external tools. Think of it as USB-C for AI: one protocol, any tool.

The problem is scale. Three MCP servers and three MCP clients means nine separate configurations. That's the M×N problem, and it breaks fast.

MCP Mesh is the fix. It's an open-source control plane — built by my company, [deco](https://github.com/decocms/mesh) — that sits between your clients and your servers. One governed endpoint. You configure your tools once, and any MCP client can use them.

For this blog, three MCP servers power the pipeline:

- **Supabase** — stores articles, handles publishing, manages the database
- **Perplexity** — deep research with the sonar-pro model, returning sourced findings
- **Nano Banana** — image generation via Gemini models for cover art

All three connect through the Mesh. Claude Code sees them as available tools, ready to call.

```
Claude Code → MCP Mesh → [ Supabase | Perplexity | Nano Banana ]
```

This gives the agent real capabilities — querying databases, researching with academic rigor, generating images. But capabilities without direction produce noise. An agent with access to Perplexity still doesn't know *when* to call it, *what* to ask, or *how* to structure the findings.

That's the second pattern.

## Custom skills — the workflow layer

Claude Code supports custom slash commands. You drop markdown files into `.claude/commands/` and they become domain-specific skills. Each file defines an objective, references context files, lays out a step-by-step process, and specifies success criteria.

I built 10 of these for the blog:

`/article:new` → `/article:research` → `/article:outline` → `/article:draft` → `/article:image` → `/article:publish`

Plus `/article:status`, `/article:resume`, `/article:preview`, and `/article:quick` for the full workflow.

The detail matters. `/article:research` doesn't just say "do research." It tells the agent to make 2-4 Perplexity calls using the sonar-pro model, covering topic overview, data and evidence, contrarian viewpoints, and recent developments. It specifies the output format — a structured `RESEARCH.md` with sections for key findings, notable quotes, contrarian angles, and a synthesis connecting everything back to the brief.

`/article:draft` references my tone-of-voice guide — a 680-line forensic analysis of how I write, covering hook architecture, sentence rhythm, vocabulary profile, emotional engineering, and philosophical framework. The skill instructs the agent to self-review against the voice checklist before presenting the draft.

Without MCPs, these skills are beautiful plans with no way to execute. The agent knows it should call Perplexity but has no Perplexity. It knows it should generate a cover image but has no image generation tool. And without skills, the MCPs are powerful tools with no direction — the agent *can* do anything but doesn't know what to do *first*.

You need both.

## This article is the proof

Here's exactly what happened during this session:

1. `/article:new` — the agent asked me about topic, angle, audience, and key message through interactive questions. Created `BRIEF.md`
2. `/article:research` — triggered 3 Perplexity calls via MCP (topic overview, market data, contrarian angles), then read my company's strategy docs for additional context. Produced `RESEARCH.md`
3. `/article:outline` — applied the technical writing blueprint from my tone-of-voice guide, mapped 7 beats with emotional registers and word counts. Produced `OUTLINE.md`
4. `/article:draft` — you're reading it. Written beat-by-beat following the outline, voice-checked against the tone guide
5. `/article:image` — called Nano Banana via MCP to generate the cover using Gemini, then optimized it to meet the 250KB constraint
6. `/article:publish` — will write the article directly to Supabase via MCP

Everything in one terminal session. I directed. The agent executed.

## What I actually learned

**Skills need success criteria, not just instructions.** The difference between a mediocre skill and a great one is the self-review step. "Write a draft" produces generic text. "Write a draft, then check it against this 10-point voice checklist covering hook patterns, paragraph length, vulnerability moments, and hedging language" produces something I'd actually want to publish. The success criteria are doing more work than the instructions.

**The Mesh makes tools portable.** The same Supabase, Perplexity, and Nano Banana tools that power this pipeline in Claude Code are available in Cursor, Claude Desktop, any MCP client. I configured them once through the Mesh. When I switch editors, the tools come with me.

**I'm still the author.** I chose this topic because I'm building this system and living inside it daily. I chose the angle because I believe the two-pattern insight is genuinely useful. I directed every step — approving the brief, reading the research, reviewing the outline. The agent wrote a line that sounded like AI slop ("No CMS. No context switching. Just an agent with the right tools.") and I caught it and rewrote it. That editorial loop is the whole point of vibecoding.

**It breaks.** Mid-session, Perplexity's MCP auth token expired. I had to re-authenticate and re-run the research command. The agent sometimes needs course correction — a research finding that doesn't fit, an outline beat that needs reordering. The 65% solution critique is fair. But 65% with active human direction gets you to 95%. And 95% at this speed changes what one person can ship.

## Where this goes

This article was written by the system it describes. The research came through Perplexity's MCP. The cover image came through Nano Banana's MCP. The published version lives in Supabase. Every step was orchestrated by skills that encode how I think about writing.

The same architecture applies to anything where the workflow is repeatable but the content is unique. At deco, we're building this for commerce — agents that ship storefront improvements while you sleep. The blog pipeline is a small proof of the same pattern.

Software used to enable. Now it does.

The blog is vibecoded now.
