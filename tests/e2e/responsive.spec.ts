/**
 * Responsive Design E2E Tests
 *
 * Verifies CONSTRAINTS.md Section 2.2: Mobile-First
 * - No horizontal scroll
 * - Touch targets minimum 44×44px
 * - Content readable on all viewports
 */

import { test, expect } from "@playwright/test";

const viewports = [
  { name: "iPhone SE", width: 375, height: 667 },
  { name: "iPhone 13", width: 390, height: 844 },
  { name: "iPad", width: 768, height: 1024 },
  { name: "Desktop", width: 1280, height: 720 },
];

test.describe("Responsive Design Constraints", () => {
  for (const viewport of viewports) {
    test.describe(`${viewport.name} (${viewport.width}x${viewport.height})`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        await page.goto("/");
      });

      test("no horizontal scroll", async ({ page }) => {
        const scrollWidth = await page.evaluate(
          () => document.documentElement.scrollWidth,
        );
        const clientWidth = await page.evaluate(
          () => document.documentElement.clientWidth,
        );

        // Allow 1px tolerance for rounding
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
      });

      test("content is visible", async ({ page }) => {
        // Main content should be visible
        const main = page.locator("main");
        await expect(main).toBeVisible();

        // Header should be visible
        const header = page.locator("header");
        await expect(header).toBeVisible();
      });

      test("text is readable (font size >= 14px)", async ({ page }) => {
        const body = page.locator("body");
        const fontSize = await body.evaluate((el) => {
          return parseFloat(window.getComputedStyle(el).fontSize);
        });

        expect(fontSize).toBeGreaterThanOrEqual(14);
      });
    });
  }

  test.describe("Touch Targets", () => {
    test.beforeEach(async ({ page }) => {
      // Use mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/");
    });

    test("buttons have minimum 44x44px touch target", async ({ page }) => {
      const buttons = page.locator("button");
      const count = await buttons.count();

      for (let i = 0; i < count; i++) {
        const button = buttons.nth(i);
        const box = await button.boundingBox();

        if (box) {
          // Minimum touch target as per Apple HIG / WCAG
          expect(box.width).toBeGreaterThanOrEqual(44);
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
      }
    });

    test("navigation links have adequate spacing", async ({ page }) => {
      const navLinks = page.locator("nav a");
      const count = await navLinks.count();

      if (count > 1) {
        const boxes = [];
        for (let i = 0; i < count; i++) {
          const box = await navLinks.nth(i).boundingBox();
          if (box) boxes.push(box);
        }

        // Check that links don't overlap
        for (let i = 0; i < boxes.length - 1; i++) {
          const current = boxes[i];
          const next = boxes[i + 1];

          if (current && next) {
            // Horizontal layout: check horizontal spacing
            if (Math.abs(current.y - next.y) < 10) {
              expect(next.x).toBeGreaterThanOrEqual(current.x + current.width);
            }
          }
        }
      }
    });
  });
});
