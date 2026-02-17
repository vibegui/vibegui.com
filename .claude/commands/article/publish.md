---
description: Publish an article to Supabase
argument-hint: "<slug>"
allowed-tools:
  - Read
  - Edit
  - Glob
  - Bash
  - mcp__supabase-agent__execute_sql
---

<objective>
Publish an article from the local markdown file to Supabase. Handles both new articles (INSERT) and updates (UPDATE). Sets status to published and verifies roundtrip consistency.
</objective>

<context>
Arguments: $ARGUMENTS

@blog/config.json
</context>

<process>

1. **Resolve the slug.** If `$ARGUMENTS` is provided, use it as the slug. Otherwise, scan `blog/articles/` for files with `status: draft`, and list them.

2. **Read and parse the article.** Read `blog/articles/{slug}.md` and extract:
   - Frontmatter: slug, title, description, date, status, coverImage, tags
   - Content: the markdown body

3. **Check if article exists in Supabase.** Use `mcp__supabase-agent__execute_sql` on project `juzhkuutiuqkyuwbcivk`:

```sql
SELECT id, slug, status FROM articles WHERE slug = '{slug}';
```

4. **Upsert the article.**

   **If new (no rows returned):** INSERT:
   ```sql
   INSERT INTO articles (slug, title, description, content, date, status, cover_image, created_by, updated_by)
   VALUES ('{slug}', '{title}', '{description}', '{content}', '{date}', 'published', '{coverImage}', 'claude-article-skill', 'claude-article-skill')
   RETURNING id;
   ```

   **If exists:** UPDATE:
   ```sql
   UPDATE articles
   SET title = '{title}',
       description = '{description}',
       content = '{content}',
       date = '{date}',
       status = 'published',
       cover_image = '{coverImage}',
       updated_by = 'claude-article-skill'
   WHERE slug = '{slug}'
   RETURNING id;
   ```

5. **Handle tags.** If the article has tags:

   a. Upsert each tag name into the `tags` table:
   ```sql
   INSERT INTO tags (name) VALUES ('{tag}') ON CONFLICT (name) DO NOTHING;
   ```

   b. Clear existing article_tags:
   ```sql
   DELETE FROM article_tags WHERE article_id = {article_id};
   ```

   c. Insert new junction rows:
   ```sql
   INSERT INTO article_tags (article_id, tag_id)
   SELECT {article_id}, id FROM tags WHERE name IN ('{tag1}', '{tag2}', ...);
   ```

6. **Update local file status.** Edit `blog/articles/{slug}.md` to change `status: draft` to `status: published`.

7. **Verify roundtrip.** Run `bun run sync --dry-run` to confirm the sync script sees no changes (the local file should match what the DB would produce).

8. **Report.**

Output:
```
Published: {title}
  - Slug: {slug}
  - Article ID: {id}
  - Tags: {tags}
  - Status: published
  - URL: /article/{slug}
  - Roundtrip: {pass/fail}
```

</process>

<success_criteria>
- Article exists in Supabase with status `published`
- Tags are properly linked via `article_tags` junction table
- Local file status is updated to `published`
- `bun run sync --dry-run` shows no diff for this article (roundtrip consistent)
- `updated_by` is set to `claude-article-skill`
</success_criteria>
