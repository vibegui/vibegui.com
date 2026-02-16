# Coding Conventions

**Analysis Date:** 2026-02-16

## Naming Patterns

**Files:**
- React components: PascalCase with `.tsx` extension (e.g., `Header.tsx`, `ArticleCard.tsx`)
- Utility modules: camelCase with `.ts` extension (e.g., `use-canonical.ts`, `manifest.ts`)
- Configuration files: kebab-case in root (e.g., `vite.config.ts`, `playwright.config.ts`)
- Directories: kebab-case for page directories (`src/pages/`, `src/components/`, `src/hooks/`, `src/lib/`)

**Functions:**
- Exported React components: PascalCase (e.g., `export function Header()`)
- Utility functions: camelCase (e.g., `export function updateCanonical()`, `export function readArticle()`)
- Hook functions: camelCase with `use` prefix (e.g., `useRoute()`, `useCurrentPath()`, `useCanonical()`)
- Private/internal functions: camelCase (e.g., `function parseRoute()`, `function formatDate()`)

**Variables:**
- State variables: camelCase (e.g., `const [menuOpen, setMenuOpen]`)
- Constants: UPPER_SNAKE_CASE (e.g., `const NAV_LINKS`, `const MAX_IMAGE_SIZE`)
- Object keys: camelCase (e.g., `{ href, label }`, `{ slug, title, date }`)

**Types:**
- TypeScript interfaces: PascalCase with `Props` suffix for component props (e.g., `ArticleCardProps`, `ArticleData`)
- Type unions and discriminated unions: PascalCase (e.g., `type Route = { type: "content" } | ...`)
- Enums: Implied via literal union types (e.g., `status: "draft" | "published"`)

## Code Style

**Formatting:**
- Formatter: Biome v1.9.4
- Indentation: 2 spaces
- Line endings: LF (via Git)
- Quotes: Double quotes (enforced by Biome)

**Key Settings (biome.json):**
```json
{
  "formatter": {
    "indentStyle": "space",
    "indentWidth": 2
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "semicolons": "always"
    }
  }
}
```

**Linting:**
- Linter: OxLint v0.16.1
- Configuration: `oxlint --ignore-pattern dist/`
- Rules: Basic linting for code quality
- Running: `npm run lint`

**Type Checking:**
- TypeScript: v5.7.2
- Strict mode: Enabled (`strict: true`)
- Additional flags:
  - `noUnusedLocals: true` - Unused local variables error
  - `noUnusedParameters: true` - Unused function parameters error
  - `noFallthroughCasesInSwitch: true` - Switch statement fallthrough check
  - `noUncheckedIndexedAccess: true` - Undefined array/object access check
- Running: `npm run check` (uses tsconfig.check.json)

## Import Organization

**Order:**
1. React and external libraries (e.g., `import React from "react"`)
2. External npm packages (e.g., `import { marked } from "marked"`)
3. Relative imports from src (e.g., `import { Header } from "./components/header"`)
4. Relative imports from lib (e.g., `import { readArticle } from "../../lib/articles"`)

**Path Aliases:**
- `~/*` resolves to `./src/*` (defined in tsconfig.json)
- Example: `import { Link } from "~/app"` loads `src/app.tsx`

**Import Statements:**
- Biome organizes imports automatically via `organizeImports: true`
- Named imports preferred over default imports: `import { Header }` vs `import Header`
- Type imports when needed: `import type { Route } from "./app"` (though rarely used in this codebase)

## Error Handling

**Patterns:**
- Try-catch blocks for parse operations: JSON.parse, DOM queries, file reads
- Null-coalescing pattern: `if (!value) return null` followed by destructuring
- Error logging with context: `console.error("Failed to load content manifest:", error)`
- Error objects as fallback: `catch (err) { ... (err as Error).message ... }`
- Graceful degradation in UI: Show "Document not found" or "Article not found" messages instead of throwing

**Example (from `article.tsx`):**
```typescript
function getEmbeddedArticle(): ArticleData | null {
  if (typeof document === "undefined") return null;
  const script = document.getElementById("article-data");
  if (!script) return null;
  try {
    return JSON.parse(script.textContent || "");
  } catch {
    return null;
  }
}
```

**Example (from `manifest.ts`):**
```typescript
try {
  return JSON.parse(script.textContent || "");
} catch (error) {
  console.error("Failed to load content manifest:", error);
  return null;
}
```

## Logging

**Framework:** `console` (no logging library)

**Patterns:**
- Development logs: `console.log()` with context (e.g., `console.log("🔄 Articles changed, regenerating...")`)
- Warnings: `console.warn()` for non-critical issues (e.g., bookmark cache errors)
- Errors: `console.error()` for failures (e.g., API calls, manifest loading)
- API debug logs: Prefixed with `[API]`, `[Mesh]`, `[Supabase]` for clarity

**Example (from `vite.config.ts`):**
```typescript
console.log("[API] /api/bookmarks/update called");
console.error("[API] SQL execution failed:", sqlErr);
console.log("[Mesh Proxy] Calling:", MESH_GATEWAY_URL);
```

## Comments

**When to Comment:**
- File headers: JSDoc-style comments describing module purpose and major features
- Complex logic: Comments explaining non-obvious algorithms (e.g., YAML parser, SQL escaping)
- Workarounds: Comments explaining why a suboptimal approach was taken
- Architectural decisions: Comments explaining unusual patterns

**JSDoc/TSDoc:**
- Not extensively used in this codebase
- File headers use multi-line comments with description and context
- Function-level comments for complex utilities

**Example (from `articles.ts`):**
```typescript
/**
 * Article Management
 *
 * Reads articles from markdown files with YAML frontmatter.
 * ...
 */

/**
 * Parse YAML frontmatter from markdown content
 */
function parseFrontmatter(content: string): { ... }
```

## Function Design

**Size:** Aim for single-responsibility functions under 50 lines where practical. Longer functions (100+ lines) are acceptable for complex operations like SQL query building.

**Parameters:**
- Typed via TypeScript: All parameters have explicit types
- Destructuring for object parameters: `{ href, children, className }` instead of spread
- Props interfaces for React components (e.g., `ArticleCardProps`)

**Return Values:**
- Explicit return types on all functions: `function getName(): string | null`
- Nullable returns use `| null` union type (not `undefined`)
- React components return JSX.Element or function that returns it

**Example (from `app.tsx`):**
```typescript
function parseRoute(pathname: string): Route {
  if (pathname === "/" || pathname === "") {
    return { type: "content" };
  }
  // ... more cases
  return { type: "not-found" };
}

export function navigate(to: string): void {
  updateCanonical(to);
  window.history.pushState({}, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
```

## Module Design

**Exports:**
- Named exports preferred: `export function Header()` not `export default Header`
- Mix of functions and constants: `export const NAV_LINKS = [...]` and `export function Header()`
- Single responsibility per module (utilities grouped logically)

**Barrel Files:**
- Not extensively used; direct imports from modules preferred
- Examples: `import { Header } from "./components/header"` not `import { Header } from "./components/"`

**Module Structure:**
- Single feature per file (one component or utility function set)
- Related utilities in same file (e.g., `formatDate()` and `Article()` component in same file if tightly coupled)
- Separation of concerns:
  - Components in `src/components/`
  - Pages in `src/pages/`
  - Hooks in `src/hooks/`
  - Utilities in `lib/` or `src/lib/`

---

*Convention analysis: 2026-02-16*
