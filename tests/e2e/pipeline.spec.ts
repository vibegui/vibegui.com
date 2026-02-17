/**
 * E2E Pipeline Verification Tests
 *
 * Verifies the complete Supabase-first pipeline produces a working site:
 * - Articles synced from Supabase are built into static HTML in dist/
 * - Preview server serves article pages with HTTP 200
 * - Article pages contain actual content (not empty shells or SPA fallbacks)
 * - Content index lists articles from the generated manifest
 *
 * Pre-condition: dist/ must already be built (bun run build).
 * The Playwright webServer config starts preview-server automatically.
 */

import { test, expect } from "@playwright/test";

test.describe("E2E Pipeline Verification", () => {
  test("article pages served from dist with HTTP 200", async ({ page }) => {
    const response = await page.goto(
      "/article/hello-world-building-an-mcp-native-blog",
    );

    // Assert HTTP 200
    expect(response?.status()).toBe(200);

    // Assert article element is visible (real content rendered)
    const article = page.locator("article");
    await expect(article).toBeVisible();

    // Assert "Article not found" is NOT visible (proves real content, not SPA fallback)
    await expect(page.locator("text=Article not found")).not.toBeVisible();
  });

  test("content index lists articles from manifest", async ({ page }) => {
    await page.goto("/content");
    await page.waitForLoadState("domcontentloaded");

    // Find article links
    const articleLinks = page.locator("a[href*='/article/']");
    const count = await articleLinks.count();

    // Assert at least one article link exists (proves manifest was generated)
    expect(count).toBeGreaterThan(0);
  });

  test("multiple article pages render correctly", async ({ page }) => {
    // Navigate to content index to discover article links
    await page.goto("/content");
    await page.waitForLoadState("domcontentloaded");

    // Collect the first 3 article link hrefs
    const articleLinks = page.locator("a[href*='/article/']");
    const count = await articleLinks.count();
    const linksToTest = Math.min(count, 3);

    expect(linksToTest).toBeGreaterThan(0);

    const hrefs: string[] = [];
    for (let i = 0; i < linksToTest; i++) {
      const href = await articleLinks.nth(i).getAttribute("href");
      if (href) hrefs.push(href);
    }

    // Navigate to each article and verify it renders
    for (const href of hrefs) {
      const response = await page.goto(href);

      // Assert HTTP 200
      expect(response?.status(), `Expected 200 for ${href}`).toBe(200);

      // Assert content element is visible (article or main)
      const contentElement = page.locator("article, main");
      await expect(
        contentElement.first(),
        `Expected content visible for ${href}`,
      ).toBeVisible();
    }
  });
});
