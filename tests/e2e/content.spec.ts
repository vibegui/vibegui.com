/**
 * Content E2E Tests
 *
 * Verifies that content pages load correctly:
 * - Context/leadership documents render without errors
 * - Articles load and display content
 * - Manifest-based content hashing works
 */

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

  test("leadership documents load correctly", async ({ page }) => {
    // Test a leadership document that was previously broken
    await page.goto("/context/leadership/05_future_as_context");
    await page.waitForLoadState("domcontentloaded");

    // Should NOT show error message
    await expect(page.locator("text=Document not found")).not.toBeVisible();

    // Should show the document title
    await expect(
      page.locator("text=The Future as Context").first(),
    ).toBeVisible();

    // Should have source attribution with link
    await expect(page.locator("text=Source:")).toBeVisible();
    await expect(page.getByText("Authors:")).toBeVisible();

    // Should have back link
    await expect(page.locator("text=← Back to context")).toBeVisible();
  });

  test("all leadership documents are accessible", async ({ page }) => {
    const documents = [
      { path: "01_integrity", title: "Integrity" },
      { path: "02_authenticity", title: "Authenticity" },
      { path: "03_something_bigger", title: "Something Bigger" },
      { path: "04_being_cause_in_matter", title: "Being Cause" },
      { path: "05_future_as_context", title: "Future as Context" },
      { path: "06_already_always_listening", title: "Already-Always" },
      { path: "07_life_sentences", title: "Life Sentences" },
      { path: "08_rackets", title: "Rackets" },
      { path: "09_authentic_listening", title: "Authentic Listening" },
      { path: "10_contextual_framework", title: "Contextual Framework" },
      { path: "11_power", title: "Power" },
    ];

    for (const doc of documents) {
      await page.goto(`/context/leadership/${doc.path}`);
      await page.waitForLoadState("domcontentloaded");

      // Should NOT show error - document should load
      const errorVisible = await page
        .locator("text=Document not found")
        .isVisible()
        .catch(() => false);

      expect(
        errorVisible,
        `Document ${doc.path} should load without error`,
      ).toBe(false);

      // Should have some content (main area should have text)
      const main = page.locator("main");
      await expect(main).toBeVisible();
    }
  });

  test("integrity summary document loads", async ({ page }) => {
    await page.goto("/context/integrity_positive_model_summary");
    await page.waitForLoadState("domcontentloaded");

    // Should NOT show error
    await expect(page.locator("text=Document not found")).not.toBeVisible();

    // Should have content
    const main = page.locator("main");
    await expect(main).toBeVisible();
  });
});

test.describe("Article Pages", () => {
  test("article page loads correctly", async ({ page }) => {
    await page.goto("/article/hello-world-building-an-mcp-native-blog");
    await page.waitForLoadState("domcontentloaded");

    // Should NOT show error
    await expect(page.locator("text=Article not found")).not.toBeVisible();

    // Should show article title
    await expect(page.locator("text=Hello World")).toBeVisible();

    // Should have article content
    const article = page.locator("article");
    await expect(article).toBeVisible();
  });

  test("content index page shows articles", async ({ page }) => {
    await page.goto("/content");
    await page.waitForLoadState("domcontentloaded");

    // Should show at least one article
    await expect(
      page.locator("text=Hello World: Building an MCP-Native Blog"),
    ).toBeVisible();
  });
});

test.describe("Content Loading", () => {
  test("manifest is loaded and contains articles", async ({ page }) => {
    await page.goto("/content");
    await page.waitForLoadState("domcontentloaded");

    // Content page should show articles from manifest
    await expect(
      page.locator("text=Hello World: Building an MCP-Native Blog"),
    ).toBeVisible();
  });

  test("context navigation works between documents", async ({ page }) => {
    // Start at context index
    await page.goto("/context");
    await page.waitForLoadState("domcontentloaded");

    // Click on a document link
    await page.click("text=1. Integrity");
    await page.waitForLoadState("domcontentloaded");

    // Should load the document
    await expect(page.locator("text=Document not found")).not.toBeVisible();

    // Should be able to go back
    await page.click("text=← Back to context");
    await page.waitForLoadState("domcontentloaded");

    // Should be back on context index
    await expect(
      page.getByRole("heading", { name: "Leadership" }),
    ).toBeVisible();
  });
});
