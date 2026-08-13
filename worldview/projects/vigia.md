---
id: vigia
name: vigia
repo: vibegui/vigia
lifecycle: active
serves: [agency, relationships]
next_review: 2026-08-19
---

**Spirit:** the watchman who walks the building hour by hour and writes down what he saw.

## Declared outcome

The eyes. A local scraper that collects the signals I actually generate all day —
browser tabs, WhatsApp threads, LinkedIn connections — indexes them on my machine,
resolves them into people and projects, and serves that index to my agents over
MCP.

Local-only, read-only at every source, no hands.

**This is the missing half of `agency`.** The whole system is built on the gap
between what should be and what is, and until now "what is" meant GitHub commits
and site metrics — the narrowest possible slice of a life. Forty tabs across four
windows *is* a project list nobody wrote down. Two thousand WhatsApp threads *are*
a CRM nobody indexed. vigia is what makes "what is" honest instead of convenient.

Its own README states the architecture better than I had:

```
vigia          eyes      local        watches, indexes, resolves.       no hands
zelador        hands     local        organizes files.                  review-gated
worldview      ledger    Worker+MCP   declares, measures, scores.       never executes
runtime-team   hands     CF + Claude  writes code, ships.
```

One correction to that table, worth carrying back to `vibegui/vigia`: the last
row implies Runtime is *the* code-writing hands. It is one of two — deco Studio is
the incumbent attempt at the same function and Runtime is the exploration
(`competes_with`). The row should read something like *"a factory — Studio or
Runtime, bet open"*, or vigia's architecture bakes in a winner that has not been
chosen.

## Success criteria

1. A session starts from evidence instead of a question — the agent knows what I
   was doing without asking.
2. WhatsApp and LinkedIn resolve into people with contact recency and frequency,
   replacing manual entry entirely.
3. It touches raw personal data and can change nothing outside its own index.
   That property is not a feature to trade away later.

## Where it actually is

1 commit, `main`, started 2026-08-12. The README is fully specified; the index is
not built.

## Supersedes

`personal-crm`. The PRM was a WhatsApp/LinkedIn scraper feeding a relationship
map, which is a subset of what vigia does. Its declared outcome moves here rather
than living in two places.

## Open questions

- vigia is upstream of everything and is the only component touching raw personal
  data. Does the index ever leave the machine? The answer should be no, stated
  once, and treated as a condition of satisfaction rather than a default.
- Does it write to Worldview's D1 as measurement, or does Worldview query it over
  MCP? The second keeps "local-only" true; the first is simpler.
