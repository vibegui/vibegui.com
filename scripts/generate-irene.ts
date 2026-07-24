/**
 * Generate the /irene mini-site (Poesia da Irene) — called from generate.ts.
 *
 * Reads content/irene/*.md and writes fully static, self-contained pages:
 *   .build/irene/index.html         landing: 5 most recent poems + full index + search
 *   .build/irene/<slug>/index.html  one page per poem (prev/next navigation)
 *   .build/irene/busca.json         search index fetched on demand by the landing
 *
 * Zero-dependency and Node-compatible (runs on Cloudflare Pages without
 * installed deps). Look & feel: "caderno" — warm paper, Alegreya, sage accent.
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

const BASE_URL = "https://vibegui.com";
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
  html { scroll-behavior: smooth; }
  @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
  body {
    background: var(--papel);
    color: var(--tinta);
    font-family: "Alegreya", Georgia, serif;
    line-height: 1.65;
    -webkit-font-smoothing: antialiased;
  }
  a { color: var(--verde-escuro); }
  .pagina { max-width: 40rem; margin: 0 auto; padding: 0 1.5rem 4rem; }
  .capa { text-align: center; padding: clamp(2.5rem, 8vh, 5rem) 0 1.5rem; }
  .capa h1 {
    font-size: clamp(2.2rem, 7vw, 3.4rem);
    font-weight: 500;
    line-height: 1.1;
    text-wrap: balance;
  }
  .capa h1 a { color: inherit; text-decoration: none; }
  .capa .autora { margin-top: .7rem; font-style: italic; font-size: 1.2rem; color: var(--verde); }
  .capa .nota {
    margin-top: 1rem;
    font-family: "Alegreya Sans", system-ui, sans-serif;
    font-size: .95rem;
    color: var(--tinta-suave);
  }
  .no-js .ferramentas { display: none; }
  .ferramentas { padding: 1.25rem 0 .25rem; font-family: "Alegreya Sans", system-ui, sans-serif; }
  .busca {
    width: 100%;
    font: inherit;
    font-size: 1rem;
    color: var(--tinta);
    background: #fff;
    border: 1px solid var(--linha);
    border-radius: 999px;
    padding: .55rem 1.1rem;
  }
  .busca::placeholder { color: var(--tinta-suave); }
  .busca:focus { outline: 2px solid var(--verde); outline-offset: 1px; border-color: transparent; }
  .contagem { padding-top: .5rem; font-size: .85rem; color: var(--tinta-suave); min-height: 1.6em; }
  .poema { padding: clamp(2rem, 5vh, 3rem) 0; }
  .poema + .poema { border-top: 1px solid var(--linha); }
  .poema h2, .poema h1 { font-size: clamp(1.5rem, 4vw, 1.9rem); font-weight: 500; line-height: 1.2; text-wrap: balance; }
  .poema h2 a { color: inherit; text-decoration: none; }
  .poema h2 a:hover { color: var(--verde-escuro); }
  .poema time {
    display: block;
    margin-top: .3rem;
    font-family: "Alegreya Sans", system-ui, sans-serif;
    font-size: .85rem;
    color: var(--tinta-suave);
  }
  .texto { margin-top: 1.4rem; font-size: 1.15rem; max-width: 60ch; }
  .texto p { margin-block: 1.1em; text-wrap: pretty; }
  .texto p:first-child { margin-top: 0; }
  .divisor {
    text-align: center;
    color: var(--tinta-suave);
    padding: 2.5rem 0 .5rem;
    font-size: 1.1rem;
    letter-spacing: .5em;
  }
  .indice h2 {
    font-size: 1.4rem;
    font-weight: 500;
    padding: 1.5rem 0 .25rem;
  }
  .grupo-ano { margin-top: 1.25rem; }
  .grupo-ano > h3 {
    font-family: "Alegreya Sans", system-ui, sans-serif;
    font-size: .85rem;
    font-weight: 500;
    color: var(--tinta-suave);
    border-bottom: 1px solid var(--linha);
    padding-bottom: .3rem;
    font-variant-numeric: tabular-nums;
  }
  .grupo-ano ol { list-style: none; margin-top: .4rem; }
  .grupo-ano a {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 1rem;
    padding: .35rem .5rem;
    margin-inline: -.5rem;
    border-radius: .35rem;
    color: var(--tinta);
    text-decoration: none;
    line-height: 1.35;
  }
  .grupo-ano a:hover { background: var(--papel-2); color: var(--verde-escuro); }
  .grupo-ano a time {
    font-family: "Alegreya Sans", system-ui, sans-serif;
    font-size: .78rem;
    color: var(--tinta-suave);
    white-space: nowrap;
  }
  .vazio { padding: 2.5rem 0; font-style: italic; color: var(--tinta-suave); text-align: center; }
  .voltar {
    display: inline-block;
    font-family: "Alegreya Sans", system-ui, sans-serif;
    font-size: .9rem;
    text-decoration: none;
    margin-top: 2.5rem;
  }
  .navegacao {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    margin-top: 3rem;
    padding-top: 1.5rem;
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
    margin-top: 3rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--linha);
    text-align: center;
    font-family: "Alegreya Sans", system-ui, sans-serif;
    font-size: .9rem;
    color: var(--tinta-suave);
  }
`;

interface IrenePoem {
  slug: string;
  title: string;
  date: string;
  content: string;
}

function poemArticle(p: IrenePoem, heading: "h1" | "h2"): string {
  const titleHtml =
    heading === "h2"
      ? `<h2><a href="/irene/${p.slug}">${escapeHtml(p.title)}</a></h2>`
      : `<h1>${escapeHtml(p.title)}</h1>`;
  return `<article class="poema">
  <header>
    ${titleHtml}
    <time datetime="${p.date}">${formatDatePt(p.date)}</time>
  </header>
  <div class="texto">
${poemBodyHtml(p.content)}
  </div>
</article>`;
}

function landingHtml(poems: IrenePoem[]): string {
  const recentes = poems.slice(0, 5);
  const anos = new Map<string, IrenePoem[]>();
  for (const p of poems) {
    const ano = p.date.slice(0, 4);
    if (!anos.has(ano)) anos.set(ano, []);
    anos.get(ano)!.push(p);
  }

  const grupos = [...anos.entries()]
    .map(
      ([ano, lista]) => `    <section class="grupo-ano" data-busca-grupo>
      <h3>${ano}</h3>
      <ol>
${lista
  .map(
    (p) => `        <li data-busca-item="${p.slug}"><a href="/irene/${p.slug}">
          <span>${escapeHtml(p.title)}</span>
          <time datetime="${p.date}">${p.date.slice(8, 10)}/${p.date.slice(5, 7)}</time>
        </a></li>`,
  )
  .join("\n")}
      </ol>
    </section>`,
    )
    .join("\n");

  const body = `<div class="pagina">
  <header class="capa">
    <h1>Poesia da Irene</h1>
    <p class="autora">Irene Diaz Rodrigues</p>
    <p class="nota">${poems.length} poesias · ${poems[poems.length - 1].date.slice(0, 4)}–${poems[0].date.slice(0, 4)}</p>
  </header>

  <div class="ferramentas">
    <input class="busca" type="search" data-busca placeholder="Buscar um verso, um título…" aria-label="Buscar poesias">
    <p class="contagem" data-busca-count aria-live="polite"></p>
  </div>

  <main>
    <section data-busca-hide>
${recentes.map((p) => poemArticle(p, "h2")).join("\n")}
      <p class="divisor" aria-hidden="true">✳ ✳ ✳</p>
    </section>

    <section class="indice" aria-label="Todas as poesias">
      <h2 data-busca-hide>Todas as poesias</h2>
${grupos}
      <p class="vazio" data-busca-vazio hidden>Nenhuma poesia encontrada por aqui…</p>
    </section>
  </main>

  <footer>♥ Poesias de Irene Diaz Rodrigues</footer>
</div>
<script>${searchScript("/irene/busca.json")}</script>`;

  return pageShell(
    {
      title: "Poesia da Irene",
      description: `${poems.length} poesias de Irene Diaz Rodrigues.`,
      url: `${BASE_URL}/irene`,
      fonts: FONTS,
    },
    `    <style>${CSS}</style>`,
    body,
  );
}

function poemHtml(
  p: IrenePoem,
  anterior: IrenePoem | null,
  proximo: IrenePoem | null,
): string {
  const firstVerses = p.content
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" / ");

  const body = `<div class="pagina">
  <header class="capa">
    <h1 style="font-size:1.4rem"><a href="/irene">Poesia da Irene</a></h1>
  </header>
  <main>
${poemArticle(p, "h1")}
    <nav class="navegacao" aria-label="Outras poesias">
      <a href="${anterior ? `/irene/${anterior.slug}` : "/irene"}" rel="prev">${
        anterior ? `← ${escapeHtml(anterior.title)}` : "← Todas as poesias"
      }</a>
      <a href="${proximo ? `/irene/${proximo.slug}` : "/irene"}" rel="next">${
        proximo ? `${escapeHtml(proximo.title)} →` : "Todas as poesias →"
      }</a>
    </nav>
    <a class="voltar" href="/irene">↑ Todas as poesias</a>
  </main>
  <footer>♥ Poesias de Irene Diaz Rodrigues</footer>
</div>
<script>
document.addEventListener("keydown", function (e) {
  if (e.key === "ArrowLeft") { var a = document.querySelector('[rel="prev"]'); if (a) location.href = a.href; }
  if (e.key === "ArrowRight") { var a2 = document.querySelector('[rel="next"]'); if (a2) location.href = a2.href; }
});
</script>`;

  return pageShell(
    {
      title: `${p.title} — Poesia da Irene`,
      description: firstVerses,
      url: `${BASE_URL}/irene/${p.slug}`,
      ogType: "article",
      fonts: FONTS,
    },
    `    <style>${CSS}</style>`,
    body,
  );
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

  const outDir = join(buildDir, "irene");
  mkdirSync(outDir, { recursive: true });

  writeFileSync(join(outDir, "index.html"), landingHtml(poems));

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
      poemHtml(poems[i], poems[i - 1] ?? null, poems[i + 1] ?? null),
    );
  }

  return poems.length;
}
