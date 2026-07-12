import bundledHtml from "../dist/web/index.html";
import type { AccessLevel } from "./env.ts";
import { PERSONAL_AI_OS_RESOURCE } from "./tools.ts";

export const MCP_APP_MIME = "text/html;profile=mcp-app";

export interface ResourceDefinition {
  uri: string;
  name: string;
  description: string;
  access: AccessLevel;
}

const resources: ResourceDefinition[] = [
  {
    uri: PERSONAL_AI_OS_RESOURCE,
    name: "VibeGui Personal AI OS",
    description:
      "Private project map, goals, memory, daily brief, attention evidence, and inbox.",
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
  return {
    resource,
    body: bundledHtml as unknown as string,
  };
}
