# Testing Patterns

**Analysis Date:** 2026-02-16

## Test Framework

**Test Runners:**
- **Unit/Constraint Tests:** Bun test (built-in, zero-config)
- **E2E Tests:** Playwright v1.49.1
- Config files: `playwright.config.ts` (only config file in root)

**Assertion Library:**
- Bun test: Built-in `expect()` from `bun:test`
- Playwright: Built-in Playwright assertions

**Run Commands:**
```bash
npm run test                    # Run Bun tests (unit and constraints)
npm run test:e2e                # Run Playwright E2E tests
npm run test:constraints        # Run constraint tests only: bun test tests/constraints/
```

## Test File Organization

**Location:**
- Constraint tests: `tests/constraints/*.test.ts`
- E2E tests: `tests/e2e/*.spec.ts`
- File naming convention: `.test.ts` for unit/constraint, `.spec.ts` for E2E

**Structure:**
```
tests/
├── constraints/                  # Performance and build constraints
│   ├── images.test.ts           # Image size limits
│   ├── cache-headers.test.ts    # Cache strategy validation
│   └── build-size.test.ts       # Payload size limits
└── e2e/                         # End-to-end browser tests
    ├── content.spec.ts          # Article and context loading
    ├── accessibility.spec.ts    # WCAG AA compliance
    ├── responsive.spec.ts       # Mobile/responsive behavior
    └── performance.spec.ts      # Page load performance
```

## Test Structure

**Unit/Constraint Tests (Bun):**
```typescript
import { describe, test, expect, beforeAll } from "bun:test";
import { readdirSync, statSync } from "node:fs";

describe("Image Constraints", () => {
  test("all images in public/ < 250KB", () => {
    const images = getAllImages(PUBLIC_DIR);

    for (const imagePath of images) {
      const stats = statSync(imagePath);
      console.log(`${relativePath}: ${(stats.size / 1024).toFixed(2)}KB`);
      expect(stats.size).toBeLessThan(MAX_IMAGE_SIZE);
    }
  });
});
```

**Patterns:**
- Suite organization: `describe()` blocks for logical grouping
- Test definition: `test(description, () => { ... })`
- Setup: `beforeAll()` for expensive operations (file scanning, build setup)
- Assertions: `expect(value).toBeLessThan()`, `expect(value).toBe(true)`
- Console logging: Used for diagnostic output (file sizes, paths)
- Error handling: Try-catch in helper functions that might fail silently

**E2E Tests (Playwright):**
```typescript
import { test, expect } from "@playwright/test";

test.describe("Context Pages", () => {
  test("context index page loads", async ({ page }) => {
    await page.goto("/context");
    await page.waitForLoadState("domcontentloaded");

    // Should have Leadership section heading
    await expect(
      page.getByRole("heading", { name: "Leadership" }),
    ).toBeVisible();

    // Should have document links
    await expect(page.locator("text=1. Integrity")).toBeVisible();
  });
});
```

**Patterns:**
- Async test functions: `async ({ page }) => { ... }`
- Navigation: `await page.goto(path)`
- Wait for readiness: `await page.waitForLoadState("domcontentloaded")`
- Locators: `page.getByRole()`, `page.locator()`, `page.getByText()`
- Assertions: `await expect(element).toBeVisible()`
- Negative assertions: `await expect(element).not.toBeVisible()`

## Mocking

**Framework:** None explicitly used

**Patterns:**
- No mocks used in constraint tests (test against actual built artifacts)
- No mocks used in E2E tests (test against real running server)
- Real data approach: Tests verify constraints against production build output

**What NOT to Mock:**
- File system (read actual dist/ and public/ directories)
- Network calls in E2E (real Playwright server with production build)
- Build artifacts (test against actual output from `bun run build`)

## Fixtures and Test Data

**Test Data:**
- Constraint tests use discovered file system data (no fixtures)
- E2E tests use actual application data from manifest and database
- Hardcoded test paths for known documents:

Example (from `content.spec.ts`):
```typescript
const documents = [
  { path: "01_integrity", title: "Integrity" },
  { path: "02_authenticity", title: "Authenticity" },
  { path: "03_something_bigger", title: "Something Bigger" },
  // ... more documents
];
```

