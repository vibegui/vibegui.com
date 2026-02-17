---
description: Full article pipeline in one session (new -> research -> outline -> draft -> image -> publish)
argument-hint: "<topic>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Bash
  - AskUserQuestion
  - mcp__perplexity-ai-agent__ask
  - mcp__perplexity-ai-agent__chat
  - mcp__nano-banana-agent__GENERATE_IMAGE
  - mcp__supabase-agent__execute_sql
---

<objective>
Chain all article authoring steps in a single session: new -> research -> outline -> draft -> image -> publish. Includes checkpoints for user approval at key stages.
</objective>

<context>
Arguments: $ARGUMENTS

@blog/tone-of-voice.md
@blog/visual-style.md
@blog/config.json
</context>

<process>

**This skill chains all article steps sequentially. Follow the full process from each individual skill, but in a continuous flow.**

### Step 1: New (from /article:new)
- Get topic from `$ARGUMENTS` or ask the user
- Guided ideation: angle, type, audience, key message
- Generate slug, create BRIEF.md, create draft skeleton
- Show: "Brief created. Moving to research..."

### Step 2: Research (from /article:research)
- Read the brief
- Make 2-4 Perplexity calls with `model: "sonar-pro"`
- Write RESEARCH.md
- Show: "Research complete. Moving to outline..."

### Step 3: Outline (from /article:outline)
- Read brief + research + tone-of-voice.md
- Create beat-by-beat outline following structural blueprints
- Write OUTLINE.md

**CHECKPOINT 1:** Use `AskUserQuestion` to ask:
"Here's the outline for '{title}'. Approve the structure, or tell me what to change?"
- Show the outline summary (beats, hook, closing strategy)
- Wait for approval before proceeding

### Step 4: Draft (from /article:draft)
- Read all artifacts + tone-of-voice.md
- Write the full article following the outline
- Self-review against voice checklist (Section 11.1)
- Run Guilherme Voice Test (Section 11.2)

**CHECKPOINT 2:** Use `AskUserQuestion` to ask:
"Draft complete ({word_count} words). Approve the draft, or tell me what to change?"
- Show voice checklist results
- Wait for approval before proceeding

### Step 5: Image (from /article:image)
- Extract concept from article
- Build prompt using visual-style.md template
- Generate with `mcp__nano-banana-agent__GENERATE_IMAGE` (aspectRatio: "3:2")

**CHECKPOINT 3:** Use `AskUserQuestion` to ask:
"Here's the cover image. Approve, or describe what to change?"
- Wait for approval before saving

- Save image and update frontmatter

### Step 6: Publish (from /article:publish)
- Read article, check Supabase for existing entry
- INSERT or UPDATE in Supabase (project: `juzhkuutiuqkyuwbcivk`)
- Handle tags
- Update local status to published
- Verify with `bun run sync --dry-run`

### Final Report

```
Article published: {title}

Pipeline summary:
  1. Brief: content/briefs/{slug}/BRIEF.md
  2. Research: content/briefs/{slug}/RESEARCH.md ({N} sources)
  3. Outline: content/briefs/{slug}/OUTLINE.md ({N} beats)
  4. Draft: blog/articles/{slug}.md ({word_count} words)
  5. Image: public/images/articles/{slug}.png
  6. Published to Supabase (ID: {id})

URL: /article/{slug}
```

</process>

<success_criteria>
- All 6 steps completed successfully
- User approved at all 3 checkpoints (outline, draft, image)
- Article is published in Supabase with status `published`
- All planning artifacts exist in `content/briefs/{slug}/`
- Cover image exists in `public/images/articles/`
- Voice checklist passes
- Roundtrip sync is consistent
</success_criteria>
