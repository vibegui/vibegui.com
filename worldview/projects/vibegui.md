---
id: vibegui
name: vibegui.com
repo: vibegui/vibegui.com
public: true
lifecycle: active
serves: [understanding, expression]
next_review: 2026-08-19
---

**Spirit:** the concepts I wish I knew when starting out.

## Declared outcome

The output surface. Content is one of the two things the machine produces, and
this is where it lands: 87 published articles across two locales, a distinction
graph they should eventually form, and the corpus that answers "have I already
said this?"

## Success criteria

1. Twelve distinctions have an essay, a position in the graph, sources, and a
   guided path.
2. Distribution closes the loop — a shipped piece produces a measurement that
   changes the next ranking.
3. The site stays static; the Worker holds no site rendering.

## Where it actually is

226 commits. 87 published articles, 4 drafts, plus two new drafts on the software
factory argument awaiting a cover image. The `mcp/` Worker has been extracted, so
this repo is a static site plus a Worldview instance.

Content is the only part of the whole loop running at volume. Everything else is
between 0% and 35%.

## Open questions

- `DECLARATION.md` at the repo root is stale: it still opens with the old charter
  and the seven outcomes, superseded by `worldview.json`. Rewrite it as the
  long-form charter, or delete it. Two declarations, one wrong, is integrity of
  objects failing.
