# Research: The State of Applied AI, August 2026

**Researched**: 2026-08-13 · **Method**: WebSearch + WebFetch (Perplexity not connected in this workspace)

**Rule:** every number in the draft has a URL here. Anything under `## Deliberately excluded` stays out.

---

## 1. The coinage timeline *(all verbatim, all primary)*

- **Agentic workflows** — Andrew Ng, **2024-03-21**. *"I think AI agentic workflows will drive massive AI progress this year — perhaps even more than the next generation of foundation models."* Same post is an early plain use of "agent loop" and the origin of the four patterns (reflection, tool use, planning, multi-agent). https://x.com/AndrewYNg/status/1770897666702233815
- **Vibe coding** — Andrej Karpathy, **2025-02-02 23:17 UTC**. *"There's a new kind of coding I call 'vibe coding', where you fully give in to the vibes, embrace exponentials, and forget that the code even exists."* Continues: *"I 'Accept All' always, I don't read the diffs anymore."* https://x.com/karpathy/status/1886192184808149383
  - **Date caution:** Simon Willison's much-cited post says "February 6th" while linking this exact tweet ID. The platform timestamp is 2 February. Use 2 February.
- **Vibe coding, adoption** — **2025-03-06**, YC managing partner Jared Friedman: a quarter of the Winter 2025 batch had **95% of their codebases AI-generated**. https://techcrunch.com/2025/03/06/a-quarter-of-startups-in-ycs-current-cohort-have-codebases-that-are-almost-entirely-ai-generated/
- **Vibe coding, Collins Word of the Year 2025** — **2025-11-06**. Merriam-Webster's 2025 pick was "slop"; Oxford's was "rage bait". https://blog.collinsdictionary.com/language-lovers/collins-word-of-the-year-2025-ai-meets-authenticity-as-society-shifts/
- **Context engineering** — Tobi Lütke, **2025-06-19**: *"the art of providing all the context for the task to be plausibly solvable by the LLM."* Karpathy amplified 2025-06-25. https://x.com/tobi/status/1935533422589399127
- **Context engineering, formalised** — Anthropic, **2025-09-29**: *"Context, therefore, must be treated as a finite resource with diminishing marginal returns."* https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- **Harness** — **no coinage exists.** Borrowed from "test harness"; EleutherAI's `lm-evaluation-harness` dates to 2020-08-28, SWE-bench ships `swebench.harness` from 2023. The datable moment it became standard for the agent scaffold is Anthropic's **2025-11-26** "Effective harnesses for long-running agents". Use that date, and do not call it a coinage. https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
- **Context graph** — named (not coined) by Jaya Gupta and Ashu Garg, Foundation Capital, **2025-12-22**: *"a living record of decision traces stitched across entities and time so precedent becomes searchable."* They write "we call," not "we coin." Mozilla used the identical phrase for an unrelated Firefox recommender in 2016. Neo4j's canonical definition landed 2026-08-04. https://foundationcapital.com/ideas/context-graphs-ais-trillion-dollar-opportunity
- **Agentic engineering** — Karpathy retires his own word, **2026-02-04**. Calls the original *"a shower of thoughts throwaway tweet that I just fired off without thinking."* The replacement: *"'agentic' because the new default is that you are not writing the code directly 99% of the time, you are orchestrating agents who do."* https://x.com/karpathy/status/2019137879310836075
- **"Agentic" as analyst standard** — Gartner names Agentic AI the #1 strategic technology trend for 2025 on **2024-10-21**. https://www.gartner.com/en/newsroom/press-releases/2024-10-21-gartner-identifies-the-top-10-strategic-technology-trends-for-2025

## 2. "Software factory" is a revival — say so on stage

