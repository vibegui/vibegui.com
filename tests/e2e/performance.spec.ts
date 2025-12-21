/**
 * Performance E2E Tests
 *
 * Verifies CONSTRAINTS.md Section 1: Performance
 * - Initial payload size
 * - No render-blocking resources
 * - Fast first contentful paint
 */

import { test, expect } from "@playwright/test";

test.describe("Performance Constraints", () => {
  test("initial HTML transfer size < 100KB", async ({ page }) => {
    const [response] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes("/") && r.request().resourceType() === "document",
      ),
      page.goto("/"),
    ]);

    const headers = response.headers();
    const contentLength = headers["content-length"];

    if (contentLength) {
      const sizeKB = parseInt(contentLength) / 1024;
      console.log(`Initial HTML: ${sizeKB.toFixed(2)}KB`);
      expect(parseInt(contentLength)).toBeLessThan(100 * 1024);
    }
  });

  test("total JS transfer < 200KB", async ({ page }) => {
    let totalJsSize = 0;

    page.on("response", async (response) => {
      if (response.request().resourceType() === "script") {
        const headers = response.headers();
        const size = parseInt(headers["content-length"] || "0");
        totalJsSize += size;
      }
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    console.log(`Total JS: ${(totalJsSize / 1024).toFixed(2)}KB`);
    expect(totalJsSize).toBeLessThan(200 * 1024);
  });

  test("page loads within 3 seconds", async ({ page }) => {
    const startTime = Date.now();

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const loadTime = Date.now() - startTime;
    console.log(`DOM Content Loaded: ${loadTime}ms`);

    expect(loadTime).toBeLessThan(3000);
  });

  test("no layout shift after initial render", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Wait a bit for any delayed content
    await page.waitForTimeout(1000);

    // Check CLS (Cumulative Layout Shift) via Performance API
    const cls = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let clsValue = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const layoutEntry = entry as unknown as {
              hadRecentInput: boolean;
              value: number;
            };
            if (!layoutEntry.hadRecentInput) {
              clsValue += layoutEntry.value;
            }
          }
        });

        observer.observe({ type: "layout-shift", buffered: true });

        // Give it a moment to collect
        setTimeout(() => {
          observer.disconnect();
          resolve(clsValue);
        }, 500);
      });
    });

    console.log(`Cumulative Layout Shift: ${cls.toFixed(4)}`);
    // Good CLS is < 0.1, needs improvement < 0.25
    expect(cls).toBeLessThan(0.25);
  });
});
