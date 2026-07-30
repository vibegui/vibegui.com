import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../..");
const DIST = join(ROOT, "dist");

interface ManifestArticle {
  slug: string;
  locale: "pt-BR" | "en";
  translationKey: string;
  status: "draft" | "published";
  layout: "prose" | "story";
  path: string;
  alternatePath?: string;
}

interface OgManifest {
  images: Record<string, string>;
}

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf-8");
}

describe("Localized build and SEO", () => {
  const manifest = JSON.parse(
    readFileSync(join(DIST, "content/manifest.json"), "utf-8"),
  ) as { articles: ManifestArticle[] };
  const ogManifest = JSON.parse(
    readFileSync(join(DIST, "images/og/manifest.json"), "utf-8"),
  ) as OgManifest;

  test("manifest uses localized URLs and excludes drafts", () => {
    expect(
      manifest.articles.some((article) => article.locale === "pt-BR"),
    ).toBe(true);
    expect(manifest.articles.some((article) => article.locale === "en")).toBe(
      true,
    );

    for (const article of manifest.articles) {
      expect(article.status).toBe("published");
      expect(article.translationKey.length).toBeGreaterThan(0);
      expect(["prose", "story"]).toContain(article.layout);
      expect(article.path).toBe(
        article.locale === "en"
          ? `/en/article/${article.slug}/`
          : `/article/${article.slug}/`,
      );
      expect(existsSync(join(DIST, article.path.slice(1), "index.html"))).toBe(
        true,
      );
    }
  });

  test("alternates only point to real translation pairs", () => {
    for (const article of manifest.articles) {
      const alternate = manifest.articles.find(
        (candidate) =>
          candidate.translationKey === article.translationKey &&
          candidate.locale !== article.locale,
      );
      expect(article.alternatePath).toBe(alternate?.path);
    }
  });

  test("home shells have localized metadata and embedded manifests", () => {
    const pt = read("dist/index.html");
    const en = read("dist/en/index.html");

    expect(pt).toContain('<html lang="pt-BR">');
    expect(pt).toContain(
      "<title>vibegui — Guilherme Rodrigues sobre IA, liderança e software</title>",
    );
    expect(pt).toContain(
      'content="vibegui — Guilherme Rodrigues sobre IA, liderança e software"',
    );
    expect(pt).toContain('<link rel="canonical" href="https://vibegui.com/"');
    expect(pt).toContain('<meta property="og:locale" content="pt_BR"');
    expect(en).toContain('<html lang="en">');
    expect(en).toContain(
      "<title>vibegui — Guilherme Rodrigues on AI, leadership, and software</title>",
    );
    expect(en).toContain(
      'content="vibegui — Guilherme Rodrigues on AI, leadership, and software"',
    );
    expect(en).toContain(
      '<link rel="canonical" href="https://vibegui.com/en/"',
    );
    expect(en).toContain('<meta property="og:locale" content="en_US"');
    expect(pt).toContain(
      'content="Textos de Guilherme Rodrigues sobre liderança, IA, software, Brasil e futuros possíveis."',
    );
    expect(en).toContain(
      'content="Writing by Guilherme Rodrigues on leadership, AI, software, Brazil, and possible futures."',
    );
    expect(pt).not.toContain("sistema operacional pessoal");
    expect(en).not.toContain("personal AI OS");
    expect(pt).toContain('id="manifest-data"');
    expect(en).toContain('id="manifest-data"');
  });

  test("article pages expose canonical, language, and structured data", () => {
    for (const article of manifest.articles) {
      const html = read(`dist${article.path}/index.html`);
      expect(html).toContain(`<html lang="${article.locale}">`);
      expect(html).toContain(
        `<link rel="canonical" href="https://vibegui.com${article.path}"`,
      );
      expect(html).toContain(`"inLanguage":"${article.locale}"`);
      expect(html).toContain(`"translationKey":"${article.translationKey}"`);
      const image = `https://vibegui.com${ogManifest.images[`${article.locale}:${article.slug}`]}`;
      expect(html).toContain(`<meta property="og:image" content="${image}"`);
      expect(html).toContain('<meta property="og:image:width" content="1200"');
      expect(html).toContain('<meta property="og:image:height" content="630"');
      expect(html).toContain(
        '<meta property="og:image:type" content="image/png"',
      );
      expect(html).toContain(`<meta name="twitter:image" content="${image}"`);
      expect(html).toContain(
        `"image":{"@type":"ImageObject","url":"${image}","width":1200,"height":630,"encodingFormat":"image/png"}`,
      );
      expect(html.includes('hreflang="en"')).toBe(
        article.alternatePath !== undefined,
      );
    }
  });

  test("sitemap, feeds, robots, and redirects are localized", () => {
    const sitemap = read("dist/sitemap.xml");
    const robots = read("dist/robots.txt");
    const ptFeed = read("dist/feed.xml");
    const enFeed = read("dist/en/feed.xml");
    const redirects = read("dist/_redirects");
    const ptSlugs = new Set(
      manifest.articles
        .filter((article) => article.locale === "pt-BR")
        .map((article) => article.slug),
    );

    expect(sitemap).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(sitemap).toContain('hreflang="pt-BR"');
    expect(sitemap).toContain('hreflang="en"');
    expect(robots).toContain("Sitemap: https://vibegui.com/sitemap.xml");
    expect(ptFeed).toContain("<language>pt-BR</language>");
    expect(enFeed).toContain("<language>en</language>");

    for (const article of manifest.articles) {
      expect(sitemap).toContain(
        `<loc>https://vibegui.com${article.path}</loc>`,
      );
      if (article.locale === "en" && !ptSlugs.has(article.slug)) {
        expect(redirects).toContain(
          `/article/${article.slug} /en/article/${article.slug}/ 301`,
        );
        expect(redirects).toContain(
          `/article/${article.slug}/ /en/article/${article.slug}/ 301`,
        );
      }
    }
  });
});