- **1968, Robert W. Bemer, General Electric.** Proposed it first. Bemer's own definition (1969): *"A software factory should be a programming environment residing upon and controlled by a computer… A factory has measures and controls for productivity and quality."*
- **1969, Hitachi** built the first one — the first company anywhere to apply the word to a real software facility. SDC 1975; NEC, Toshiba, Fujitsu 1976-77. Cusumano, *Japan's Software Factories*, OUP 1991. https://www.gregorystrachta.com/resources/Touchstones/swp-3268-23661042.pdf
- **2003-2004, Microsoft sense** — Greenfield & Short, OOPSLA'03: *"a model-driven product line."*
- **2026, the AI sense, already in use by others.** BCG Platinion, 2026-03-26: *"In an Agentic Software Factory, autonomous AI agents build, test, and ship software solutions around the clock, while humans define business intent and review outcomes."* Factory.ai, 2026-06-15: *"The software factory starts with signals from the outside world… The entire system is a continuous feedback loop."* https://www.bcgplatinion.com/insights/the-agentic-software-factory · https://factory.ai/news/software-factory
- **Why this matters for the room:** the old sense meant industrialising *human* programmers — standard tools, reuse, variance control. Anyone over forty-five may remember it as a bad memory. The honest line is that Bemer wanted a factory and only had people to put in it.

## 3. Models, August 2026 *(all vendor-primary unless marked)*

- **Claude Opus 5** — **2026-07-24**. $5/MTok in, $25 out. 1M context. Anthropic: *"comes close to the frontier intelligence of Claude Fable 5 at half the price."* https://www.anthropic.com/news/claude-opus-5
- **Claude Fable 5** — 2026-06-09, $10/$50. **Claude Sonnet 5** — ~2026-06-30, $2/$10, 1M context; the scheduled Sept 2026 rise to $3/$15 was cancelled. https://platform.claude.com/docs/en/about-claude/pricing
- **GPT-5.6 family** — **2026-07-09**. Sol $5/$30, Terra $2/$12, Luna $0.20/$1.20. https://developers.openai.com/api/docs/pricing
- **Grok 4.6** — **2026-08-12**, two days before this piece. $2/$6 under 200k. https://docs.x.ai/docs/models
- **Google has no stable Gemini 3 Pro.** Only `gemini-3.1-pro-preview`. The newest stable Pro-tier model is Gemini 2.5 Pro. https://ai.google.dev/gemini-api/docs/models
- **Llama is gone.** Meta replaced it with the closed **Muse Spark** line (2026-04-08); Muse Spark 1.1 currently leads SWE-bench Pro. Meta returned to open weights with **Muse Glimmer**, 30B, Apache 2.0, **2026-08-10**. Artificial Analysis still scores Llama 4 Scout at 10 against Kimi K3's 60. https://ai.meta.com/blog/introducing-muse-spark-msl/ · https://www.cnbc.com/2026/08/10/meta-muse-glimmer-open-weight-ai.html
- **Price of a fixed capability level falls 5-10× per year; the price of running the newest frontier model rises 3-18× per year.** arXiv 2511.23455 (Nov 2025, rev. Mar 2026). Epoch's separate estimate puts GPT-4-level GPQA performance falling 40× per year. https://arxiv.org/abs/2511.23455 · https://epoch.ai/data-insights/llm-inference-price-trends

## 4. The finding that carries the argument

Open weights versus closed, same month, three benchmarks:

| Benchmark | Best open | Best closed | Gap |
|---|---|---|---|
| Artificial Analysis intelligence index | Kimi K3 — 60 | Opus 5 — 63 | **3** |
| SWE-bench Verified (vals.ai, independent harness) | DeepSeek V4 Pro — 96.4 | Opus 5 — 97.0 | **0.6** |
| Terminal-Bench 2.1 (independent leaderboard) | GLM-5.1 — 58.7 | Fable 5 (Claude Code) — 83.8 | **25.1** |

https://artificialanalysis.ai/models/open-source · https://www.vals.ai/benchmarks/swebench · https://www.tbench.ai/leaderboard/terminal-bench/2.1

**Open models close the gap fastest on benchmarks where somebody else built the machine around them.** Terminal-Bench measures multi-step agentic work, and it is exactly where the closed labs ship a harness (Claude Code, Codex) while open weights arrive naked.

Corroborating detail: the same model scores differently under different harnesses. Fable 5 is 83.8% under Claude Code and 80.4% under Terminus 2. Opus 4.7 is 68.9% and 66.1%. The model is not the whole decision.

