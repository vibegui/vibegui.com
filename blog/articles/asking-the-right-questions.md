---
slug: asking-the-right-questions
title: The Most Productive Thing I Did Today Was Answer Questions
description: How GSD turned a messy SQLite-to-Supabase migration into 49 commits across 5 phases in 33 minutes — while I was working on 3 other projects.
date: 2026-02-16
status: published
coverImage: /images/articles/from-coder-to-conductor.jpeg
tags: null
---
# The Most Productive Thing I Did Today Was Answer Questions

The most productive thing I did today was not write code.

It was answer questions.

A framework called [GSD](https://github.com/gsd-build/get-shit-done) sat me down and asked what I actually wanted. Not "describe the feature." More like — what are you trying to become? What's in scope? What's off limits? What does done look like? The kind of questions that make you realize you hadn't thought it through. I'd been carrying a half-baked migration plan in my head for a week. Ten minutes of answering GSD's questions and I understood my own project better than I had all week.

That's the shift. Not faster code. Better thinking before any code gets written.

Then it went to work. Phase by phase — each one researched, planned, and executed autonomously. Between phases I'd check in, answer more questions, course-correct. Most times it verified itself and moved on. 49 commits. 5 phases. 33 minutes of agent execution. A complete SQLite-to-Supabase migration — schema, import, sync pipeline, verification tests, the whole thing.

I was working on three other projects simultaneously.

## The first tool that treats AI like a project

Every AI coding tool I've used treats software like a conversation. You prompt. It responds. The conversation ends. Context gone. Start over tomorrow.

[GSD](https://github.com/gsd-build/get-shit-done) treats it like a project. It runs on top of Claude Code, and the difference is structural.

It maps your codebase. Interviews you. Researches the domain. Breaks the work into phased plans with success criteria. Executes with parallel agents. Then verifies — not "did the tests pass" but "did the stated goal get achieved."

And it remembers. Every step produces artifacts in a `.planning/` directory — state, roadmap, per-phase research, plans, verification reports. Come back in three weeks and pick up where you left off. No other AI coding tool does this.

## What actually happened

This morning, vibegui.com was a mess. Half-finished SQLite migration from a week ago. Unstaged changes. Dead references everywhere. A custom YAML parser I'd hacked together that occasionally mangled frontmatter. 52 articles in markdown files with no database backing. I'd been avoiding this cleanup for days.

I told GSD: complete the migration to Supabase-first.

It started by mapping the codebase — seven structured documents covering stack, architecture, conventions, integrations, concerns. Then it interviewed me. Scope. Constraints. What's out of bounds. Captured everything into a PROJECT.md and produced 34 requirements traced to five phases.

Then, phase by phase:

1. **Migration cleanup** (3 min) — Deleted every SQLite artifact, fixed stale references across package.json, vite config, READMEs. Build passes clean.
2. **Parser foundation** (8 min) — Replaced my hand-rolled YAML parser with gray-matter and Zod validation. Roundtrip fidelity tests for all 52 articles. That parser had been a source of quiet anxiety for weeks. Gone.
3. **Supabase schema & import** (10 min) — Tables, triggers, search vectors, RLS policies. All 52 articles imported with tag management. Dry-run tested first.
4. **Sync pipeline** (2 min) — The reverse direction: Supabase back to markdown. SHA-256 hash comparison, dry-run mode, orphan detection.
5. **Integration & verification** (10 min) — Pre-commit hooks, CRUD helpers with audit trails, 70 end-to-end tests across desktop and mobile. Full pipeline verified: Supabase → sync → generate → build → serve.

33 minutes. 49 commits. 117 constraint tests passing, 70 E2E tests green.

The whole time, I was jumping between this and three other projects. GSD held the context. I didn't have to.

## The interview is the product

Voltaire said you judge a man not by his answers but by his questions. That applies to agents too.

Most of the value I got today didn't come from the code agents wrote. It came from the questions GSD asked me before anything executed. Questions that challenged assumptions I didn't know I was making. Questions that surfaced edge cases I'd been ignoring. Questions that confirmed the dubious stuff — the things I was 60% sure about but hadn't stress-tested.

Formulating the right questions is the hard part. Any agent can generate code. The difference is whether it knows what to ask before it starts. I've spent years studying Erhard's work on the power of language to shift context. GSD's interview loop is that principle made operational. The questions don't just capture requirements. They create clarity that didn't exist before. By the time agents started writing code, the hard thinking was already done.

Cursor is incredible for flow-state coding. When I know what I'm building and I'm in the zone, nothing beats it. But Cursor is a conversation. No plan. No memory. No verification that what you built matches what you intended. For a focused task — fix this bug, add this component — it's perfect. For a multi-phase migration with dependencies between phases? It's a pen when you need an architecture firm.

## Half my commands were /clear

About 50% of my GSD commands today were `/clear`. Context window fills up, you clear it, resume from disk, run the next phase. Clear again. The commands are verbose and it sometimes over-plans — a two-minute task gets a fifteen-minute planning cycle.

But every time I think "this is too much ceremony," I look at the git log.

49 commits. Five phases. 33 minutes. All verified. While I was doing other things.

The ceremony is the feature. It just needs better UX.

## What comes next

I'm working on a fork. GSD's bones are solid — I want to reuse as much of it as possible and rebuild the philosophical layer on top.

You don't *plan* a future. You *declare* it. In Erhard and Zaffron's framework, a declared future isn't prediction or hope. It's a commitment that reorganizes action. "Our company will be the leader in X" isn't a forecast. It's a context that shifts how every decision gets made.

Applied to agents: instead of "plan the migration," you declare "vibegui.com is Supabase-first with a complete sync pipeline, verification tests, and agent-friendly authoring tools." The system figures out the gap between current state and declared future, then works backward from the declaration.

More on that soon.
