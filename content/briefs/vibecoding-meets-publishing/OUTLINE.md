# Outline: Vibecoding Meets Publishing

**Slug**: vibecoding-meets-publishing
**Structure**: Technical (Section 4.3 — Setup → The Build → Lessons → Meta-Reflection)
**Emotional Arc**: Pattern B — Provocation → Reframe → Declaration
**Target Length**: ~1400-1800 words

## Beats

### Beat 1: The Hook — Provocation
- **What happens**: Open with the meta moment. Establish that this article was written using the system it describes. Not as a gimmick — as proof.
- **Key points**:
  - I typed `/article:new` into my terminal and directed a full article pipeline — research, writing, image, publishing — without leaving Claude Code
  - This isn't "AI writes my blog." It's vibecoding applied to publishing
  - The blog doesn't need a CMS. It needs an agent with the right tools and the right instructions
- **Emotional register**: Provocative confidence. "I built this and it works. Let me show you how."
- **Research to use**: None yet — pure setup and personal experience
- **~Words**: 150-200

### Beat 2: The Problem — Why Most AI Content Pipelines Fail
- **What happens**: Acknowledge the skepticism honestly. Most agentic AI content is a 65% solution — impressive in demos, messy in reality. Name the real problems.
- **Key points**:
  - The "agent sprawl" problem: tools everywhere, no coherence
  - Quality degradation: AI content that *feels* authoritative but lacks substance
  - The complexity tax: setting up multi-tool chains often costs more than it saves
  - Gartner's 40% scrapped prediction — these criticisms aren't wrong
  - But they describe systems missing two things
- **Emotional register**: Honest assessment. Earn credibility by naming the problems before presenting the solution.
- **Research to use**: Contrarian angles section — 65% solution quote, agent sprawl, Gartner 40% stat, quality degradation concerns
- **~Words**: 200-250

### Beat 3: Pattern 1 — MCP Mesh (The Hands)
- **What happens**: Explain MCP Mesh as the first enabling pattern. What it is, why it matters, how it works in this system specifically.
- **Key points**:
  - MCP = open standard for connecting AI agents to external tools. Mesh = one governed endpoint for all of them
  - The M×N problem: without mesh, every client needs separate config for every server
  - Three MCP servers powering this blog: Supabase (storage/publishing), Perplexity (research), Nano Banana (image generation via Gemini)
  - All configured through deco's open-source Mesh — RBAC, observability, token vault
  - Show the architecture diagram: Claude Code → Mesh → [Supabase, Perplexity, Nano Banana]
  - MCP gives the agent *hands* — it can research, generate images, and write to a database. But hands without a plan just flail
- **Emotional register**: Technical enthusiasm. The builder explaining the engine.
- **Research to use**: MCP ecosystem findings, Mesh README architecture, M×N elimination stat (40-60% deployment time reduction)
- **~Words**: 300-350

### Beat 4: Pattern 2 — Custom Skills (The Brain)
- **What happens**: Explain custom skills/commands as the second enabling pattern. What they are, how they encode workflow intelligence, why they're the missing piece.
- **Key points**:
  - Claude Code's `.claude/commands/` — markdown files that become slash commands
  - Each skill has: objective, context references, process steps, success criteria
  - 10 article skills form a complete pipeline: `/article:new` → `/article:research` → `/article:outline` → `/article:draft` → `/article:image` → `/article:publish`
  - Skills encode *domain knowledge*: the tone-of-voice guide, structural blueprints, hook patterns, closing strategies
  - Show a concrete example — what `/article:research` actually tells the agent to do (make Perplexity calls, synthesize findings, produce structured RESEARCH.md)
  - Skills give the agent a *brain* — structured, domain-aware workflows. But a brain without hands can only think
- **Emotional register**: Practical excitement. "Here's the part that made everything click."
- **Research to use**: This project's architecture (10 skills, the flow), Claude Code custom commands capability
- **~Words**: 300-350

