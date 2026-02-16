# Codebase Structure

**Analysis Date:** 2026-02-16

## Directory Layout

```
vibegui.com/
├── .build/                    # Generated SSG HTML (build artifacts, not committed)
│   ├── article/               # Article pages (pre-rendered)
│   └── context/               # Context pages (pre-rendered)
├── .planning/                 # GSD planning documents
├── blog/                      # Article source files
│   └── articles/              # Markdown articles with YAML frontmatter
├── context/                   # Context source files (LLM summaries)
│   ├── leadership/            # Leadership ontology summaries
│   ├── GUILHERME_TONE_OF_VOICE.md
│   ├── LINKEDIN_PROFILE.md
│   ├── VISUAL_STYLE.md
│   └── integrity_positive_model_summary.md
├── data/                      # Data files (not used currently)
├── dist/                      # Final production build output
│   ├── article/               # Built article pages
│   ├── context/               # Built context pages
│   ├── images/                # Optimized images
│   └── index.html             # Home page
├── lib/                       # Build-time and shared libraries
│   ├── articles.ts            # Markdown parsing (server-side)
│   ├── supabase.ts            # Supabase client (client-side)
│   └── bookmarks/             # Browser bookmark import utilities
│       ├── types.ts           # Type definitions
│       ├── chrome.ts          # Chrome bookmark reader
│       ├── firefox.ts         # Firefox bookmark reader
│       ├── safari.ts          # Safari bookmark reader
│       └── index.ts           # Main export
├── public/                    # Static files served as-is
│   ├── content/               # Generated manifest.json
│   ├── images/                # Original images
│   └── other static files
├── scripts/                   # Build and utility scripts
│   ├── build.ts               # Main build orchestrator
│   ├── generate.ts            # Article/context SSG generation
│   ├── finalize.ts            # Post-build processing (cache busting)
│   ├── preview-server.ts      # Local preview server
│   ├── backup-supabase.ts     # Database backup
│   ├── restore-supabase.ts    # Database restore
│   ├── optimize-images.ts     # Image optimization
│   ├── tunnel.ts              # Tunneling utility
│   └── other utilities
├── src/                       # Client-side React application
│   ├── app.tsx                # Root component and routing
│   ├── main.tsx               # Entry point (hydration)
│   ├── components/            # Reusable UI components
│   │   ├── article-card.tsx   # Article preview card
│   │   ├── bookmark-modal.tsx # Modal for bookmark details
│   │   ├── header.tsx         # Site header with nav
│   │   ├── page-header.tsx    # Page title headers
│   │   └── theme-toggle.tsx   # Dark/light mode toggle
│   ├── hooks/                 # Custom React hooks
│   │   └── use-canonical.ts   # Dynamic canonical URL
│   ├── lib/                   # Client-side utilities
│   │   └── manifest.ts        # Content manifest loading
│   ├── pages/                 # Page components (one per route)
│   │   ├── article.tsx        # Article display page
│   │   ├── bookmarks.tsx      # Bookmark table (lazy-loaded)
│   │   ├── bookmarks-edit.tsx # Bookmark editor (lazy-loaded)
│   │   ├── content.tsx        # Home page (article list)
│   │   ├── context.tsx        # Context browser
│   │   ├── roadmap.tsx        # Project roadmap (lazy-loaded)
│   │   └── commitment.tsx     # Commitment statement
│   └── styles/                # Global styles
│       └── main.css           # CSS variables, Tailwind imports
├── temp/                      # Temporary files (not committed)
├── tests/                     # Test files
│   └── constraints/           # Constraint validation tests
├── types/                     # Global TypeScript type definitions
├── workflows/                 # GitHub/automation workflows (if any)
├── index.html                 # Dev/SPA entry point template
├── package.json               # Project metadata and scripts
├── tsconfig.json              # TypeScript configuration
├── vite.config.ts             # Vite build configuration (with Supabase MCP support)
├── tailwind.config.js         # Tailwind CSS configuration (if present)
├── biome.json                 # Biome formatter/linter config
├── lefthook.yml               # Git hooks configuration
└── playwright.config.ts       # E2E test configuration
```

