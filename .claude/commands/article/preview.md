---
description: Build and preview the site locally
argument-hint: "<slug>"
allowed-tools:
  - Read
  - Bash
  - Glob
---

<objective>
Serve the site locally so the user can preview an article in the browser. Drafts require the dev server; only a published build can be checked with the preview server.
</objective>

<context>
Arguments: $ARGUMENTS
</context>

<process>

1. **Check the article's status.** Read the frontmatter of `blog/articles/{slug}.md`.

2. **Draft (`status: draft`) — use the dev server.**

   `bun run preview` serves the production build, which filters drafts out. Use dev mode instead.

   - If nothing is listening on 4001 (`lsof -ti:4001`), start `bun run dev` in the background.
   - Report and open the URL:
     ```
     Dev server: http://localhost:4001
     Article preview: http://localhost:4001/article/{slug}
     ```
   - `open http://localhost:4001/article/{slug}` (English articles: `/en/article/{slug}`).
   - Leave the server running — markdown saves regenerate and reload the page automatically.

   If 4001 is held by another workspace, start with `PORT=4011 bun run dev` and use that port.

3. **Published (`status: published`) — verify the real build.**

   - `bun run build`
   - `bun run preview` in the background (serves `dist/` on **port 4002**)
   - Report and open:
     ```
     Site built and serving at: http://localhost:4002
     Article preview: http://localhost:4002/article/{slug}
     ```

4. **No slug given.** Default to the dev server and report `http://localhost:4001`.

</process>

<success_criteria>
- A server is running and the URL reported actually renders the requested article
- Drafts are previewed via dev mode, never via `bun run preview`
- Ports are correct: dev 4001, preview 4002
</success_criteria>
