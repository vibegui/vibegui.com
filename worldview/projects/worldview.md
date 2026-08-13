---
id: worldview
name: Worldview
repo: vibegui/worldview
public: true
lifecycle: active
serves: [agency, word]
next_review: 2026-08-19
---

**Spirit:** know what my life is about, what game I am playing, and whether I am playing it well.

## Declared outcome

The layer above the factory. It holds the declared future, measures what is, and
computes the gap — and it never executes. Its own instance is this folder, which
is the test of whether the split is real: if the instance needs logic, the library
is wrong.

## Success criteria

1. `GET_DECLARATION` answers the three questions from git + D1 joined, and the gap
   is queryable.
2. A second person deploys their own instance from the docs alone.
3. It runs standalone in a browser, so it can be evaluated without an MCP host.
4. Alignment and integrity both produce a number I act on, not a number I explain.

## Where it actually is

14 commits, extracted from `vibegui.com/mcp` on 2026-08-11 with history intact.
Declaration lives in git; scores collapsed from eleven items to two. Becoming a
library so this folder can hold only configuration and content.

Not built: the word ledger (so integrity has no value yet), `GET_GAP`, and the
alignment computation.

## Open questions

- Integrity currently reads `null` rather than 0, honestly, because there is no
  word ledger. That is the next thing that makes the second score real.
