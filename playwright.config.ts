import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for vibegui.com E2E tests
 *
 * Tests verify CONSTRAINTS.md requirements:
 * - Performance (payload sizes, caching)
 * - Accessibility (WCAG AA)
 * - Mobile-first responsive design
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",

  use: {
    baseURL: "http://localhost:4001",
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"] },
    },
  ],

  // Start dev server before running tests
  webServer: {
    command: "bun run preview",
    url: "http://localhost:4001",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
