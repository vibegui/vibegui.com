/**
 * Zero-dependency helpers for the standalone static mini-sites
 * (/irene and /malvados) generated at build time.
 *
 * These pages are complete self-contained HTML (own look & feel, no React
 * bundle, work without JS) — unlike /article and /context which hydrate the
 * SPA. Keep this file dependency-free and Node-compatible: it runs on
 * Cloudflare Pages via `node --experimental-strip-types` with
 * SKIP_DEPENDENCY_INSTALL (same constraint as lib/articles-reader.ts).
 */

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Accent-insensitive lowercase form used by both search indexes and clients. */
export function normalizeSearch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** "2026-07-18" → "18 de julho de 2026" */
export function formatDatePt(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${Number(m[3])} de ${MESES[Number(m[2]) - 1]} de ${m[1]}`;
}

/**
 * Plain poem text → HTML: blank lines split stanzas (<p>), single newlines
 * become <br>. Poems are not markdown; no inline formatting is interpreted.
 */
export function poemBodyHtml(text: string): string {
  return text
    .split(/\n\s*\n/)
    .map(
      (stanza) =>
        `<p>${stanza
          .split("\n")
          .map((l) => escapeHtml(l.trim()))
          .filter(Boolean)
          .join("<br>\n")}</p>`,
    )
    .join("\n");
}

/** JSON payload inside a <script> tag, safe against premature tag closing. */
export function jsonForScript(data: unknown): string {
  return JSON.stringify(data).replace(/<\/script>/gi, "<\\/script>");
}

export interface PageMeta {
  title: string;
  description: string;
  url: string;
  image?: string;
  ogType?: string;
  fonts?: string; // Google Fonts css2 family query, e.g. "family=Alegreya..."
  lang?: string;
}

/**
 * Shared HTML skeleton. `<html>` starts with class "no-js" which an inline
 * script immediately swaps to "js" — CSS can hide JS-only controls so the
 * page degrades gracefully (e.g. WhatsApp's in-app viewer).
 */
export function pageShell(meta: PageMeta, head: string, body: string): string {
  const fontLinks = meta.fonts
    ? `<link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?${meta.fonts}&display=swap" rel="stylesheet">`
    : "";
  const image = meta.image
    ? `<meta property="og:image" content="${escapeHtml(meta.image)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${escapeHtml(meta.image)}" />`
    : `<meta name="twitter:card" content="summary" />`;

  return `<!doctype html>
<html lang="${meta.lang || "pt-BR"}" class="no-js">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script>document.documentElement.classList.replace("no-js","js");</script>
    <title>${escapeHtml(meta.title)}</title>
    <meta name="description" content="${escapeHtml(meta.description)}" />
    <link rel="canonical" href="${escapeHtml(meta.url)}" />
    <meta property="og:type" content="${meta.ogType || "website"}" />
    <meta property="og:title" content="${escapeHtml(meta.title)}" />
    <meta property="og:description" content="${escapeHtml(meta.description)}" />
    <meta property="og:url" content="${escapeHtml(meta.url)}" />
    ${image}
    ${fontLinks}
${head}
</head>
<body>
${body}
</body>
</html>
`;
}

/**
 * Client-side collection search, shared by both mini-sites.
 *
 * Progressive enhancement over server-rendered lists: on first input it
 * fetches a prebuilt index (array of { k, t } — key + normalized text) and
 * toggles [hidden] on items marked data-busca-item="<k>". Elements with
 * [data-busca-hide] are hidden while a query is active; [data-busca-count]
 * receives "N de M". Sections with [data-busca-grupo] hide when all their
 * items are hidden.
 */
export function searchScript(indexUrl: string): string {
  return `
(function () {
  var input = document.querySelector("[data-busca]");
  if (!input) return;
  var norm = function (s) {
    return s.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/\\s+/g, " ").trim().toLowerCase();
  };
  var items = null; // { key: element }
  var index = null; // [{ k, t }]
  var carregando = false;
  function coletar() {
    items = {};
    var els = document.querySelectorAll("[data-busca-item]");
    for (var i = 0; i < els.length; i++) items[els[i].getAttribute("data-busca-item")] = els[i];
  }
  function aplicar() {
    if (!index || !items) return;
    var q = norm(input.value);
    var visiveis = 0;
    for (var i = 0; i < index.length; i++) {
      var el = items[index[i].k];
      if (!el) continue;
      var ok = !q || index[i].t.indexOf(q) !== -1;
      el.hidden = !ok;
      if (ok) visiveis++;
    }
    var esconder = document.querySelectorAll("[data-busca-hide]");
    for (var j = 0; j < esconder.length; j++) esconder[j].hidden = !!q;
    var grupos = document.querySelectorAll("[data-busca-grupo]");
    for (var g = 0; g < grupos.length; g++) {
      var algum = grupos[g].querySelector("[data-busca-item]:not([hidden])");
      grupos[g].hidden = !algum;
    }
    var count = document.querySelector("[data-busca-count]");
    if (count) count.textContent = q ? visiveis + " de " + index.length : "";
    var vazio = document.querySelector("[data-busca-vazio]");
    if (vazio) vazio.hidden = !q || visiveis > 0;
  }
  function carregar() {
    if (index || carregando) return;
    carregando = true;
    coletar();
    fetch(${JSON.stringify(indexUrl)})
      .then(function (r) { return r.json(); })
      .then(function (data) { index = data; aplicar(); })
      .catch(function () { carregando = false; });
  }
  input.addEventListener("focus", carregar);
  input.addEventListener("input", function () { carregar(); aplicar(); });
})();
`;
}
