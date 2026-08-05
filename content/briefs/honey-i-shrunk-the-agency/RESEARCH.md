# Research: Honey, I Shrunk the Agency!

**Slug**: honey-i-shrunk-the-agency
**Researched**: 2026-08-05

## Key Findings

### Self-evolving storefront ≠ shopping agent
- Most "agentic commerce" coverage is buyer-side: AI shopping on behalf of consumers (eMarketer, McKinsey, Forrester). The article's thesis is **merchant-side**: agents that operate and improve the storefront itself — diagnose, prioritize, ship PRs, observe metrics, loop.
- Forrester (mid-2026): true autonomous purchasing is rare; hype runs ahead of behavior. Useful contrarian frame — don't sell the article as "agents buy everything," sell it as "agents run the factory that makes the store better."

### Services-as-software is the economic frame
- Sequoia (Julien Bek, Mar 2026): "Services: The New Software" — for every $1 on software, ~$6 on services; sell the *work*, not the tool. Autopilots beat copilots. Start where work is already outsourced (vendor swap > reorg).
- Already cited lightly in Guilherme's `software-gardening-era-of-agents` — reuse as economic spine, don't rehash the gardening metaphor. This piece's unique move: **the service being compressed is the digital agency**, and the factory topology is rooms/agents/PRs.

### Agency economics make compression urgent
- Mid-market ecommerce retainers commonly $3k–$15k/mo; full-service $10k–$50k+/mo (2026 agency pricing surveys).
- CRO alone often $6k–$18k/mo; SEO $1k–$10k; paid media $8k–$25k + % of spend.
- Most founders under ~$30M can't staff a full agency bench (AM + SEO + CRO + eng + QA). The "agency in a pocket" claim is economic, not cute.

### Buzz proves the room/workstream pattern in public
- Block (Jack Dorsey) launched Buzz Jul 21, 2026: Nostr workspace where humans and agents share channels; git + chat + workflows; agents hold keypairs.
- Buzz forge vision: branch → channel; patches, CI, review, merge in one stream — exact structural cousin of deco's room=repo / thread=branch.
- Use as intellectual scaffolding ("the forge pattern is landing"), not as deco dependency.

### Production reality check
- Only ~5% of companies had AI agents in production early 2025; 70–85% of AI initiatives miss expected outcomes (industry surveys cited in agentic-commerce analyses).
- Gartner: large share of agentic projects risk scrap by 2027 if they don't link to business value.
- Implication for voice: honest that deco is building the loop in public (diagnostics, autofix, rooms) — arena, not vaporware.

## Data & Evidence

| Claim | Number | Source |
|-------|--------|--------|
| AI agents market 2026 | ~$11.55B | Precedence Research |
| Agentic AI in retail/ecom 2026 | ~$60.43B | Mordor Intelligence |
| US agentic ecom volume 2026 → 2029 | ~$21B → ~$144B (8.8% of retail ecom) | L.E.K. / eMarketer |
| Software:$services spend ratio | ~$1 : $6 | Sequoia / Julien Bek |
| Mid-market ecom agency retainer | $3k–$15k/mo typical; full-service $10k–$50k+ | 2026 agency pricing surveys |
| Full-service median (sample) | ~$14.5k/mo | growwithba pricing study |
| AI initiatives failing expectations | 70–85% | industry surveys (agentic commerce analyses) |
| Agents in production (early 2025) | ~5.2% of surveyed cos | cited in Wiegold / industry |

Internal / product evidence (from brief + meetings, not public research):
- Autofix daily 2026-08-04: room=repo, thread=branch, sandbox work sessions, Kanban as shared state, coding + QA agents
- Week-start 2026-08-03: software factory vision (diagnostics → tasks → cloud execution)
- FUTURE.md / MILESTONES: overnight diagnose→fix→optimize; AI-service as agency replacement outcomes

## Notable Quotes & References

