/**
 * Host-based routing for the dedicated mini-site domains.
 *
 * - poesiadairene.com/*  → serves the /_dominio-irene build (rewrite, URL intact)
 * - buscamalvados.com/*  → serves the /_dominio-malvados build
 * - www.<domain>         → 301 to the apex
 * - vibegui.com/irene*   → 301 to poesiadairene.com (same for /malvados),
 *   so the dedicated domains are canonical in production. Dev servers and
 *   *.pages.dev previews are unaffected (host doesn't match), where /irene
 *   and /malvados keep working normally.
 *
 * Shared canonical assets (strip images, /images) are excluded from the
 * function entirely via public/_routes.json, so they are served statically
 * on every host without invoking this middleware.
 */

interface Env {
  ASSETS: { fetch: (req: Request) => Promise<Response> };
  /** override do endpoint do beacon (ex.: quando o worker migrar de conta) */
  ANALYTICS_BEACON_URL?: string;
}

const SITES = [
  { dominio: "poesiadairene.com", caminho: "/irene", build: "/_dominio-irene" },
  {
    dominio: "buscamalvados.com",
    caminho: "/malvados",
    build: "/_dominio-malvados",
  },
];

// Beacon de analytics first-party: o worker do Personal AI OS grava o evento
// em D1 e expõe as tools SITES_OVERVIEW / SITE_METRICS no MCP privado.
const BEACON = "https://mcp.vibegui.com/e";

interface Contexto {
  request: Request;
  env: Env;
  next: () => Promise<Response>;
  waitUntil: (p: Promise<unknown>) => void;
}

/** Rede do visitante sem guardar IP inteiro: /24 no v4, /48 no v6. */
function faixaIp(ip: string): string | undefined {
  if (!ip) return undefined;
  if (ip.includes(":")) return `${ip.split(":").slice(0, 3).join(":")}::/48`;
  const octetos = ip.split(".");
  return octetos.length === 4
    ? `${octetos.slice(0, 3).join(".")}.0/24`
    : undefined;
}

/**
 * Dimensões extras do evento (o que a tela de analytics da Cloudflare mostra):
 * status, cache, user agent cru, ASN/organização, colo e faixa de IP.
 */
function dimensoes(
  request: Request,
  resposta?: Response,
): Record<string, unknown> {
  const cf = (request as { cf?: Record<string, unknown> }).cf ?? {};
  const dims: Record<string, unknown> = {
    ua: (request.headers.get("user-agent") || "").slice(0, 200) || undefined,
    asn: cf.asn ? String(cf.asn) : undefined,
    asOrg:
      typeof cf.asOrganization === "string" ? cf.asOrganization : undefined,
    colo: typeof cf.colo === "string" ? cf.colo : undefined,
    ip: faixaIp(request.headers.get("cf-connecting-ip") || ""),
  };
  if (resposta) {
    dims.status = resposta.status;
    // dentro da function o cf-cache-status quase sempre não existe ainda —
    // é o edge que escreve o header na saída
    dims.cache = resposta.headers.get("cf-cache-status") || "n/a";
  }
  for (const chave of Object.keys(dims)) {
    if (dims[chave] === undefined) delete dims[chave];
  }
  return dims;
}

function registrar(
  context: Contexto,
  evento: string,
  site: string,
  caminho: string,
  resposta?: Response,
): void {
  const { request } = context;
  try {
    context.waitUntil(
      fetch(context.env.ANALYTICS_BEACON_URL || BEACON, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: evento,
          site,
          path: caminho,
          ref: request.headers.get("referer") || "",
          country: request.headers.get("cf-ipcountry") || "",
          ip: request.headers.get("cf-connecting-ip") || "",
          ua: request.headers.get("user-agent") || "",
          dims: dimensoes(request, resposta),
        }),
      }).catch(() => {}),
    );
  } catch {
    // analytics nunca pode derrubar a página
  }
}

/** Caminho de página (sem extensão de arquivo). */
function ehPagina(pathname: string): boolean {
  return !/\.[a-zA-Z0-9]+$/.test(pathname);
}

