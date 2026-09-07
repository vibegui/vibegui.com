# Brief: Swap the Domain, Read the Store

## Topic

Announcement + tech talk for decoindex.com — a read-through proxy that turns any VTEX
or Shopify storefront URL into Markdown an agent can use.

## Angle

A side-project writeup, not a benchmark report. Lead with the trick working, then why
it exists, then how it is built, then what it cost to learn. Numbers come late and
serve the story; they are not the story.

## Audience

Engineers who would build this themselves, and people who own a storefront. They
should be able to try it on their own domain before finishing the piece.

## Key message

Storefronts are written for browsers and the thing reading them stopped being one.
A thin, boring proxy that resolves one URL against the merchant's own API — and sends
every shopper back to the merchant — beats a crawler with an index.

## Structure

Announcement → why → how → results → try it.

1. The URL swap, working, in the first ten lines. Live, open source, AGPL-3.0.
2. Why: Farm Rio at 917 KB, `robots.txt` closing search to everyone, a 30-line
   `llms.txt`, C&A's 6 MB page. WebMCP looked like the fix and is headless-blind.
3. How: platform probe decided by content type (VTEX answers 404 with `200 text/html`),
   two upstream calls, 6s each, rate limit per merchant, negative cache, KV with no TTL
   as the line between a cache and an index. Search and sort on the merchant's own
   conventions. Channel-not-competitor invariants: noindex, canonical, `?ref=decoindex`,
   `live_commercial_data: false`.
4. Results: `<TokenGap />`, `<ModelCost />`, the errand ($1.01 and a shrug vs 19 cents).
5. Try it, plus the reason to keep it thin and open.

Cut on review: the v0-crawler post-mortem and the "agents wrote the bug reports"
section. Both were good material and both turned the announcement back into a
retrospective. They belong in their own piece.

## Sources (all primary)

- `~/conductor/workspaces/decoindex/lisbon` — `bench/results/{latest,models,models-errand,journeys}.json`,
  `bench/models.mjs`, `README.md`, `CLAUDE.md`.
- Commit bodies `e56212f` (the deletion), `d3b2ba3` (search + the agent's own words),
  `3b75aaf` (ordering, benchmark methodology), `1548311` (docs vs shipped service).
- Session logs: farmrio-storefront-davao 2026-08-31 (the originating question, the
  917 KB measurement, the WebMCP research) and decoindex-lisbon (the benchmark runs).

## Editorial rules

- No figure that isn't in a committed benchmark file. Tokens are estimated at four bytes
  per token and the piece says so.
- Name the unflattering rows in the same breath as the ratio.
- Voice guards: no "No X. No Y. Just Z.", no "This isn't X, it's Y.", no tidy parallel
  punchlines, no abstract noun doing a verb's job.
