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
}

const SITES = [
  { dominio: "poesiadairene.com", caminho: "/irene", build: "/_dominio-irene" },
  {
    dominio: "buscamalvados.com",
    caminho: "/malvados",
    build: "/_dominio-malvados",
  },
];

export const onRequest = async (context: {
  request: Request;
  env: Env;
  next: () => Promise<Response>;
}): Promise<Response> => {
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

  return next();
};
