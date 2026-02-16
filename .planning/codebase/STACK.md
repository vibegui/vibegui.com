# Technology Stack

**Analysis Date:** 2026-02-16

## Languages

**Primary:**
- TypeScript 5.7.2 - Full codebase including frontend, build scripts, and server logic
- TSX (React + TypeScript) - React component files

**Secondary:**
- JavaScript (Node.js runtime) - Vite, build tooling, scripts
- Markdown - Content files in `blog/articles/*.md` with YAML frontmatter

## Runtime

**Environment:**
- Bun 1.3.5+ (primary runtime for scripts and development)
- Node.js 22.0.0+ (for compatibility with certain CLI tools)

**Package Manager:**
- Bun - Primary package manager and script runner
- Lockfile: `bun.lock` present

## Frameworks

**Core:**
- React 19.1.0 - UI framework for component-based application
- Vite 6.0.6 - Build tool and development server
- Tailwind CSS 4.1.3 - Utility-first CSS framework
- @tailwindcss/vite 4.1.3 - Tailwind integration with Vite

**Content Processing:**
- marked 15.0.7 - Markdown to HTML parsing
- gray-matter 4.0.3 - YAML frontmatter extraction from markdown

**Testing:**
- @playwright/test 1.49.1 - End-to-end testing framework
- Bun's built-in test runner (used in `bun test`)

**Build/Dev:**
- @vitejs/plugin-react 4.4.1 - React Fast Refresh plugin
- vite-plugin-imagemin 0.6.1 - Image optimization plugin
- sharp 0.34.5 - Image processing library
- tsx 4.21.0 - TypeScript execution for Node scripts

## Key Dependencies

**Critical:**
- @supabase/supabase-js 2.89.0 - Supabase PostgreSQL client for bookmarks database
- postgres 3.4.7 - PostgreSQL driver for direct database operations

**Infrastructure:**
- zod 3.25.76 - Runtime schema validation and type inference
- zod-to-json-schema 3.25.1 - Convert Zod schemas to JSON Schema

**Build & Bundling:**
- rollup (via Vite) - Module bundler configuration
- esbuild (via Vite) - Fast JavaScript bundler

**Code Quality:**
- @biomejs/biome 1.9.4 - Unified linter and formatter
- oxlint 0.16.1 - Fast Rust-based linter

**Git Hooks:**
- lefthook 1.10.10 - Git hook manager

## Optional Dependencies

**Model Context Protocol (MCP):**
- @modelcontextprotocol/sdk 1.25.1 - SDK for Model Context Protocol servers
- @decocms/runtime 1.0.0-alpha.39 - Deco CMS runtime for content processing
- @decocms/bindings 1.0.1-alpha.23 - Deco CMS bindings

**Apple Configuration:**
- plist 3.1.0 - Apple plist file parser
- @types/plist 3.0.5 - TypeScript types for plist

## Configuration

**Environment:**
- Vite-based `.env` file loading at build time
- Environment variables exposed via `import.meta.env.VITE_*` pattern for frontend
- Backend scripts use direct `process.env.*` access
- Variables required:
  - `VITE_SUPABASE_URL` - Supabase project URL
  - `VITE_SUPABASE_ANON_KEY` - Supabase anonymous/public key
  - `SUPABASE_SERVICE_KEY` - Service role key for privileged operations
  - `SUPABASE_DB_URL` - PostgreSQL connection string for backups/restores
  - `MESH_GATEWAY_URL` - MCP Mesh gateway for tool execution
  - `MESH_API_KEY` - Bearer token for Mesh API authentication

**Build:**
- `vite.config.ts` - Main Vite configuration with custom plugins for:
  - SSG article generation and serving
  - Bookmarks API endpoints via Supabase MCP
  - Article file watcher for dev mode reloads
- `tsconfig.json` - TypeScript compiler options with path aliases (`~/*` → `./src/*`)
- `biome.json` - Code formatting and linting rules (2-space indentation, double quotes)
- `playwright.config.ts` - E2E test configuration with production build testing

**Type Checking:**
- `tsconfig.check.json` - Strict type checking configuration (referenced by `bun run check`)

## Platform Requirements

**Development:**
- Bun 1.3.5 or higher
- Node.js 22.0.0+ (for cross-platform compatibility)
- Git with lefthook support
- Chrome browser (for Playwright E2E tests)
- PostgreSQL tools (pg_dump for backups via `libpq`)

**Production:**
- Static hosting compatible with SPA + SSG pages (Cloudflare Pages, Vercel, etc.)
- PostgreSQL 12+ database (Supabase)
- Vite-generated assets with content-hash based naming for cache busting
- Preview server handles SSG article serving and bookmarks API endpoints

---

*Stack analysis: 2026-02-16*
