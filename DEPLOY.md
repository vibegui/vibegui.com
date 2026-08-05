# Deployment Guide

This site deploys to **Cloudflare Pages** with zero npm dependencies at build time.

## How It Works

### The Zero-Deps Strategy

Cloudflare Pages runs `npm run pages:build` which executes:

```bash
node --experimental-strip-types scripts/build.ts --mode=pages
```

This works because:
1. **Node 22** is available on Cloudflare (with experimental TypeScript support)
2. **Vite assets are pre-committed** in `dist/` (built locally before push)
3. **Articles are Markdown or MDX files** in `blog/articles/` (committed to git)
4. **The content compiler is pre-bundled** as
   `scripts/generate.bundle.mjs`, including MDX support
5. **No npm install needed** (`SKIP_DEPENDENCY_INSTALL=true` in Cloudflare settings)

### Build Modes

| Mode | Command | What It Does |
|------|---------|--------------|
| `dev` | `bun run dev` | Generate content + Vite dev server |
| `prod` | `bun run build` | Generate + Vite build + Finalize |
| `pages` | `npm run pages:build` | Generate + Finalize (no Vite) |

### What Each Step Does

1. **Generate** (`scripts/generate.ts`)
   - Reads `blog/articles/*.md` (markdown with YAML frontmatter)
   - Writes `public/content/manifest.json` (article list)
   - Writes `.build/article/*/index.html` (SSG article pages)
   - Writes `.build/context/*/index.html` (SSG context pages)

2. **Vite Build** (prod mode only)
   - Bundles React app to `dist/`
   - Copies public assets

3. **Finalize** (`scripts/finalize.ts`)
   - Copies generated manifests and public assets to `dist/`
   - Processes SSG HTML (injects prod asset tags)
   - Embeds manifest into `index.html` (no fetch needed)

The bookmarks page fetches its read-only data at runtime from
`https://mcp.vibegui.com`; Cloudflare Pages does not need bookmark database
credentials.

## Cloudflare Pages Settings

```
Build command:     npm run pages:build
Build output:      dist
Root directory:    /
Node version:      22

Environment variables:
  SKIP_DEPENDENCY_INSTALL = true
  CI = true
```

## Troubleshooting

### Build fails with "vite: not found"
You're probably running `prod` mode on Cloudflare. Use `pages` mode instead.
The `pages:build` script should use `--mode=pages`.

### Articles not showing in production
Check that:
1. `blog/articles/*.md` files are committed
2. Articles have `status: published` in frontmatter (drafts are hidden when `CI=true`)
3. `generate.ts` ran successfully (check build logs for article count)
4. The article slug matches (trailing slashes are stripped)

### Context pages 404
Check that:
1. `context/*.md` files exist
2. Build logs show context count > 0

### Assets look broken
The `dist/` directory with Vite-built assets needs to exist. Run `bun run build` locally before pushing.

### Blank page on vibegui.com but `*.pages.dev` works
**Root cause:** Cloudflare Pages SPA-falls back unknown paths to `index.html` (200). If HTML references a new hashed `/assets/*.js` before that file is available — or during a failed deploy — browsers/CDN can cache `text/html` under the JS URL with `Cache-Control: immutable` (1 year). Custom-domain edge cache then serves HTML-as-JS forever; preview hosts don't share that cache.

**Guards already in place:**
1. `public/assets/404.html` — missing `/assets/*` → real 404
2. `public/_headers` — immutable only on `/assets/*.{js,css,woff2,map}` (not `/assets/*`)
3. `functions/_middleware.ts` — rejects HTML/wrong MIME under `/assets/*` with `404` + `no-store`
4. Hash rotation on the next successful Vite build (new filename busts browser cache)

**If it happens again (poisoned edge HIT still serving HTML for an old hash):**
1. Cloudflare Dashboard → vibegui.com zone → Caching → Configuration → **Purge Everything** (or purge the specific `https://vibegui.com/assets/<poisoned>.js` URLs)
2. Confirm: `curl -sSI https://vibegui.com/assets/definitely-missing.js` → `404` + `cache-control: no-store`
3. Hard-refresh the browser (or open a private window)

### Changes not appearing
Cloudflare caches aggressively. Check:
1. `index.html` has 30s max-age (should update quickly)
2. Asset URLs have hashes (immutable cache is fine)
3. Try a hard refresh or clear Cloudflare cache

## Local Testing

```bash
# Full production build + preview
bun run preview:build

# Just preview existing build
bun run preview
```

The preview server mimics Cloudflare's behavior with proper caching headers.

## Personal AI OS Worker

The public site and `mcp/` deploy independently. From `mcp/`:

```bash
bun install
bun run check
bun run test
bun run deploy:dry

# First deployment only
bunx wrangler d1 create vibegui-personal-ai-os
bunx wrangler d1 migrations apply vibegui-personal-ai-os --remote
bunx wrangler r2 bucket create vibegui-corpus
bun run corpus:upload:remote
bunx wrangler ai-search create vibegui-writing \
  --type r2 \
  --source vibegui-corpus \
  --prefix 'articles/' \
  --embedding-model '@cf/baai/bge-m3' \
  --hybrid-search \
  --chunk-size 512 \
  --chunk-overlap 20 \
  --max-num-results 10 \
  --score-threshold 0.35

# Set interactively; never put values in shell history
bunx wrangler secret put MCP_PRIVATE_TOKEN
bunx wrangler secret put GITHUB_TOKEN

bun run deploy
```

The current single-token MVP needs a classic GitHub PAT with `repo` scope because the mapped private repositories span multiple owners (`vibegui`, `decocms`, and `deco-cx`). The Worker only performs GET requests, but the token itself has broader permissions than ideal. Authorize organization SSO when required and replace this with GitHub App authentication later.

Connect `https://<worker-host>/mcp` to Studio:

- Public connection: no authorization header; published writing tools only.
- Private connection: `Authorization: Bearer <MCP_PRIVATE_TOKEN>`; Personal AI OS tools and UI.

The private token proves possession, not caller identity. Keep it only in the private Studio connection.
