# Content Directory

This directory contains all blog content managed via MCP tools.

## Collections

### `/ideas/`
Raw thoughts and sparks. Quick captures that might become articles.

**Create via MCP:**
```
COLLECTION_IDEAS_CREATE({
  title: "My idea title",
  content: "The raw thought...",
  tags: ["topic1", "topic2"]
})
```

### `/research/`
Deep research documents generated using AI (Perplexity).

**Generate via MCP:**
```
RESEARCH_TOPIC({
  topic: "Topic to research",
  questions: [
    "What are the key facts?",
    "What are recent developments?"
  ]
})
```

### `/drafts/`
Article outlines with structure, ready for editing.

**Transform from idea:**
```
IDEA_TO_DRAFT({
  ideaId: "my-idea-slug",
  includeResearch: ["research-slug-1", "research-slug-2"]
})
```

### `/articles/`
Final, published content.

**Publish from draft:**
```
DRAFT_TO_ARTICLE({
  draftId: "my-draft-slug",
  polish: true  // Optional AI polish
})
```

## Frontmatter Format

All markdown files use YAML frontmatter:

```yaml
---
title: "Article Title"
description: "Optional description for SEO"
date: 2024-12-20
tags: ["topic1", "topic2"]
status: draft | published
---

Article content here...
```

## Workflow

1. **Capture**: Create an idea when inspiration strikes
2. **Research**: Generate research on the topic
3. **Outline**: Transform idea + research into a draft
4. **Edit**: Refine the draft (manually or with AI)
5. **Publish**: Convert draft to article
6. **Deploy**: Build, commit, push

All steps can be done through natural conversation with AI via MCP.

