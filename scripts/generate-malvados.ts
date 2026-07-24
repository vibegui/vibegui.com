/**
 * Generate the /malvados mini-site — called from generate.ts.
 *
 * A fan-made browser for André Dahmer's Malvados strips, built from a local
 * scrape (content/malvados/strips.json + public/malvados/tirinhas/*). All
 * content belongs to André Dahmer — the pages carry a homage disclaimer.
 *
 * Writes fully static, self-contained pages:
 *   .build/malvados/index.html       grid of all strips (lazy images) + OCR full-text search
 *   .build/malvados/<n>/index.html   one page per strip (prev/next, original link)
 *   .build/malvados/busca.json       search index fetched on demand
 *
 * Zero-dependency and Node-compatible (Cloudflare Pages build).
 * Look & feel: gray, stark, malvados-like — independent from the blog.
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  escapeHtml,
  normalizeSearch,
  pageShell,
  searchScript,
} from "../lib/static-site.ts";

const BASE_URL = "https://vibegui.com";
const FONTS = "family=Archivo+Black";

const DISCLAIMER =
  "Site de homenagem ao André Dahmer — todo o conteúdo é dele. " +
  "Feito para os fãs acharem as tirinhas mais fácil que no site oficial.";

const CSS = `
  :root {
    --fundo: #1c1c1e;
    --painel: #262629;
    --tinta: #d9d9d6;
    --tinta-suave: #94948e;
    --borda: #3a3a3e;
    --sangue: #c0392b;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: var(--fundo);
    color: var(--tinta);
    font-family: system-ui, -apple-system, sans-serif;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
  a { color: var(--tinta); }
  .pagina { max-width: 74rem; margin: 0 auto; padding: 0 1.25rem 4rem; }
  .topo { text-align: center; padding: clamp(2rem, 6vh, 4rem) 0 1rem; }
  .topo h1 {
    font-family: "Archivo Black", system-ui, sans-serif;
    font-size: clamp(2.2rem, 7vw, 3.8rem);
    letter-spacing: .04em;
    line-height: 1;
    color: var(--tinta);
  }
  .topo h1 a { text-decoration: none; color: inherit; }
  .topo h1 .virgula { color: var(--sangue); }
  .disclaimer {
    max-width: 44rem;
    margin: 1.25rem auto 0;
    font-size: .85rem;
    color: var(--tinta-suave);
    text-wrap: pretty;
  }
  .disclaimer a { color: var(--tinta-suave); }
  .no-js .ferramentas { display: none; }
  .ferramentas { max-width: 44rem; margin: 1.5rem auto 0; }
  .busca {
    width: 100%;
    font: inherit;
    font-size: 1rem;
    color: var(--tinta);
    background: var(--painel);
    border: 1px solid var(--borda);
    border-radius: .4rem;
    padding: .6rem 1rem;
  }
  .busca::placeholder { color: var(--tinta-suave); }
  .busca:focus { outline: 2px solid var(--sangue); outline-offset: 1px; border-color: transparent; }
  .contagem { padding-top: .5rem; font-size: .85rem; color: var(--tinta-suave); min-height: 1.5em; }
  .aviso-busca { padding-top: .25rem; font-size: .78rem; color: var(--tinta-suave); }
  .grade {
    margin-top: 2rem;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 1rem;
  }
  .tirinha-card {
    display: flex;
    flex-direction: column;
    gap: .4rem;
    text-decoration: none;
    background: var(--painel);
    border: 1px solid var(--borda);
    border-radius: .3rem;
    padding: .6rem;
    transition: border-color .15s ease;
  }
  .tirinha-card:hover { border-color: var(--tinta-suave); }
  .tirinha-card img {
    width: 100%;
    height: 180px;
    object-fit: cover;
    object-position: top left;
    background: #fff;
    border-radius: .15rem;
  }
  .tirinha-card .num {
    font-size: .8rem;
    color: var(--tinta-suave);
    font-variant-numeric: tabular-nums;
  }
  .vazio { grid-column: 1 / -1; text-align: center; padding: 3rem 0; color: var(--tinta-suave); }
  /* detail page */
  .detalhe { max-width: 52rem; margin: 0 auto; }
  .detalhe .quadro {
    margin-top: 1.5rem;
    background: #fff;
    border-radius: .3rem;
    padding: 1rem;
    text-align: center;
  }
  .detalhe .quadro img { max-width: 100%; height: auto; }
  .meta {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 1rem;
    flex-wrap: wrap;
    margin-top: 1rem;
    font-size: .9rem;
    color: var(--tinta-suave);
  }
  .meta a { color: var(--tinta-suave); }
  .navegacao {
    display: flex;
    justify-content: space-between;
    gap: .75rem;
    margin-top: 1.5rem;
  }
  .navegacao a, .navegacao span {
    flex: 1;
    text-align: center;
    padding: .7rem .5rem;
    background: var(--painel);
    border: 1px solid var(--borda);
    border-radius: .3rem;
    text-decoration: none;
    font-variant-numeric: tabular-nums;
  }
  .navegacao span { opacity: .35; }
  .navegacao a:hover { border-color: var(--sangue); }
  .navegacao .indice-link { flex: 0 1 auto; padding-inline: 1.25rem; }
  .transcricao { margin-top: 1.5rem; font-size: .9rem; color: var(--tinta-suave); }
  .transcricao summary { cursor: pointer; }
  .transcricao p { margin-top: .5rem; font-style: italic; }
  footer {
    margin-top: 3rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--borda);
    text-align: center;
    font-size: .8rem;
    color: var(--tinta-suave);
  }
  footer a { color: var(--tinta-suave); }
