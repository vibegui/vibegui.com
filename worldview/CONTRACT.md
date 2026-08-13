# The interface this instance expects from the `worldview` library

Written from the consuming side, before the library exists, so there is
something concrete to build against. If the library lands with a different
shape, this file is the thing to argue with — and `src/index.ts` is the only
file here that has to change.

## The split

**The instance owns configuration and content. The library owns behaviour.**

| Instance (this folder) | Library (`~/Projects/worldview`) |
|---|---|
| `declared-future.md` — the prose | MCP protocol dispatch, tool definitions |
| `worldview.json` — its structure | browser login + the UI at `/` |
| `projects/*.md` — the portfolio | `worldviewErrors()` validation |
| `wrangler.jsonc` — bindings, vars, cron, domain | D1 schema + migrations |
| `src/index.ts` — ~20 lines wiring adapters | the MCP App UI |
| secrets | auth / capability boundary |
| synced `migrations/` (committed, see below) | corpus, RAG, analytics, bookmarks, GitHub evidence |

Nothing in this folder should ever contain logic. If a change here needs an
`if`, it probably belongs in the library.

## Proposed entry point

*Amended by `.context/worldview-contract-amendment.md` after the library agent's
reply. This block is current.*

```ts
import { createWorldview } from "worldview";
import declaredFuture from "../declared-future.md";
import declaration from "../worldview.json" with { type: "json" };

export default createWorldview({ declaration, declaredFuture, … });
```

`createWorldview(config)` returns a Cloudflare `ExportedHandler` — at minimum
`{ fetch, scheduled }`. The instance never implements a handler itself.

```ts
interface WorldviewConfig {
  /** Structure only: ids, positions, stages, metric targets, score definitions,
   *  conditions of satisfaction. Prose lives in markdown. */
  declaration: unknown;

  /** The declared future, as markdown. Separate because it is the thing edited
   *  most often, and it was unreadable as an escaped JSON string. */
  declaredFuture: string;

  /** One per project file, frontmatter + body. Each carries `serves:`, the
   *  input to the alignment score. */
  projects?: unknown[];

  /** Optional. Omit and the public writing tools do not exist. */
  publicWriting?: { siteOrigin: string; manifestPath: string };

  /** Optional. Has a public HTTP surface, so opt-in per instance. */
  bookmarks?: { publicRoutes: boolean };

  /** Optional. `/e` is not configurable — it is hardcoded in the consuming
   *  site's middleware and nothing will ever change it. */
  analytics?: { sites: string[] };
}
```

Three properties worth keeping:

- **Declaration and future are passed as values, not paths.** They stay in the
  instance's git, which is the entire thesis — changing my future is a commit
  here. The library must not fetch them or own a copy.
- **Optional modules are absent, not disabled.** `publicWriting: undefined`
  should mean those tools never appear in `tools/list`, not that they appear and
  error. `PRODUCT.md` already calls public writing an example module.
- **Validation happens at check time, not module scope.** The library exports
  `worldviewErrors(config): string[]`; the instance calls it from `bun run
  check`. A throw in `createWorldview()` would 500 every route including the
  public read-only tier, so a typo in my declaration would take down the one
  surface strangers touch. Loud in CI is free; loud at module scope costs
  availability.

## Three problems a naive extraction will hit

These are the places where "just make it a library" breaks. Each one is a real
decision, not a detail.

### 1. Migrations — schema lives in the library, but wrangler needs a local path

`migrations_dir` is resolved relative to `wrangler.jsonc`, so it cannot point
into the library. Two options:

- point it at `node_modules/worldview/migrations` — no sync step, but the
  schema you are about to apply never appears in this repo's diff, and it is
  fragile across package managers;
- **the library ships its migrations and the instance syncs them into a
  committed `migrations/`** (`bun run schema:sync`).

**Recommended: sync.** For a system whose thesis is that consequential change
should be reviewable, applying a schema migration you cannot see in your own
diff is the wrong default. The cost is one script and a commit.

