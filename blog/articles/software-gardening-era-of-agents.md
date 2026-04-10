---
slug: software-gardening-era-of-agents
title: Software Gardening in the Era of Agents
description: 'Atwood called it Software Gardening in 2008. Karpathy named it vibecoding in 2025. When code is almost free, the bottleneck was always somewhere else — and the teams winning now are the ones who figured out where.'
date: 2026-04-08
status: published
coverImage: /images/articles/software-gardening-era-of-agents.png
tags:
  - agents
  - ai
  - mcp
  - product
  - startup
---
For most of my career, I thought I was doing software wrong.

The senior engineers I respected showed up with architecture documents, system diagrams, months of planning before a single line was written. Conferences ran entire tracks on methodology. I absorbed the message: serious builders plan first.

I never could do that. I'd ship something small, learn from it, redirect.

I thought I was being undisciplined.

But I was really discovering an important property of software: that it greatly resists planning and foreseeing, and greatly rewards humble iteration.

Agents didn't change that insight. They made it 100x more consequential.

## Planning was a hedge, not a virtue

Jeff Atwood published "[Tending Your Software Garden](https://blog.codinghorror.com/tending-your-software-garden/)" in 2008 — citing Andy Hunt, Dave Thomas, and a passage from 37Signals I've thought about ever since:

> "Software grows much in the same way that plants grow. There's flowering season. There's new feature season. There's infrastructure season. Sometimes software is working on its roots — growing underground where the public can't see it."

His point: the construction metaphor — blueprints, load-bearing beams, one shot to get it right — doesn't hold. Software is soft. It's alive. The best projects feel alive: constantly growing, shaped by whatever conditions they encounter.

He was right. But in 2008, even the largest teams still worked at the pace of human hands. You shipped. You waited. Problems surfaced when users ran into them.

The reason planning *felt* rational wasn't wisdom. It was that coding was expensive. Redoing things cost months. Over-planning was a hedge — a rational defense against the cost of being wrong.

Agents dissolved that cost.

## Karpathy named it vibecoding in 2025

In February 2025, Andrej Karpathy posted on X:

> "There's a new kind of coding I call 'vibe coding', where you forget that the code even exists. It's not really coding — I just see stuff, say stuff, run stuff, and copy-paste stuff, and it mostly works."

Then, a year later:

> "Something flipped where I went from 80-20 writing code versus delegating to agents — to 20-80."

And then the real insight:

> "Now the bottleneck is you."

When building gets cheap, the cost that justified planning disappears — and something else comes into view. The bottleneck was never writing code. **It was always knowing what to build.** What your users actually need. What's failing that you haven't noticed yet. What problem you're solving that actually matters.

Agents made this undeniable.

## The real constraint is domain knowledge

Claude Code flipped the interaction model: developers went from writing code to directing it. Karpathy's 80-20 flip became the norm for millions of developers in less than a year.

Then Charlie Holtz and Jackson de Campos built [Conductor](https://www.conductor.build/blog/series-a) — $22M Series A, March 2026 — and took the next step: isolated copies of your codebase, dozens of agents running in parallel across each one, review and merge their work. Not one developer walking the rows. Twenty agents, each working their own section.

Faster. Yes. But faster *at what?*

Here's what I've learned running agents inside live storefronts and production codebases: the quality of what agents produce is entirely proportional to the domain context they carry. Give an agent a generic prompt, it does generic work. Give it the specifics — what your users complain about, how your catalog is actually structured, what failed last quarter and why — and it starts doing work no external consultant ever could.

Sequoia recently argued that [the next wave of billion-dollar companies](https://sequoiacap.com/article/services-the-new-software/) will look like service firms on the outside but run like software companies on the inside. Don't sell the shovel — sell the harvest. You build domain context so deep that your agents can tend someone else's garden better than they can tend it themselves.

The compounding isn't in the velocity. It's in the knowledge you encode into each agent over time.

## The point of speed is learning

Faster cycles compress the distance between what you build and what you learn.

The teams winning now aren't the ones with the most agents. They're the ones who figured out how to orchestrate agents with the right tools and context — and used the speed to discover what their users actually need, faster than anyone else could.

If you've been building iteratively and felt like you were cutting corners — you weren't. You were learning. That was always the game. Agents just collapsed the timeline.

The construction metaphor promised certainty. The garden metaphor demands something harder: staying close enough to what's growing to know when to prune, when to water, and when to let something die.

Agents accelerated everything. Except the fundamentals. You still plant, tend, learn, and adapt. The more things change, the more the garden demands the same thing it always did.
