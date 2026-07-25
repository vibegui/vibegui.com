import bundledHtml from "../dist/web/index.html";
import type { AccessLevel } from "./env.ts";
import {
  ANALYTICS_RESOURCE,
  BOOKMARKS_RESOURCE,
  PERSONAL_AI_OS_RESOURCE,
} from "./tools.ts";

export const MCP_APP_MIME = "text/html;profile=mcp-app";

export interface ResourceDefinition {
  uri: string;
  name: string;
  description: string;
  access: AccessLevel;
}

const resources: ResourceDefinition[] = [
  {
    uri: BOOKMARKS_RESOURCE,
    name: "VibeGUI Bookmarks",
    description:
      "Private bookmark workspace for creation, editing, deletion, and enrichment.",
    access: "private",
  },
  {
    uri: PERSONAL_AI_OS_RESOURCE,
    name: "VibeGui Personal AI OS",
    description:
      "Private project map, goals, memory, daily brief, attention evidence, and inbox.",
    access: "private",
  },
  {
    uri: ANALYTICS_RESOURCE,
    name: "Site Analytics",
    description:
      "Pageviews and unique visitors for vibegui.com, poesiadairene.com and buscamalvados.com — opens straight on the Analytics tab.",
    access: "private",
  },
];

export function resourcesForAccess(access: AccessLevel): ResourceDefinition[] {
  return resources.filter(
    (resource) => resource.access === "public" || access === "private",
  );
}

export function readResource(
  uri: string,
  access: AccessLevel,
): { resource: ResourceDefinition; body: string } | null {
  const resource = resourcesForAccess(access).find(
    (candidate) => candidate.uri === uri,
  );
  if (!resource) return null;
  const html = bundledHtml as unknown as string;
  const bootTool =
    uri === ANALYTICS_RESOURCE
      ? "SITES_OVERVIEW"
      : uri === BOOKMARKS_RESOURCE
        ? "LIST_ALL_BOOKMARKS"
        : null;
  return {
    resource,
    // the same single-file app, told which view to boot into
    body: bootTool
      ? `${html}<script>window.__BOOT_TOOL__='${bootTool}';</script>`
      : html,
  };
}
