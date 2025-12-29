# PLAN.md

> Detailed implementation roadmap for vibegui.com

This document breaks down the README into actionable tasks. Each task is atomic and testable. Work through them in order—later tasks often depend on earlier ones.

---

## Phase 1: Project Foundation

### 1.1 Initialize Project ✅

- [x] Initialize Bun project with `bun init`
- [x] Create `package.json` with project metadata
- [x] Add `.gitignore` (node_modules, .env, etc.)
- [x] Create `tsconfig.json` with strict mode
- [x] Set up Biome for formatting (`biome.json`)

**Deliverable**: ✅ Project passes `bun run check`

### 1.2 Install Core Dependencies ✅

```bash
bun add vite @vitejs/plugin-react react react-dom
bun add -D typescript @types/react @types/react-dom
bun add tailwindcss @tailwindcss/vite
bun add zod
```

**Deliverable**: ✅ Dependencies installed

### 1.3 Install MCP Dependencies ✅

```bash
bun add @decocms/runtime @decocms/bindings
bun add @modelcontextprotocol/sdk
```

**Deliverable**: ✅ MCP dependencies available

### 1.4 Create Directory Structure ✅

```
mkdir -p src/{components,pages,lib,styles}
mkdir -p content/{ideas,research,drafts,articles}
mkdir -p public/{fonts,images}
mkdir -p dist
```

**Deliverable**: ✅ All directories exist

---

## Phase 2: Vite + Build Configuration

### 2.1 Create Vite Config

Create `vite.config.ts`:

- [ ] Configure React plugin
- [ ] Configure Tailwind CSS v4 integration
- [ ] Set up asset handling with content-hash filenames
- [ ] Configure build output to `dist/`
- [ ] Add image optimization plugin (`vite-plugin-imagemin` or similar)

**Key settings**:
```typescript
build: {
  rollupOptions: {
    output: {
      // Content-hash based naming
      entryFileNames: 'assets/[name].[hash].js',
      chunkFileNames: 'assets/[name].[hash].js',
      assetFileNames: 'assets/[name].[hash].[ext]'
    }
  }
}
```

**Deliverable**: `bun run build` produces content-hashed assets

### 2.2 Configure Image Optimization

- [ ] Install `vite-plugin-imagemin` or `unplugin-imagemin`
- [ ] Configure WebP conversion
- [ ] Set max quality/size thresholds (< 100KB per image)
- [ ] Test with a sample image

**Deliverable**: Images in `public/images/` are auto-optimized

### 2.3 Create Tailwind Config

Create `tailwind.config.ts`:

- [ ] Configure custom colors (forest green, terminal green)
- [ ] Set up typography scale
- [ ] Configure dark mode (`class` strategy)
- [ ] Set content paths

**Color palette**:
```typescript
colors: {
  // Light mode
  forest: {
    50: '#F0FDF4',
    600: '#1B4332',
    900: '#0A1F12',
  },
  // Dark mode
  terminal: {
    DEFAULT: '#00FF41',
    dim: '#00CC33',
    bright: '#33FF66',
  }
}
```

**Deliverable**: Custom colors work in components

### 2.4 Create CSS Entry Point

Create `src/styles/main.css`:

- [ ] Import Tailwind layers
- [ ] Define CSS custom properties for theming
- [ ] Add base typography styles
- [ ] Add utility classes for reading comfort (max-width prose)

**Deliverable**: Styles load correctly in dev server

---

## Phase 3: Frontend Shell

### 3.1 Create Entry Point

Create `src/main.tsx`:

- [ ] Mount React app to `#root`
- [ ] Import main CSS
- [ ] Set up theme initialization (read from localStorage before render)

**Deliverable**: App mounts without errors

### 3.2 Create App Shell

Create `src/app.tsx`:

- [ ] Set up simple client-side router (no react-router, hand-rolled)
- [ ] Create `<Header />` slot
- [ ] Create `<main />` content area
- [ ] Handle route changes via `popstate` and link clicks

**Deliverable**: Navigation between routes works

### 3.3 Create Header Component

Create `src/components/header.tsx`:

- [ ] Logo (text or simple SVG)
- [ ] Hamburger menu (mobile)
- [ ] Navigation links (Home, Commitment, Integrity, Alignment, deco)
- [ ] Theme toggle button

**Mobile-first**: Menu hidden behind hamburger on mobile, inline on desktop

**Deliverable**: Header renders, menu works on mobile

### 3.4 Create Theme Toggle

Create `src/components/theme-toggle.tsx`:

- [ ] Sun/Moon icons
- [ ] Toggle between 'light', 'dark', 'system'
- [ ] Persist to localStorage
- [ ] Update `<html data-theme="...">` attribute
- [ ] Listen for system preference changes when set to 'system'

**Deliverable**: Theme toggle works, preference persists

### 3.5 Create Article Card

Create `src/components/article-card.tsx`:

- [ ] Title (h2 or h3)
- [ ] Date (formatted nicely)
- [ ] Excerpt (first paragraph or explicit description)
- [ ] "Read more" link
- [ ] Hover state

