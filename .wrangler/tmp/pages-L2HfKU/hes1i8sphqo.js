// <define:__ROUTES__>
var define_ROUTES_default = {
  version: 1,
  description:
    "Routes the domain middleware (functions/_middleware.ts). Heavy static paths are excluded so they never invoke the function \u2014 including the strip images, which are canonical shared assets on every host.",
  include: ["/*"],
  exclude: [
    "/assets/*",
    "/images/*",
    "/fonts/*",
    "/article/*",
    "/context/*",
    "/content/*",
    "/bookmarks/*",
    "/malvados/tirinhas/*",
  ],
};

// ../../../../../.bun/install/global/node_modules/wrangler/templates/pages-dev-pipeline.ts
import worker from "/Users/guilherme/Projects/vibegui.com/.claude/worktrees/irene-malvados/.wrangler/tmp/pages-L2HfKU/functionsWorker-0.2318763072255534.mjs";
import { isRoutingRuleMatch } from "/Users/guilherme/.bun/install/global/node_modules/wrangler/templates/pages-dev-util.ts";
export * from "/Users/guilherme/Projects/vibegui.com/.claude/worktrees/irene-malvados/.wrangler/tmp/pages-L2HfKU/functionsWorker-0.2318763072255534.mjs";
var routes = define_ROUTES_default;
var pages_dev_pipeline_default = {
  fetch(request, env, context) {
    const { pathname } = new URL(request.url);
    for (const exclude of routes.exclude) {
      if (isRoutingRuleMatch(pathname, exclude)) {
        return env.ASSETS.fetch(request);
      }
    }
    for (const include of routes.include) {
      if (isRoutingRuleMatch(pathname, include)) {
        const workerAsHandler = worker;
        if (workerAsHandler.fetch === void 0) {
          throw new TypeError("Entry point missing `fetch` handler");
        }
        return workerAsHandler.fetch(request, env, context);
      }
    }
    return env.ASSETS.fetch(request);
  },
};
export { pages_dev_pipeline_default as default };
//# sourceMappingURL=hes1i8sphqo.js.map
