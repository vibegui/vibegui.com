import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { onRequest } from "../../functions/_middleware";

type Locale = "pt-BR" | "en";

interface ManifestArticle {
  slug: string;
  locale: Locale;
  path: string;
  alternatePath?: string | null;
  title: string;
  date: string;
  status: "draft" | "published";
}

async function articles(page: Page) {
  return page.evaluate(async () => {
    const response = await fetch("/content/manifest.json");
    const manifest = (await response.json()) as {
      articles: ManifestArticle[];
    };
    return manifest.articles;
  });
}

test.describe("Localized writing", () => {
  for (const [locale, path] of [
    ["pt-BR", "/"],
    ["en", "/en"],
  ] as const) {
    test(`${locale} home only lists its locale`, async ({ page }) => {
      await page.goto(path);
      const manifest = await articles(page);
      const expected = manifest
        .filter(
          (article) =>
            article.locale === locale && article.status === "published",
        )
        .map((article) => article.path)
        .sort();
      const otherLocale = new Set(
        manifest
          .filter((article) => article.locale !== locale)
          .map((article) => article.path),
      );

      expect(expected.length).toBeGreaterThan(0);
      const cards = page.getByTestId("article-card");
      await expect(cards.first()).toBeVisible();
      const hrefs = (await cards
        .locator("a")
        .evaluateAll((links) =>
          links.map((link) => link.getAttribute("href") || "").sort(),
        )) as string[];
      expect(hrefs).toEqual(expect.arrayContaining(expected));
      expect(hrefs.some((href) => otherLocale.has(href))).toBe(false);
      expect(
        hrefs.every((href) =>
          locale === "en"
            ? href.startsWith("/en/article/")
            : href.startsWith("/article/"),
        ),
      ).toBe(true);
    });
  }

  test("topbar switches between PT and EN", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        name: "Ideias que eu gostaria de ter entendido antes.",
      }),
    ).toBeVisible();

    const switcher = page.locator(".language-switch:visible");
    await expect(switcher.getByRole("link", { name: "EN" })).toHaveAttribute(
      "href",
      "/en/?lang=en",
    );
    await switcher.getByRole("link", { name: "EN" }).click();

    await expect(page).toHaveURL(/\/en\/\?lang=en$/);
    await expect(
      page.getByRole("heading", { name: "Ideas I wish I had earlier." }),
    ).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://vibegui.com/en/",
    );
  });

  test("articles use localized dates and back links", async ({ page }) => {
    await page.goto("/");
    const manifest = await articles(page);

    for (const locale of ["pt-BR", "en"] as const) {
      const article = manifest.find(
        (item) => item.locale === locale && item.status === "published",
      );
      expect(article).toBeTruthy();
      if (!article) continue;

      await page.goto(article.path);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        `https://vibegui.com${article.path}`,
      );
      const expectedDate = new Date(article.date).toLocaleDateString(
        locale === "en" ? "en-US" : "pt-BR",
        {
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: "UTC",
        },
      );
      await expect(page.locator("article time")).toHaveText(expectedDate);
      await expect(
        page.getByRole("link", {
          name: locale === "en" ? "← Back to writing" : "← Voltar aos textos",
        }),
      ).toHaveAttribute("href", locale === "en" ? "/en/" : "/");
    }
  });

  test("paired article links to its exact translation", async ({ page }) => {
    await page.goto("/");
    const manifest = await articles(page);
    const paired = manifest.find(
      (article) => article.status === "published" && article.alternatePath,
    );
    test.skip(!paired, "No translated article pair in the manifest");
    if (!paired?.alternatePath) return;

    await page.goto(paired.path);
    const label =
      paired.locale === "en" ? "Ler em português" : "Read in English";
    await expect(page.getByRole("link", { name: label })).toHaveAttribute(
      "href",
      `${paired.alternatePath}?lang=${paired.locale === "en" ? "pt" : "en"}`,
    );
  });

  test("visitor geolocation does not select a language", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      geolocation: { latitude: 38.7223, longitude: -9.1393 },
      permissions: ["geolocation"],
      extraHTTPHeaders: { "CF-IPCountry": "US" },
    });
    const page = await context.newPage();
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        name: "Ideias que eu gostaria de ter entendido antes.",
      }),
    ).toBeVisible();
    await context.close();
  });
});

function middleware(
  request: Request,
  next: () => Promise<Response> = async () =>
    new Response("asset response", { status: 418 }),
) {
  return onRequest({
    request,
    env: {
      ASSETS: { fetch: async () => new Response("asset") },
      ANALYTICS_BEACON_URL: "data:application/json,{}",
    },
    next,
    waitUntil: () => {},
  });
}

test.describe("Locale middleware", () => {
  test("negotiates English only on the home route", async () => {
    const home = await middleware(
      new Request("https://vibegui.com/", {
        headers: { "Accept-Language": "en-US,en;q=0.9" },
      }),
    );
    expect(home.status).toBe(302);
    expect(home.headers.get("location")).toBe("https://vibegui.com/en/");
    expect(home.headers.get("vary")).toBe("Accept-Language, Cookie");

    const article = await middleware(
      new Request("https://vibegui.com/article/exemplo", {
        headers: { "Accept-Language": "en-US,en;q=0.9" },
      }),
    );
    expect(article.status).toBe(418);
    expect(article.headers.get("location")).toBeNull();
    expect(article.headers.get("vary")).toBeNull();
  });

  test("cookie wins and explicit switches persist", async () => {
    const portuguese = await middleware(
      new Request("https://vibegui.com/", {
        headers: {
          Cookie: "vibegui_locale=pt",
          "Accept-Language": "en-US,en;q=0.9",
        },
      }),
    );
    expect(portuguese.status).toBe(418);
    expect(portuguese.headers.get("vary")).toBe("Accept-Language, Cookie");

    const explicit = await middleware(
      new Request("https://vibegui.com/?lang=en"),
    );
    expect(explicit.status).toBe(302);
    expect(explicit.headers.get("location")).toBe("https://vibegui.com/en/");
    expect(explicit.headers.get("set-cookie")).toContain(
      "vibegui_locale=en; Max-Age=31536000; Path=/; SameSite=Lax",
    );
  });

  test("country headers are ignored and stale editor route is gone", async () => {
    const home = await middleware(
      new Request("https://vibegui.com/", {
        headers: {
          "Accept-Language": "pt-BR,pt;q=0.9",
          "CF-IPCountry": "US",
        },
      }),
    );
    expect(home.status).toBe(418);

    const stale = await middleware(
      new Request("https://vibegui.com/bookmarks/edit"),
    );
    expect(stale.status).toBe(404);
  });
});