**Location:**
- Test data embedded in test files (small dataset)
- No separate fixtures directory needed
- Application state comes from running server (manifest, database)

## Coverage

**Requirements:** No coverage target enforced

**Tools:** Coverage not measured (Bun test doesn't report coverage by default)

**Approach:** Constraint tests focus on CONSTRAINTS.md compliance rather than code coverage

## Test Types

**Constraint Tests:**
- Purpose: Enforce CONSTRAINTS.md requirements
- Scope: File system validation against build output
- Examples:
  - Image sizes < 250KB (`tests/constraints/images.test.ts`)
  - HTML payload < 100KB compressed (`tests/constraints/build-size.test.ts`)
  - Cache headers configured correctly (`tests/constraints/cache-headers.test.ts`)
- Run: `npm run test:constraints`

**E2E Tests:**
- Purpose: Verify user-facing functionality
- Scope: Full browser rendering and interaction
- Examples:
  - Content pages load correctly
  - Context documents render
  - Navigation works
  - Accessibility standards (WCAG AA)
  - Responsive design (mobile/desktop)
  - Performance metrics (LCP, FCP)
- Run: `npm run test:e2e`

**Note:** No separate unit tests for components. Testing strategy relies on:
1. Type checking (TypeScript strict mode)
2. Constraint tests (performance/quality gates)
3. E2E tests (user-facing behavior)

## Common Patterns

**Async Testing (E2E):**
```typescript
test("article page loads correctly", async ({ page }) => {
  await page.goto("/article/hello-world");
  await page.waitForLoadState("domcontentloaded");

  // Wait for specific content
  await expect(page.locator("text=Hello World")).toBeVisible();
});

// Polling for content
const errorVisible = await page
  .locator("text=Document not found")
  .isVisible()
  .catch(() => false);
```

**File System Scanning (Constraints):**
```typescript
function getAllImages(dir: string, images: string[] = []): string[] {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        getAllImages(fullPath, images);  // Recursive
      } else if (IMAGE_EXTENSIONS.includes(extname(entry.name))) {
        images.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist - silently skip
  }
  return images;
}
```

**Size Calculation (Constraints):**
```typescript
function getCompressedSize(content: string | Buffer): number {
  const buffer = typeof content === "string" ? Buffer.from(content) : content;
  return gzipSync(buffer).length;
}

// Used in tests
const compressedSize = getCompressedSize(htmlContent);
expect(compressedSize).toBeLessThan(MAX_HTML_SIZE_COMPRESSED);
```

**Loop-Based Testing (Constraints):**
```typescript
test("all leadership documents are accessible", async ({ page }) => {
  const documents = [
    { path: "01_integrity", title: "Integrity" },
    { path: "02_authenticity", title: "Authenticity" },
  ];

  for (const doc of documents) {
    await page.goto(`/context/leadership/${doc.path}`);
    await page.waitForLoadState("domcontentloaded");

    const errorVisible = await page
      .locator("text=Document not found")
      .isVisible()
      .catch(() => false);

    expect(
      errorVisible,
      `Document ${doc.path} should load without error`,
    ).toBe(false);
  }
});
```

## Playwright Configuration

**File:** `playwright.config.ts`

**Key Settings:**
```typescript
{
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  use: {
    baseURL: "http://localhost:4002",
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],

  webServer: {
    command: "bun scripts/preview-server.ts 4002",
    url: "http://localhost:4002",
    reuseExistingServer: false,
    timeout: 30000,
  },
}
```

**Notes:**
- Runs against production build (assumes `bun run build` already ran)
- Custom preview server respects SSG article HTML files
- Two projects: Desktop Chrome and Mobile Chrome
- Mobile viewport: 390x844 (iPhone-like)
- On CI: Retry failed tests up to 2 times, use single worker for stability

## Pre-commit Testing

**Hook:** Defined in `lefthook.yml`

**Sequence:**
```bash
npm run fmt         # Format code
npm run lint        # Lint with oxlint
npm run check       # Type check with TypeScript
npm run build       # Build production
npm run test:constraints  # Run constraint tests
npm run test:e2e    # Run E2E tests
```

**Failure:** Any step failure prevents commit

---

*Testing analysis: 2026-02-16*
