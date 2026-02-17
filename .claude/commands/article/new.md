---
description: Create a new article brief and draft skeleton
argument-hint: "<topic or title>"
allowed-tools:
  - Read
  - Write
  - Glob
  - AskUserQuestion
---

<objective>
Create a new article from a topic idea. Produces a structured brief in `content/briefs/{slug}/BRIEF.md` and a draft skeleton in `blog/articles/{slug}.md` with minimal frontmatter.
</objective>

<context>
Arguments: $ARGUMENTS

@blog/config.json
@blog/tone-of-voice.md (Section 10.3 for title patterns, Section 4 for structural blueprints)
</context>

<process>

1. **Get the topic.** If `$ARGUMENTS` is empty, use `AskUserQuestion` to ask:
   - "What topic do you want to write about?"

2. **Guided ideation.** Use `AskUserQuestion` to gather:
   - **Angle**: What's the unique take or perspective? (not just the topic, but the *argument*)
   - **Type**: Short-form (~400-800 words), Long-form (~800-2000 words), or Technical (devlog/architecture)
   - **Target audience**: Who specifically should care about this?
   - **Key message**: If the reader remembers ONE thing, what is it?

3. **Generate the slug.** From the working title:
   - Lowercase, normalize accents, replace non-alphanumeric with hyphens
   - Trim leading/trailing hyphens, max 80 characters
   - Check `blog/articles/` to ensure no collision

4. **Create the brief.** Write `content/briefs/{slug}/BRIEF.md`:

```markdown
# Brief: {Title}

**Slug**: {slug}
**Type**: {short/long/technical}
**Created**: {YYYY-MM-DD}

## Topic
{What this article is about}

## Angle
{The unique perspective or argument}

## Target Audience
{Who this is for and why they'd care}

## Key Message
{The one thing the reader should take away}

## Hook Ideas
{2-3 potential opening hooks using patterns from tone-of-voice.md Section 3}

## Notes
{Any additional context, references, or constraints}
```

5. **Create the draft skeleton.** Write `blog/articles/{slug}.md`:

```
---
slug: {slug}
title: '{Title}'
description: '{One-line description}'
date: {YYYY-MM-DD}
status: draft
coverImage: null
tags: null
---
```

Leave the body empty — the draft skill will write the full article.

6. **Report and suggest next step.**

Output:
```
Created:
  - content/briefs/{slug}/BRIEF.md
  - blog/articles/{slug}.md

Next step: /article:research {slug}
```

</process>

<success_criteria>
- Brief file exists at `content/briefs/{slug}/BRIEF.md` with all sections filled
- Draft skeleton exists at `blog/articles/{slug}.md` with valid frontmatter (status: draft)
- Slug is unique (no collision with existing articles)
- Title follows patterns from tone-of-voice.md Section 10.3
</success_criteria>
