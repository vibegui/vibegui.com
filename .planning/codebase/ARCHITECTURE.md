# Architecture

**Analysis Date:** 2026-02-16

## Pattern Overview

**Overall:** Hybrid SPA + SSG (Static Site Generation)

**Key Characteristics:**
- Client-side React SPA with custom routing (no Next.js/Router dependency)
- Static HTML pre-rendered at build time for article/context pages with embedded data
- Minimal JavaScript bundle - heavy pages (bookmarks, roadmap) lazy-loaded
- Server-less: All data either embedded in HTML or fetched from Supabase at runtime
- Dual database strategy: SQLite for local development, Supabase for production bookmarks

## Layers

**Presentation (React Components):**
- Purpose: UI rendering, user interaction, filtering/sorting logic
- Location: `src/components/`, `src/pages/`
- Contains: React functional components with hooks, modal dialogs, tables, forms
- Depends on: Data fetching layer (Supabase client), utilities, hooks
- Used by: App.tsx (main router)

**Pages/Routes:**
- Purpose: Page-level components implementing specific routes
- Location: `src/pages/`
  - `content.tsx` - Home page listing articles
  - `article.tsx` - Individual article display (SSG)
  - `bookmarks.tsx` - Read-only bookmark table with filters (heavy, lazy-loaded)
  - `bookmarks-edit.tsx` - Bookmark management UI (heavy, lazy-loaded)
  - `context.tsx` - LLM context browsing (SSG context pages)
  - `roadmap.tsx` - Project roadmap (lazy-loaded)
  - `commitment.tsx` - Commitment statement
- Contains: Page logic, state management for filters/modals, data loading
- Depends on: Supabase client, manifest utilities, components

**Data Layer:**
- Purpose: Database/API access and content loading
- Location: `lib/`
  - `supabase.ts` - Bookmark data fetching (light and full queries, search)
  - `articles.ts` - Markdown article parsing (server-side build-time)
  - `bookmarks/` - Browser bookmark import utilities
- Contains: Supabase queries, type definitions, article parsing
- Depends on: @supabase/supabase-js, file system (build-time only)
- Used by: Pages and components

**Utilities:**
- Purpose: Shared logic and helpers
- Location: `src/hooks/`, `src/lib/manifest.ts`
  - `use-canonical.ts` - Dynamic canonical URL updates
  - `manifest.ts` - Content manifest loading (embedded or via fetch)
- Contains: Custom hooks, manifest loading/caching
- Depends on: None (pure utilities)

**Styling:**
- Purpose: Global styles and theme system
- Location: `src/styles/main.css`
- Contains: CSS variables, theme tokens, Tailwind imports
- Depends on: Tailwind CSS 4, @tailwindcss/vite

**Build/Generation:**
- Purpose: Content generation and bundling at build time
- Location: `scripts/`
  - `build.ts` - Main build orchestrator (dev/prod/pages modes)
  - `generate.ts` - Article SSG and manifest generation
  - `finalize.ts` - Post-build hashing for cache busting
- Contains: Pre-rendering logic, file generation
- Depends on: articles.ts, vite.config.ts, Vite

## Data Flow

**Article Page Load (SSG):**

1. User navigates to `/article/slug`
2. Browser requests pre-rendered HTML from `dist/article/{slug}/index.html`
3. HTML contains embedded `<script id="article-data">` with JSON article content
4. React hydrates, `Article` component reads embedded data from DOM
5. No fetch needed - zero latency content display
6. Markdown rendered client-side using `marked` library

**Bookmark List Load (Client-Fetched):**

1. User navigates to `/bookmarks`
2. Page component lazy-loads, triggers `getAllBookmarksLight()` on mount
3. Supabase queries: bookmarks table (light fields) + bookmark_tags table
4. Data combined client-side (tags mapped to bookmarks by ID)
5. Filters/sorting applied client-side in React state
6. Full-text search (3+ chars) triggers `searchBookmarks()` - server-side query
7. Modal opens on row click, loads full bookmark content via `getBookmarkContent()`

**Home Page Load (Hybrid):**

1. User navigates to `/` (Content page)
2. `loadManifest()` checks for embedded HTML data first (SSG)
3. If present: parse and use immediately (no fetch)
4. If absent (dev mode): fetch `/content/manifest.json` from public directory
5. Manifest used to render article cards
6. Card links use full `<a href>` (not SPA Link) to force page reload, ensuring article SSG page is served

**Context Pages (SSG):**

1. User navigates to `/context/path`
2. Pre-rendered context HTML at `dist/context/{path}/index.html` with embedded content
3. Same pattern as articles - embedded data, no fetch

**Theme Toggle:**