**Deliverable**: Article cards render correctly

---

## Phase 4: Pages

### 4.1 Create Home Page

Create `src/pages/home.tsx`:

- [ ] Banner: "Personal blog of Guilherme Rodrigues, co-founder of decocms.com, RJ ↔ NY"
- [ ] Featured article (latest, larger display)
- [ ] List of article cards
- [ ] Load articles from `content/articles/` manifest

**Deliverable**: Home page shows articles

### 4.2 Create Article Page

Create `src/pages/article.tsx`:

- [ ] Load article MD based on slug from URL
- [ ] Parse frontmatter
- [ ] Render markdown to HTML
- [ ] Apply prose styling
- [ ] Show title, date, tags
- [ ] Add back link to home

**Deliverable**: Individual articles render correctly

### 4.3 Create Commitment Page

Create `src/pages/commitment.tsx`:

- [ ] Static content about Brazil tech vision
- [ ] Include the full narrative (Sweden → Brazil → VTEX → Movimento Tech → deco)
- [ ] Styled as article

**Content source**: Use the PT-BR text from the spec, translate/adapt to English

**Deliverable**: Commitment page is readable and complete

### 4.4 Create Integrity Page (TODO)

Create `src/pages/integrity.tsx`:

- [ ] Placeholder title: "Integrity"
- [ ] TODO note: "Content coming soon — exploring Werner Erhard's distinction of integrity as a performance factor"

**Deliverable**: Page exists with placeholder

### 4.5 Create Alignment Page (TODO)

Create `src/pages/alignment.tsx`:

- [ ] Placeholder title: "Alignment"
- [ ] TODO note: "Content coming soon — exploring how our actions derive from the future"

**Deliverable**: Page exists with placeholder

### 4.6 Create deco Page (TODO)

Create `src/pages/deco.tsx`:

- [ ] Placeholder title: "deco CMS"
- [ ] TODO note: "Content coming soon — the journey of deco and invitation to join"
- [ ] Include link to decocms.com

**Deliverable**: Page exists with placeholder

---

## Phase 5: Content Loading

### 5.1 Create Markdown Parser

Create `src/lib/markdown.ts`:

- [ ] Parse YAML frontmatter
- [ ] Convert MD to HTML (use `marked` or similar lightweight parser)
- [ ] Support syntax highlighting for code blocks (optional, can be added later)

**Deliverable**: `parseMarkdown(md) → { frontmatter, html }`

### 5.2 Create Content Loader

Create `src/lib/content.ts`:

- [ ] `loadArticle(slug)` — fetch and parse single article
- [ ] `loadArticleList()` — fetch article manifest, return metadata
- [ ] Handle 404 gracefully

**Strategy**: At build time, generate a `content/manifest.json` with article metadata. At runtime, lazy-load individual MD files.

**Deliverable**: Articles load from filesystem

### 5.3 Create Build Script for Content Manifest

Add to `vite.config.ts` or separate script:

- [ ] Scan `content/articles/` at build time
- [ ] Extract frontmatter from each
- [ ] Write `dist/content/manifest.json`
- [ ] Copy article MD files to `dist/content/articles/`

**Deliverable**: `dist/content/manifest.json` is generated on build

---

## Phase 6: MCP Server

### 6.1 Create MCP Server Entry Point

Create `mcp-server.ts`:

- [ ] Import `withRuntime` from `@decocms/runtime`
- [ ] Define empty tools array
- [ ] Export default with `withRuntime()`
- [ ] Add script to `package.json`: `"mcp:dev": "bun run mcp-server.ts"`

**Deliverable**: MCP server starts without errors

### 6.2 Define Configuration Schema

In `mcp-server.ts`:

- [ ] Create Zod schema for state (OpenRouter binding, etc.)
- [ ] Configure `configuration.state` option

```typescript
const ConfigSchema = z.object({
  OPENROUTER: BindingOf("@deco/openrouter"),
});
```

**Deliverable**: MCP exposes configuration schema

### 6.3 Create Ideas Collection Tools

Add to `mcp-server.ts`:

- [ ] `COLLECTION_IDEAS_LIST` — list all ideas
- [ ] `COLLECTION_IDEAS_GET` — get single idea
- [ ] `COLLECTION_IDEAS_CREATE` — create new idea (writes MD file)
- [ ] `COLLECTION_IDEAS_UPDATE` — update idea
- [ ] `COLLECTION_IDEAS_DELETE` — delete idea

**File format**: `content/ideas/{slug}.md` with frontmatter

**Deliverable**: Ideas collection fully functional

### 6.4 Create Research Collection Tools

Same pattern as Ideas:

- [ ] `COLLECTION_RESEARCH_LIST`
- [ ] `COLLECTION_RESEARCH_GET`
- [ ] `COLLECTION_RESEARCH_CREATE`
- [ ] `COLLECTION_RESEARCH_UPDATE`
- [ ] `COLLECTION_RESEARCH_DELETE`

**Deliverable**: Research collection fully functional

### 6.5 Create Drafts Collection Tools

