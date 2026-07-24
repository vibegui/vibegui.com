// <define:__ROUTES__>
var define_ROUTES_default = {
  version: 1,
  description:
    "Routes the domain middleware (functions/_middleware.ts), which also records first-party pageviews. Only non-page static paths are excluded (article/context pages stay included so their views are counted).",
  include: ["/*"],
  exclude: [
    "/assets/*",
    "/images/*",
    "/fonts/*",
    "/content/*",
    "/bookmarks/*",
    "/malvados/tirinhas/*",
  ],
};

// ../../../../../.bun/install/global/node_modules/wrangler/templates/pages-dev-pipeline.ts
import worker from "/Users/guilherme/Projects/vibegui.com/.claude/worktrees/irene-malvados/.wrangler/tmp/pages-Fm85id/functionsWorker-0.7583072903552825.mjs";
import { isRoutingRuleMatch } from "/Users/guilherme/.bun/install/global/node_modules/wrangler/templates/pages-dev-util.ts";
export * from "/Users/guilherme/Projects/vibegui.com/.claude/worktrees/irene-malvados/.wrangler/tmp/pages-Fm85id/functionsWorker-0.7583072903552825.mjs";
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
//# sourceMappingURL=b8melmikuow.js.map