**Benchmark-integrity warning worth saying out loud:** DeepSeek self-published 80.6% on SWE-bench Verified for V4-Pro; on an independently harnessed evaluation with a 0.3% false-positive verifier, the same preview build scored 8% pass@1. Vendor-reported open-model scores are not currently comparable to independently harnessed ones. [SECONDARY]

## 5. The money, honestly

**What is measured, and it is uncomfortable:**

- **US total factor productivity moved 0.07%** over the four quarters to Q1 2026. SF Fed utilisation-adjusted series. https://www.frbsf.org/research-and-insights/data-and-indicators/total-factor-productivity-tfp/
- **95% of AI productivity talk on earnings calls is future tense.** St. Louis Fed, 2026-07-31. Method: 490,000 transcripts, 5,198 US public firms, 2000-2025, 910,955 productivity sentences classified. Versus roughly three-quarters for non-AI productivity talk. Their conclusion: earnings calls *"point less to broad realized productivity gains than to a corporate sector actively investing in, experimenting with and expecting future gains."* https://www.stlouisfed.org/on-the-economy/2026/jul/ai-productivity-what-firms-say-earnings-calls
- **CFOs feel 3× what their own numbers imply.** Atlanta Fed WP 2026-4, March 2026, ~750 CFOs. Reported AI-attributed labour productivity gain **1.8%** for 2025; computed from the same respondents' reported revenue and employment changes, **0.6%**. https://www.atlantafed.org/-/media/Project/Atlanta/FRBA/Documents/research/publication/working-paper/2026/03/25/04-artificial-intelligence-productivity-and-the-workforce-evidence-from-corporate-executives.pdf
- **95% of GenAI pilots show no measurable P&L impact.** MIT NANDA, July 2025. **Attach the caveat, which is the report's own:** *"These figures are directionally accurate based on individual interviews rather than official company reporting."* https://mlq.ai/media/quarterly_decks/v0.1_State_of_AI_in_Business_2025_Report.pdf
- **The best-identified positive number:** BIS WP 1325, 2026-01-23, >12,000 EU and US firms, adoption instrumented by US peer rates. *"AI adoption increases the level of labor productivity by 4%… no adverse effects on firm-level employment."* https://www.bis.org/publ/work1325.htm

**The finding that should reframe the room, and it is the most useful thing in this file:**

- **The firms with real gains did not get them from cutting costs.** Atlanta Fed, same study. Ranked motives (0-4): improving production efficiency 2.88, enhancing decision-making 2.71, serving customers more effectively 2.36, developing new products 2.30 — versus **reducing labour costs 2.01 and reducing non-labour costs 1.71, the two lowest on the list.** Gains correlated with demand- and innovation-oriented motives, not cost ones.
- **Where savings did show up, it was external spend.** MIT, among the ~5% with measurable returns: *"BPO elimination: $2-10M annually"*, **30% decrease in external creative and content costs**, and explicitly *"these gains came without material workforce reduction."*
  - This is deco's business stated by a third party: the money is in the agency invoice, not the payroll.

**The commerce demand signal, with its denominator:**

- **AI-referred retail visits convert 54% higher and are worth 53% more per visit**, growing 138% YoY. Adobe Digital Insights Q3 2026, data through May 2026. Twelve months earlier non-AI visits were worth 128% *more* — the gap inverted. https://business.adobe.com/resources/sdk/.q3-ai-traffic-trends-report/q3-2026-ai-sourced-traffic-insights.pdf
- **Shopify Q1 2026:** AI-referred sessions convert ~50% higher with 14% higher AOV; AI-referred orders up 13× YoY. Shopify's own qualifier: organic still refers more sessions than all AI platforms combined. https://www.shopify.com/enterprise/blog/ai-search-insights
- **The denominator that keeps everyone honest:** AI assistants are still roughly **0.1-0.2% of sessions and revenue** on established stores. A 13× growth rate on 0.1% is 1.3%. [SECONDARY]
- **Retail is the laggard, not the leader:** **14.0%** of retail firms use AI, against 19.8% economy-wide and 39.7% in information. US Census BTOS, data through 2026-05-03. https://www.census.gov/library/stories/2026/05/ai-use-businesses.html
- **Amazon Rufus:** ~$12bn incremental annualised sales, users converting 60%+ higher. Jassy, Q4 2025 earnings call. Company estimate, no disclosed counterfactual. [EXEC CLAIM]