- Sequoia: "The next $1T company will be a software company masquerading as a services firm."
- Sequoia: "If you sell the tool, you're in a race against the model. If you sell the work, every improvement in the model makes your service faster, cheaper, and harder to compete with."
- Jack Dorsey on Buzz: groupchat for "teams of people and agents… built to reduce our dependency on slack and github."
- Block Engineering: "A project becomes a conversation with code in it."
- Guilherme (Autofix daily): org has repos that are rooms; branch opens a thread; coding agent + QA agent + deploy preview in one place; Kanban is shared state agents respect.
- Guilherme (2023 experience optimization layer): darwinistic iteration on services × audiences × outcomes — now agents run the iterations.

## Contrarian Angles

### Buyer-side hype ≠ merchant-side factory
Most capital and press chase shopping agents. Merchant ops (the factory that improves the site) is less sexy and more valuable for brands that already have traffic. Acknowledge the confusion; draw the line early.

### Autopilot trust is earned slowly
Forrester: consumers rarely let agents complete purchases unsupervised. Parallel for merchants: brands won't let agents merge to main without QA, previews, and human gates. Rooms/threads exist *because* of that — work is visible and reviewable.

### "Agency in a box" can sound like deskilling
Agencies will say judgment, taste, and brand strategy don't compress. Fair. The article's answer: account manager role remains (human or agent) for prioritization; judgment stays at the Kanban; execution compresses first (intelligence-heavy outsourced work — Sequoia's wedge).

### Hallucinated PRs are worse than slow agencies
Bad autofix at production scale destroys trust. Need QA agent, deploy preview, severity tiers (gold/silver/zinc findings), limited free runs — governance is the product.

### Protocol / forge wars are early
Buzz forge incomplete at launch; GitHub still the actuator for most teams. Don't pretend the stack is finished — GitHub PRs + deploys are fine actuators while rooms mature.

## Recent Developments

- Jul 21, 2026: Block launches Buzz (buzz.xyz) — humans + agents in shared Nostr workspace
- Mar 2026: Sequoia "Services: The New Software" goes viral; frames autopilot vs copilot
- Mid-2026: Forrester tempers agentic commerce hype — discovery shifting, checkout not yet
- Aug 2026 (deco internal): Autofix sandbox→PR demos; rooms=repos architecture consensus; PLG diagnostic free + autofix paywall; Electrolux/agency-replacement GTM conversations

## Sources

- https://sequoiacap.com/article/services-the-new-software/
- https://www.emarketer.com/content/ai-commerce-2026
- https://www.forrester.com/blogs/the-state-of-agentic-commerce-in-mid-2026/
- https://www.mordorintelligence.com/industry-reports/agentic-artificial-intelligence-in-retail-and-ecommerce-market
- https://www.precedenceresearch.com/ai-agents-market
- https://block.xyz/inside/introducing-buzz-where-humans-and-agents-work-together
- https://engineering.block.xyz/blog/buzz
- https://techcrunch.com/2026/07/21/jack-dorsey-is-taking-on-slack-with-buzz-a-group-chat-platform-for-teams-and-their-ai-agents/
- https://www.theinterconnections.com/blog/ecommerce-marketing-cost
- https://limelightmarketing.com/blogs/how-much-does-an-ecommerce-agency-cost-in-2025/
- https://growwithba.com/blog/marketing-agency-pricing-study-2026
- https://thomas-wiegold.com/blog/agentic-commerce-in-2026/
- Internal: Autofix daily 2026-08-04; week-start 2026-08-03; context/FUTURE.md; Buzz VISION_PROJECTS.md

## Synthesis for Article

The article should refuse the shopping-agent narrative and plant a sharper flag: a self-evolving storefront is a **software factory** that compresses a digital services agency. Sequoia supplies the economics ($1 software / $6 services; sell the work). Agency retainer data makes the punchline real — most entrepreneurs can't buy the full bench. Buzz supplies the proof that the industry is converging on rooms where humans and agents share workstreams, with branches as conversations. Deco's stack (diagnostics → Kanban → autofix sandboxes → PRs/deploys → observe) is the merchant-side factory being built in the arena. Contrarian fuel: trust, QA gates, and visible work state are features, not footnotes — "agency in a pocket" without audit is just a faster way to ship bugs.
