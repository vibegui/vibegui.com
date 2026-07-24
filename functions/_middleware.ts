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
const BEACON = "https://vibegui-personal-ai-os.deco-ceo.workers.dev/e";

interface Contexto {
  request: Request;
  env: Env;
  next: () => Promise<Response>;
  waitUntil: (p: Promise<unknown>) => void;
}

function registrarPageview(
  context: Contexto,
  site: string,
  caminho: string,
): void {
  const { request } = context;
  try {
    context.waitUntil(
      fetch(context.env.ANALYTICS_BEACON_URL || BEACON, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "pageview",
          site,
          path: caminho,
          ref: request.headers.get("referer") || "",
          country: request.headers.get("cf-ipcountry") || "",
          ip: request.headers.get("cf-connecting-ip") || "",
          ua: request.headers.get("user-agent") || "",
        }),
      }).catch(() => {}),
    );
  } catch {
    // analytics nunca pode derrubar a página
  }
}

/** Só GETs de página HTML contam como pageview (nada de .json/.gif/etc). */
function ehPageview(request: Request, pathname: string): boolean {
  return request.method === "GET" && !/\.[a-zA-Z0-9]+$/.test(pathname);
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
    const ehPagina = !/\.[a-zA-Z0-9]+$/.test(destino.pathname);
    if (ehPagina && !destino.pathname.endsWith("/")) destino.pathname += "/";
    const resposta = await env.ASSETS.fetch(
      new Request(destino.toString(), request),
    );
    // caminho inexistente cai no fallback SPA do blog (200 com a home do
    // vibegui); detecta pelo lang e volta pra capa do domínio
    if (ehPagina && resposta.ok) {
      const copia = resposta.clone();
      const inicio = (await copia.text()).slice(0, 300);
      if (!inicio.includes('lang="pt-BR"')) {
        return Response.redirect(`https://${host}/`, 302);
      }
      if (ehPageview(request, url.pathname)) {
        registrarPageview(context, host, url.pathname);
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

  const resposta = await next();
  if (resposta.ok && ehPageview(request, url.pathname)) {
    registrarPageview(context, host, url.pathname);
  }
  return resposta;
};
