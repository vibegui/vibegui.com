---
description: Publish an article by committing and pushing to origin
argument-hint: "<slug>"
allowed-tools:
  - Read
  - Edit
  - Glob
  - Bash
---

<objective>
Publish an article by flipping its frontmatter to `status: published` and pushing the commit. Markdown is the source of truth — committing the file is the entire publish act. Cloudflare Pages will pick up the push and deploy.
</objective>

<context>
Arguments: $ARGUMENTS

@blog/config.json
</context>

<process>

1. **Resolve the slug.** If `$ARGUMENTS` is provided, use it as the slug. Otherwise scan `blog/articles/` for files with `status: draft` and ask the user which to publish.

2. **Read the article.** Read `blog/articles/{slug}.md`. Confirm the frontmatter parses and the body isn't empty.

3. **Update frontmatter.**
   - Set `status: published`.
   - If `date` is unset or in the future (relative to today), set it to today (`YYYY-MM-DD`).
   - Leave every other field untouched.

4. **Generate OG images.** Run `bun run og:generate`. Cloudflare Pages does not run this step — without committed OG assets the deploy fails with `Missing OG image for …`.

5. **Stage.** Run `git add blog/articles/{slug}.md` (or `.mdx`). Also stage:
   - `public/images/og/manifest.json`
   - matching `public/images/og/{en,pt}/{slug}.*.png` (and the PT translation slug if present)
   - `coverImage` under `public/images/articles/` if untracked or modified
   - any PT twin under `blog/articles/` that shares the same `translationKey`

6. **Commit.** Use the convention from recent history:
   ```
   feat(article): publish '{slug}'
   ```
   No body required for a simple publish.

7. **Push.** `git push origin HEAD`. This skill is the one authorized exception to the "never auto-push" rule in `AGENTS.md`.

8. **Report.**

```
Published: {title}
  Slug:    {slug}
  Date:    {date}
  Commit:  {short-sha}
  URL:     https://vibegui.com/article/{slug}

Pushed to origin. Cloudflare Pages will deploy shortly.
```

</process>

<success_criteria>
- `blog/articles/{slug}.md` (or `.mdx`) has `status: published` and a sensible `date`.
- `public/images/og/manifest.json` includes `{locale}:{slug}` and the PNG files are committed.
- A commit was created on the current branch with the expected message.
- The commit was pushed to `origin`.
- No Supabase calls. No sync. OG generation (`bun run og:generate`) is required; the rest of the site build stays on the deployment pipeline.
</success_criteria>
