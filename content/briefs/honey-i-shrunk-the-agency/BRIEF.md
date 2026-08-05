# Brief: Honey, I Shrunk the Agency!

**Slug**: honey-i-shrunk-the-agency
**Type**: long
**Created**: 2026-08-05

## Topic
What it takes to build a self-evolving storefront: not a chatbot bolted onto a CMS, but a closed-loop software factory — inputs, metrics, actions (PRs, deploys), observation, learning, and back into inputs. The factory is organized as rooms (repos) and agents (the roles of a digital services agency). Every entrepreneur gets a full agency that fits in a pocket and a browser.

## Angle
**The self-evolving storefront is an agency compressed into software.** Digital services agencies already know how to run storefronts: account managers prioritize a Kanban, specialists work in parallel, PRs ship, deploys land, metrics tell you what to do next. AI doesn't invent that operating model — it shrinks it until it fits in your phone. Rooms are repos. Threads are branches. Agents are the same roles you'd hire: account manager, coding agent, QA, SEO, content. Sandboxes are where work happens. The loop never stops: diagnose → prioritize → act → observe → learn.

## Target Audience
- Founders and brand operators who can't (or shouldn't) hire a full digital agency
- Ecommerce leaders tired of agency retainers that don't compound
- Builders who already vibe-code and want the next layer: continuous operation, not one-shot generation
- Anyone who has felt the gap between "AI wrote a page" and "the storefront keeps getting better overnight"

## Key Message
A self-evolving storefront is a software factory with agency roles inside it. Honey, I shrunk the agency — it fits in your pocket and your browser.

## Hook Ideas
1. **Manifesto Declaration**: "Honey, I shrunk the agency! Now it fits in your pocket and your browser."
2. **Philosophical Provocation**: "A self-evolving storefront isn't a smarter CMS. It's a factory with inputs, metrics, and outputs — and the workers are agents that play the same roles a digital agency already has."
3. **Story Seed (from the Autofix daily)**: "Yesterday we mapped rooms to repositories and threads to branches. Then it clicked: we weren't designing a chat product. We were shrinking the agency."

## Notes

### The software factory loop
```
inputs (diagnostics, analytics, incidents, briefs)
    → metrics monitored (conversion, errors, CWV, SEO, GMV)
    → decisions (Kanban / account manager prioritization)
    → actions (PRs on GitHub, deploys, content changes)
    → observation & learning
    → inputs again
```
This is the same loop Guilherme described with Lucas (2026-08-04) as a "software factory," and the week-start priority toward automated diagnostics + task execution (2026-08-03). It is also the overnight diagnose→fix→optimize loop in deco's 2028 milestones (M2).

### Rooms + agents (product architecture — from Autofix daily 2026-08-04)
- **Room = repository.** One conversation surface per repo. Deploy events, PRs, and system messages land in the room that owns that code.
- **Thread = branch.** Opening work starts a branch; the thread is the PR + CI + review + preview, one stream.
- **Sandbox = work session.** Cloud or local: conjure a sandbox inside a thread, run tools, open a PR, surface deploy preview in the same place.
- **Agents = agency roles**, not a single "super agent." Coding agent, QA review agent, account manager. An agent can enter many rooms; you @mention them into a thread the way you'd pull a specialist into a Slack channel.
- **Kanban = shared state.** Account manager (human or agent) prioritizes with you; tasks get assigned; "I'll take it" means the card moves. Rooms scope tasks to the repo they belong to.
- **State of work lives in chat**, not only on GitHub PR pages — PR status, QA result, deploy preview all surface as messages in the thread.

### Buzz (Jack Dorsey / Nostr-native forge) — conceptual cousin
Buzz's forge model is the open-source mirror of this intuition:
- Branch creates a channel; patches, CI, review, merge live in that channel; channel archives on merge (`VISION_PROJECTS.md`).
- Humans and agents share the same rooms, same identity model, same audit trail (`VISION.md`, `README.md`).
- Agents are members, not bots — scoped by keypair and channel membership.
Use Buzz as intellectual scaffolding / "the forge pattern," not as "we are building on Buzz." The deco stack is Studio + diagnostics + autofix + rooms; Buzz proves the room=workstream idea in the wild.

### Conductor latest worktree
Latest Conductor workspace: `~/Conductor/workspaces/decocms-tanstack/minsk-v1` (bridge-tam / bridge-round-dashboard aliases, Aug 4). `PLAN.md` is the storefront handoff for the TanStack port — useful as *example* of agentic storefront work (visual-diff loops, deploy workflows, phase gates), not as the product thesis itself. The product thesis lives in the Autofix rooms conversation and in `context/FUTURE.md` / `MILESTONES.md`.

### Stack to name (without turning the piece into a product brochure)
- **Diagnostics / Monte Carlo** — front door: free public score → connected benchmark → findings (gold/silver/zinc)
- **Autofix** — sandbox → coding agent → PR → QA agent → deploy preview; limited free runs → paid monitoring
- **Studio / Mesh** — control plane: connections, agents, projects, observability
- **Storefront runtime** — TanStack / deco storefronts as the production surface being evolved
- **GitHub** — PRs and deploys as the factory's actuators
- Pattern from 2023 essay "The experience optimization layer": audiences × outcomes × continuous darwinistic iteration — now with agents as the operators

### Related internal context
- `context/FUTURE.md` — "We make digital experiences autonomous"
- `context/MILESTONES.md` — M1 diagnostic+autofix PLG; M2 AI-service overnight loop; M3 agentic editor
- `context/01_declaration/_archive/proposals/2026-02-24-deco-macro-product-vision.md` — control plane → projects → production loop
- `context/05_growth/reference/articles/experience-optimization-layer.md` — 2023 primitive: services / audiences / outcomes
- Meetings: Autofix daily (rooms), week-start (software factory), Lucas 30min (factory thesis), Electrolux/Elux (agency-replacement GTM), PLG docs (agency-comparable subscription)

### Tone constraints
- Follow `blog/tone-of-voice.md`. Arena, not stands. No "No X. No Y. Just Z." AI slop.
- Specific: rooms, branches, Kanban, PRs, deploy previews — not abstract "AI transforms ecommerce."
- Punchline earns its place once; don't repeat "agency in a box" every paragraph.
- Honest that this is being built in public (autofix, diagnostics) — not vaporware manifesto.
- English article (title + punchline are English); match recent EN technical/manifesto posts.

### Possible structure (for outline skill)
1. Hook — honey / agency shrunk
2. What "self-evolving" actually means (factory loop, not magic)
3. The agency already knew how to do this (roles)
4. Compression: room=repo, thread=branch, agent=role, sandbox=desk
5. The loop with storefront metrics as the scoreboard
6. Stack we're building (diagnostics → kanban → autofix → observe)
7. Why every entrepreneur gets one
8. Close — grounded invitation

### Related published pieces (don't repeat, do build on)
- `generative-software-and-the-era-of-context-management.md` — self-evolving systems, plan IS the system
- `software-gardening-era-of-agents.md` — gardening metaphor
- `from-coder-to-conductor` brief — orchestration / GSD (adjacent, different thesis)
- `the-orchestration-epiphany` — executor → orchestrator
