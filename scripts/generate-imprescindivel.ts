/**
 * Generate the "Agenda Imprescindível 2026" mini-site — called from generate.ts.
 *
 * Reads content/imprescindivel/NN-slug.md (written once by
 * scripts/import-agenda.ts) and writes fully static, self-contained pages.
 * Layout mirrors /irene: sumário pinned to the viewport on desktop, one
 * section open at a time; on mobile the índice starts closed above the text.
 * The root shows the opening section.
 *
 * Built TWICE (see SITES): under /imprescindivel for vibegui.com, and under
 * /_dominio-imprescindivel with root-relative links, agendaimprescindivel.com.br
 * canonicals, sitemap.xml and robots.txt — served on that domain by the
 * host-based rewrite in functions/_middleware.ts.
 *
 * Look & feel: institutional editorial — navy, verde and cream from the
 * Derrubando Muros identity, Archivo for display, Newsreader for the long
 * policy prose. Fully typographic; the docx cover art is not used.
 * Works without JS: the sumário is a native <details> (open in the markup),
 * links are plain anchors; search controls are hidden via .no-js.
 */

import {
  writeFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { marked } from "marked";
import {
  escapeHtml,
  normalizeSearch,
  pageShell,
  searchScript,
} from "../lib/static-site.ts";

interface Site {
  base: string; // prefixo dos links internos: "/imprescindivel" ou ""
  origin: string; // origem canônica das URLs
  out: string; // diretório dentro de .build/
  dominio: boolean; // build de domínio dedicado: gera sitemap + robots
}

const SITES: Site[] = [
  {
    base: "/imprescindivel",
    origin: "https://vibegui.com",
    out: "imprescindivel",
    dominio: false,
  },
  {
    base: "",
    origin: "https://agendaimprescindivel.com.br",
    out: "_dominio-imprescindivel",
    dominio: true,
  },
];

const TITULO = "Agenda Imprescindível 2026";
const AUTORIA = "Derrubando Muros";
const OG_IMAGE = "https://vibegui.com/images/og-agendaimprescindivel.png";
const FAVICON =
  "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2064%2064%22%3E%3Crect%20width%3D%2264%22%20height%3D%2264%22%20fill%3D%22%230f2350%22%2F%3E%3Ctext%20x%3D%2232%22%20y%3D%2247%22%20font-family%3D%22Archivo%2CHelvetica%2Csans-serif%22%20font-weight%3D%22800%22%20font-size%3D%2242%22%20text-anchor%3D%22middle%22%20fill%3D%22%238fbf2e%22%3EA%3C%2Ftext%3E%3C%2Fsvg%3E";
const FONTS =
  "family=Archivo:wght@500;600;700;800&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,400";

const CSS = `
  :root {
    --papel: #f7f4ec;
    --papel-2: #efeade;
    --tinta: #14181f;
    --tinta-suave: #5d6470;
    --navy: #0f2350;
    --navy-2: #1d3461;
    --verde: #1e8a3c;
    --verde-claro: #8fbf2e;
    --linha: #d8d1bf;
    --font-display: "Archivo", system-ui, sans-serif;
    --font-leitura: "Newsreader", Georgia, serif;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  [hidden] { display: none !important; }
  body {
    background: var(--papel);
    color: var(--tinta);
    font-family: var(--font-leitura);
    font-size: 1.09rem;
    line-height: 1.62;
    -webkit-font-smoothing: antialiased;
  }
  a { color: var(--navy-2); }
  .layout { min-height: 100dvh; }
  .leitura { min-width: 0; max-width: 46rem; padding: 0 1.5rem 5rem; }

  /* ---------- índice ---------- */
  .sumario {
    font-family: var(--font-display);
    background: var(--navy);
    color: var(--papel);
    padding: 1.25rem 1.5rem;
  }
  .sumario summary {
    cursor: pointer;
    list-style: none;
    display: inline-block;
    font-size: .82rem;
    font-weight: 600;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: var(--papel);
    border: 1px solid color-mix(in srgb, var(--papel) 35%, transparent);
    border-radius: 999px;
    padding: .5rem 1.1rem;
    user-select: none;
  }
  .sumario summary::before { content: "☰  "; }
  .sumario summary::-webkit-details-marker { display: none; }
  .sumario summary:hover { background: var(--navy-2); }
  .sumario[open] { padding-bottom: 2rem; }
  .sumario-inner { padding: 1.5rem 0 0; }
  .marca {
    display: block;
    text-decoration: none;
    color: var(--papel);
    padding-bottom: 1.4rem;
    margin-bottom: 1.4rem;
    border-bottom: 1px solid color-mix(in srgb, var(--papel) 18%, transparent);
  }
  .marca b {
    display: block;
    font-size: 1.32rem;
    font-weight: 800;
    line-height: 1.05;
    letter-spacing: -.02em;
    text-wrap: balance;
  }
  .marca b i { font-style: normal; color: var(--verde-claro); }
  .marca span {
    display: block;
    margin-top: .45rem;
    font-size: .7rem;
    font-weight: 600;
    letter-spacing: .16em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--papel) 60%, transparent);
  }
  .no-js .busca-area { display: none; }
  .busca {
    width: 100%;
    font: inherit;
    font-size: .95rem;
    color: var(--papel);
    background: color-mix(in srgb, var(--papel) 7%, transparent);
    border: 1px solid color-mix(in srgb, var(--papel) 22%, transparent);
    border-radius: .4rem;
    padding: .6rem .8rem;
  }
  .busca::placeholder { color: color-mix(in srgb, var(--papel) 45%, transparent); }
  .busca:focus { outline: 2px solid var(--verde-claro); outline-offset: 1px; border-color: transparent; }
  .contagem { padding-top: .4rem; font-size: .75rem; color: color-mix(in srgb, var(--papel) 55%, transparent); min-height: 1.4em; }
  .parte { margin-top: 1.6rem; }
  .parte > h3 {
    font-size: .68rem;
    font-weight: 700;
    letter-spacing: .18em;
    text-transform: uppercase;
    color: var(--verde-claro);
    padding-bottom: .5rem;
    border-bottom: 1px solid color-mix(in srgb, var(--papel) 18%, transparent);
  }
  .parte ol { list-style: none; margin-top: .5rem; counter-reset: none; }
  .parte a {
    display: grid;
    grid-template-columns: 2.3rem 1fr;
    gap: .3rem;
    align-items: baseline;
    padding: .45rem .6rem;
    margin-inline: -.6rem;
    border-radius: .35rem;
    color: color-mix(in srgb, var(--papel) 88%, transparent);
    text-decoration: none;
    font-size: .92rem;
    line-height: 1.35;
  }
  .parte a em {
    font-style: normal;
    font-size: .72rem;
    font-weight: 700;
    letter-spacing: .04em;
    color: color-mix(in srgb, var(--papel) 45%, transparent);
    font-variant-numeric: tabular-nums;
  }
  .parte a:hover { background: var(--navy-2); color: #fff; }
  .parte a:hover em { color: var(--verde-claro); }
  .parte a[aria-current="page"] { background: var(--verde); color: #fff; font-weight: 600; }
  .parte a[aria-current="page"] em { color: rgba(255,255,255,.75); }
  .vazio { padding: 1.25rem 0; font-size: .85rem; color: color-mix(in srgb, var(--papel) 55%, transparent); }

  /* ---------- capítulo ---------- */
  .cabecalho { padding: clamp(2rem, 6vh, 3.75rem) 0 0; }
  /* Numeral romano em serifa: em Archivo (grotesca) "I", "II" e "III" viram
     barras sem leitura. As serifas dão a travessa que identifica o numeral. */
  .numeral {
    font-family: var(--font-leitura);
    font-size: clamp(4rem, 13vw, 7rem);
    font-weight: 600;
    line-height: .85;
    letter-spacing: .02em;
    color: var(--verde);
    margin-bottom: .5rem;
    user-select: none;
  }
  .kicker {
    font-family: var(--font-display);
    font-size: .72rem;
    font-weight: 700;
    letter-spacing: .2em;
    text-transform: uppercase;
    color: var(--verde);
  }
  .cabecalho h2 {
    font-family: var(--font-display);
    font-size: clamp(2.1rem, 6.5vw, 3.4rem);
    font-weight: 800;
    line-height: 1.02;
    letter-spacing: -.03em;
    color: var(--navy);
    text-wrap: balance;
    margin-top: .5rem;
  }
  .subtitulo {
    margin-top: .7rem;
    font-size: 1.24rem;
    font-style: italic;
    color: var(--tinta-suave);
    text-wrap: balance;
  }
  .regra { margin: 2rem 0 1.9rem; height: 3px; border: 0; background: linear-gradient(90deg, var(--verde), var(--verde-claro)); }

  .texto > p { margin-block: 1.15em; text-wrap: pretty; }
  .texto > p:first-child { margin-top: 0; }
  /* lead: o primeiro parágrafo do capítulo, em itálico no markdown */
  .texto > p:first-child > em:only-child {
    display: block;
    font-size: 1.28rem;
    font-style: normal;
    line-height: 1.45;
    color: var(--navy);
    text-wrap: pretty;
  }
  .texto blockquote {
    margin: 2.1rem 0;
    padding-left: 1.4rem;
    border-left: 4px solid var(--verde-claro);
    font-family: var(--font-display);
    font-size: 1.22rem;
    font-weight: 600;
    line-height: 1.3;
    letter-spacing: -.015em;
    color: var(--navy);
    text-wrap: balance;
  }
  .texto > ul { list-style: none; margin: 1.6rem 0; }
  .texto > ul > li { margin-block: 1em; }
  .texto > ul > li > strong {
    font-family: var(--font-display);
    font-size: .78rem;
    font-weight: 700;
    letter-spacing: .12em;
    color: var(--verde);
    margin-right: .15rem;
  }
  .texto > ol { list-style: none; counter-reset: n; margin: 1.6rem 0; }
  .texto > ol > li { counter-increment: n; margin-block: 1em; padding-left: 3rem; position: relative; }
  .texto > ol > li::before {
    content: counter(n, decimal-leading-zero);
    position: absolute;
    left: 0;
    font-family: var(--font-display);
    font-size: 1.05rem;
    font-weight: 800;
    color: var(--verde-claro);
    font-variant-numeric: tabular-nums;
  }

  /* ---------- caixas ---------- */
  .caixa { margin: 2.75rem 0; }
  .caixa-kicker {
    font-family: var(--font-display);
    font-size: .68rem;
    font-weight: 700;
    letter-spacing: .2em;
    text-transform: uppercase;
  }
  .caixa[data-tipo="quadro"], .caixa[data-tipo="historia"] {
    background: var(--papel-2);
    border-left: 4px solid var(--verde);
    padding: 1.5rem 1.6rem;
  }
  .caixa[data-tipo="quadro"] .caixa-kicker,
  .caixa[data-tipo="historia"] .caixa-kicker { color: var(--verde); }
  .caixa[data-tipo="quadro"] p, .caixa[data-tipo="historia"] p { font-size: 1rem; margin-top: .9em; }
  .caixa h3 {
    font-family: var(--font-display);
    font-size: 1.35rem;
    font-weight: 700;
    letter-spacing: -.02em;
    color: var(--navy);
    margin-top: .5rem;
  }

  /* a régua é o elemento-assinatura do documento: painel, não aside discreto */
  .caixa[data-tipo="regua"] {
    background: var(--navy);
    color: var(--papel);
    padding: 1.9rem 1.8rem 1.7rem;
    border-radius: .25rem;
  }
  .caixa[data-tipo="regua"] .caixa-kicker { color: var(--verde-claro); }
  .caixa[data-tipo="regua"] p { font-size: 1.02rem; }
  .caixa[data-tipo="regua"] > p:nth-of-type(2) {
    margin-top: .9rem;
    padding-bottom: 1.3rem;
    border-bottom: 1px solid color-mix(in srgb, var(--papel) 20%, transparent);
    font-size: 1.16rem;
    line-height: 1.45;
  }
  .caixa[data-tipo="regua"] strong {
    font-family: var(--font-display);
    font-size: .72rem;
    font-weight: 700;
    letter-spacing: .14em;
    text-transform: uppercase;
    color: var(--verde-claro);
  }
  .caixa[data-tipo="regua"] ol { list-style: none; counter-reset: o; margin: 1.3rem 0; }
  .caixa[data-tipo="regua"] ol li {
    counter-increment: o;
    padding-left: 2.9rem;
    position: relative;
    margin-block: 1.05em;
    font-size: 1rem;
    line-height: 1.5;
  }
  .caixa[data-tipo="regua"] ol li::before {
    content: counter(o, decimal-leading-zero);
    position: absolute;
    left: 0;
    top: .05em;
    font-family: var(--font-display);
    font-size: 1.15rem;
    font-weight: 800;
    color: var(--verde-claro);
    font-variant-numeric: tabular-nums;
  }
  /* inline: em bloco o "—" do markdown ficaria órfão abrindo a linha seguinte */
  .caixa[data-tipo="regua"] ol li strong { color: #fff; }
  .caixa[data-tipo="regua"] > p:last-child {
    padding-top: 1.2rem;
    border-top: 1px solid color-mix(in srgb, var(--papel) 20%, transparent);
    font-size: .93rem;
    color: color-mix(in srgb, var(--papel) 80%, transparent);
  }

  /* ---------- integrantes ---------- */
  .texto.nomes > ul {
    columns: 3 13rem;
    column-gap: 2rem;
    font-family: var(--font-display);
    font-size: .92rem;
    border-top: 1px solid var(--linha);
    padding-top: 1.4rem;
  }
  .texto.nomes > ul > li {
    break-inside: avoid;
    margin: 0 0 .45em;
    color: var(--navy);
  }

  /* ---------- rodapé ---------- */
  .navegacao {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    margin-top: 3.5rem;
    padding-top: 1.3rem;
    border-top: 1px solid var(--linha);
    font-family: var(--font-display);
    font-size: .88rem;
    font-weight: 600;
  }
  .navegacao a { text-decoration: none; max-width: 45%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .navegacao a:hover { text-decoration: underline; }
  footer {
    margin-top: 3rem;
    font-family: var(--font-display);
    font-size: .78rem;
    letter-spacing: .04em;
    color: var(--tinta-suave);
  }

  /* ---------- desktop: sumário fixo à esquerda ---------- */
  @media (min-width: 60rem) {
    .layout { display: grid; grid-template-columns: minmax(19rem, 23rem) minmax(0, 1fr); }
    .sumario {
      padding: 2.25rem 2rem 3rem;
      position: sticky;
      top: 0;
      height: 100dvh;
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-width: thin;
    }
    .sumario[open] { padding-bottom: 3rem; }
    .sumario summary { display: none; }
    .sumario-inner { padding-top: 0; }
    .leitura { padding: 0 2rem 5rem clamp(2.5rem, 5vw, 4.5rem); }
  }
`;

interface Secao {
  ordem: number;
  slug: string;
  titulo: string;
  kicker: string;
  subtitulo: string;
  numeral: string;
  /** frase-síntese do capítulo (SÍNTESE EXECUTIVA); vira a manchete quando presente */
  ideia: string;
  corpo: string;
}

const RE_FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

/**
 * Leitura própria em vez de getAllContent: aqui a ordem é a do documento
 * (prefixo NN do arquivo), não a de uma data — isto é um documento, não um
 * feed, e os .md nem têm campo `date`.
 */
function lerSecoes(dir: string): Secao[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f, i) => {
      const m = readFileSync(join(dir, f), "utf-8").match(RE_FRONTMATTER);
      if (!m) throw new Error(`frontmatter inválido em ${f}`);
      const campos: Record<string, string> = {};
      for (const linha of m[1].split(/\r?\n/)) {
        const kv = linha.match(/^(\w+):\s*(.*)$/);
        if (kv) campos[kv[1]] = kv[2].replace(/^"(.*)"$/, "$1").trim();
      }
      return {
        ordem: i + 1,
        slug: campos.slug || f.replace(/^\d+-|\.md$/g, ""),
        titulo: campos.title || "",
        kicker: campos.kicker || "",
        subtitulo: campos.subtitle || "",
        numeral: campos.numeral || "",
        ideia: campos.idea || "",
        corpo: m[2].trim(),
      };
    });
}