## Directory Purposes

**`.build/`**
- Purpose: Generated static HTML during build (SSG output before Vite bundling)
- Contains: Article and context pages with embedded JSON data
- Generated: Yes (by `scripts/generate.ts`)
- Committed: No (build artifact)
- Cleaned: Yes (removed each build)

**`blog/articles/`**
- Purpose: Source markdown articles
- Contains: `.md` files with YAML frontmatter (slug, title, date, status, tags, coverImage, content)
- Key files: All `.md` files in this directory
- Committed: Yes

**`context/`**
- Purpose: LLM-generated context summaries used for AI-assisted writing
- Contains: Markdown files organized by source (leadership, integrity, etc.)
- Key files:
  - `leadership/` - 11-part leadership ontology summaries
  - `GUILHERME_TONE_OF_VOICE.md` - Author's communication style
  - `LINKEDIN_PROFILE.md` - LinkedIn profile summary
  - `VISUAL_STYLE.md` - Design/brand visual guidelines
- Committed: Yes

**`dist/`**
- Purpose: Final production-ready output (served on vibegui.com)
- Contains: Bundled JavaScript, built HTML pages, optimized images
- Generated: Yes (by `vite build` after generate.ts)
- Committed: No (build artifact)

**`lib/`**
- Purpose: Shared libraries and utilities used by both build scripts and runtime
- **`articles.ts`** - Markdown parser with YAML frontmatter support (build-time only)
- **`supabase.ts`** - Supabase client and query functions (client-side runtime)
- **`bookmarks/`** - Browser bookmark import logic for bookmarks-edit page
- Committed: Yes

**`lib/bookmarks/`**
- Purpose: Browser bookmark format support (abstraction over Chrome/Firefox/Safari)
- **`types.ts`** - Type definitions and interfaces (BrowserReader, RawBookmark, etc.)
- **`chrome.ts`** - Chrome JSON bookmark file reader
- **`firefox.ts`** - Firefox JSON bookmark file reader
- **`safari.ts`** - Safari plist bookmark file reader
- **`index.ts`** - Unified import/export interface
- Committed: Yes

**`scripts/`**
- Purpose: Build, deployment, and utility scripts
- **`build.ts`** - Orchestrates dev/prod/pages builds (entry point for `npm run build`)
- **`generate.ts`** - Generates manifest.json and SSG HTML pages
- **`finalize.ts`** - Post-build hashing and cache busting
- **`preview-server.ts`** - Local HTTP server for testing production builds
- **`backup-supabase.ts` / `restore-supabase.ts`** - Database snapshot utilities
- **`optimize-images.ts`** - Image compression and format conversion
- **`tunnel.ts`** - Tunneling utility for exposing local dev server
- Committed: Yes (except generated output)

**`src/`**
- Purpose: Client-side React application source code
- Language: TypeScript (.tsx)
- Committed: Yes

**`src/components/`**
- Purpose: Reusable UI components
- **`article-card.tsx`** - Article preview (image, date, title, excerpt)
- **`bookmark-modal.tsx`** - Modal dialog for bookmark details (tabs for dev/founder/investor insights, research, content)
- **`header.tsx`** - Site header (logo, navigation, theme toggle, mobile menu)
- **`page-header.tsx`** - Page title component
- **`theme-toggle.tsx`** - Dark/light mode button
- Naming: kebab-case filenames, PascalCase component names
- Committed: Yes

