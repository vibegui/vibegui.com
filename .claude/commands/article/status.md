---
description: Show status of all articles and their progress
allowed-tools:
  - Read
  - Glob
  - mcp__supabase-agent__execute_sql
---

<objective>
Display a comprehensive status table of all articles — both local drafts and published articles — showing their progress through the authoring pipeline.
</objective>

<context>
Arguments: $ARGUMENTS
</context>

<process>

1. **Scan local articles.** Use `Glob` to find all `blog/articles/*.md` files (excluding README.md). Read each file's frontmatter to extract: slug, title, status, date, coverImage.

2. **Scan briefs.** Use `Glob` to find all directories in `content/briefs/`. For each slug directory, check for:
   - `BRIEF.md` (has brief?)
   - `RESEARCH.md` (has research?)
   - `OUTLINE.md` (has outline?)

3. **Check Supabase.** Query all articles in the database using `mcp__supabase-agent__execute_sql` on project `juzhkuutiuqkyuwbcivk`:

```sql
SELECT slug, status FROM articles ORDER BY date DESC;
```

4. **Build the status table.** Cross-reference all three sources and display:

```
| Slug                    | Status    | Brief | Research | Outline | Image | In DB |
|-------------------------|-----------|-------|----------|---------|-------|-------|
| my-new-article          | draft     | yes   | yes      | no      | no    | no    |
| hello-world-building... | published | no    | no       | no      | no    | yes   |
| ...                     | ...       | ...   | ...      | ...     | ...   | ...   |
```

- **Status**: from local file frontmatter (`draft` or `published`)
- **Brief**: `yes` if `content/briefs/{slug}/BRIEF.md` exists
- **Research**: `yes` if `content/briefs/{slug}/RESEARCH.md` exists
- **Outline**: `yes` if `content/briefs/{slug}/OUTLINE.md` exists
- **Image**: `yes` if `coverImage` is not null in frontmatter
- **In DB**: `yes` if slug exists in Supabase

5. **Show summary counts.**

```
Total: {N} articles
  - Published (in DB): {N}
  - Drafts (local only): {N}
  - In progress (have briefs): {N}
```

6. **Highlight actionable items.** List any articles that are in an incomplete state with their suggested next step:
   - Has brief but no research → `/article:research {slug}`
   - Has research but no outline → `/article:outline {slug}`
   - Has outline but draft is empty → `/article:draft {slug}`
   - Has content but no image → `/article:image {slug}`
   - Has content + image but not in DB → `/article:publish {slug}`

</process>

<success_criteria>
- All local articles are listed with accurate status
- Brief/Research/Outline presence is correctly detected
- Supabase status is cross-referenced
- Actionable next steps are shown for in-progress articles
</success_criteria>
