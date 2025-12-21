# CONSTRAINTS.md

> Axioms and non-negotiable constraints for vibegui.com

These constraints define the fundamental rules of the project. They are not suggestions—they are load-bearing architectural decisions. Every feature, every component, every line of code must respect them.

---

## 1. Performance

### 1.1 Initial HTML Payload
- **Maximum**: `< 100 KB` (compressed, including inline critical CSS)
- **Target**: `< 50 KB`
- No JavaScript is required for first meaningful paint. Content must be readable with JS disabled.

### 1.2 Image Optimization
- **Maximum file size per image**: `250 KB` (after optimization)
- **Preferred format**: WebP (with AVIF for modern browsers)
- **Automatic optimization**: All images in the repo are automatically optimized via Vite plugin during dev/build
- **Lazy loading**: All below-the-fold images use `loading="lazy"`
- **Aspect ratio hints**: Always include `width` and `height` to prevent layout shifts

### 1.3 Asset Caching Strategy
- **index.html**: `Cache-Control: public, max-age=30, stale-while-revalidate=3600, stale-if-error=10800`
- **Static assets (JS/CSS)**: Content-hash filenames, `Cache-Control: public, max-age=31536000, immutable`
- **Fonts**: Same as static assets
- **Images**: Same as static assets

### 1.4 Cache Efficiency Between Deploys
- Asset URLs change **only** when their content changes (content-hash based naming)
- Deploys should produce minimal diffs—most files should retain their URLs
- No deployment-id or timestamp-based cache busting

---

## 2. User Experience

### 2.1 Reading Comfort
- **Line length**: 60-75 characters maximum for body text
- **Typography**: Readable font size (minimum 16px on mobile), generous line height (1.6+)
- **Contrast ratio**: WCAG AA minimum (4.5:1 for body text)

### 2.2 Mobile-First
- All layouts designed for mobile first, enhanced for larger screens
- Touch targets minimum 44×44px
- No horizontal scroll under any viewport

### 2.3 Theme Support
- Dark and Light modes from day one
- System preference detection with manual override
- Preference persisted in localStorage, cookie-synced for SSR

---

## 3. Design

### 3.1 Minimalism
- No decorative elements without purpose
- Maximum 2 fonts (1 for headings, 1 for body—or single font family)
- Limited color palette: background, foreground, accent, muted
- White space is a feature, not wasted space

### 3.2 Color Theme
- **Primary accent**: Green
- **Dark mode**: Terminal green tones (`#00FF41`, `#0D1117` background)
- **Light mode**: Dark forest green accents (`#1B4332`, `#F5F5F5` background)

### 3.3 Information Hierarchy
- Clear visual hierarchy: one H1 per page, sequential heading levels
- Date/metadata secondary to content
- Author avatar/bio minimal, non-intrusive

---

## 4. Architecture

### 4.1 Static-First, Dynamic-When-Needed
- Core pages are pre-generated static HTML
- Article content (MD/MDX) loaded on-demand as SPA
- Templates/components loaded once, cached aggressively

### 4.2 No Build on CI
- Build runs locally: `bun run build`
- Generated files (dist/) are versioned in git
- Deploy = push to main = Cloudflare Pages picks up dist/

### 4.3 SPA Runtime for Articles
- Single template shell loads once
- Articles are fetched as raw MD and rendered client-side
- Template changes are rare; article changes are frequent
- This maximizes cache efficiency

### 4.4 MCP-First Content Management
- All content operations go through MCP tools
- No direct file manipulation for content—always through MCP
- AI-assisted writing, research, and editing via OpenRouter binding

---

## 5. Content Pipeline

### 5.1 Collection Stages
- **Ideas**: Raw thoughts, single paragraph, unstructured
- **Research**: Deep research documents using AI (Firecrawl/Apify)
- **Drafts**: Outlined articles with structure, not yet polished
- **Articles**: Final, published content

### 5.2 File Organization
- Each collection is a folder: `content/ideas/`, `content/research/`, etc.
- Filenames are kebab-case slugs: `my-great-idea.md`
- Frontmatter for metadata (title, date, tags, status)

### 5.3 Transformation
- Ideas → Drafts (with research support)
- Drafts → Articles (via editing tools)
- Never skip stages—each stage has purpose

---

## 6. Dependencies

### 6.1 Minimal Dependencies
- Core: Vite, React 19, Tailwind v4, TypeScript
- Markdown: MDX or marked (single parser)
- MCP: @decocms/runtime, @decocms/bindings
- No UI framework (no shadcn, no Radix)—hand-rolled minimal components

### 6.2 Dependency Rules
- Prefer native APIs over polyfills
- No lodash, moment, or heavyweight utilities
- Every dependency must justify its bundle cost

---

## 7. Code Quality

### 7.1 TypeScript Strictness
- `strict: true`
- No `any` unless absolutely necessary (and documented)

### 7.2 Simplicity Over Abstraction
- Avoid premature abstraction
- Inline styles over utility classes when one-off
- Plain functions over classes
- Composition over inheritance

### 7.3 Documentation
- Every file should be self-explanatory
- Comments explain "why", code explains "what"
- README files in each major directory

---

## 8. Accessibility

### 8.1 Keyboard Navigation
- All interactive elements focusable and operable via keyboard
- Visible focus indicators

### 8.2 Screen Readers
- Semantic HTML (nav, main, article, aside)
- ARIA labels where needed
- Alt text on all images

### 8.3 Motion
- Respect `prefers-reduced-motion`
- No animations that can cause vestibular issues

---

## Revision Policy

These constraints can be amended, but changes must:
1. Be documented with rationale
2. Not violate the spirit of minimalism and performance
3. Be reflected across the entire codebase

---

*Last updated: December 2024*

