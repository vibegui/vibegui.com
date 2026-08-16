import { describe, expect, test } from "bun:test";
import {
  isProductionContentBuild,
  resolvePagesContentBuildMode,
} from "../../lib/build-mode";

describe("Cloudflare Pages draft visibility", () => {
  test("branch previews include drafts", () => {
    expect(
      resolvePagesContentBuildMode({
        CF_PAGES_BRANCH: "vibegui/draft-article",
      }),
    ).toBe("preview");
  });

  test("main and local Pages builds hide drafts", () => {
    expect(resolvePagesContentBuildMode({ CF_PAGES_BRANCH: "main" })).toBe(
      "production",
    );
    expect(resolvePagesContentBuildMode({})).toBe("production");
  });

  test("preview mode overrides the CI and Node production defaults", () => {
    expect(
      isProductionContentBuild({
        CI: "true",
        NODE_ENV: "production",
        VIBEGUI_BUILD_MODE: "preview",
      }),
    ).toBe(false);
  });

  test("production mode keeps drafts private", () => {
    expect(
      isProductionContentBuild({
        CI: "true",
        NODE_ENV: "production",
        VIBEGUI_BUILD_MODE: "production",
      }),
    ).toBe(true);
  });
});
