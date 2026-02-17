---
description: Build and preview the site locally
argument-hint: "<slug>"
allowed-tools:
  - Read
  - Bash
  - Glob
---

<objective>
Build the site and serve it locally so the user can preview an article in the browser.
</objective>

<context>
Arguments: $ARGUMENTS
</context>

<process>

1. **Build the site.** Run `bun run build` to regenerate all pages including the article.

2. **Start preview server.** Run `bun run preview` in the background.

3. **Report the preview URL.**

   If a slug was provided via `$ARGUMENTS`:
   ```
   Site built and serving at: http://localhost:4173
   Article preview: http://localhost:4173/article/{slug}
   ```

   If no slug:
   ```
   Site built and serving at: http://localhost:4173
   ```

4. **Optionally open the browser.** Run `open http://localhost:4173/article/{slug}` to open the article directly.

</process>

<success_criteria>
- `bun run build` completes without errors
- Preview server is running in the background
- User is given the local URL to preview the article
</success_criteria>
