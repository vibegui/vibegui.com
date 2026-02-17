---
description: Resume work on an in-progress article
argument-hint: "<slug>"
allowed-tools:
  - Read
  - Glob
---

<objective>
Pick up an in-progress article and route to the appropriate next step in the pipeline.
</objective>

<context>
Arguments: $ARGUMENTS
</context>

<process>

1. **Resolve the slug.** If `$ARGUMENTS` is provided, use it as the slug. Otherwise:
   - Scan `blog/articles/` for files with `status: draft`
   - Scan `content/briefs/` for directories with planning artifacts
   - List in-progress articles with their current state for the user to pick

2. **Check what exists.** For the resolved slug, check:
   - `content/briefs/{slug}/BRIEF.md` — has brief?
   - `content/briefs/{slug}/RESEARCH.md` — has research?
   - `content/briefs/{slug}/OUTLINE.md` — has outline?
   - `blog/articles/{slug}.md` — exists? Has content beyond frontmatter? Has coverImage?
   - Is it in Supabase? (check frontmatter status)

3. **Determine next step.** Route based on what's missing:

   | State | Next Step |
   |-------|-----------|
   | No brief | `/article:new {slug}` (shouldn't happen, but handle it) |
   | Brief only | `/article:research {slug}` |
   | Brief + Research | `/article:outline {slug}` |
   | Brief + Research + Outline, no content | `/article:draft {slug}` |
   | Has content, no image | `/article:image {slug}` |
   | Has content + image, status: draft | `/article:publish {slug}` |
   | Published | "This article is already published!" |

4. **Show context summary.**

```
Article: {title}
Slug: {slug}
Status: {status}

Completed steps:
  {checkmark} Brief
  {checkmark} Research
  {x} Outline
  {x} Draft
  {x} Image
  {x} Published

Next step: /article:outline {slug}
```

5. **Offer to proceed.** Tell the user what the next step is and that they can run the suggested skill command.

</process>

<success_criteria>
- Correctly identifies all existing artifacts for the slug
- Routes to the right next step in the pipeline
- Shows a clear progress summary
</success_criteria>
