/**
 * Generate the Malvados strip-browser mini-site — called from generate.ts.
 *
 * A fan-made browser for André Dahmer's Malvados strips, built from a local
 * scrape (content/malvados/strips.json + public/malvados/tirinhas/*). All
 * content belongs to André Dahmer — the pages carry a homage disclaimer.
 *
 * The site is built TWICE (see SITES): under /malvados for vibegui.com, and
 * under /_dominio-malvados with root-relative links, buscamalvados.com
 * canonicals, sitemap.xml and robots.txt — served on that domain by the
 * host-based rewrite in functions/_middleware.ts. Strip images always live at
 * /malvados/tirinhas/* (excluded from the rewrite via public/_routes.json).
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

interface Site {
  base: string; // prefixo dos links internos: "/malvados" ou ""
  origin: string; // origem canônica das URLs
  out: string; // diretório dentro de .build/
  dominio: boolean; // build de domínio dedicado: gera sitemap + robots
}

const SITES: Site[] = [
  {
    base: "/malvados",
    origin: "https://vibegui.com",
    out: "malvados",
    dominio: false,
  },
  {
    base: "",
    origin: "https://buscamalvados.com",
    out: "_dominio-malvados",
    dominio: true,
  },
];

const OG_IMAGE = "https://vibegui.com/images/og-buscamalvados.png";
const ICONE = "https://vibegui.com/images/icone-buscamalvados.png";
const FAVICON =
  "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2064%2064%22%3E%3Crect%20width%3D%2264%22%20height%3D%2264%22%20fill%3D%22%231c1c1e%22%2F%3E%3Ctext%20x%3D%2232%22%20y%3D%2248%22%20font-family%3D%22Arial%20Black%2CArial%2Csans-serif%22%20font-weight%3D%22900%22%20font-size%3D%2246%22%20text-anchor%3D%22middle%22%20fill%3D%22%23d9d9d6%22%3Em%3C%2Ftext%3E%3C%2Fsvg%3E";
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
  [hidden] { display: none !important; }
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
  .ordenar {
    display: flex;
    align-items: center;
    gap: .4rem;
    padding-top: .6rem;
    font-size: .82rem;
    color: var(--tinta-suave);
  }
  .ordenar button {
    font: inherit;
    font-size: .82rem;
    color: var(--tinta);
    background: transparent;
    border: 1px solid var(--borda);
    border-radius: 999px;
    padding: .25rem .7rem;
    cursor: pointer;
  }
  .ordenar button[aria-pressed="true"] {
    background: var(--tinta);
    color: var(--fundo);
    border-color: transparent;
  }
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

function titulo(site: Site): string {
  return `<h1><a href="${site.base || "/"}">MALVADOS<span class="virgula">.</span></a></h1>`;
}

const RODAPE = `<footer>
  ${DISCLAIMER}<br>
  Visite o site oficial: <a href="https://www.malvados.com.br" rel="external">malvados.com.br</a>
</footer>`;

function headExtra(jsonLd: string): string {
  return `    <link rel="icon" href="${FAVICON}">
    <link rel="apple-touch-icon" href="${ICONE}">
    <meta name="theme-color" content="#1c1c1e">
    <meta property="og:locale" content="pt_BR">
    <script type="application/ld+json">${jsonLd}</script>
    <style>${CSS}</style>`;
}

function landingHtml(strips: Strip[], site: Site): string {
  // newest (highest number) first
  const cards = [...strips]
    .reverse()
    .map(
      (
        s,
      ) => `    <a class="tirinha-card" href="${site.base}/${s.n}" data-busca-item="${s.n}">
      <img src="/malvados/tirinhas/${s.file}" loading="lazy" decoding="async" alt="Tirinha #${s.n} dos Malvados" width="240" height="180">
      <span class="num">#${s.n}</span>
    </a>`,
    )
    .join("\n");

  const body = `<div class="pagina">
  <header class="topo">
    ${titulo(site)}
    <p class="disclaimer">${DISCLAIMER} Visite (e apoie) o site oficial: <a href="https://www.malvados.com.br" rel="external">malvados.com.br</a>.</p>
  </header>

  <div class="ferramentas">
    <input class="busca" type="search" data-busca placeholder="Buscar pelo texto das tirinhas…" aria-label="Buscar tirinhas">
    <p class="aviso-busca">A busca usa leitura automática (OCR) das imagens — nem todo texto foi lido perfeitamente.</p>
    <div class="ordenar" role="group" aria-label="Ordenar tirinhas">
      Ordenar:
      <button type="button" data-ordem="recentes" aria-pressed="true">mais recentes</button>
      <button type="button" data-ordem="vistas" aria-pressed="false">mais vistas</button>
    </div>
    <p class="contagem" data-busca-count aria-live="polite"></p>
  </div>

  <main class="grade">
${cards}
    <p class="vazio" data-busca-vazio hidden>Nenhuma tirinha encontrada. Tenta outra palavra — o OCR é malvado.</p>
  </main>

  ${RODAPE}
</div>
<script>${searchScript(`${site.base}/busca.json`)}
(function () {
  var grade = document.querySelector(".grade");
  var vazio = grade.querySelector("[data-busca-vazio]");
  var botoes = document.querySelectorAll(".ordenar button");
  var vistas = null; // { numero: views }
  function numeroDe(card) {
    return Number(card.getAttribute("data-busca-item")) || 0;
  }
  function ordenar(modo) {
    var cards = Array.prototype.slice.call(grade.querySelectorAll(".tirinha-card"));
    cards.sort(function (a, b) {
      if (modo === "vistas" && vistas) {
        var va = vistas[numeroDe(a)] || 0;
        var vb = vistas[numeroDe(b)] || 0;
        if (vb !== va) return vb - va;
      }
      return numeroDe(b) - numeroDe(a);
    });
    for (var i = 0; i < cards.length; i++) grade.appendChild(cards[i]);
    grade.appendChild(vazio);
  }
  function aplicar(modo, botao) {
    botoes.forEach(function (b) { b.setAttribute("aria-pressed", String(b === botao)); });
    if (modo === "vistas" && !vistas) {
      fetch("https://mcp.vibegui.com/popular?site=buscamalvados.com&days=90")
        .then(function (r) { return r.json(); })
        .then(function (data) {
          vistas = {};
          (data.items || []).forEach(function (item) {
            var partes = String(item.path || "").split("/").filter(Boolean);
            var n = Number(partes[partes.length - 1]);
            if (n > 0) vistas[n] = (vistas[n] || 0) + (item.views || 0);
          });
          ordenar("vistas");
        })
        .catch(function () {});
      return;
    }
    ordenar(modo);
  }
  botoes.forEach(function (botao) {
    botao.addEventListener("click", function () { aplicar(botao.getAttribute("data-ordem"), botao); });
  });
})();
</script>`;

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Busca Malvados",
    description: `Buscador de tirinhas dos Malvados, de André Dahmer, com busca pelo texto de ${strips.length} tirinhas.`,
    inLanguage: "pt-BR",
  });

  return pageShell(
    {
      title: "Busca Malvados — buscador de tirinhas do André Dahmer",
      description: `Busque pelo texto de ${strips.length} tirinhas dos Malvados. ${DISCLAIMER}`,
      url: `${site.origin}${site.base || "/"}`,
      image: OG_IMAGE,
      fonts: FONTS,
    },
    headExtra(jsonLd),
    body,
  );
}

function stripHtml(
  s: Strip,
  anterior: Strip | null,
  proximo: Strip | null,
  site: Site,
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
    ${titulo(site)}
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
      ${anterior ? `<a href="${site.base}/${anterior.n}" rel="prev">← #${anterior.n}</a>` : "<span>←</span>"}
      <a class="indice-link" href="${site.base || "/"}">todas</a>
      ${proximo ? `<a href="${site.base}/${proximo.n}" rel="next">#${proximo.n} →</a>` : "<span>→</span>"}
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

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ComicStory",
    name: `Malvados #${s.n}`,
    author: { "@type": "Person", name: "André Dahmer" },
    inLanguage: "pt-BR",
  });

  return pageShell(
    {
      title: `Malvados #${s.n} — Busca Malvados`,
      description: `Tirinha #${s.n} dos Malvados, de André Dahmer. ${DISCLAIMER}`,
      url: `${site.origin}${site.base}/${s.n}`,
      image: `https://vibegui.com/malvados/tirinhas/${s.file}`,
      ogType: "article",
      fonts: FONTS,
    },
    headExtra(jsonLd),
    body,
  );
}

function buildSite(strips: Strip[], buildDir: string, site: Site): void {
  const outDir = join(buildDir, site.out);
  mkdirSync(outDir, { recursive: true });

  writeFileSync(join(outDir, "index.html"), landingHtml(strips, site));

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
      stripHtml(strips[i], strips[i - 1] ?? null, strips[i + 1] ?? null, site),
    );
  }

  if (site.dominio) {
    const urls = [
      `${site.origin}/`,
      ...strips.map((s) => `${site.origin}/${s.n}`),
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

export function generateMalvados(contentDir: string, buildDir: string): number {
  const dataPath = join(contentDir, "malvados", "strips.json");
  if (!existsSync(dataPath)) return 0;
  const strips: Strip[] = JSON.parse(readFileSync(dataPath, "utf-8"));
  if (strips.length === 0) return 0;
  strips.sort((a, b) => a.n - b.n);

  for (const site of SITES) buildSite(strips, buildDir, site);
  return strips.length;
}