The instance keeps `db:local` / `db:remote` because the D1 name is instance
configuration.

### 2. The MCP App HTML — currently a text import through a wrangler glob

Today the UI is built by vite to `dist-mcp/index.html` and imported as text via
a `rules` block. That does not survive the split: the glob is relative to the
instance, but the UI belongs to the library.

**Recommended: the library exports the built HTML as a string** (e.g.
`export const mcpAppHtml: string`, generated at library build time). Then:

- the instance has no vite config, no build step, and no `rules` block — which
  is why `wrangler.jsonc` here has neither;
- `bun run deploy` in the instance is genuinely just `wrangler deploy`.

The cost is ~600KB of string in the bundle. The Worker already uploads 735KB
and the limit is far above that, so this is affordable today — worth
re-checking if the UI grows a lot.

The alternative (instance re-runs the library's vite build) puts a build
pipeline back into a folder that is supposed to be config only.

### 3. Resource URIs are live identifiers

`ui://vibegui/personal-ai-os/v9`, `ui://vibegui/bookmarks/v1`,
`ui://vibegui/site-analytics/v1` are pinned by the existing Studio connection.
If the library generates these from an instance name, the default must still
produce **exactly** those strings for this instance, or the pinned views break.
Safest: let the instance override the URI prefix, defaulting to something
neutral, and set it here if the library's default differs.

## Live bindings — do not "clean up"

This instance deploys over a Worker holding real personal data.

| Thing | Value | Breaks if renamed |
|---|---|---|
| Worker name | `vibegui-personal-ai-os` | the deployment target and its domain |
| Custom domain | `mcp.vibegui.com` (set in the CF dashboard) | the site's analytics beacon — `functions/_middleware.ts:34` |
| D1 | `vibegui-personal-ai-os` / `503776b2-1c54-481d-85a4-a99e8028c72d` | orphans every project, goal, memory, decision |
| R2 | `vibegui-corpus` | the writing corpus |
| AI Search | `vibegui-writing` | `SEARCH_PUBLIC_WRITING` |
| Resource URIs | `ui://vibegui/*` | pinned Studio views |

The old name in several of these is cosmetically wrong and load-bearing anyway.
Renaming any of them is a migration with a data-movement plan, never a tidy-up.

## Setup, once the library exists

```bash
cd ~/Projects/worldview && bun link    # one-time, while the library is unpublished
cd -                    && bun run setup   # link + install + schema:sync
cp .dev.vars.example .dev.vars         # then fill in
bun run db:local
bun run dev
```

`http://localhost:8787/` is the browser UI (log in with `WORLDVIEW_PASSWORD`);
`/mcp` is the same tool registry over JSON-RPC.

Deploy:

```bash
bun run schema:sync && git diff migrations/   # review schema before applying
bun run db:remote
bun run deploy:dry                            # validates bindings, ships nothing
bun run deploy
```

Secrets are per-instance: `wrangler secret put WORLDVIEW_PASSWORD`,
`wrangler secret put GITHUB_TOKEN`.

## Definition of done for the library

The instance is correct when all of these hold:

1. `bun run check` passes — `tsc` plus `worldviewErrors()` returning empty.
   `src/index.ts` is a *target* to leave unchanged, not a frozen constraint:
   expect it to move once after the standalone review, then hold.
2. `bun run deploy:dry` resolves all four bindings.
3. `GET_DECLARATION` returns the three questions, exactly two scores, integrity
   as a count-to-zero with `word` / `systems` / `objects`, and all 11 strategic
   results with D1 progress joined in.
4. `resources/list` still returns the three `ui://vibegui/*` URIs.
5. `POST /e` still records an analytics event.
6. Unauthenticated `tools/list` exposes only public writing tools.
7. `bun run demo` in the library renders every view with no raw JSON — the real
   test of whether the boundary is complete.