`;

interface Strip {
  n: number;
  file: string;
  url: string;
  text: string;
}

const TITULO = `<h1><a href="/malvados">MALVADOS<span class="virgula">.</span></a></h1>`;

const RODAPE = `<footer>
  ${DISCLAIMER}<br>
  Visite o site oficial: <a href="https://www.malvados.com.br" rel="external">malvados.com.br</a>
</footer>`;

function landingHtml(strips: Strip[]): string {
  // newest (highest number) first
  const cards = [...strips]
    .reverse()
    .map(
      (
        s,
      ) => `    <a class="tirinha-card" href="/malvados/${s.n}" data-busca-item="${s.n}">
      <img src="/malvados/tirinhas/${s.file}" loading="lazy" decoding="async" alt="Tirinha #${s.n} dos Malvados" width="240" height="180">
      <span class="num">#${s.n}</span>
    </a>`,
    )
    .join("\n");

  const body = `<div class="pagina">
  <header class="topo">
    ${TITULO}
    <p class="disclaimer">${DISCLAIMER} Visite (e apoie) o site oficial: <a href="https://www.malvados.com.br" rel="external">malvados.com.br</a>.</p>
  </header>

  <div class="ferramentas">
    <input class="busca" type="search" data-busca placeholder="Buscar pelo texto das tirinhas…" aria-label="Buscar tirinhas">
    <p class="aviso-busca">A busca usa leitura automática (OCR) das imagens — nem todo texto foi lido perfeitamente.</p>
    <p class="contagem" data-busca-count aria-live="polite"></p>
  </div>

  <main class="grade">
${cards}
    <p class="vazio" data-busca-vazio hidden>Nenhuma tirinha encontrada. Tenta outra palavra — o OCR é malvado.</p>
  </main>

  ${RODAPE}
</div>
<script>${searchScript("/malvados/busca.json")}</script>`;

  return pageShell(
    {
      title: "Malvados — buscador de tirinhas",
      description: `${DISCLAIMER} ${strips.length} tirinhas com busca por texto.`,
      url: `${BASE_URL}/malvados`,
      fonts: FONTS,
    },
    `    <style>${CSS}</style>`,
    body,
  );
}

function stripHtml(
  s: Strip,
  anterior: Strip | null,
  proximo: Strip | null,
): string {
  const original = s.url
    ? `<a href="${escapeHtml(s.url)}" rel="external">ver no site original</a>`
    : "";
  const transcricao = s.text
    ? `    <details class="transcricao">
      <summary>Transcrição automática (OCR)</summary>
      <p>${escapeHtml(s.text)}</p>
    </details>`
    : "";

  const body = `<div class="pagina detalhe">
  <header class="topo">
    ${TITULO}
  </header>
  <main>
    <figure class="quadro">
      <img src="/malvados/tirinhas/${s.file}" alt="Tirinha #${s.n} dos Malvados" decoding="async">
    </figure>
    <div class="meta">
      <span>Tirinha #${s.n} · André Dahmer</span>
      ${original}
    </div>
    <nav class="navegacao" aria-label="Navegar entre tirinhas">
      ${anterior ? `<a href="/malvados/${anterior.n}" rel="prev">← #${anterior.n}</a>` : "<span>←</span>"}
      <a class="indice-link" href="/malvados">todas</a>
      ${proximo ? `<a href="/malvados/${proximo.n}" rel="next">#${proximo.n} →</a>` : "<span>→</span>"}
    </nav>
${transcricao}
  </main>
  ${RODAPE}
</div>
<script>
document.addEventListener("keydown", function (e) {
  if (e.key === "ArrowLeft") { var a = document.querySelector('[rel="prev"]'); if (a) location.href = a.href; }
  if (e.key === "ArrowRight") { var a2 = document.querySelector('[rel="next"]'); if (a2) location.href = a2.href; }
});
</script>`;

  return pageShell(
    {
      title: `Malvados #${s.n}`,
      description: `Tirinha #${s.n} dos Malvados, de André Dahmer. ${DISCLAIMER}`,
      url: `${BASE_URL}/malvados/${s.n}`,
      image: `${BASE_URL}/malvados/tirinhas/${s.file}`,
      ogType: "article",
      fonts: FONTS,
    },
    `    <style>${CSS}</style>`,
    body,
  );
}

export function generateMalvados(contentDir: string, buildDir: string): number {
  const dataPath = join(contentDir, "malvados", "strips.json");
  if (!existsSync(dataPath)) return 0;
  const strips: Strip[] = JSON.parse(readFileSync(dataPath, "utf-8"));
  if (strips.length === 0) return 0;
  strips.sort((a, b) => a.n - b.n);

  const outDir = join(buildDir, "malvados");
  mkdirSync(outDir, { recursive: true });

  writeFileSync(join(outDir, "index.html"), landingHtml(strips));

  writeFileSync(
    join(outDir, "busca.json"),
    JSON.stringify(
      strips.map((s) => ({ k: String(s.n), t: normalizeSearch(s.text) })),
    ),
  );

  for (let i = 0; i < strips.length; i++) {
    const dir = join(outDir, String(strips[i].n));
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "index.html"),
      stripHtml(strips[i], strips[i - 1] ?? null, strips[i + 1] ?? null),
    );
  }

  return strips.length;
}
