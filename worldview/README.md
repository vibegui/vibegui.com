# worldview/ — Guilherme's instance

This folder is **configuration and content only.** No behaviour lives here.

```
worldview.json     the declared future — what should be. This is the content.
wrangler.jsonc     bindings: Worker name, D1, R2, AI Search, cron, vars
src/index.ts       ~20 lines wiring the library's optional adapters
migrations/        synced from the library, committed before being applied
CONTRACT.md        the interface expected from the `worldview` library
.dev.vars.example  local secrets template
```

Everything else — the MCP server, the tool definitions, the D1 schema, the MCP
App UI, auth, the corpus, analytics, bookmarks, GitHub evidence — comes from the
[`worldview`](https://github.com/decocms/worldview) library.

If a change in this folder needs an `if`, it belongs in the library.

## Why the declaration is here and not in the library

Because changing my future should be a commit in *my* repo, reviewable in a
diff. `src/index.ts` imports `worldview.json` as a value and hands it to the
library; the library validates it and never owns a copy.

## Setup

The library is not published yet, so link it rather than hardcoding a path (a
`file:` path would be relative to this conductor workspace and break when the
workspace moves):

```bash
cd ~/Projects/worldview && bun link
cd -                    && bun link worldview

bun install
cp .dev.vars.example .dev.vars     # then fill it in
bun run schema:sync                # library migrations -> ./migrations
bun run db:local
bun run dev
```

MCP endpoint: `http://localhost:8787/mcp` (wrangler picks the next free port if
that one is taken — check its output).

Private connection:

```text
URL:           http://localhost:8787/mcp
Authorization: Bearer <WORLDVIEW_PASSWORD>
```

Never commit `.dev.vars`.

## Deploy

```bash
bun run schema:sync && git diff migrations/   # review schema before applying it
bun run db:remote
bun run deploy:dry                            # validates bindings, ships nothing
bun run deploy
```

Or from the repo root: `bun run worldview:deploy`.

Secrets are per-instance and set interactively, never through shell history:

```bash
bunx wrangler secret put WORLDVIEW_PASSWORD
bunx wrangler secret put GITHUB_TOKEN
```

## This deploys over a live Worker

Every identifier in `wrangler.jsonc` is load-bearing. It ships over the Worker
serving `mcp.vibegui.com`, which holds real projects, goals, memory, and
decisions — and which the static site posts analytics to
(`../functions/_middleware.ts:34`).

Renaming the Worker, the D1 database, the R2 bucket, or the AI Search instance
is a migration with a data-movement plan, never a tidy-up. The old
`personal-ai-os` naming is cosmetically wrong and load-bearing anyway. See
`CONTRACT.md` for the full table.
