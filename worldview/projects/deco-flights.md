---
id: deco-flights
name: Flights
repo: null # no remote configured
lifecycle: draft
serves: [validation] # PROPOSED — it is a shipped proof, not a declared aim
next_review: 2026-08-19
---

**Spirit:** turn flight planning into a conversation.

## Declared outcome

A standalone MCP app that plans a trip conversationally: describe where, when, how
long, and your preferences, and it runs focused background searches against Google
Flights and ranks results by price, stops, layovers, and what you care about.

No API keys, no database — trips persist as plain JSON under
`~/.deco/flights/trips/`. Every tool ships an inline MCP-app UI.

## Why `validation`

This is the most complete small example in the portfolio of the thing Worldview
keeps claiming matters: a real MCP app with real UIs that a person can use, built
without infrastructure. It validates the pattern — inline MCP-app UIs, no
database, no keys — that anjo.chat, holocard, and Worldview's own app all depend
on.

If that is not what it is for, then it is a personal tool that serves nothing
declared, and it should say so.

## Success criteria

1. It plans a trip I actually take.
2. The inline-UI pattern it proves is reused rather than reinvented elsewhere.

## Where it actually is

2 commits, `main`, last activity 2026-06-12 — two months cold. **No git remote
configured**, so it exists only on this machine and is one disk failure from gone.

## Open questions

- No remote is the finding here. Push it or accept that it is disposable, but
  choose deliberately.
- Is this a product, a proof, or a personal tool? `serves: [validation]` assumes
  proof. If it is a personal tool, `serves: []` is the honest value.
