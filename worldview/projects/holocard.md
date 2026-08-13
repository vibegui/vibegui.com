---
id: holocard
name: Holocard
repo: decocms/holocard
lifecycle: active
serves: [validation] # PROPOSED resolution — see below
next_review: 2026-08-19
---

**Spirit:** a card is a link people send on WhatsApp.

## Declared outcome

Per its own `CLAUDE.md`: *make holocard make money online and become a BR
internet trend.* Three seeded goals — weekly card pageviews (people opening
cards because others shared them), cards created per week, and BRL per week.

It is also the most complete instance of the self-driving loop that exists
anywhere in the portfolio: a four-hat team (analyst, builder, reviewer, CEO), a
token economy where budgets are earned on efficiency, a review gate the server
enforces, and rooms for handoffs. Runtime is trying to build what Holocard is
already running by hand.

## Success criteria

1. Revenue per week is not 0 — no monetization exists yet, so getting it off zero
   means shipping one.
2. Cards created per week and card pageviews both trending up, with bots excluded
   from the count.
3. The loop runs without me: reviewer-closed tasks and reviewer-issued verdicts
   accumulating without my intervention.

## The alignment question

**`serves: null` is not an oversight.** Holocard is real, active, has 16 commits,
a deployed product at holocard.page, and a working autonomous team — and it does
not obviously advance anything in the declared future. "Make money online and
become a BR internet trend" appears nowhere in `../declared-future.md`.

Three honest resolutions, and this is exactly the conversation the alignment score
exists to force:

1. **It serves `validation`.** Holocard is where I find out whether a thing anyone
   wants can be shipped and measured — the stage the rest of the portfolio skips.
   Under this reading it is the most aligned project I have, and the declaration
   should say so.
2. **The declaration is missing revenue.** If making money independently matters,
   it is a strategic result and its absence is a gap in what should be, not in
   Holocard.
3. **It is a side bet.** Genuinely outside the declared future, kept anyway
   because it is fun and teaches things. Then say that out loud and cap the
   attention it gets, rather than letting it compete silently with declared work.

Pick one. Leaving it `null` while it stays active is the state that quietly costs
the most.

## Open questions

- 12 uncommitted files on `experiment/fortune-teller` as of 2026-07-25, last
  activity three weeks ago. Is the fortune-teller experiment live, parked, or
  dead? A branch nobody has decided about is unhonored word to yourself.
- Holocard's four-hat protocol is more advanced than Runtime's. Should Runtime
  inherit it rather than reinvent it?
