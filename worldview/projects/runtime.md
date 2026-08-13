---
id: runtime
name: Runtime
repo: decocms/runtime-team
lifecycle: active
serves: [software-factory]
competes_with: [deco-studio]
next_review: 2026-08-19
---

**Spirit:** a place to try the thing the team cannot afford to try.

## Declared outcome

Runtime and Studio are attempts at the same function. Runtime exists because
Studio has a team depending on it, and a product with users cannot cheaply
gamble on its own shape.

So Runtime is the exploration: one deploy is one org, rooms as the social plane,
teammates named for the craft they own, `studio.json` as versioned org design,
GitHub as the execution record. It gets to be wrong. That is the point — testing
the rooms format here costs a rewrite, testing it in Studio costs the team's
trust.

It is not a layer beneath or above Studio. It is the other horse.

## Success criteria

The exploration succeeds when it produces a decision, not when it produces a
product:

1. **The rooms format is answered.** Either rooms-as-versioned-org-design is
   clearly better than what Studio does, or it is not, and either answer is a
   win.
2. A queue populates from the gap without anyone typing a task, and every item
   names the declared outcome it serves and the measurement that exposed it.
3. No work item completes without a tokened review by someone other than its
   author, and no status without an artifact that opens.
4. Whatever wins here transfers to Studio, or Runtime takes over. Learning that
   dies in this repo was wasted.

## Where it actually is

76 commits, `main` clean as of 2026-08-10. Built: one deploy per org, GitHub org
membership as the front door, the runtime as its own MCP server, projects as
repositories, a strict reporting line, rooms that open as a chat.

Not built, per its own `WORLDVIEW.md` §8: rooms are a database write rather than
a pull request, the queue is empty until a human types, no expansion stage, no
distribution stage, no return edge, and integrity is mostly prompt policy.

## The bet needs a finish line

"Both walk in parallel until one wins" is a real strategy and an expensive one.
Two active projects serving one declared outcome is a deliberate hedge, not a
duplication error — but a race with no finish line is just two projects.

Unanswered: **what evidence decides it, and by when?** Without that, the default
outcome is both continuing indefinitely, which is the one result that spends
double and decides nothing.

Candidate criterion, for argument: whichever one first produces a queue derived
from the gap that I actually work from for two consecutive weeks.

## Open questions

- What decides the bet, and when do I look?
- Holocard already runs the four-hat protocol — analyst, builder, reviewer, CEO,
  with a server-enforced review gate and a token economy. Runtime is rebuilding
  what Holocard operates today. Should Runtime inherit it rather than reinvent it?
- Agent word identity: `@dev` gives word as itself and the score rolls up. Still
  needs the ledger it writes to.