**`src/pages/`**
- Purpose: Page-level components (one component per route)
- **`content.tsx`** - Home page showing article list (with draft toggle)
- **`article.tsx`** - Article display (SSG, reads embedded data)
- **`bookmarks.tsx`** - Public bookmark table with filters/search (lazy-loaded)
- **`bookmarks-edit.tsx`** - Bookmark management UI (lazy-loaded)
- **`context.tsx`** - LLM context browser (hardcoded collections)
- **`roadmap.tsx`** - Project roadmap (lazy-loaded)
- **`commitment.tsx`** - Commitment statement page
- Naming: kebab-case filenames, PascalCase component names
- Lazy-loaded: bookmarks.tsx, bookmarks-edit.tsx, roadmap.tsx
- Committed: Yes

**`src/hooks/`**
- Purpose: Custom React hooks
- **`use-canonical.ts`** - Updates canonical URL tag for page navigation
- Naming: kebab-case filenames, camelCase hook names (useCanonical)
- Committed: Yes

**`src/lib/`**
- Purpose: Client-side utilities (not to be confused with project-root `lib/`)
- **`manifest.ts`** - Loads and caches content manifest (embedded or fetched)
- Naming: camelCase filenames
- Committed: Yes

**`src/styles/`**
- Purpose: Global CSS and theme system
- **`main.css`** - Tailwind directives, CSS variables, theme definitions
- Structure: CSS custom properties for colors (--color-bg, --color-fg, --color-accent, etc.)
- Committed: Yes

**`types/`**
- Purpose: Global TypeScript type definitions (if separate from lib/)
- Committed: Yes

**`tests/`**
- Purpose: Test files
- **`constraints/`** - Tests for CONSTRAINTS.md rules
- Committed: Yes

**`public/`**
- Purpose: Static files served as-is by web server
- **`content/manifest.json`** - Generated article list (created by generate.ts)
- **`images/`** - Original, non-optimized images
- Sub-paths: `images/articles/`, `images/og/` for cover images and OG cards
- Committed: Images yes, manifest.json no

## Key File Locations

