---
slug: web-generation-as-human-expression
title: Web Generation As Human Expression
description: Everyone deserves to express themselves through the web. For the first time, the software doesn't ask you to learn its language first.
date: 2026-04-10
status: draft
locale: "en"
translationKey: "article:web-generation-as-human-expression"
coverImage: null
tags: []
---

The web is the most powerful canvas ever invented.

Ship a product. Run a team. Publish a tool. Share an idea with anyone, immediately. Nothing else comes close. I've spent my career here and I still believe this.

Here's what bothers me: even for developers, most of the time goes into managing the canvas. Not making something on it.

---

You know exactly what you want the site to do. Getting there means navigating a framework, a build system, a CMS integration, a deployment pipeline. The vocabulary is the tool's vocabulary — pages, sections, components, variants — not yours. You translate your intent into the tool's language. The tool executes. Something always gets lost crossing that gap.

Bret Victor called this in 2011: creators deserve immediate connection to what they're creating. Every abstraction layer costs something real. Not just time. The idea itself changes when it has to pass through a form it wasn't meant for.

This is as true for experienced developers as for anyone. The canvas is powerful. The ceremony around it is the problem.

---

Language models change the ratio.

They can read your codebase and reason about it. They can generate and deploy code. They can understand what you're trying to do before you've fully articulated it.

That's new. So what would it actually look like to build software around this — for real teams, serious sites, high traffic, production stakes? What would a dev and content platform look like if it was designed from the start to close that gap? Demos are easy. The argument has to be made where it's hard.

---

## It starts with a conversation

There's no blank canvas. The agent doesn't wait for you to know what to ask — it presents choices, explains tradeoffs, asks the right questions.

You describe your site. Your goals. What's working and what isn't. It reads your repo, your logs, your analytics. But it also captures something harder to get at: your intentions. Why the system is designed the way it is. What decisions were made and why. What you're optimizing for.

That context doesn't disappear when the conversation ends. The agent holds it — a living summary of your goals and your architecture, updated as things change. Every future conversation starts from where the last one left off.

## It knows your system better than any one person does

A developer looking at a slow page has the code. Maybe some analytics. Rarely has CDN logs, error traces, real-user performance data, and business metrics in the same view, at the same time, connected to each other.

An agent with all of it — codebase, CDN behavior, error logs, Core Web Vitals, conversion data — doesn't wait to be asked. It tracks performance continuously, notices when something shifts, and comes to you with findings before you know there's a problem.

Cache strategies inconsistent across loaders. A loader called 47 times per page request with no cache key. A VTEX routing bug that only fires from a `.myvtex.com` domain. These used to require an incident to surface. Now they surface before anyone notices.

The specificity is the difference between a recommendation and a diagnosis.

## From idea to production, fast

You describe what you want to try. The agent writes the code, runs it in a full sandbox, executes end-to-end tests, verifies the outcome. If it holds, it opens the pull request with an explanation. You review. It ships.

The idea-to-production loop collapses. The ceremony disappears. You stay at the level of the experiment — what you're trying, why, and whether it worked — and the agent owns everything between the idea and the result.

No staging environments to wrangle. No CI configuration to debug. No manual test suites to run. The verification happens automatically, every time.

## New contributors hit the ground running

Every codebase has someone who knows all of it. Where the debt is. Why that workaround exists. What breaks under load. Usually one person. Sometimes none.

The agent becomes that person — and it's available to everyone on the team, all the time. A new developer on day one inherits the same context as someone who's been on the project for three years. Design decisions are distilled, not buried in Slack threads. Past choices are explained, not rediscovered by accident.

The knowledge stops being locked in one head. The team stops being fragile around that head leaving.

## It runs while you're not there

This is where the gap closes for real.

You declare a goal — a banner campaign for the weekend sale, an A/B test on the homepage CTA, auto-updates to a product page when stock changes. The agent has the right connections and the right constraints. It executes.

No mac mini running a cron job in the corner. No cloud server you have to SSH into and maintain. No security configuration to worry about. The web automates the web — full code sandbox, end-to-end verification, and deployment, running continuously against your declared goals.

Content teams run campaigns without involving engineering. Developers set the constraints once and trust the system. The site keeps improving whether or not anyone is actively working on it.

---

## The platform

All of this lives in one place: [deco studio](https://www.decocms.com/studio).

Connect your infrastructure — GitHub, analytics, CDN, commerce platform, observability stack. Declare what you're working toward. Watch agents run in continuous loops toward it. Redirect, approve, or expand scope from anywhere.

Same platform for developers and editors. Same agents, different domains. One control plane for a team that never stops working.

---

The web is still the most powerful canvas. The gap between having an idea and expressing it through software is finally closing.

That's what I'm building toward.
