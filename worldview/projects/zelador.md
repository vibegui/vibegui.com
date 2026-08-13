---
id: zelador
name: zelador
repo: vibegui/zelador
public: true
lifecycle: active
serves: [order]
next_review: 2026-08-19
---

**Spirit:** the caretaker who quietly keeps the building in order.

## Declared outcome

A local, open-source desktop app that organizes files. You bring your own AI;
zelador brings the methodology. Nothing leaves the machine. MIT, Tauri, no
account, no server, no telemetry.

Deterministic heuristics do the confident work — hash-verified duplicates, app
installers, dead `.crdownload`, stale git clones, credential-shaped files,
screenshot dumps — and a model handles only the ambiguous remainder. Every action
is approved before anything moves.

**This is integrity of objects, made operational.** Integrity of objects means
components and relationships are complete and every claim has an artifact that
opens. A passport PDF sitting in plaintext next to a GitHub App private key is
that failing at the personal-data layer, and 58 GB of `~/Downloads` is the same
failure at scale.

## Success criteria

1. Read-only scan first, always. The index is built before anything is proposed.
2. Every move has a dry run, an audit trail, and a recovery path — zero
   unrecoverable automated operations.
3. File contents stay local and unread unless explicitly opted in per rule; the
   model sees metadata.
4. It survives being pointed at my real drives without me holding my breath.

## Where it actually is

2 commits, `main`, started 2026-08-12. Methodology specified in detail — scan,
understand, propose. Not built.

## Supersedes

`personal-files`. Same declared outcome — Mac, iCloud, and Drive as one usable
map with reversible operations — but as a real app rather than a design note.

## Open questions

- Is it MIT and public from the first commit, or private until it has been pointed
  at real data once? Its README already says MIT, which is a commitment.
- The overlap with vigia is the file layer: vigia indexes to answer questions,
  zelador indexes to move things. One scan or two?