**Entry Points:**
- `src/main.tsx`: React hydration (mounts App to #root, sets up StrictMode)
- `src/app.tsx`: Root component, route parsing, navigation setup
- `index.html`: Development SPA template (also serves as fallback)

**Configuration:**
- `package.json`: Scripts, dependencies, project metadata
- `tsconfig.json`: TypeScript compiler options, path aliases (`~/*` → `src/*`)
- `vite.config.ts`: Vite bundler config, MCP integration for build-time SQL
- `biome.json`: Formatter/linter config
- `tailwind.config.js`: Tailwind theming (if present)
- `playwright.config.ts`: E2E test runner config

**Core Logic:**
- `src/app.tsx`: Routing, route type definitions, Link component, navigate function
- `lib/articles.ts`: Markdown parsing, frontmatter extraction
- `lib/supabase.ts`: All Supabase queries (getAllBookmarksLight, searchBookmarks, getBookmarkContent, etc.)
- `src/pages/bookmarks.tsx`: Filter/sort state machine, keyboard navigation logic
- `scripts/generate.ts`: SSG HTML generation, manifest building

**Testing:**
- `tests/constraints/`: Constraint validation (runs via `npm run test:constraints`)
- `playwright.config.ts`: E2E test setup
- E2E tests: Location TBD (check `tests/` or integration folders)

## Naming Conventions

**Files:**
- React components: kebab-case (e.g., `article-card.tsx`, `bookmark-modal.tsx`)
- Utilities/services: camelCase (e.g., `manifest.ts`, `supabase.ts`)
- Scripts: kebab-case (e.g., `build.ts`, `generate.ts`)
- Markdown articles: kebab-case (e.g., `my-article-slug.md`)

**Components:**
- Function components: PascalCase (e.g., `export function ArticleCard()`)
- Hooks: camelCase with `use` prefix (e.g., `export function useRoute()`)

**Variables/Functions:**
- Constants: UPPER_SNAKE_CASE (e.g., `NAV_LINKS`, `PLATFORM_PATTERNS`)
- Functions: camelCase (e.g., `parseRoute()`, `getAllBookmarksLight()`)
- React state: camelCase (e.g., `const [bookmarks, setBookmarks]`)

**Types/Interfaces:**
- PascalCase (e.g., `interface BookmarkLight`, `type Route`)
- Prefix types with domain: `BookmarkLight`, `ArticleMeta`, `BrowserReader`

**CSS/Classes:**
- Tailwind classes: kebab-case (e.g., `container`, `flex`, `gap-2`, `text-lg`)
- CSS variables: kebab-case with double-dash (e.g., `--color-bg`, `--color-fg-muted`)

## Where to Add New Code

**New Feature/Page:**
1. Create page component in `src/pages/new-page.tsx`
2. Add route type to `type Route` union in `src/app.tsx`
3. Add route parsing in `parseRoute()` function
4. Add route rendering in `RouteContent()` switch statement
5. If lazy-loading: Wrap with `React.lazy()` and `Suspense`
6. Add navigation link in `src/components/header.tsx` NAV_LINKS if applicable
7. Create tests in `tests/` if needed

**New Component:**
1. Create in `src/components/component-name.tsx`
2. Use TypeScript + React.FC or plain function
3. Import and use in pages as needed
4. Keep components focused (single responsibility)
5. Export with `export function ComponentName()`

**New Data Source/Service:**
1. If client-side fetch: Add to `lib/supabase.ts` or create new service in `lib/`
2. If build-time: Add to `lib/articles.ts` or create new utility
3. Export typed functions/interfaces from module
4. Import in pages/components where needed

**New Utility/Hook:**
- Client hooks: `src/hooks/use-*.ts`
- Utilities: `src/lib/*.ts`
- Server-side (build-time): `lib/*.ts`
- Keep utilities focused and side-effect free

**Articles/Content:**
- Add markdown files to `blog/articles/` with YAML frontmatter
- Frontmatter format:
  ```yaml
  ---
  slug: my-article-slug
  title: "Article Title"
  description: "Brief summary"
  date: 2025-02-16
  status: published  # or draft
  tags:
    - tag1
    - tag2
  coverImage: /images/articles/my-article.png
  ---
  # Article content in markdown
  ```
- Run `npm run build` to generate static pages

**Context Documents:**
- Add markdown files to `context/` with category subdirectories
- Auto-discovered by `scripts/generate.ts` and hardcoded in `src/pages/context.tsx`
- No frontmatter required

**Tests:**
- Unit tests: Colocated or in `tests/`
- E2E tests: In `tests/` directory
- Constraint tests: `tests/constraints/` (run via `npm run test:constraints`)

## Special Directories

**`.build/`**
- Purpose: Transient SSG output
- Generated: Yes (during `generate.ts` step)
- Committed: No
- Cleaned: Yes (removed each full build)
- Contents: Pre-rendered article/context HTML with embedded JSON

**`dist/`**
- Purpose: Final production output
- Generated: Yes (by `vite build` after .build/)
- Committed: No
- Cleaned: Yes (wiped before each build)
- Contents: Bundled JavaScript, CSS, final HTML, optimized images
- Deployment: Copied to web server (Cloudflare Pages, etc.)

**`public/content/`**
- Purpose: Generated manifest used by article list page
- Generated: Yes (by `scripts/generate.ts`)
- Committed: No
- Manual cleanup: Rare (auto-generated)
- Contents: `manifest.json` with article metadata array

**`.planning/codebase/`**
- Purpose: GSD codebase analysis documents (this directory)
- Generated: Yes (by `/gsd:map-codebase` command)
- Committed: Yes
- Contents: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, CONCERNS.md

**`node_modules/`, `.git/`, `.build/`, `dist/`, `temp/`**
- Purpose: Build artifacts, dependencies, version control
- Excluded from: TypeScript checks, linting, commits (.gitignore)

---

*Structure analysis: 2026-02-16*
