---
description: Show status of all articles and their progress
allowed-tools:
  - Read
  - Glob
---

<objective>
Display a status table of all articles, derived entirely from the filesystem. Shows where each article sits in the pipeline and suggests the next step.
</objective>

<context>
Arguments: $ARGUMENTS
</context>

<process>

1. **Scan articles.** `Glob` for `blog/articles/*.md` (skip `README.md`). For each file, read its frontmatter and capture: slug, title, status, date, coverImage.

2. **Scan briefs.** `Glob` for `content/briefs/*/`. For each slug dir, check for `BRIEF.md`, `RESEARCH.md`, `OUTLINE.md`.

3. **Render the table.** Sort by date descending. Columns:

```
| Slug                | Status    | Brief | Research | Outline | Image |
|---------------------|-----------|-------|----------|---------|-------|
| my-new-article      | draft     | yes   | yes      | no      | no    |
| hello-world-...     | published | no    | no       | no      | yes   |
```

- **Status**: from frontmatter (`draft` | `published`).
- **Brief/Research/Outline**: `yes` if the respective file exists under `content/briefs/{slug}/`.
- **Image**: `yes` if `coverImage` in frontmatter is non-null.

4. **Summary counts.**

```
Total: {N} articles
  Published: {N}
  Drafts:    {N}
  In planning (has brief, no article file): {N}
```

5. **Next-step suggestions.** For any in-progress article, print the next command:
- Has BRIEF.md only → `/article:research {slug}`
- Has BRIEF.md + RESEARCH.md → `/article:outline {slug}`
- Has OUTLINE.md, but article body is empty/skeleton → `/article:draft {slug}`
- Has draft content but no `coverImage` → `/article:image {slug}`
- Has draft + image, ready to ship → `/article:publish {slug}`

</process>

<success_criteria>
- All local articles listed with accurate state.
- No network calls — pure filesystem inspection.
- Next steps printed only for articles that aren't already published.
</success_criteria>