/** Só GETs de página HTML contam como pageview (nada de .json/.gif/etc). */
function ehPageview(request: Request, pathname: string): boolean {
  return request.method === "GET" && ehPagina(pathname);
}

/**
 * Rotas que o SPA do blog conhece — espelha `parseRoute` em src/app.tsx.
 * Qualquer outra rota de página devolve 404 de verdade: o fallback do Pages
 * responde 200 com o shell do SPA pra QUALQUER caminho, o que dava soft-404
 * pro Google e enchia o analytics de varredura de scanner (/.git/config,
 * /.aws/credentials, /wp-json/..., 200 distintos em uma semana).
 */
const ROTAS = new Set([
  "/",
  "/content",
  "/bookmarks",
  "/bookmarks/edit",
  "/roadmap",
  "/commitment",
  "/context",
]);
const PREFIXOS = [
  "/article/",
  "/context/",
  "/irene",
  "/malvados",
  "/_dominio-",
];

function rotaConhecida(pathname: string): boolean {
  const limpo =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  return (
    ROTAS.has(limpo) || PREFIXOS.some((prefixo) => pathname.startsWith(prefixo))
  );
}

export const onRequest = async (context: Contexto): Promise<Response> => {
  const { request, env, next } = context;
  const url = new URL(request.url);
  // header Host permite testar com `wrangler pages dev` + curl -H "Host: ..."
  const rawHost = (request.headers.get("host") || url.hostname)
    .toLowerCase()
    .split(":")[0];
  const host = rawHost.replace(/^www\./, "");

  const site = SITES.find((s) => s.dominio === host);
  if (site) {
    if (rawHost.startsWith("www.")) {
      return Response.redirect(
        `https://${host}${url.pathname}${url.search}`,
        301,
      );
    }
    const destino = new URL(url);
    destino.pathname = site.build + (url.pathname === "/" ? "/" : url.pathname);
    // páginas são diretórios com index.html: já pede com barra final para o
    // servidor de assets não responder 308 expondo o caminho interno
    const pagina = ehPagina(destino.pathname);
    if (pagina && !destino.pathname.endsWith("/")) destino.pathname += "/";
    const resposta = await env.ASSETS.fetch(
      new Request(destino.toString(), request),
    );
    // caminho inexistente cai no fallback SPA do blog (200 com a home do
    // vibegui); detecta pelo lang e volta pra capa do domínio
    if (pagina && resposta.ok) {
      const copia = resposta.clone();
      const inicio = (await copia.text()).slice(0, 300);
      if (!inicio.includes('lang="pt-BR"')) {
        registrar(context, "blocked", host, url.pathname);
        return Response.redirect(`https://${host}/`, 302);
      }
      if (ehPageview(request, url.pathname)) {
        registrar(context, "pageview", host, url.pathname, resposta);
      }
    }
    if (resposta.status === 404) {
      return Response.redirect(`https://${host}/`, 302);
    }
    return resposta;
  }

  // domínio principal em produção: os caminhos antigos migram pros domínios
  if (host === "vibegui.com") {
    for (const s of SITES) {
      if (
        url.pathname === s.caminho ||
        url.pathname === `${s.caminho}/` ||
        url.pathname.startsWith(`${s.caminho}/`)
      ) {
        const resto = url.pathname.slice(s.caminho.length) || "/";
        return Response.redirect(
          `https://${s.dominio}${resto}${url.search}`,
          301,
        );
      }
    }
  }

  // rota que o SPA não conhece: 404 de verdade, sem contar como pageview.
  // Fica gravado como evento "blocked" (visível pelo SITE_METRICS) pra dar
  // pra olhar a varredura sem sujar os números de visitante.
  if (ehPagina(url.pathname) && !rotaConhecida(url.pathname)) {
    registrar(context, "blocked", host, url.pathname);
    return new Response("404 — não existe por aqui.\n", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=300",
        "x-robots-tag": "noindex",
      },
    });
  }

  const resposta = await next();
  if (resposta.ok && ehPageview(request, url.pathname)) {
    registrar(context, "pageview", host, url.pathname, resposta);
  }
  return resposta;
};
