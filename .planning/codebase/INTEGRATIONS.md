# External Integrations

**Analysis Date:** 2026-02-16

## APIs & External Services

**Model Context Protocol (MCP) Mesh:**
- Deco CMS Mesh gateway - Primary integration point for AI tooling and automation
  - Gateway URL: Environment variable `MESH_GATEWAY_URL`
  - Authentication: Bearer token via `MESH_API_KEY`
  - Protocol: JSON-RPC 2.0 over HTTP
  - Location: `vite.config.ts` lines 16-41 (callMcpTool function)
  - Usage:
    - Tool execution (execute_sql for Supabase)
    - Content processing with AI models
    - LinkedIn post processing in `scripts/process-linkedin-posts.ts`

**Supabase MCP Tools:**
- SQL execution tool (execute_sql)
  - Used for all bookmark database queries in development
  - Implements request queue with rate-limiting (100ms minimum delay)
  - Location: `vite.config.ts` lines 93-139 (executeSupabaseSql functions)

## Data Storage

**Databases:**
- Supabase PostgreSQL (Cloud)
  - Type: Managed PostgreSQL with Auth + RLS policies
  - Connection: `SUPABASE_URL` environment variable
  - Client: `@supabase/supabase-js` for frontend queries
  - Direct access: `postgres` driver for scripts
  - Database URL: `SUPABASE_DB_URL` (postgresql://)
  - Tables:
    - `bookmarks` - URL, title, description, classified metadata, enrichment data
    - `bookmark_tags` - Junction table for tag relationships
  - Fields include:
    - Research content: `perplexity_research`, `firecrawl_content`
    - Insights: `insight_dev`, `insight_founder`, `insight_investor`
    - Classification: `classified_at`, `published_at`, `researched_at`
  - Connection pooling via Supabase's pg-boss (controlled by MCP Mesh)

**File Storage:**
- Local filesystem
  - Articles: `blog/articles/*.md` (markdown with YAML frontmatter)
  - Context pages: `context/` directory structure
  - Generated static: `.build/article/` and `.build/context/` (not committed)
  - Public assets: `public/` (bookmarks JSON, images, manifest)
  - Build output: `dist/` (Vite build artifacts)

**Caching:**
- Client-side: Browser localStorage
  - Theme preference stored in localStorage
  - Used in `scripts/generate.ts` for theme initialization
- HTTP caching:
  - Vite build with content-hash naming for cache busting
  - Manifest files for asset verification
  - Development: Vite dev server hot module replacement

## Authentication & Identity

**Auth Provider:**
- Custom implementation (RLS-based)
  - Frontend uses anonymous key (`VITE_SUPABASE_ANON_KEY`) for read-only access
  - Row-Level Security (RLS) policies control data visibility
  - Service role key (`SUPABASE_SERVICE_KEY`) for privileged operations only
  - Vite config exposes booking API endpoints with request validation
  - Location: `vite.config.ts` lines 604-658 (bookmarks create/update endpoints)

**Edit Access:**
- Protected endpoints for bookmark management:
  - POST `/api/bookmarks/create` - Requires Mesh proxy for MCP access
  - POST `/api/bookmarks/update` - Updates via Supabase MCP
  - POST `/api/bookmarks/batch-update` - Batch operations in transaction
  - POST `/api/bookmarks/delete` - Cascade delete bookmarks + tags
  - All modify operations use escaped SQL and SQL injection prevention

## Monitoring & Observability

**Error Tracking:**
- Console logging (no external service)
  - Error logs in vite.config.ts plugins
  - Debug logs in API endpoints (prefixed with [API], [Mesh Proxy], [Supabase MCP])
  - Located at: `vite.config.ts` lines 229-350, 682-710

**Logs:**
- Standard output to console
  - Development: Vite dev server logs + plugin logs
  - Production: Build output and preview server logs
  - Request logging in bookmarks API (POST endpoints)
  - Content generation status in `scripts/generate.ts`

## CI/CD & Deployment

**Hosting:**
- Static site with API backend
  - SPA frontend: React app served from `dist/` via Vite build
  - SSG articles: Pre-rendered HTML in `.build/` (served via preview server)
  - API endpoints: Express-style middleware in Vite dev/preview servers
  - Target: Cloudflare Pages or similar (configured in DEPLOY.md)

**CI Pipeline:**
- Pre-commit hooks via lefthook
  - Format check: `biome format`
  - Lint: `oxlint`
  - Type check: `tsc --noEmit`
  - Build: `bun scripts/build.ts`
  - Constraint tests: `bun test tests/constraints/`
  - E2E tests: `playwright test`
- Environment: GitHub Actions (CI flag via `process.env.CI`)

**Build Process:**
1. `bun run generate.ts` - Generate manifest.json, SSG article HTML
2. `bun run build.ts --mode=prod` - Vite build + post-processing
3. Optional: Image optimization `bun run optimize:images`
4. Optional: Backup `bun run backup` (via pg_dump)

## Environment Configuration

**Required env vars:**
- `VITE_SUPABASE_URL` - Supabase project URL (public, safe to expose)
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key (public, scoped by RLS)
- `SUPABASE_SERVICE_KEY` - Service role key (secret, for privileged operations)
- `SUPABASE_DB_URL` - PostgreSQL connection string (secret, for backups)
- `MESH_GATEWAY_URL` - MCP Mesh gateway endpoint
- `MESH_API_KEY` - Bearer token for Mesh API (secret)

**Secrets location:**
- `.env` file in project root (not committed)
- GitHub Actions secrets (for CI/CD)
- Deployment platform env variables (Cloudflare, Vercel, etc.)

## Webhooks & Callbacks

**Incoming:**
- POST `/api/bookmarks/create` - Create new bookmark with tags
- POST `/api/bookmarks/update` - Update single bookmark and tags
- POST `/api/bookmarks/batch-update` - Batch update multiple bookmarks in transaction
- POST `/api/bookmarks/delete` - Delete bookmark and associated tags
- POST `/api/bookmarks/check` - Check if URL exists
- GET `/api/bookmarks` - Fetch all bookmarks with tags
- GET `/api/bookmarks/stats` - Fetch aggregated stats
- POST `/api/mesh/call` - Mesh gateway proxy (forwards tool calls with auth)

**Outgoing:**
- None detected (read-only integration with external services)
- Internal: Article file watching triggers `bun run generate.ts` (Vite watcher)

## Content Processing Pipeline

**LinkedIn Posts:**
- Script: `scripts/process-linkedin-posts.ts`
- Input: JSON file with LinkedIn post data
- Process: AI evaluation via Mesh/OpenRouter
- Output: Article markdown files to `blog/articles/`
- Environment: Requires `MESH_GATEWAY_URL` and `MESH_API_KEY`

**Article Generation:**
- Script: `scripts/generate.ts`
- Input: Markdown files from `blog/articles/` (YAML frontmatter + content)
- Process:
  - Parse frontmatter with gray-matter
  - Convert markdown to HTML with marked
  - Generate manifest.json (article list)
  - Create SSG HTML pages in `.build/article/{slug}/`
- Output: Embedded JSON data in `<script id="article-data">` tags

**Article Serving:**
- Development: Vite plugin `ssgDevPlugin()` injects `.build/` HTML into SPA
  - Intercepts `/article/*` and `/context/*` requests
  - Reads pre-rendered HTML, extracts embedded data
  - Transforms through Vite (adds HMR)
- Production: Preview server `scripts/preview-server.ts` serves files directly

## Database Operations

**Read Operations:**
- Frontend queries via Supabase client (`lib/supabase.ts`)
  - `getAllBookmarksLight()` - Fetch all bookmarks with minimal fields
  - `getBookmarkContent()` - Fetch full content for modal view
  - `searchBookmarks()` - Full-text search with match location info
  - `getBookmarkByUrl()` - Fetch single bookmark with tags
  - `getBookmarkStats()` - Aggregate bookmark statistics

**Write Operations:**
- Via Vite API endpoints (development/preview only)
  - Request queue serialization to avoid rate limiting
  - SQL escaping with dollar-quoting for safety
  - Transactions for batch operations
  - Cascade deletes for bookmark + tags

**Backup/Restore:**
- Script: `scripts/backup-supabase.ts` - pg_dump based backup
  - Requires `SUPABASE_DB_URL` with URL-encoded password
  - Creates timestamped SQL dump in `~/Backups/supabase-vibegui.com/`
  - Uses system pg_dump (checks multiple paths)
- Script: `scripts/restore-supabase.ts` - pg_restore based restore
  - Restores from SQL dump files

---

*Integration audit: 2026-02-16*