Same pattern:

- [x] Removed separate DRAFTS tools - use ARTICLES with status: "draft"

**Deliverable**: Drafts collection fully functional

### 6.6 Create Articles Collection Tools

Same pattern:

- [ ] `COLLECTION_ARTICLES_LIST`
- [ ] `COLLECTION_ARTICLES_GET`
- [ ] `COLLECTION_ARTICLES_CREATE`
- [ ] `COLLECTION_ARTICLES_UPDATE`
- [ ] `COLLECTION_ARTICLES_DELETE`

**Deliverable**: Articles collection fully functional

### 6.7 Create Transformation Tools

Add AI-powered tools:

- [ ] `IDEA_TO_DRAFT` — uses AI to expand idea into draft outline
- [ ] `RESEARCH_TOPIC` — deep research on topic (for now, use AI; later integrate Firecrawl)
- [ ] `ENHANCE_DRAFT` — improve draft with AI
- [ ] `DRAFT_TO_ARTICLE` — polish and publish draft as article

**AI usage**: Call OpenRouter via binding

**Deliverable**: Transformation tools work with AI

### 6.8 Create Development Tools

Add tools for dev workflow:

- [ ] `DEV_SERVER_START` — spawn Vite dev server (child process)
- [ ] `DEV_SERVER_STOP` — kill dev server process
- [ ] `BUILD` — run `bun run build`
- [ ] `GENERATE_COMMIT` — AI generates commit message based on git diff
- [ ] `COMMIT` — run `git add . && git commit -m "..."`
- [ ] `PUSH` — run `git push`

**Deliverable**: Full dev workflow controllable via MCP

---

## Phase 7: Deployment

### 7.1 Create Headers File

Create `dist/_headers` (or copy from `public/_headers`):

```
/index.html
  Cache-Control: public, max-age=30, stale-while-revalidate=3600, stale-if-error=10800

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/content/*
  Cache-Control: public, max-age=3600, stale-while-revalidate=86400
```

**Deliverable**: Headers file deployed with site

### 7.2 Set Up Cloudflare Pages

Manual steps:

1. Go to Cloudflare Dashboard → Pages
2. Create new project
3. Connect GitHub repo
4. **Build command**: leave empty
5. **Build output directory**: `dist`
6. Configure custom domain: `vibegui.com`

**Deliverable**: Cloudflare Pages project exists

### 7.3 Test Full Deploy Flow

1. Make a small change
2. Run `bun run build`
3. Commit all changes including `dist/`
4. Push to `main`
5. Verify Cloudflare picks up and deploys
6. Check cache headers in browser DevTools

**Deliverable**: Push-to-deploy works

---

## Phase 8: Polish & Testing

### 8.1 Accessibility Audit

- [ ] Run Lighthouse accessibility audit
- [ ] Fix any issues (focus indicators, alt text, etc.)
- [ ] Test with keyboard only
- [ ] Test with screen reader (VoiceOver/NVDA)

**Deliverable**: Score 90+ on accessibility

### 8.2 Performance Audit

- [ ] Run Lighthouse performance audit
- [ ] Verify initial payload < 100KB
- [ ] Verify all images < 100KB
- [ ] Check Core Web Vitals

**Deliverable**: Score 95+ on performance

### 8.3 Cross-Browser Testing

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

**Deliverable**: Site works on all browsers

### 8.4 Content: First Real Article

- [ ] Write first article using MCP workflow
- [ ] Test full pipeline: idea → research → draft → article
- [ ] Build and deploy

**Deliverable**: First article live on site

---

## Phase 9: Documentation

### 9.1 Add README Files to Subdirectories

- [ ] `src/README.md` — Frontend architecture overview
- [ ] `content/README.md` — Content structure and frontmatter format
- [ ] Add inline comments to complex code

**Deliverable**: Codebase is self-documenting

### 9.2 Create CONTRIBUTING.md

- [ ] Explain how to run locally
- [ ] Explain coding standards
- [ ] Explain content workflow

**Deliverable**: Someone new can contribute

---

## Success Criteria

The project is complete when:

1. ✅ All pages render correctly
2. ✅ Theme toggle works (light/dark)
3. ✅ MCP server exposes all documented tools
4. ✅ Content workflow (idea → article) works end-to-end
5. ✅ Build produces minimal diffs between deploys
6. ✅ Site scores 95+ on Lighthouse performance
7. ✅ Site scores 90+ on Lighthouse accessibility
8. ✅ Push to main auto-deploys via Cloudflare
9. ✅ First real article is published

---

## Stretch Goals (Post-MVP)

- [ ] RSS feed generation
- [ ] Full-text search (client-side with Fuse.js)
- [ ] Reading time estimate
- [ ] Table of contents for long articles
- [ ] Comments via GitHub issues or similar
- [ ] Newsletter signup (Buttondown, Resend)
- [ ] Firecrawl integration for deep research
- [ ] Syntax highlighting for code blocks
- [ ] Social share images (OG images)

---

*Start with Phase 1. Don't skip ahead. Each phase builds on the previous.*

