import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for vibegui.com E2E tests
 *
 * Tests verify CONSTRAINTS.md requirements:
 * - Performance (payload sizes, caching)
 * - Accessibility (WCAG AA)
 * - Mobile-first responsive design
 *
 * Always runs against production build to exercise the full pipeline:
 * - Vite build with content hashing
 * - Post-build script for manifest hashing
 * - Preview server (simulates Cloudflare deployment)
 */

// Use a dedicated port for E2E tests to avoid conflicts with dev server
const E2E_PORT = 4002;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",

  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
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

  // Serve production build for testing
  // Uses custom preview server that respects SSG article HTML files
  // Assumes `bun run build` already ran (e.g., in pre-commit)
  webServer: {
    command: `bun scripts/preview-server.ts ${E2E_PORT}`,
    url: `http://localhost:${E2E_PORT}`,
    reuseExistingServer: false,
    timeout: 30 * 1000,
  },
});
