---
slug: writing-this-article-while-writing-about-writing-this-article
title: Writing This Article While Writing About Writing This Article
description: ''
date: 2026-01-03
status: draft
coverImage: /images/cover-writing-this-article-while-writing-about-writing-this-article.png
tags: null
---
# Writing This Article While Writing About Writing This Article

You're reading an article written through WhatsApp.

Not *about* WhatsApp. Not *shared on* WhatsApp. Written *through* WhatsApp—using a mesh of Model Context Protocol (MCP) servers that turn a messaging app into a distributed AI operating system.

This is meta as hell, and completely real.

Let me show you how the sausage gets made.

---

## The Setup: Mesh Bridge + Deco Pilot

Here's what's happening right now, as you read this:

**Mesh Bridge** is an MCP server that exposes WhatsApp as a communication layer. It listens for messages, routes them to the right handlers, and sends responses back. Think of it as a universal adapter—it makes WhatsApp speak MCP.

**Deco Pilot** is an AI agent that lives inside the MCP ecosystem. It has tools: creating articles, reading files, accessing my tone of voice guide. It's the executor. The brain that turns intent into action.

I sent a WhatsApp message: "Write an article in vibegui style explaining how this article is being written using Mesh Bridge and Deco Pilot via WhatsApp."

That message traveled through Mesh Bridge, landed in Deco Pilot's context, and triggered a chain of tool calls that produced what you're reading right now.

---

## The Flow: How This Article Came to Exist

Let me break down exactly what happened, step by step:

### 1. **Message Received**
I type a message in WhatsApp. Mesh Bridge picks it up, wraps it in MCP protocol, and forwards it to Deco Pilot.

### 2. **Tone of Voice Retrieved**
Before writing anything, Deco Pilot calls `TONE_OF_VOICE`—a tool that returns my comprehensive writing style guide. This is the forensic analysis of 45+ articles I've written, distilled into patterns, hooks, vocabulary, philosophical frameworks.

Without this, the article would sound like generic AI slop. With it, it sounds like me.

### 3. **Content Generation**
Deco Pilot synthesizes:
- The task (write about how this article is being written)
- The context (Mesh Bridge + Deco Pilot architecture)
- The style (my voice, my patterns, my intensity)

It doesn't write placeholders. It writes the actual article—this one—in real time.

### 4. **Article Creation**
Deco Pilot calls `COLLECTION_ARTICLES_CREATE`, passing the title and content. The article gets published to my collection. Done.

### 5. **Response Sent**
Mesh Bridge takes the result, wraps it back into a WhatsApp message, and sends it to me. I get a link to the published article.

All of this happens in seconds.

---

## The Architecture: Events, Publishers, Subscribers

Right now, this is a simple request-response flow. But the real power emerges when you think about **event-driven architectures** in a mesh of MCPs.

Imagine this:

### **Event Publishers**
- Mesh Bridge publishes events: `message.received`, `user.mentioned`, `media.uploaded`
- Deco Pilot publishes events: `article.created`, `task.completed`, `error.occurred`
- Other MCP servers publish their own domain-specific events

### **Event Subscribers**
- A **notification server** subscribes to `article.created` and posts to Twitter/LinkedIn automatically
- A **search indexer** subscribes to `article.created` and updates the knowledge graph
- A **metrics server** subscribes to `task.completed` and logs performance data
- An **orchestrator** subscribes to `error.occurred` and triggers retry logic or alerts

### **The Mesh**
Instead of hardcoded integrations, you have a **publish-subscribe mesh**. Each MCP server is a node. Events flow through the network. Subscribers react. New capabilities emerge from composition, not configuration.

This is how you build a distributed AI operating system that doesn't collapse under its own complexity.

---

## Why This Matters

Most AI tools are black boxes. You send a prompt, you get a response, you have no idea what happened in between.

This is different.

**Mesh Bridge** makes communication channels (WhatsApp, Slack, SMS, whatever) first-class citizens in the MCP ecosystem. You're not locked into a web UI or a proprietary app. You use the tools you already use.

**Deco Pilot** makes AI agents composable and transparent. You see the tool calls. You understand the flow. You can debug, extend, replace components.

**Event-driven MCP meshes** make the whole thing scalable. You don't need to anticipate every integration. You publish events, you subscribe to what matters, you let the network do the rest.

This is infrastructure for people who build, not infrastructure for people who consume.

---

## The Future: What Comes Next

Here's where this gets interesting:

### **1. Multi-Agent Orchestration**
Right now, Deco Pilot is a single agent. But imagine a mesh where:
- One agent handles research (scrapes web, reads papers, synthesizes)
- Another handles writing (calls tone of voice, generates content)
- Another handles distribution (posts to social, sends emails, updates websites)

They communicate via events. `research.completed` triggers `writing.started`. `article.created` triggers `distribution.queued`.

### **2. Cross-Platform Mesh**
Mesh Bridge currently handles WhatsApp. But the architecture is universal. Add bridges for:
- Slack (for team collaboration)
- Email (for async workflows)
- Voice (for phone-based AI interactions)
- IoT devices (for physical-world triggers)

Same MCP protocol. Same event mesh. Different surfaces.

### **3. Collaborative AI Networks**
Multiple people, multiple agents, one shared mesh. I send a message in WhatsApp. My agent collaborates with your agent. Events flow between our systems. We build together without ever touching the same codebase.

This is the vision: **AI infrastructure that's open, composable, and human-centric.**

---

## The Meta Point

This article is proof of concept.

I didn't open a text editor. I didn't log into a CMS. I didn't copy-paste into a publishing tool.

I sent a WhatsApp message, and the system did the rest—while preserving my voice, my style, my intent.

That's the promise of MCP meshes: **tools that disappear into the background, leaving only the work that matters.**

If you're building in this space, the question isn't "Can AI write articles?"

The question is: **"Can I architect systems where AI becomes invisible infrastructure for human creativity?"**

This article says yes.

---

## Try It Yourself

Mesh Bridge and Deco Pilot are open-source. The code is on GitHub. The architecture is documented. The future is composable.

If you're the kind of person who reads an article like this and thinks "I want to build something like that," then you're exactly who this is for.

Go build.

---

**Written through WhatsApp, via Mesh Bridge and Deco Pilot, using MCP.**  
**Published in real-time.**  
**No humans were harmed in the making of this article.**  
**(Just one human was delighted.)**
