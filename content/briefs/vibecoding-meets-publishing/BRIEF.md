# Brief: Vibecoding Meets Publishing

**Slug**: vibecoding-meets-publishing
**Type**: technical
**Created**: 2026-02-17

## Topic
How my article authoring commands (`/article:new`, `/article:research`, `/article:draft`, `/article:publish`, etc.) work inside Claude Code, and how composing MCP servers for Supabase, Nano Banana (image generation), and Perplexity (research) — all configured through decoCMS mesh — delivered my first true end-to-end agentic blogging experience.

## Angle
Vibecoding applied to content creation. The same philosophy of building with AI that transforms coding also transforms writing, research, image generation, and publishing. Two things made this possible in equal measure: **MCP mesh** (composing specialized tools into a unified agent surface) and **custom skills/commands** (giving the agent structured, domain-aware workflows). Neither alone is enough — the magic is in the combination.

## Target Audience
Developers and technical founders experimenting with AI-assisted workflows. People who've heard of MCP but haven't seen it applied beyond code. Anyone curious about what "agentic content pipelines" actually look like in practice — not theory, but a working system.

## Key Message
Two patterns unlock agentic workflows: **MCP mesh** gives the agent hands (Supabase for storage, Perplexity for research, Nano Banana for images), and **custom skills** give it a brain (structured multi-step workflows like `/article:draft` that know what to do and in what order). Together, they turn Claude Code from a coding assistant into a full content pipeline — from idea to published article — with zero context switching.

## Hook Ideas
1. **Confession Hook**: "I wrote an article yesterday. Or rather, I directed one — from topic to published page — without leaving my terminal. The blog is vibecoded now."
2. **Story Seed**: "Last week I typed `/article:new` into Claude Code and 45 minutes later had a researched, illustrated, published blog post. Here's what's under the hood."
3. **Provocation**: "The blog doesn't need a CMS anymore. It needs an agent with the right tools and the right instructions."

## Notes
- This is meta — writing about the system while using the system. Lean into that.
- Reference the `../mesh` directory for MCP configuration details.
- Show the architecture: Claude Code → Skills (slash commands) → MCP servers (Supabase, Perplexity, Nano Banana) → published content.
- Equal weight to MCPs and skills — the key message is that both patterns matter.
- Keep it practical: show real commands, real flow, real output.
- Related existing article: "writing-this-article-while-writing-about-writing-this-article" — differentiate by going deeper on the technical architecture rather than the meta narrative.