## 6. Counterweights held in reserve for Q&A

- **BIS WP 1367, 2026-07-07** — the best-argued bear case, by a named central-bank economist with a calibrated model. Over-investment *"around 1.5 times the efficient level, rising to around three times where demand is less elastic."* Hyperscaler capex above **$700bn in 2026**. https://www.bis.org/publ/work1367.pdf
- **Acemoglu's ceiling** — ≤0.66% TFP over ten years, *Economic Policy* 40(121). Peer-reviewed, and it is a ceiling.
- **Furman** — information-processing equipment and software was 4% of US GDP in H1 2025 but 92% of GDP growth; excluding it, growth was 0.1%. The bear reading: the effect so far is the *building* of AI, not the *using*.
- **Klarna walked its own claim back**, May 2025: *"We focused too much on efficiency and cost. The result was lower quality, and that's not sustainable."*
- **Entry-level displacement is real and widening** — Stanford Digital Economy Lab, 2026-08-12 (yesterday): employment for 22-25 year olds in highly AI-exposed occupations is **~19% below** trend, up from 15% a year earlier. https://digitaleconomy.stanford.edu/news/canariesaug26/
- **And it points the other way for software** — Indeed Hiring Lab, 2026-07-08: US software development postings **+14.8%** since Claude Code launched, while overall postings fell 7%. 71% of the increase is senior roles. Present both; anyone presenting one is selecting. https://hiringlab.indeed.com/2026/07/08/ai-and-job-postings-from-destruction-to-creation/

## 7. Cost of running the factory

- **Anthropic's own published figure:** **~$13 per developer per active day**, **$150-250 per developer per month**, under $30/day for 90% of users. Agent teams use ~**7× more tokens**. https://code.claude.com/docs/en/costs
- **Cost per merged pull request ranges $0.28 to $89.32** across 12,000 developers at 200 companies — a ~320× spread. Jellyfish, 2026-07-20, vendor-published. https://jellyfish.co/library/ai-token-usage-monitoring/
- **Median large firm plans $300,000 of AI spend in 2026**; median small firm $12,500. 55% of large-firm spend is operations, 31% internal development, 13% hardware. Atlanta Fed WP 2026-4.

---

## Deliberately excluded

- Every ecommerce autonomous-experimentation figure found in vendor and SEO blogs (20-40% conversion lift, 3-4× assisted-session conversion, $47K first-month DTC revenue). No methodology, no independent source.
- Salesforce's "AI influenced 20% of holiday sales / $262bn" — "AI influenced" counts any touchpoint including recommendations and ranking, so it measures install base, not incremental revenue.
- "Prompt engineer job postings rose then fell" — no rigorous source exists. Indeed's Hiring Lab treats prompt engineering as a *skill*, never as a title time series.
- Gartner's "by 2028 over 50% of AI agent systems will use context graphs" — repeated widely, underlying note paywalled, not on any Gartner-hosted page.
- C3.ai / Monday.com / Sprout Social 2026 layoffs "because of AI" — disclosed drivers are revenue pressure and layer removal.
- METR's 19%-slowdown RCT as a standalone stat. METR abandoned the design on 2026-02-24 because *"30% to 50% of developers told us that they were choosing not to submit some tasks because they did not want to do them without AI."* Cite only as a pair, or not at all.

## Could not verify

- Merriam-Webster's "vibe coding" entry date (Wikipedia says 2025-03-08; the live page renders only a Jun 2026 stamp; M-W returns 403).
- Archived 2024/2025 vendor pricing snapshots — web.archive.org is blocked from these tools. Price trajectories are built from currently listed legacy prices instead.
- Anthropic release dates for Opus 4.8, 4.7, 4.6, Sonnet 5 and Sonnet 4.6 — inferred from the deprecation table minus 12 months; the method is validated on two known-good cases but the rest remain inferred.
- Adobe's absolute AI traffic share — every relative metric is published, the level is not.
- Amazon's Rufus $12bn methodology — no filing, no counterfactual, no definition of "incremental".
- Kimi K3 release date (2026-07-27 is from a search summary; the model card carries no date).
