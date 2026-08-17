# Research: AI Learned to Work. Now We Need to Build the Factory.

**Researched**: 2026-08-13
**Revised independently**: 2026-08-16
**Rule**: use evidence to explain the operating shift. Do not turn the article into an industry-statistics roundup.

## Evidence used in the article

### From answer to action

- **OpenAI function calling — 13 June 2023.** Models could return structured arguments for a function chosen from developer-provided definitions. The application still executes the action and returns its result. This is the clean technical boundary between generating an answer and requesting an action.

  https://openai.com/index/function-calling-and-other-api-updates/
- **Model Context Protocol — 25 November 2024.** Anthropic introduced an open protocol for connecting assistants to data sources and business tools, addressing the cost of a custom integration for every source.

  https://www.anthropic.com/news/model-context-protocol

### Broad adoption, shallow operation

- **Stanford AI Index 2026, Economy chapter.** AI adoption reached 88% of surveyed organizations and generative AI appeared in at least one function at 70%, while agent deployment remained in the single digits across nearly every business function. This supports the distinction between adopting AI and redesigning work around agents.

  https://hai.stanford.edu/ai-index/2026-ai-index-report/economy

### What successful deployments require

- **Stanford Digital Economy Lab, Enterprise AI Playbook — April 2026.** The study covers 51 successful deployments across 41 organizations, with selection bias toward mature positive outcomes explicitly acknowledged by its authors.

  https://digitaleconomy.stanford.edu/publication/enterprise-ai-playbook/
- 77% of the hardest challenges reported were change management, data quality, and process redesign rather than technical problems.
- Agentic implementations were only 20% of the selected cases, but showed 71% median productivity gains versus 40% for high automation. These figures are contextual support, not representative economy-wide estimates, so the article does not quote the productivity comparison.
- Successful agentic cases shared four practical properties: high-volume work, clear success criteria, recoverable errors, and access to data and action systems.
- The report found model choice fully interchangeable in 42% of cases and critical in 19%. This is more nuanced than claiming that the model is never a differentiator, so the previous open-versus-closed comparison was removed.

## Factory anatomy

The article uses “software factory” as an operating-system analogy, not as a claim that software creation becomes a conventional assembly line.

- **Goal and constraints**: the accountable human defines the desired business result, risk limits, approvals, and rollback conditions.
- **Signals**: observable changes such as conversion, catalog drift, performance, incidents, competitor moves, and customer behavior initiate work before a ticket exists.
- **Internal loops**: observe, combine evidence, prioritize, plan, execute, verify, and escalate.
- **Actions**: pull requests, deploys, pages, prices, campaigns, or evidence-rich human escalations.
- **Feedback and memory**: measure the action against the goal and preserve the result so later decisions start from accumulated experience.

## Deliberately excluded

- Prompt-engineer salary history: memorable but irrelevant to an executive deciding how to deploy AI.
- Current model-release dates and the Artificial Analysis/Terminal-Bench open-versus-closed chart: too time-sensitive and weaker than deployment evidence.
- “95% of pilots fail”: the MIT NANDA report is not needed once the Stanford deployment study supplies a more useful and better-qualified finding.
- Adobe AI-referred traffic, CFO productivity estimates, BPO savings, and agency-spend claims: they turn the piece into a money roundup and interrupt the evolution toward the factory.
- “Context graph” as a synonym for memory: a context graph may store decision traces, but the durable capability is learning from measured outcomes, independent of data structure.
