---
description: Deep research for an article using Perplexity
argument-hint: "<slug>"
allowed-tools:
  - Read
  - Write
  - Glob
  - mcp__perplexity-ai-agent__ask
  - mcp__perplexity-ai-agent__chat
---

<objective>
Conduct deep research for an article using Perplexity AI. Reads the brief for context, makes multiple research calls, and produces a structured `content/briefs/{slug}/RESEARCH.md` document.
</objective>

<context>
Arguments: $ARGUMENTS

@blog/config.json
</context>

<process>

1. **Resolve the slug.** If `$ARGUMENTS` is provided, use it as the slug. Otherwise, scan `content/briefs/` for directories that have a `BRIEF.md` but no `RESEARCH.md`, and list them for the user to pick.

2. **Read the brief.** Read `content/briefs/{slug}/BRIEF.md` to understand the topic, angle, audience, and key message.

3. **Conduct research.** Make 2-4 Perplexity calls using `mcp__perplexity-ai-agent__ask` with `model: "sonar-pro"`:

   **Call 1 — Topic Overview:**
   "Give me a comprehensive overview of {topic}. Include key concepts, current state, and why it matters. Focus on {angle}."

   **Call 2 — Data & Evidence:**
   "What are the most compelling statistics, data points, and concrete examples related to {topic}? Include recent studies, market data, or real-world cases."

   **Call 3 — Contrarian Viewpoints:**
   "What are the strongest counterarguments, criticisms, or alternative perspectives on {topic}? What do skeptics say?"

   **Call 4 (optional) — Recent Developments:**
   "What are the most recent developments, news, or trends related to {topic} in the last 6 months?"

4. **Synthesize findings.** Write `content/briefs/{slug}/RESEARCH.md`:

```markdown
# Research: {Title}

**Slug**: {slug}
**Researched**: {YYYY-MM-DD}

## Key Findings
{Bulleted list of the most important discoveries, organized by theme}

## Data & Evidence
{Specific numbers, statistics, studies, and concrete examples that support the article's angle}

## Notable Quotes & References
{Direct quotes or paraphrased insights from credible sources, with attribution}

## Contrarian Angles
{Counterarguments and alternative perspectives — these make the article stronger}

## Recent Developments
{What's happening right now that makes this timely}

## Sources
{List of URLs and references from Perplexity results}

## Synthesis for Article
{2-3 paragraph summary of how this research supports the article's angle and key message from the brief}
```

5. **Report and suggest next step.**

Output:
```
Research complete:
  - content/briefs/{slug}/RESEARCH.md
  - {N} Perplexity queries made
  - Key finding: {most interesting discovery}

Next step: /article:outline {slug}
```

</process>

<success_criteria>
- Research file exists at `content/briefs/{slug}/RESEARCH.md` with all sections populated
- At least 2 Perplexity calls were made with `model: "sonar-pro"`
- Sources are included with URLs
- Contrarian angles section is non-empty (makes articles stronger)
- Synthesis section connects research back to the brief's angle and key message
</success_criteria>
