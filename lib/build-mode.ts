type BuildEnvironment = Partial<
  Pick<
    NodeJS.ProcessEnv,
    "CF_PAGES_BRANCH" | "CI" | "NODE_ENV" | "VIBEGUI_BUILD_MODE"
  >
>;

export type ContentBuildMode = "preview" | "production";

const PRODUCTION_BRANCH = "main";

export function resolvePagesContentBuildMode(
  env: BuildEnvironment,
): ContentBuildMode {
  const branch = env.CF_PAGES_BRANCH?.trim();

  return branch && branch !== PRODUCTION_BRANCH ? "preview" : "production";
}

export function isProductionContentBuild(env: BuildEnvironment): boolean {
  if (env.VIBEGUI_BUILD_MODE === "preview") return false;

  return (
    env.CI === "true" ||
    env.NODE_ENV === "production" ||
    env.VIBEGUI_BUILD_MODE === "production"
  );
}