1. Theme change stored in `localStorage`
2. Theme script runs in `<head>` before React mounts to prevent flash
3. Applied to `<html data-theme="...">` attribute
4. CSS variables use `var(--color-bg)`, `var(--color-fg)`, etc. that change with theme

**State Management:** No Redux/Context API. Local React component state via `useState`. Manifest and bookmarks cached in module-level variables to prevent redundant fetches.

## Key Abstractions

**Route Type Union:**
- Purpose: Type-safe routing without router library
- Location: `src/app.tsx`
- Pattern: Discriminated union types
- Example: `type Route = { type: "content" } | { type: "article"; slug: string } | ...`

**Bookmark Type Hierarchy:**
- Purpose: Progressive data loading (light vs. full content)
- Location: `lib/supabase.ts`
  - `BookmarkLight`: ID, URL, title, description, icon, stars, classification dates, tags
  - `Bookmark`: extends BookmarkLight + full content fields (research, insights, page content)
- Pattern: Separate types for different query needs, combined at call site

**Browser Reader Interface:**
- Purpose: Abstraction over browser bookmark formats (Chrome, Firefox, Safari)
- Location: `lib/bookmarks/types.ts` and implementations
- Pattern: Strategy pattern with `BrowserReader` interface
- Implementations: Chrome JSON, Firefox JSON, Safari plist readers

**ContentManifest:**
- Purpose: Type-safe article/project list structure
- Location: `lib/manifest.ts`
- Pattern: Single source of truth for content structure (articles array with status field)
- Caching: Module-level `cachedContentManifest` prevents refetch

## Entry Points

**Browser Entry Point:**
- Location: `src/main.tsx`
- Triggers: Browser loads index.html
- Responsibilities: Mount React app to #root, initialize StrictMode

**Root Component:**
- Location: `src/app.tsx`
- Triggers: React hydration after main.tsx mounts
- Responsibilities: Initialize routing, render Header + route-based page, manage navigation

**Header Component:**
- Location: `src/components/header.tsx`
- Triggers: App component render
- Responsibilities: Navigation links, theme toggle, mobile menu

**Build Entry Point:**
- Location: `scripts/build.ts`
- Triggers: `bun run build` or `bun run dev`
- Responsibilities: Orchestrate generate.ts → vite build/dev → finalize.ts

**Generate Script Entry:**
- Location: `scripts/generate.ts`
- Triggers: From build.ts
- Responsibilities: Read markdown articles, generate manifest.json, pre-render article/context HTML

## Error Handling

**Strategy:** Fallback to 404 page or error state, console logging for debugging

**Patterns:**

**Data Loading Errors:**
- Pages set error state: `const [error, setError] = useState<string | null>(null)`
- Catch blocks store error message, display in UI
- Example: `src/pages/bookmarks.tsx` shows "Error: {error}" in error state

**Article Not Found:**
- Embedded data mismatch: Article component checks slug matches
- Falls back to "Article not found" message with refresh link
- Link forces full page reload to ensure SSG page is served

**Manifest Loading:**
- `loadManifest()` tries embedded data → fetch → null
- Returns null if both fail, pages handle gracefully (show "Loading..." or empty state)

**Supabase Errors:**
- Row not found (PGRST116 error code): Return null, component handles missing data
- Other errors: Throw and catch in component, display generic error message

**SEO/Canonical Errors:**
- `updateCanonical()` safely updates or creates canonical link tag
- Handles missing document gracefully (runs in browser context check)

## Cross-Cutting Concerns

**Logging:** Console logging for development (no logging library). Examples:
- `lib/supabase.ts`: Warns if VITE_SUPABASE_ANON_KEY not set
- `lib/manifest.ts`: Logs errors when manifest fails to load

**Validation:** Zod used in build pipeline (tsconfig includes), runtime type-checking for manifest

**Authentication:** Supabase anon key for public read-only access (RLS enforced server-side). Development uses service key (in vite.config.ts for build-time queries only)

**Environment Variables:**
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Public read-only key
- `MESH_GATEWAY_URL` - MCP gateway for build-time SQL execution
- `MESH_API_KEY` - Authorization for MCP calls
- All VITE_ prefixed vars embedded in client bundle
- Non-VITE vars server-only (build scripts)

**Performance Optimization:**
- Lazy loading: Heavy pages (bookmarks, roadmap) loaded with React.lazy + Suspense
- Code splitting: Each lazy component in separate chunk
- SSG: Article/context pages pre-rendered, zero runtime rendering
- Manifest caching: Prevent refetch via module-level variable
- Debounced search: 300ms debounce on bookmark search input
- Minimal bundle: No routing library, custom route parser keeps bundle small

---

*Architecture analysis: 2026-02-16*