const md = (s: string) => marked(s, { async: false }) as string;

/**
 * Corpo → HTML. `## KICKER` abre uma caixa que vai até o próximo `##`;
 * o interior é markdown comum, nunca re-parseado.
 */
function corpoHtml(corpo: string): string {
  const [prosa, ...caixas] = corpo.split(/\n## /);
  let out = md(prosa);
  for (const bruto of caixas) {
    // sem "\n" = caixa sem corpo (heading no fim do arquivo, ou dois "## "
    // seguidos); sem isso quebra=-1 e slice(0,-1)/slice(-1) cortam a caixa
    const quebra = bruto.includes("\n") ? bruto.indexOf("\n") : bruto.length;
    const kicker = bruto.slice(0, quebra).trim();
    const tipo = kicker.startsWith("RÉGUA")
      ? "regua"
      : kicker.startsWith("HISTÓRIA")
        ? "historia"
        : "quadro";
    out += `\n<aside class="caixa" data-tipo="${tipo}">\n<p class="caixa-kicker">${escapeHtml(kicker)}</p>\n${md(bruto.slice(quebra))}</aside>\n`;
  }
  return out;
}

/** Abertura (01–04) · Capítulos (I–XII) · Encerramento. */
function parteDe(s: Secao): string {
  if (s.numeral) return "Capítulos";
  return s.ordem <= 4 ? "Abertura" : "Encerramento";
}

function sumarioHtml(secoes: Secao[], atual: string, base: string): string {
  const partes = new Map<string, Secao[]>();
  for (const s of secoes) {
    const p = parteDe(s);
    if (!partes.has(p)) partes.set(p, []);
    partes.get(p)!.push(s);
  }
  const grupos = [...partes.entries()]
    .map(
      ([nome, lista]) => `      <section class="parte" data-busca-grupo>
        <h3>${nome}</h3>
        <ol>
${lista
  .map(
    (s) =>
      `          <li data-busca-item="${s.slug}"><a href="${base}/${s.slug}"${
        s.slug === atual ? ' aria-current="page"' : ""
      }><em>${s.numeral || "—"}</em><span>${escapeHtml(s.titulo)}</span></a></li>`,
  )
  .join("\n")}
        </ol>
      </section>`,
    )
    .join("\n");

  return `  <details class="sumario" open>
    <summary>Sumário</summary>
    <nav class="sumario-inner" aria-label="Sumário da Agenda">
      <a class="marca" href="${base || "/"}">
        <b>Agenda<br>Imprescindível <i>2026</i></b>
        <span>${AUTORIA}</span>
      </a>
      <div class="busca-area">
        <input class="busca" type="search" data-busca placeholder="Buscar no documento…" aria-label="Buscar na Agenda">
        <p class="contagem" data-busca-count aria-live="polite"></p>
      </div>
${grupos}
      <p class="vazio" data-busca-vazio hidden>Nada encontrado nesta Agenda.</p>
    </nav>
  </details>`;
}

const SCRIPT_EXTRA = `
(function () {
  var sumario = document.querySelector(".sumario");
  var desktop = window.matchMedia("(min-width: 60rem)");
  // desktop: sempre aberto (sem botão); mobile: começa fechado
  if (!desktop.matches) sumario.open = false;
  desktop.addEventListener("change", function (e) { sumario.open = e.matches; });
  document.addEventListener("keydown", function (e) {
    if (e.target && e.target.tagName === "INPUT") return;
    if (e.key === "ArrowLeft") { var a = document.querySelector('[rel="prev"]'); if (a) location.href = a.href; }
    if (e.key === "ArrowRight") { var b = document.querySelector('[rel="next"]'); if (b) location.href = b.href; }
  });
})();
`;

function resumo(s: Secao): string {
  const texto = s.corpo
    .replace(/^#+ .*$/gm, "")
    .replace(/[*>`_-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return (
    `${s.subtitulo ? `${s.subtitulo}. ` : ""}${texto}`.slice(0, 180).trim() +
    "…"
  );
}

/** HTML do artigo — igual para a raiz e para a própria página da seção 0, só o metadata (title/url/jsonLd) muda entre as duas. */
function corpoDaPagina(secoes: Secao[], i: number, site: Site): string {
  const s = secoes[i];
  const anterior = secoes[i - 1] ?? null;
  const proximo = secoes[i + 1] ?? null;
  const home = site.base || "/";

  return `<div class="layout">
${sumarioHtml(secoes, s.slug, site.base)}

  <main class="leitura">
    <article>
      <header class="cabecalho">
        ${s.numeral ? `<p class="numeral" aria-hidden="true">${s.numeral}</p>` : ""}
        <p class="kicker">${escapeHtml(s.ideia ? `${s.kicker} · ${s.titulo}` : s.kicker)}</p>
        <h2>${escapeHtml(s.ideia || s.titulo)}</h2>
        ${s.subtitulo ? `<p class="subtitulo">${escapeHtml(s.subtitulo)}</p>` : ""}
      </header>
      <hr class="regra">
      <div class="texto${s.slug === "integrantes" ? " nomes" : ""}">
${corpoHtml(s.corpo)}
      </div>
    </article>
    <nav class="navegacao" aria-label="Outras seções">
      ${anterior ? `<a href="${site.base}/${anterior.slug}" rel="prev">← ${escapeHtml(anterior.titulo)}</a>` : `<a href="${home}">← Início</a>`}
      ${proximo ? `<a href="${site.base}/${proximo.slug}" rel="next">${escapeHtml(proximo.titulo)} →</a>` : "<span></span>"}
    </nav>
    <footer>${TITULO} · ${AUTORIA} · ${secoes.length} seções</footer>
  </main>
</div>
<script>${searchScript(`${site.base}/busca.json`)}${SCRIPT_EXTRA}</script>`;
}

function pagina(
  secoes: Secao[],
  i: number,
  opts: { canonicalRoot: boolean },
  site: Site,
  body = corpoDaPagina(secoes, i, site),
): string {
  const s = secoes[i];

  const jsonLd = JSON.stringify(
    opts.canonicalRoot
      ? {
          "@context": "https://schema.org",
          "@type": "Report",
          name: TITULO,
          inLanguage: "pt-BR",
          author: { "@type": "Organization", name: AUTORIA },
        }
      : {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: s.titulo,
          isPartOf: { "@type": "Report", name: TITULO },
          inLanguage: "pt-BR",
          author: { "@type": "Organization", name: AUTORIA },
        },
  );

  return pageShell(
    {
      title: opts.canonicalRoot
        ? `${TITULO} — ${AUTORIA}`
        : `${s.titulo} — ${TITULO}`,
      description: opts.canonicalRoot
        ? `${TITULO}: um projeto nacional para o Brasil em ${secoes.length} seções, do ${AUTORIA}. Prosperidade e igualdade de oportunidades como um só ciclo.`
        : resumo(s),
      url: opts.canonicalRoot
        ? `${site.origin}${site.base || "/"}`
        : `${site.origin}${site.base}/${s.slug}`,
      image: OG_IMAGE,
      ogType: opts.canonicalRoot ? "website" : "article",
      fonts: FONTS,
    },
    `    <link rel="icon" href="${FAVICON}">
    <meta name="theme-color" content="#0f2350">
    <meta property="og:locale" content="pt_BR">
    <script type="application/ld+json">${jsonLd}</script>
    <style>${CSS}</style>`,
    body,
  );
}

function buildSite(secoes: Secao[], buildDir: string, site: Site): void {
  const outDir = join(buildDir, site.out);
  mkdirSync(outDir, { recursive: true });

  // raiz = seção de abertura, com o sumário do lado; corpo idêntico ao da
  // própria página da seção (só o metadata muda), computa uma vez só
  const corpoAbertura = corpoDaPagina(secoes, 0, site);
  writeFileSync(
    join(outDir, "index.html"),
    pagina(secoes, 0, { canonicalRoot: true }, site, corpoAbertura),
  );

  writeFileSync(
    join(outDir, "busca.json"),
    JSON.stringify(
      secoes.map((s) => ({
        k: s.slug,
        t: normalizeSearch(`${s.titulo} ${s.subtitulo} ${s.corpo}`),
      })),
    ),
  );

  for (let i = 0; i < secoes.length; i++) {
    const dir = join(outDir, secoes[i].slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "index.html"),
      pagina(
        secoes,
        i,
        { canonicalRoot: false },
        site,
        i === 0 ? corpoAbertura : undefined,
      ),
    );
  }

  if (site.dominio) {
    const urls = [
      `${site.origin}/`,
      ...secoes.map((s) => `${site.origin}/${s.slug}`),
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

export function generateImprescindivel(
  contentDir: string,
  buildDir: string,
): number {
  const secoes = lerSecoes(join(contentDir, "imprescindivel"));
  if (secoes.length === 0) return 0;

  for (const site of SITES) buildSite(secoes, buildDir, site);
  return secoes.length;
}
