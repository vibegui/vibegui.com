---
slug: how-ai-agents-can-eliminate-production-bugs
title: How AI Agents Can Eliminate Production Bugs
description: From manually fixing customer errors with Claude Code and Cursor to building MCPs that let agents debug in real-time.
date: 2025-09-11
status: published
coverImage: null
tags:
  - ai
  - debugging
  - mcp
  - agents
  - linkedin-import
---
Normally, a startup writes product code that customers use directly. deco, however, is a platform. That means we write the "base" code, on top of which our customers write their code.

Anyone who's operated a platform knows that running user code is an immense challenge—you don't control what goes into production.

About two months ago, when declaring deco's future at deco.day, we had a powerful distinction: **we can't announce a platform evolution for AI workflows and agents while our production customers are suffering from errors.**

Whether the errors are in their code, written by them or by an agency: it doesn't matter. Our responsibility is to build infrastructure and tooling that PREVENTS our users from putting errors into production.

So I did what any obsessive founder would do and started *manually* fixing the "top errors" from our dashboard (which is an integrated deco feature, of course—every site has complete error logs accessible to users). I also had help from geniuses on the team, especially the hero Guilherme Tavano, who deeply understands the nuances of our framework.

Manually means:
- Find a high-frequency error
- Copy the stack trace
- Get the store name
- Clone the repository from our centralized GitHub (we host all our clients' code privately, which allows us to collaborate with them much more easily)
- Run locally and reproduce the error
- Have Claude Code or Cursor (I experimented a lot between them, I'm especially happy with Cursor+GPT-5) look at the code and stack trace and propose a fix
- 60% of the time it found the problem one-shot
- 30% of the time it was just updating a deco dependency
- 10% of the time I had to stop and think and give better context, eventually adding our relevant docs

But I wasn't doing this (just) to pay for my sins (remembering that the errors are in our customer's code). I did this to progressively automate the pieces necessary for **AI AGENTS to do this for me**, and for my clients and partners, forever.

Beyond the tactical result from our 28-day dashboard, we created the MCPs for the logging system that allows deco agents to look at errors in real-time and propose code changes.

If you want to see a demo of an agent seeing the log, solving the error, and pushing the fix, I left the link to Tavano's demo in the comments.

**You have no idea the quality leap that humanity's code will undergo in the next 2 years.** Buggy software will be something we'll tell stories about with nostalgia. Remember when we woke up in the morning with a production bug because someone pushed wrong code? LOL

Good times!

---

*Originally published on [LinkedIn](https://www.linkedin.com/posts/vibegui_normalmente-uma-startup-escreve-o-c%C3%B3digo-activity-7371884584998727680-qNPb) on September 11, 2025.*
