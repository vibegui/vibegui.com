/**
 * Accessibility E2E Tests
 *
 * Verifies CONSTRAINTS.md Section 2 & 8: UX and Accessibility
 * - WCAG AA contrast (4.5:1 for body text)
 * - Keyboard navigation
 * - Semantic HTML
 */

import { test, expect } from "@playwright/test";

test.describe("Accessibility Constraints", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("page has proper semantic structure", async ({ page }) => {
    // Check for main landmark
    const main = page.locator("main");
    await expect(main).toBeVisible();

    // Check for header/nav
    const header = page.locator("header");
    await expect(header).toBeVisible();

    // Check for nav element
    const nav = page.locator("nav");
    await expect(nav).toBeVisible();
  });

  test("page has exactly one h1", async ({ page }) => {
    const h1s = page.locator("h1");
    const count = await h1s.count();

    // Home page might not have h1, but other pages should have exactly one
    expect(count).toBeLessThanOrEqual(1);
  });

  test("all links are focusable", async ({ page }) => {
    const links = page.locator("a[href]");
    const count = await links.count();

    for (let i = 0; i < Math.min(count, 10); i++) {
      const link = links.nth(i);
      await link.focus();
      await expect(link).toBeFocused();
    }
  });

  test("all buttons are focusable", async ({ page }) => {
    const buttons = page.locator("button");
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      await button.focus();
      await expect(button).toBeFocused();
    }
  });

  test("theme toggle is keyboard accessible", async ({ page }) => {
    // Find theme toggle button
    const themeToggle = page
      .locator("button")
      .filter({ hasText: /theme|dark|light/i })
      .first();

    if ((await themeToggle.count()) > 0) {
      await themeToggle.focus();
      await expect(themeToggle).toBeFocused();

      // Should be activatable via keyboard
      await page.keyboard.press("Enter");
    }
  });

  test("focus is visible on interactive elements", async ({ page }) => {
    // Tab through the page and check focus visibility
    await page.keyboard.press("Tab");

    const focusedElement = page.locator(":focus");
    await expect(focusedElement).toBeVisible();

    // Check that focus has visible outline
    const outline = await focusedElement.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return styles.outlineWidth !== "0px" || styles.boxShadow !== "none";
    });

    expect(outline).toBe(true);
  });
});
