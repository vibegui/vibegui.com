/**
 * Generate the Poesia da Irene mini-site — called from generate.ts.
 *
 * Reads content/irene/*.md and writes fully static, self-contained pages.
 * Layout: index sidebar + ONE poem open at a time, side by side on desktop
 * (sidebar pinned to the viewport, scrolling within itself); on mobile the
 * index starts closed above the poem. The root shows the most recent poem.
 *
 * The site is built TWICE (see SITES): under /irene for vibegui.com, and
 * under /_dominio-irene with root-relative links, poesiadairene.com
 * canonicals, sitemap.xml and robots.txt — served on that domain by the
 * host-based rewrite in functions/_middleware.ts.
 *
 * Zero-dependency and Node-compatible (runs on Cloudflare Pages without
 * installed deps). Look & feel: "caderno" — warm paper, Alegreya, sage accent.
 * Works without JS: the sidebar is a native <details> (open by default in the
 * markup), links are plain anchors; search controls are hidden via .no-js.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { getAllContent } from "../lib/articles-reader.ts";
import {
  escapeHtml,
  normalizeSearch,
  formatDatePt,
  poemBodyHtml,
  pageShell,
  searchScript,
} from "../lib/static-site.ts";

interface Site {
  base: string; // prefixo dos links internos: "/irene" ou ""
  origin: string; // origem canônica das URLs
  out: string; // diretório dentro de .build/
  dominio: boolean; // build de domínio dedicado: gera sitemap + robots
}

const SITES: Site[] = [
  {
    base: "/irene",
    origin: "https://vibegui.com",
    out: "irene",
    dominio: false,
  },
  {
    base: "",
    origin: "https://poesiadairene.com",
    out: "_dominio-irene",
    dominio: true,
  },
];

const OG_IMAGE = "https://vibegui.com/images/og-poesiadairene.png";
const ICONE = "https://vibegui.com/images/icone-poesiadairene.png";
const FAVICON =
  "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2064%2064%22%3E%3Crect%20width%3D%2264%22%20height%3D%2264%22%20fill%3D%22%23faf7f0%22%2F%3E%3Ctext%20x%3D%2232%22%20y%3D%2250%22%20font-family%3D%22Georgia%2C%27Times%20New%20Roman%27%2Cserif%22%20font-size%3D%2254%22%20text-anchor%3D%22middle%22%20fill%3D%22%232b2822%22%3Ei%3C%2Ftext%3E%3C%2Fsvg%3E";
const FONTS =
  "family=Alegreya:ital,wght@0,400;0,500;1,400&family=Alegreya+Sans:wght@400;500";

const CSS = `
  :root {
    --papel: #faf7f0;
    --papel-2: #f1ede2;
    --tinta: #2b2822;
    --tinta-suave: #6b6353;
    --verde: #47634f;
    --verde-escuro: #35503d;
    --linha: #ddd6c6;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  [hidden] { display: none !important; }
  body {
    background: var(--papel);
    color: var(--tinta);
    font-family: "Alegreya", Georgia, serif;
    line-height: 1.65;
    -webkit-font-smoothing: antialiased;
  }
  a { color: var(--verde-escuro); }
  .capa { text-align: center; padding: clamp(1.5rem, 5vh, 3rem) 0 2rem; }
  .capa h1 {
    font-size: clamp(1.9rem, 5vw, 2.6rem);
    font-weight: 500;
    line-height: 1.1;
    text-wrap: balance;
  }
  .capa h1 a { color: inherit; text-decoration: none; }
  .capa .autora { margin-top: .4rem; font-style: italic; font-size: 1.1rem; color: var(--verde); }
  .layout { min-height: 100dvh; }
  .leitura {
    min-width: 0;
    max-width: 46rem;
    margin: 0 auto;
    padding: 0 1.5rem 4rem;
  }
  /* ---------- índice ---------- */
  .sumario { font-family: "Alegreya Sans", system-ui, sans-serif; }
  .sumario summary {
    cursor: pointer;
    list-style: none;
    display: inline-block;
    font-size: 1rem;
    color: var(--verde-escuro);
    border: 1px solid var(--linha);
    border-radius: 999px;
    padding: .5rem 1.1rem;
    user-select: none;
  }
  .sumario summary::before { content: "☰ "; }
  .sumario summary::-webkit-details-marker { display: none; }
  .sumario summary:hover { background: var(--papel-2); }
  .sumario-inner { padding: 1.5rem .25rem 0; }
  .no-js .busca-area { display: none; }
  .busca {
    width: 100%;
    font: inherit;
    font-size: 1rem;
    color: var(--tinta);
    background: #fff;
    border: 1px solid var(--linha);
    border-radius: 999px;
    padding: .6rem 1.1rem;
  }
  .busca::placeholder { color: var(--tinta-suave); }
  .busca:focus { outline: 2px solid var(--verde); outline-offset: 1px; border-color: transparent; }
  .contagem { padding-top: .4rem; font-size: .8rem; color: var(--tinta-suave); min-height: 1.4em; }
  .grupo-ano { margin-top: 1.9rem; }
  .grupo-ano > h3 {
    font-size: .85rem;
    font-weight: 500;
    color: var(--tinta-suave);
    border-bottom: 1px solid var(--linha);
    padding-bottom: .4rem;
    font-variant-numeric: tabular-nums;
  }
  .grupo-ano ol { list-style: none; margin-top: .6rem; }
  .grupo-ano a {
    display: block;
    padding: .5rem .65rem;
    margin-inline: -.65rem;
    border-radius: .4rem;
    color: var(--tinta);
    text-decoration: none;
    font-size: 1rem;
    line-height: 1.4;
  }
  .grupo-ano a:hover { background: var(--papel-2); color: var(--verde-escuro); }
  .grupo-ano a[aria-current="page"] {
    background: var(--verde);
    color: var(--papel);
  }
  .vazio { padding: 1.5rem 0; font-style: italic; color: var(--tinta-suave); font-size: .9rem; }
  /* ---------- poema ---------- */
  .poema h2 {
    font-size: clamp(1.6rem, 4vw, 2.1rem);
    font-weight: 500;
    line-height: 1.15;
    text-wrap: balance;
  }
  .poema time {
    display: block;
    margin-top: .35rem;
    font-family: "Alegreya Sans", system-ui, sans-serif;
    font-size: .85rem;
    color: var(--tinta-suave);
  }
  .texto { margin-top: 1.6rem; font-size: 1.18rem; max-width: 58ch; }
  .texto p { margin-block: 1.1em; text-wrap: pretty; }
  .texto p:first-child { margin-top: 0; }
  .navegacao {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    margin-top: 3rem;
    padding-top: 1.25rem;
    border-top: 1px solid var(--linha);
    font-family: "Alegreya Sans", system-ui, sans-serif;
    font-size: .95rem;
  }
  .navegacao a {
    text-decoration: none;
    max-width: 45%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .navegacao a:hover { text-decoration: underline; }
  footer {
    margin-top: 3.5rem;
    text-align: center;
    font-family: "Alegreya Sans", system-ui, sans-serif;
    font-size: .85rem;
    color: var(--tinta-suave);
  }
  /* ---------- mobile: índice empilhado acima do conteúdo ---------- */
  .sumario { padding: 1.25rem 1.5rem 0; }
  .sumario[open] { padding-bottom: 2rem; border-bottom: 1px solid var(--linha); }
  /* ---------- desktop: split real — sidebar à esquerda, conteúdo à direita ---------- */
  @media (min-width: 58rem) {
    .layout {
      display: grid;
      grid-template-columns: minmax(20rem, 24rem) minmax(0, 1fr);
    }
    /* sidebar sempre visível, presa na altura da tela, rolando por dentro;
       a página só rola pelo conteúdo da direita */
    .sumario {
      background: var(--papel-2);
      border-right: 1px solid var(--linha);
      padding: 2rem 2rem 3rem;
      position: sticky;
      top: 0;
      height: 100dvh;
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-width: thin;
    }
    .sumario[open] { padding-bottom: 3rem; border-bottom: none; }
    .sumario summary { display: none; }
    .sumario-inner { padding-top: 0; }
    .grupo-ano a:hover { background: var(--papel); }
  }
`;

interface IrenePoem {
  slug: string;
  title: string;
  date: string;
  content: string;
}

function sumarioHtml(
  poems: IrenePoem[],
  currentSlug: string,
  base: string,
): string {
  const anos = new Map<string, IrenePoem[]>();
  for (const p of poems) {
    const ano = p.date.slice(0, 4);
    if (!anos.has(ano)) anos.set(ano, []);
    anos.get(ano)!.push(p);
  }
  const grupos = [...anos.entries()]
    .map(
      ([ano, lista]) => `      <section class="grupo-ano" data-busca-grupo>
        <h3>${ano}</h3>
        <ol>
${lista
  .map(
    (p) =>
      `          <li data-busca-item="${p.slug}"><a href="${base}/${p.slug}"${
        p.slug === currentSlug ? ' aria-current="page"' : ""
      }>${escapeHtml(p.title)}</a></li>`,
  )
  .join("\n")}
        </ol>
      </section>`,
    )
    .join("\n");

  return `  <details class="sumario" open>
    <summary>Índice</summary>
    <nav class="sumario-inner" aria-label="Todas as poesias">
      <div class="busca-area">
        <input class="busca" type="search" data-busca placeholder="Buscar um verso, um título…" aria-label="Buscar poesias">
        <p class="contagem" data-busca-count aria-live="polite"></p>
      </div>
${grupos}
      <p class="vazio" data-busca-vazio hidden>Nenhuma poesia encontrada…</p>
    </nav>
  </details>`;
}

const SCRIPT_EXTRA = `
(function () {
  var sumario = document.querySelector(".sumario");
  var desktop = window.matchMedia("(min-width: 58rem)");
  // desktop: sempre aberto (sem botão); mobile: começa fechado
  // (sem JS fica aberto, navegável por âncoras)
  if (!desktop.matches) sumario.open = false;
  desktop.addEventListener("change", function (e) { sumario.open = e.matches; });
  document.addEventListener("keydown", function (e) {
    if (e.target && e.target.tagName === "INPUT") return;
    if (e.key === "ArrowLeft") { var a = document.querySelector('[rel="prev"]'); if (a) location.href = a.href; }
    if (e.key === "ArrowRight") { var b = document.querySelector('[rel="next"]'); if (b) location.href = b.href; }
  });
})();
`;

function poemPage(
  poems: IrenePoem[],
  i: number,
  opts: { canonicalRoot: boolean },
  site: Site,
): string {
  const p = poems[i];
  const anterior = poems[i - 1] ?? null; // mais recente
  const proximo = poems[i + 1] ?? null; // mais antiga
  const home = site.base || "/";
  const anoMin = poems[poems.length - 1].date.slice(0, 4);
  const anoMax = poems[0].date.slice(0, 4);
  const firstVerses = p.content
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" / ");

  const body = `<div class="layout">
${sumarioHtml(poems, p.slug, site.base)}

  <main class="leitura">
    <header class="capa">
      <h1><a href="${home}">Poesia da Irene</a></h1>
      <p class="autora">Irene Diaz Rodrigues</p>
    </header>
    <article class="poema">
      <header>
        <h2>${escapeHtml(p.title)}</h2>
        <time datetime="${p.date}">${formatDatePt(p.date)}</time>
      </header>
      <div class="texto">
${poemBodyHtml(p.content)}
      </div>
    </article>
    <nav class="navegacao" aria-label="Outras poesias">
      ${
        anterior
          ? `<a href="${site.base}/${anterior.slug}" rel="prev">← ${escapeHtml(anterior.title)}</a>`
          : "<span></span>"
      }
      ${
        proximo
          ? `<a href="${site.base}/${proximo.slug}" rel="next">${escapeHtml(proximo.title)} →</a>`
          : "<span></span>"
      }
    </nav>
    <footer>♥ ${poems.length} poesias de Irene Diaz Rodrigues</footer>
  </main>
</div>
<script>${searchScript(`${site.base}/busca.json`)}${SCRIPT_EXTRA}</script>`;

  const jsonLd = JSON.stringify(
    opts.canonicalRoot
      ? {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Poesia da Irene",
          inLanguage: "pt-BR",
          author: { "@type": "Person", name: "Irene Diaz Rodrigues" },
        }
      : {
          "@context": "https://schema.org",
          "@type": "CreativeWork",
          name: p.title,
          datePublished: p.date,
          inLanguage: "pt-BR",
          author: { "@type": "Person", name: "Irene Diaz Rodrigues" },
        },
  );

  return pageShell(
    {
      title: opts.canonicalRoot
        ? "Poesia da Irene — poemas de Irene Diaz Rodrigues"
        : `${p.title} — Poesia da Irene`,
      description: opts.canonicalRoot
        ? `Todas as poesias de Irene Diaz Rodrigues: ${poems.length} poemas escritos entre ${anoMin} e ${anoMax}, com busca por verso e título.`
        : `${firstVerses} — poema de Irene Diaz Rodrigues, ${formatDatePt(p.date)}.`,
      url: opts.canonicalRoot
        ? `${site.origin}${site.base || "/"}`
        : `${site.origin}${site.base}/${p.slug}`,
      image: OG_IMAGE,
      ogType: opts.canonicalRoot ? "website" : "article",
      fonts: FONTS,
    },
    `    <link rel="icon" href="${FAVICON}">
    <link rel="apple-touch-icon" href="${ICONE}">
    <meta name="theme-color" content="#faf7f0">
    <meta property="og:locale" content="pt_BR">
    <script type="application/ld+json">${jsonLd}</script>
    <style>${CSS}</style>`,
    body,
  );
}

function buildSite(poems: IrenePoem[], buildDir: string, site: Site): void {
  const outDir = join(buildDir, site.out);
  mkdirSync(outDir, { recursive: true });

  // raiz = a poesia mais recente, com o índice do lado
  writeFileSync(
    join(outDir, "index.html"),
    poemPage(poems, 0, { canonicalRoot: true }, site),
  );

  writeFileSync(
    join(outDir, "busca.json"),
    JSON.stringify(
      poems.map((p) => ({
        k: p.slug,
        t: normalizeSearch(`${p.title} ${p.content}`),
      })),
    ),
  );

  for (let i = 0; i < poems.length; i++) {
    const dir = join(outDir, poems[i].slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "index.html"),
      poemPage(poems, i, { canonicalRoot: false }, site),
    );
  }

  if (site.dominio) {
    const urls = [
      `${site.origin}/`,
      ...poems.map((p) => `${site.origin}/${p.slug}`),
    ];
    writeFileSync(
      join(outDir, "sitemap.xml"),
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
        .map((u) => `  <url><loc>${u}</loc></url>`)
        .join("\n")}\n</urlset>\n`,
    );
    writeFileSync(
      join(outDir, "robots.txt"),
      `User-agent: *\nAllow: /\nSitemap: ${site.origin}/sitemap.xml\n`,
    );
  }
}

export function generateIrene(contentDir: string, buildDir: string): number {
  const poems: IrenePoem[] = getAllContent(join(contentDir, "irene"))
    .filter((p) => p.slug && p.title && p.content)
    .map((p) => ({
      slug: p.slug,
      title: p.title,
      date: p.date,
      content: p.content,
    }));
  if (poems.length === 0) return 0;
  // getAllContent already sorts by date desc (newest first)

  for (const site of SITES) buildSite(poems, buildDir, site);
  return poems.length;
}