### Beat 5: The Combination — Neither Alone Is Enough
- **What happens**: The turn. Show why MCPs + Skills together create something neither can alone. Use THIS article as the proof.
- **Key points**:
  - MCPs without skills = powerful tools with no workflow. The agent has access to Perplexity but doesn't know when to call it, what to ask, or how to structure findings
  - Skills without MCPs = great plans with no execution. The agent knows the steps but can't actually research, generate images, or publish
  - Together: structured workflows that invoke real tools at the right moments
  - Walk through the actual flow of THIS article being created:
    - `/article:new` → asked me questions, created BRIEF.md
    - `/article:research` → made 3 Perplexity calls via MCP, read company context, produced RESEARCH.md
    - `/article:outline` → applied tone-of-voice blueprints, produced OUTLINE.md
    - `/article:draft` → will write using the tone guide, referencing all artifacts
    - `/article:image` → will call Nano Banana via MCP to generate the cover
    - `/article:publish` → will write directly to Supabase via MCP
  - Zero context switching. One terminal. Natural language throughout.
- **Emotional register**: Building conviction. The architecture clicks into place.
- **Research to use**: The two-pattern architecture synthesis, this session's actual commands as evidence
- **~Words**: 250-300

### Beat 6: Lessons — What I Actually Learned
- **What happens**: Honest takeaways from building and using this system. Not theory — practiced lessons.
- **Key points**:
  - **Skills need success criteria, not just instructions.** The difference between "write a draft" and a skill that checks tone-of-voice compliance, structural patterns, and word count targets
  - **MCP Mesh makes the agent portable.** Same tools available in Claude Code, Cursor, or any MCP client — configure once, use everywhere
  - **The human is the creative director, not the typist.** I choose the topic, the angle, the audience. The system handles the execution. This is vibecoding — not autopilot
  - **It's not perfect.** MCP auth tokens expire (Perplexity needed re-auth mid-session). Multi-step workflows sometimes need course correction. The 65% solution critique is fair — but 65% + human direction gets you to 95%
- **Emotional register**: Grounded honesty. Admitting the rough edges while showing why the approach works.
- **Research to use**: Contrarian angles (to address honestly), the 80/20 AI-human split stat
- **~Words**: 200-250

### Beat 7: Meta-Reflection — The Close
- **What happens**: Connect this specific system to the larger vision. Where this goes next.
- **Key points**:
  - This article was written by the system it describes. That's not a gimmick — it's the proof
  - The same two patterns (MCP mesh + structured skills) apply far beyond blogging: internal ops, client reports, documentation, any domain where the workflow is repeatable but the content is unique
  - deco is building this for commerce — agents that ship storefront improvements while you sleep. The blog pipeline is a small proof of the same architecture
  - The blog is vibecoded now. And it's just the beginning
- **Emotional register**: Contained intensity. Forward-looking declaration.
- **Research to use**: deco FUTURE.md vision ("from enabler to doer"), commerce-first strategy as broader context
- **~Words**: 150-200

## Hook Selection
**Chosen hook type**: Pattern 3 — Manifesto Declaration (blended with Story Seed)
**Draft hook**: "I typed `/article:new` into my terminal and 45 minutes later had a researched, illustrated, published blog post. No CMS. No context switching. Just an agent with the right tools and the right instructions. The blog is vibecoded now."

## Closing Strategy
**Chosen close type**: Type 4 — The Grounded Statement
**Draft close**: "This article was written by the system it describes. MCPs gave the agent hands. Skills gave it a brain. And the same two patterns work for anything where the workflow is repeatable but the content is unique. The blog is vibecoded now. It's just the beginning."

## Voice Notes
- Keep the technical explanations concrete — show actual commands, actual file paths, actual flow. No abstract "imagine if" framing
- Lean into the meta angle but don't let it dominate — the two-pattern architecture is the real insight, not the self-reference
- Use "vibecoding" naturally and proudly — it's a Guilherme signature term
- The vulnerability moment is Beat 6 (honest about imperfections: auth expiry, course corrections needed). Don't oversell the system as flawless
- Avoid coach-speak. This is a builder showing his tools, not a guru prescribing a method
- Reference this actual session where possible — the Perplexity re-auth, the parallel research calls, the interactive brief creation. Real moments > polished narratives
