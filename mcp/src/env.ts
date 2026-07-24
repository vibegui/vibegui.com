export interface Env {
  DB: D1Database;
  CORPUS: R2Bucket;
  AUTORAG: AiSearchInstance;
  PUBLIC_SITE_ORIGIN: string;
  PUBLIC_REPO_RAW_ORIGIN: string;
  GITHUB_USERNAME: string;
  AUTORAG_INSTANCE: string;
  MCP_PRIVATE_TOKEN?: string;
  GITHUB_TOKEN?: string;
  ANALYTICS_SALT?: string;
}

export type AccessLevel = "public" | "private";
