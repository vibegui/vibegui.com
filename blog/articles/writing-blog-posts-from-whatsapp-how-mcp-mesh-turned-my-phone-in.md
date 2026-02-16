---
slug: writing-blog-posts-from-whatsapp-how-mcp-mesh-turned-my-phone-in
title: 'Writing Blog Posts from WhatsApp: How MCP Mesh Turned My Phone Into a Publishing Platform'
description: ''
date: 2026-01-03
status: draft
coverImage: null
tags: null
---
# Writing Blog Posts from WhatsApp: How MCP Mesh Turned My Phone Into a Publishing Platform

I just published this article from WhatsApp.

Not by copying text into a CMS. Not by emailing myself a draft. I literally typed a message in WhatsApp, and the words you're reading now flowed through a chain of open-source tools running on my laptop, hit an LLM for polish, and landed in my blog's database.

No cloud service in the middle. No API keys stored on someone else's server. Just my machine, my keys, my control.

This is what happens when you stop treating websites as walled gardens and start treating them as APIs.

## The Problem: Every App Is a Prison

Here's the absurd reality we've normalized: I can write coherent thoughts in WhatsApp, Slack, Gmail, Twitter—but the moment I want those thoughts to *do something*, I'm stuck.

Want to turn a WhatsApp thread into a blog post? Copy, paste, switch apps, format, publish.

Want to search your email while chatting? Switch apps, search, switch back, paste.

Every app is a silo. Every context switch is friction. Every platform wants to own your attention.

We've built this incredibly powerful AI infrastructure—models that can write, code, analyze, create—and then we trap it inside chat interfaces that can't touch the rest of our digital lives.

**The question that led to mesh-bridge**: What if your AI could control the browser itself?

## The Solution: Domains as APIs

MCP Mesh already solved half the problem. It's a local AI orchestration layer that connects tools—your terminal, your filesystem, web search, LLMs—into a unified mesh. You can chain them together. Ask a question, search the web, summarize results, save to a file. All local. All private.

But Mesh couldn't touch websites. Until now.

**mesh-bridge** is a Chrome extension + local server that turns any website into an MCP tool.

Here's the architecture:

### The Request Path

1. **You type in WhatsApp**: "Write a blog post about mesh-bridge architecture"
2. **Extension captures it**: The Chrome extension injected into WhatsApp sees the message
3. **Bridge matches the domain**: The local server identifies this is WhatsApp and routes to the WhatsApp domain handler
4. **Domain interprets intent**: The WhatsApp domain understands this is a command, not just a message
5. **Mesh executes tools**: Your local MCP Mesh orchestrates—calls an LLM, formats the content, hits your blog's API
6. **Response flows back**: The result appears in WhatsApp as a reply

### The Architecture: Three Layers

**Layer 1: The Extension**
A Chrome extension that injects into websites. It doesn't care what site you're on—it just establishes a WebSocket connection to your local bridge server and pipes messages back and forth.

**Layer 2: The Bridge**
A local server (running on port 9999) that acts as a universal translator. It:
- Receives messages from the extension via WebSocket
- Matches the URL to a specific **domain** (WhatsApp, Slack, Gmail, etc.)
- Forwards commands to MCP Mesh via STDIO
- Routes responses back to the extension

**Layer 3: The Domain**
This is where the magic happens. A domain is a plugin that maps a website's DOM into an API of tools.

Think about it: WhatsApp has a chat interface. It has messages, contacts, groups. That's not just UI—that's an *implicit API*. The domain makes it explicit.

The WhatsApp domain knows:
- How to detect when you're sending a command (vs. a normal message)
- How to extract text from the message input field
- How to inject responses back into the chat
- How to expose WhatsApp-specific tools to Mesh (send message, read chat, etc.)

**Domains transform websites from closed interfaces into controllable tools.**

Currently shipping: WhatsApp (ready). Coming soon: Slack, Gmail.

### The Communication Flow

```
WhatsApp (browser)
    ↕ WebSocket (port 9999)
mesh-bridge (local server)
    ↕ STDIO
MCP Mesh (orchestration layer)
    ↕ Tool calls
LLM / Terminal / Search / Your Blog API / Whatever
```

Every hop happens on your machine. No cloud middleman. No data leakage.

## Why This Matters: Sovereignty Over Your Tools

Here's what makes this architecture different from every "AI assistant" you've seen:

### 1. **Local-First, Always**
The bridge runs on your laptop. The mesh runs on your laptop. Your API keys never leave your machine. You're not trusting some startup's promise to "keep your data private"—you're running the code yourself.

### 2. **Open Source, Fully Auditable**
Don't trust me? Read the code. Fork it. Modify it. The entire stack is open. No proprietary black boxes.

### 3. **Your Keys, Your Control**
Want to use OpenAI? Anthropic? A local Llama model? Your choice. Plug in your own keys. Switch providers anytime. No lock-in.

### 4. **Composable by Design**
Because everything is MCP-compatible, you can chain tools infinitely. WhatsApp → LLM → web search → terminal → blog API. Or WhatsApp → Gmail → Slack. Whatever flow you need, you build it.

### 5. **No Platform Risk**
This isn't a SaaS product that can shut down, change pricing, or get acqui-hired into oblivion. It's infrastructure you control.

## What This Enables (Beyond Blog Posts)

Writing from WhatsApp is cute. But the real power is what happens when you generalize this pattern:

- **Email from anywhere**: Draft in Slack, send via Gmail, all without leaving Slack
- **Research flows**: Ask a question in WhatsApp, trigger web search + summarization + save to notes
- **Code deployment**: Message yourself "deploy staging", watch it hit your terminal and push
- **Cross-app automation**: Read from Gmail, process with LLM, post to Twitter, log in Notion

Every website becomes a node in your personal AI mesh.

## The Philosophy: Software Should Serve You

We've spent two decades building apps that compete for our attention. Every platform wants to be the "everything app." Every interface wants to trap you inside.

**This is the opposite.**

mesh-bridge doesn't want you to stay in WhatsApp. It doesn't care where you are. It just makes sure that wherever you are, you have access to everything you need.

It's a bet that the future of software isn't about bigger walled gardens—it's about smaller, composable tools that respect your agency.

You choose where to type.
You choose which AI to use.
You choose where your data lives.
You choose how tools connect.

## Try It Yourself

The code is on GitHub. The setup takes 10 minutes. You'll need:
- Chrome (for the extension)
- Node.js (for the bridge server)
- MCP Mesh (for orchestration)

Install, configure your domains, point it at your tools, and suddenly your browser becomes programmable.

I'm writing this from a café in Rio. My laptop is running the bridge. My phone has WhatsApp open. I just typed "publish this", and now you're reading it.

The future isn't about waiting for platforms to give us APIs.

It's about treating every interface as if it already is one.

---

*mesh-bridge is open source and available now. WhatsApp domain is production-ready. Slack and Gmail domains coming soon. Built with MCP Mesh, the local-first AI orchestration platform we're building at deco.*

*No cloud. No lock-in. No bullshit. Just tools that work.*
