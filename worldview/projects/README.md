# projects/ — what should be, per project

One file per project. Frontmatter is structure; the body is prose. Same shape as
`blog/articles/`, so it edits like writing rather than like config.

```md
---
id: vigia
name: vigia
repo: vibegui/vigia
lifecycle: active | draft | archived
serves: [agency, relationships]   # ← the relationship. Primary first.
next_review: 2026-08-19
---

**Spirit:** one line — why this exists at all.

## Declared outcome
## Success criteria
## Open questions
```

## The project ↔ strategic result relationship

`serves:` is the whole relationship, and it is **many-to-many**: one project can
advance several declared outcomes, and one outcome needs several projects.
Declared in one direction only — on the project — because two lists that must
agree is how both go stale. The reverse view is derived, never written.

```
project.serves[]  ──────▶  worldview.json → strategicResults[].id
                  ◀──────  derived: which projects serve this outcome
```

Run `bun run alignment` for both directions. It is the alignment score, and it
fails in two directions on purpose:

- **An active project serving nothing** — either it advances something declared,
  or the declaration is missing something, or it should not be active. All three
  are decisions; none of them is a file error.
- **A declared outcome nothing serves** — you declared a future and put no work
  behind it. That is the more expensive failure and the easier one to miss.

`serves: []` is a legitimate, deliberate value. `decocms` uses it: an external
commitment tracked for honesty about attention, explicitly not scored against a
personal declaration. What is *not* legitimate is leaving it empty by accident on
something active.

Several projects serving one outcome is normal and not a smell — vibegui.com and
mangabeira.chat both serve `expression` and they are complementary.

## `competes_with:` — parallel bets

Sometimes two projects are attempts at the *same* function and one is meant to
win. That is a deliberate portfolio hedge, not duplication, and it needs saying
out loud or it reads as redundancy:

```md
competes_with: [deco-studio]
```

Declared on both sides. `bun run alignment` then reports the race and which
outcomes are genuinely contested — the intersection of what both serve, since a
competitor's other outcomes are its own business.

**A race needs a finish line.** Two active projects on one outcome spends double
and the default result of an undecided race is both continuing forever. Each side
of a `competes_with` pair should name what evidence ends it and when you look.
`deco-studio` ↔ `runtime` is the live one.

Valid values are the `id`s in `../worldview.json` → `strategicResults`.
`bun run check` fails on an id that does not exist.

## What lives here vs. in D1

Here (git, reviewable): declared outcome, success criteria, spirit, what it
serves, review cadence.

In D1 (measured, changes constantly): progress percent and note, GitHub evidence,
activity, captures, goals, decisions, memory.

`GET_PORTFOLIO` joins them. Same seam as the declaration — a project declared
here with no D1 row reads as 0% and needs no migration.

## Retiring a project

`lifecycle: archived` plus a `superseded_by:` when something replaced it. Never
delete the file: the measurement history stays valid, and the decision to stop
stays legible. A project that silently disappears is unhonored word to yourself.
