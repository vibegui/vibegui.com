# Outline: From Coder to Conductor

**Slug**: from-coder-to-conductor
**Structure**: Technical Writing Architecture (Section 4.3) — Setup → The Build → Lessons → Meta-Reflection
**Emotional Arc**: Pattern B — Provocation → Reframe → Declaration
**Target Length**: 1400-2000 words

## Beats

### Beat 1: Hook — The Provocation
- "The most productive thing I did today was not write code. It was answer questions."
- Flash the result: 49 commits, 5 phases, a complete SQLite-to-Supabase migration. While working on 3 other projects.
- Name the tool: GSD (Get Shit Done). Link it immediately.
- ~100 words

### Beat 2: What GSD Actually Is
- Not another Cursor. Not autocomplete. It's a meta-prompting agent orchestration framework for Claude Code.
- The loop: map codebase → interview you → research the domain → build a plan → ask you to approve → execute with parallel sub-agents → verify results
- Each step produces artifacts (.planning/ directory) that persist between sessions
- The key insight: it treats software projects like *projects*, not chat sessions
- ~200 words

### Beat 3: The Story — What Happened Today
- This morning: vibegui.com had a half-finished SQLite-to-markdown migration, unstaged changes from a week ago, cruft everywhere
- I told GSD: "complete the migration to Supabase-first"
- What followed (from git history):
  - GSD mapped the entire codebase first (STACK.md, ARCHITECTURE.md, CONVENTIONS.md, CONCERNS.md)
  - Interviewed me about scope, constraints, what's in/out
  - Researched how to approach each phase
  - Produced a 5-phase roadmap with 34 requirements traced to phases
  - Phase 1: Migration cleanup (deleted SQLite, fixed refs, 3 min)
  - Phase 2: Parser foundation (replaced custom YAML with gray-matter + Zod, roundtrip tests, 8 min)
  - Phase 3: Supabase schema + import (tables, triggers, RLS, imported 52 articles, 10 min)
  - Phase 4: Sync pipeline (hash-based diffing, dry-run, orphan detection, 2 min)
  - Phase 5: Integration verification (pre-commit hooks, helpers, E2E tests, 10 min)
  - Total agent execution: 33 minutes
- All while I was context-switching between this and 3 other projects
- ~400 words

### Beat 4: Why This Beats Everything Else I've Tried
- Cursor: incredible for flow-state coding. But it's a conversation, not a project. No memory between sessions. No plan. No verification.
- GSD's advantage: STATE.md, ROADMAP.md, per-phase CONTEXT/RESEARCH/PLAN/VERIFICATION. It knows where it left off.
- The interview step is the real magic — it forces you to clarify what you actually want before agents start executing
- Parallel execution: GSD identifies independent plans and runs sub-agents simultaneously
- Verification: after each phase, it checks what was supposed to be true and confirms it
- "The framework treats AI like a junior engineer who's brilliant but needs structure. That's exactly right."
- ~250 words

### Beat 5: The Honest Part — The UX Is Painful
- About 50% of my GSD commands are `/clear`. The context window fills up, and you have to start fresh for the next phase.
- The commands are verbose. `/gsd:plan-phase`, `/gsd:execute-phase`, `/gsd:verify-work`. Not exactly ergonomic.
- Sometimes it over-plans. A 2-minute task gets a 15-minute planning cycle.
- The /clear dance: execute phase → context full → /clear → resume work → context loads from STATE.md → continue. Repeat.
- But: every time I think "this is too much ceremony," I look at the git log. 49 commits. 5 phases. 33 minutes. All verified. While I was doing other things.
- The ceremony is the feature. It just needs better UX.
- ~200 words

### Beat 6: What I'm Building Next
- I'm working on my own version. A fork, conceptually.
- The idea: apply future-based language to agent orchestration
- In Erhard and Zaffron's framework, you *declare* a future. Not predict it. Not plan for it. You speak it into existence and organize action around the declaration.
- Applied to agents: instead of "plan the migration," you declare "vibegui.com is Supabase-first with a complete sync pipeline." The agent figures out the gap between current state and declared future, then organizes phases backward from that declaration.
- The industry is moving this way. Skan AI just launched an "Agentic Ontology of Work" — standardized vocabulary for agents declaring skills, intents, and outcomes. Same direction.
- More on that soon.
- ~200 words

### Beat 7: Close — The Declaration
- Building from Rio. Agents don't care about your timezone.
- Short grounded statement. Callback to "answering questions" being the real work.
- ~50 words

## Hook Selection
**Chosen hook type**: Pattern 3 — Manifesto Declaration
**Draft hook**: "The most productive thing I did today was not write code. It was answer questions."

## Closing Strategy
**Chosen close type**: Type 4 — The Grounded Statement
**Draft close**: "The best code I wrote today was the code I didn't write. I just answered the right questions."

## Voice Notes
- This is a LOVE LETTER to GSD, not a balanced review. But earned through honesty about the UX pain.
- The git history IS the story. Use the actual phase names, actual timings from STATE.md, actual commit counts.
- The /clear joke should land naturally, not forced. It's funny because it's true and every GSD user knows the pain.
- Don't over-explain GSD's technical internals. Show the loop, show the results, let the reader connect the dots.
- Philosophical references only in Beat 6 (Erhard/Zaffron). Don't spray across the whole piece.
- Brazil connection: brief, natural, in the close. Not forced.
