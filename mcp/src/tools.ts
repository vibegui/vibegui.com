import { metricsQuery, sitesOverview, type MetricsGroup } from "./analytics.ts";
import type { AccessLevel, Env } from "./env.ts";
import { refreshGitHub } from "./github.ts";
import {
  getDeclaration,
  getPublicWriting,
  listPublicWriting,
  searchPublicWriting,
} from "./public-content.ts";
import { getCorpusStatus, searchWritingCorpus } from "./rag.ts";
import {
  capture,
  createGoal,
  forgetMemory,
  getAttentionMap,
  getDailyBrief,
  getDailyBriefInput,
  getDeclarationDashboard,
  getInbox,
  getPortfolio,
  getProject,
  getStaleProjects,
  getStatus,
  listDecisions,
  listGoals,
  recallMemory,
  recordDecision,
  remember,
  saveDailyBrief,
  saveProject,
  setProjectProgress,
  setStrategicResultProgress,
  updateScorecardItem,
  updateGoal,
} from "./state.ts";

export const PERSONAL_AI_OS_RESOURCE = "ui://vibegui/personal-ai-os/v9";

export interface ToolDefinition {
  name: string;
  description: string;
  access: AccessLevel;
  inputSchema: Record<string, unknown>;
  _meta?: { ui: { resourceUri: string } };
  execute: (env: Env, input: Record<string, unknown>) => Promise<unknown>;
}

const objectSchema = (
  properties: Record<string, unknown>,
  required: string[] = [],
): Record<string, unknown> => ({
  type: "object",
  properties,
  ...(required.length > 0 ? { required } : {}),
  additionalProperties: false,
});

export const tools: ToolDefinition[] = [
  {
    name: "SITES_OVERVIEW",
    description:
      "Resumo de analytics dos três sites (vibegui.com, poesiadairene.com, buscamalvados.com): pageviews e visitantes únicos por site, top páginas e top referrers na janela pedida. Fonte: eventos first-party gravados pelo middleware do Pages.",
    access: "private",
    inputSchema: objectSchema({
      days: {
        type: "number",
        description: "Janela em dias (1–90, padrão 7)",
      },
    }),
    _meta: { ui: { resourceUri: PERSONAL_AI_OS_RESOURCE } },
    execute: async (env, input) =>
      sitesOverview(env, optionalNumber(input, "days") ?? 7),
  },
  {
    name: "SITE_METRICS",
    description:
      "Consulta flexível dos eventos de analytics: agrupa por day, site, path, country, ref ou name, com filtros opcionais de site e nome do evento. Retorna events, value e visitantes únicos por grupo.",
    access: "private",
    inputSchema: objectSchema({
      days: { type: "number", description: "Janela em dias (1–90, padrão 7)" },
      group_by: {
        type: "string",
        enum: ["day", "site", "path", "country", "ref", "name"],
        description: "Dimensão de agrupamento (padrão: day)",
      },
      site: {
        type: "string",
        description:
          "Filtrar por site (vibegui.com | poesiadairene.com | buscamalvados.com)",
      },
      name: {
        type: "string",
        description: "Filtrar por nome do evento (ex.: pageview)",
      },
      limit: { type: "number", description: "Máximo de linhas (padrão 20)" },
    }),
    execute: async (env, input) =>
      metricsQuery(env, {
        days: optionalNumber(input, "days"),
        groupBy: optionalEnum(input, "group_by", [
          "day",
          "site",
          "path",
          "country",
          "ref",
          "name",
        ] as const) as MetricsGroup | undefined,
        site: optionalString(input, "site"),
        name: optionalString(input, "name"),
        limit: optionalNumber(input, "limit"),
      }),
  },
  {
    name: "LIST_PUBLIC_WRITING",
    description:
      "List published VibeGui articles. This is a public tool and never returns drafts or private state.",
    access: "public",
    inputSchema: objectSchema({}),
    execute: async (env) => ({ writing: await listPublicWriting(env) }),
  },
  {
    name: "GET_PUBLIC_WRITING",
    description:
      "Get one published VibeGui article by slug, including its Markdown body.",
    access: "public",
    inputSchema: objectSchema(
      { slug: { type: "string", description: "Published article slug" } },
      ["slug"],
    ),
    execute: async (env, input) =>
      getPublicWriting(env, requiredString(input, "slug")),
  },
  {
    name: "SEARCH_PUBLIC_WRITING",
    description:
      "Search published VibeGui article metadata by title, description, and tags.",
    access: "public",
    inputSchema: objectSchema(
      {
        query: { type: "string" },
        limit: { type: "number", default: 10, minimum: 1, maximum: 50 },
      },
      ["query"],
    ),
    execute: async (env, input) => {
      const query = requiredString(input, "query");
      const limit = optionalNumber(input, "limit") ?? 10;
      const citations = await searchWritingCorpus(env, query, limit);
      if (citations.length > 0) {
        const writing = await listPublicWriting(env);
        return {
          mode: "semantic",
          writing: mergeSemanticWriting(citations, writing, limit),
        };
      }
      return {
        mode: "lexical",
        writing: await searchPublicWriting(env, query, limit),
      };
    },
  },
  {
    name: "GET_DECLARATION",
    description:
      "Return the canonical VibeGui December 2026 declaration: charter, strategic outcomes, conditions of satisfaction, and scorecard.",
    access: "private",
    inputSchema: objectSchema({}),
    _meta: { ui: { resourceUri: PERSONAL_AI_OS_RESOURCE } },
    execute: async (env) => {
      const [declaration, dashboard] = await Promise.all([
        getDeclaration(env),
        getDeclarationDashboard(env),
      ]);
      return { ...declaration, ...dashboard };
    },
  },
  {
    name: "SET_STRATEGIC_RESULT_PROGRESS",
    description:
      "Update a declaration-level strategic result progress percentage and evidence-based note.",
    access: "private",
    inputSchema: objectSchema(
      {
        id: { type: "string" },
        progress_percent: {
          type: "number",
          minimum: 0,
          maximum: 100,
        },
        progress_note: { type: "string" },
      },
      ["id", "progress_percent"],
    ),
    _meta: { ui: { resourceUri: PERSONAL_AI_OS_RESOURCE } },
    execute: async (env, input) =>
      setStrategicResultProgress(
        env,
        requiredString(input, "id"),
        requiredNumber(input, "progress_percent"),
        optionalString(input, "progress_note") ?? "",
      ),
  },
  {
    name: "UPDATE_SCORECARD_ITEM",
    description:
      "Update the current numeric value or yes/no state of a declaration scorecard item.",
    access: "private",
    inputSchema: objectSchema(
      {
        id: { type: "string" },
        current_value: { type: ["number", "null"] },
        boolean_value: { type: ["boolean", "null"] },
        note: { type: "string" },
      },
      ["id"],
    ),
    _meta: { ui: { resourceUri: PERSONAL_AI_OS_RESOURCE } },
    execute: async (env, input) =>
      updateScorecardItem(env, {
        id: requiredString(input, "id"),
        current_value: optionalNullableNumber(input, "current_value"),
        boolean_value: optionalNullableBoolean(input, "boolean_value"),
        note: optionalString(input, "note"),
      }),
  },
  {
    name: "GET_PORTFOLIO",
    description:
      "Open the private Personal AI OS project map: draft, active, and archived projects with goals, progress, work, and activity.",
    access: "private",
    inputSchema: objectSchema({}),
    _meta: { ui: { resourceUri: PERSONAL_AI_OS_RESOURCE } },
    execute: async (env) => getPortfolio(env),
  },
  {
    name: "SAVE_PROJECT",
    description: "Create or update a project in the private project map.",
    access: "private",
    inputSchema: objectSchema(
      {
        id: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
        spirit: {
          type: "string",
          description: "What place this project occupies in the owner's life",
        },
        repository: {
          type: ["string", "null"],
          description: "GitHub owner/repo",
        },
        lifecycle: {
          type: "string",
          enum: ["draft", "active", "archived"],
        },
        current_outcome: { type: "string" },
        success_criteria: { type: "string" },
        next_review: { type: ["string", "null"] },
        progress_percent: {
          type: ["number", "null"],
          minimum: 0,
          maximum: 100,
        },
        progress_note: { type: "string" },
      },
      ["name"],
    ),
    _meta: { ui: { resourceUri: PERSONAL_AI_OS_RESOURCE } },
    execute: async (env, input) =>
      saveProject(env, {
        id: optionalString(input, "id"),
        name: requiredString(input, "name"),
        description: optionalString(input, "description"),
        spirit: optionalString(input, "spirit"),
        repository: optionalNullableString(input, "repository"),
        lifecycle: optionalEnum(input, "lifecycle", [
          "draft",
          "active",
          "archived",
        ]),
        current_outcome: optionalString(input, "current_outcome"),
        success_criteria: optionalString(input, "success_criteria"),
        next_review: optionalNullableString(input, "next_review"),
        progress_percent: optionalNullableNumber(input, "progress_percent"),
        progress_note: optionalString(input, "progress_note"),
      }),
  },
  {
    name: "SET_PROJECT_PROGRESS",
    description:
      "Set a project's explicit progress percentage and optional evidence-based note. Never infer this from activity volume.",
    access: "private",
    inputSchema: objectSchema(
      {
        id: { type: "string" },
        progress_percent: {
          type: "number",
          minimum: 0,
          maximum: 100,
        },
        progress_note: { type: "string" },
      },
      ["id", "progress_percent"],
    ),
    _meta: { ui: { resourceUri: PERSONAL_AI_OS_RESOURCE } },
    execute: async (env, input) =>
      setProjectProgress(
        env,
        requiredString(input, "id"),
        requiredNumber(input, "progress_percent"),
        optionalString(input, "progress_note") ?? "",
      ),
  },
  {
    name: "GET_PROJECT",
    description:
      "Get one private project with its goals, active memories, decisions, inbox, and recent activity.",
    access: "private",
    inputSchema: objectSchema(
      { id: { type: "string", description: "Project id" } },
      ["id"],
    ),
    _meta: { ui: { resourceUri: PERSONAL_AI_OS_RESOURCE } },
    execute: async (env, input) => getProject(env, requiredString(input, "id")),
  },
  {
    name: "GET_ATTENTION_MAP",
    description:
      "Summarize observed activity evidence by project. Evidence is explicitly not treated as hours or effort.",
    access: "private",
    inputSchema: objectSchema({
      days: { type: "number", default: 30, minimum: 1, maximum: 365 },
    }),
    _meta: { ui: { resourceUri: PERSONAL_AI_OS_RESOURCE } },
    execute: async (env, input) =>
      getAttentionMap(env, optionalNumber(input, "days") ?? 30),
  },
  {
    name: "GET_STALE_PROJECTS",
    description:
      "List active projects with no recent activity evidence or state update.",
    access: "private",
    inputSchema: objectSchema({
      days: { type: "number", default: 14, minimum: 1, maximum: 365 },
    }),
    _meta: { ui: { resourceUri: PERSONAL_AI_OS_RESOURCE } },
    execute: async (env, input) =>
      getStaleProjects(env, optionalNumber(input, "days") ?? 14),
  },
  {
    name: "LIST_GOALS",
    description:
      "List portfolio-wide or project-scoped goals from the private Personal AI OS.",
    access: "private",
    inputSchema: objectSchema({
      project_id: { type: "string" },
      status: {
        type: "string",
        enum: ["active", "paused", "completed", "cancelled", "all"],
        default: "active",
      },
    }),
    _meta: { ui: { resourceUri: PERSONAL_AI_OS_RESOURCE } },
    execute: async (env, input) =>
      listGoals(
        env,
        optionalString(input, "project_id"),
        optionalEnum(input, "status", [
          "active",
          "paused",
          "completed",
          "cancelled",
          "all",
        ]) ?? "active",
      ),
  },
  {
    name: "CREATE_GOAL",
    description:
      "Create a durable portfolio-wide or project-scoped goal with an outcome and success criteria.",
    access: "private",
    inputSchema: objectSchema(
      {
        project_id: { type: ["string", "null"] },
        parent_goal_id: { type: ["string", "null"] },
        title: { type: "string" },
        desired_outcome: { type: "string" },
        success_criteria: { type: "string" },
        horizon: { type: ["string", "null"] },
        current_assessment: { type: "string" },
        next_review: { type: ["string", "null"] },
      },
      ["title", "desired_outcome"],
    ),
    _meta: { ui: { resourceUri: PERSONAL_AI_OS_RESOURCE } },
    execute: async (env, input) =>
      createGoal(env, {
        project_id: optionalNullableString(input, "project_id"),
        parent_goal_id: optionalNullableString(input, "parent_goal_id"),
        title: requiredString(input, "title"),
        desired_outcome: requiredString(input, "desired_outcome"),
        success_criteria: optionalString(input, "success_criteria"),
        horizon: optionalNullableString(input, "horizon"),
        current_assessment: optionalString(input, "current_assessment"),
        next_review: optionalNullableString(input, "next_review"),
      }),
  },
  {
    name: "UPDATE_GOAL",
    description:
      "Update the assessment, outcome, status, or next review of a durable goal.",
    access: "private",
    inputSchema: objectSchema(
      {
        id: { type: "string" },
        title: { type: "string" },
        desired_outcome: { type: "string" },
        success_criteria: { type: "string" },
        horizon: { type: ["string", "null"] },
        status: {
          type: "string",
          enum: ["active", "paused", "completed", "cancelled"],
        },
        current_assessment: { type: "string" },
        next_review: { type: ["string", "null"] },
      },
      ["id"],
    ),
    _meta: { ui: { resourceUri: PERSONAL_AI_OS_RESOURCE } },
    execute: async (env, input) =>
      updateGoal(env, {
        id: requiredString(input, "id"),
        title: optionalString(input, "title"),
        desired_outcome: optionalString(input, "desired_outcome"),
        success_criteria: optionalString(input, "success_criteria"),
        horizon: optionalNullableString(input, "horizon"),
        status: optionalEnum(input, "status", [
          "active",
          "paused",
          "completed",
          "cancelled",
        ]),
        current_assessment: optionalString(input, "current_assessment"),
        next_review: optionalNullableString(input, "next_review"),
      }),
  },
  {
    name: "COMPLETE_GOAL",
    description: "Mark a durable goal completed.",
    access: "private",
    inputSchema: objectSchema(
      {
        id: { type: "string" },
        current_assessment: {
          type: "string",
          description: "Final result or assessment",
        },
      },
      ["id"],
    ),
    _meta: { ui: { resourceUri: PERSONAL_AI_OS_RESOURCE } },
    execute: async (env, input) =>
      updateGoal(env, {
        id: requiredString(input, "id"),
        status: "completed",
        current_assessment: optionalString(input, "current_assessment"),
      }),
  },
  {
    name: "RECALL_MEMORY",
    description:
      "Recall active global memory plus optional project memory. Expired, superseded, and forgotten entries are excluded.",
    access: "private",
    inputSchema: objectSchema({
      project_id: { type: "string" },
      limit: { type: "number", default: 50, minimum: 1, maximum: 200 },
    }),
    execute: async (env, input) =>
      recallMemory(
        env,
        optionalString(input, "project_id"),
        optionalNumber(input, "limit") ?? 50,
      ),
  },
  {
    name: "REMEMBER",
    description:
      "Store a durable, source-backed memory. Do not use this for routine chat or unsupported inference.",
    access: "private",
    inputSchema: objectSchema(
      {
        project_id: { type: ["string", "null"] },
        kind: {
          type: "string",
          enum: ["fact", "observation", "preference", "lesson", "reflection"],
        },
        content: { type: "string" },
        source: { type: "string" },
        confidence: { type: "number", minimum: 0, maximum: 1, default: 1 },
        expires_at: { type: ["string", "null"] },
        supersedes_id: { type: ["string", "null"] },
      },
      ["kind", "content", "source"],
    ),
    execute: async (env, input) =>
      remember(env, {
        project_id: optionalNullableString(input, "project_id"),
        kind: requiredEnum(input, "kind", [
          "fact",
          "observation",
          "preference",
          "lesson",
          "reflection",
        ]),
        content: requiredString(input, "content"),
        source: requiredString(input, "source"),
        confidence: optionalNumber(input, "confidence"),
        expires_at: optionalNullableString(input, "expires_at"),
        supersedes_id: optionalNullableString(input, "supersedes_id"),
      }),
  },
  {
    name: "SUPERSEDE_MEMORY",
    description:
      "Replace an existing memory with a corrected or more current source-backed memory.",
    access: "private",
    inputSchema: objectSchema(
      {
        supersedes_id: { type: "string" },
        project_id: { type: ["string", "null"] },
        kind: {
          type: "string",
          enum: ["fact", "observation", "preference", "lesson", "reflection"],
        },
        content: { type: "string" },
        source: { type: "string" },
        confidence: { type: "number", minimum: 0, maximum: 1, default: 1 },
        expires_at: { type: ["string", "null"] },
      },
      ["supersedes_id", "kind", "content", "source"],
    ),
    execute: async (env, input) =>
      remember(env, {
        supersedes_id: requiredString(input, "supersedes_id"),
        project_id: optionalNullableString(input, "project_id"),
        kind: requiredEnum(input, "kind", [
          "fact",
          "observation",
          "preference",
          "lesson",
          "reflection",
        ]),
        content: requiredString(input, "content"),
        source: requiredString(input, "source"),
        confidence: optionalNumber(input, "confidence"),
        expires_at: optionalNullableString(input, "expires_at"),
      }),
  },
  {
    name: "FORGET_MEMORY",
    description:
      "Mark a private memory forgotten so it no longer participates in recall.",
    access: "private",
    inputSchema: objectSchema({ id: { type: "string" } }, ["id"]),
    execute: async (env, input) =>
      forgetMemory(env, requiredString(input, "id")),
  },
  {
    name: "LIST_DECISIONS",
    description: "List immutable portfolio-wide or project-scoped decisions.",
    access: "private",
    inputSchema: objectSchema({ project_id: { type: "string" } }),
    execute: async (env, input) =>
      listDecisions(env, optionalString(input, "project_id")),
  },
  {
    name: "RECORD_DECISION",
    description:
      "Record an immutable decision and its rationale in the private Personal AI OS.",
    access: "private",
    inputSchema: objectSchema(
      {
        project_id: { type: ["string", "null"] },
        title: { type: "string" },
        decision: { type: "string" },
        rationale: { type: "string" },
        source: { type: "string", default: "studio" },
      },
      ["title", "decision"],
    ),
    execute: async (env, input) =>
      recordDecision(env, {
        project_id: optionalNullableString(input, "project_id"),
        title: requiredString(input, "title"),
        decision: requiredString(input, "decision"),
        rationale: optionalString(input, "rationale"),
        source: optionalString(input, "source"),
      }),
  },
  {
    name: "CAPTURE",
    description:
      "Capture a raw idea, distinction, project, task, source, or note into the private inbox with minimal friction.",
    access: "private",
    inputSchema: objectSchema(
      {
        project_id: { type: ["string", "null"] },
        kind: {
          type: "string",
          enum: ["idea", "distinction", "project", "task", "source", "note"],
          default: "idea",
        },
        content: { type: "string" },
        source: { type: "string", default: "studio" },
      },
      ["content"],
    ),
    _meta: { ui: { resourceUri: PERSONAL_AI_OS_RESOURCE } },
    execute: async (env, input) =>
      capture(env, {
        project_id: optionalNullableString(input, "project_id"),
        kind: optionalEnum(input, "kind", [
          "idea",
          "distinction",
          "project",
          "task",
          "source",
          "note",
        ]),
        content: requiredString(input, "content"),
        source: optionalString(input, "source"),
      }),
  },
  {
    name: "GET_INBOX",
    description: "List unresolved captures in the private inbox.",
    access: "private",
    inputSchema: objectSchema({
      limit: { type: "number", default: 100, minimum: 1, maximum: 500 },
    }),
    _meta: { ui: { resourceUri: PERSONAL_AI_OS_RESOURCE } },
    execute: async (env, input) =>
      getInbox(env, optionalNumber(input, "limit") ?? 100),
  },
  {
    name: "GET_DAILY_BRIEF_INPUT",
    description:
      "Return the deterministic private state packet that local Claude should synthesize into today's daily brief.",
    access: "private",
    inputSchema: objectSchema({
      brief_date: { type: "string", description: "YYYY-MM-DD" },
    }),
    _meta: { ui: { resourceUri: PERSONAL_AI_OS_RESOURCE } },
    execute: async (env, input) =>
      getDailyBriefInput(env, optionalString(input, "brief_date")),
  },
  {
    name: "SAVE_DAILY_BRIEF",
    description:
      "Persist a daily brief synthesized from GET_DAILY_BRIEF_INPUT.",
    access: "private",
    inputSchema: objectSchema(
      {
        brief_date: { type: "string", description: "YYYY-MM-DD" },
        content: { type: "string" },
        source_snapshot: { type: "object" },
      },
      ["content"],
    ),
    _meta: { ui: { resourceUri: PERSONAL_AI_OS_RESOURCE } },
    execute: async (env, input) =>
      saveDailyBrief(env, {
        brief_date: optionalString(input, "brief_date"),
        content: requiredString(input, "content"),
        source_snapshot: input.source_snapshot,
      }),
  },
  {
    name: "GET_DAILY_BRIEF",
    description: "Get the latest private daily brief or one by date.",
    access: "private",
    inputSchema: objectSchema({
      brief_date: { type: "string", description: "YYYY-MM-DD" },
    }),
    _meta: { ui: { resourceUri: PERSONAL_AI_OS_RESOURCE } },
    execute: async (env, input) =>
      getDailyBrief(env, optionalString(input, "brief_date")),
  },
  {
    name: "GET_CORPUS_STATUS",
    description:
      "Return the published Markdown mirror and AutoRAG indexing status. R2 is a derived retrieval corpus; Git Markdown remains canonical.",
    access: "private",
    inputSchema: objectSchema({}),
    execute: async (env) => getCorpusStatus(env),
  },
  {
    name: "REFRESH_GITHUB",
    description:
      "Refresh read-only GitHub issues, pull requests, and the owner's recent commits for all mapped repositories or one project.",
    access: "private",
    inputSchema: objectSchema({
      project_id: { type: "string" },
    }),
    _meta: { ui: { resourceUri: PERSONAL_AI_OS_RESOURCE } },
    execute: async (env, input) =>
      refreshGitHub(env, optionalString(input, "project_id")),
  },
  {
    name: "GET_STATUS",
    description:
      "Return private Personal AI OS health and record counts without exposing secret values.",
    access: "private",
    inputSchema: objectSchema({}),
    _meta: { ui: { resourceUri: PERSONAL_AI_OS_RESOURCE } },
    execute: async (env) => getStatus(env),
  },
];

export const toolByName: Record<string, ToolDefinition> = Object.fromEntries(
  tools.map((tool) => [tool.name, tool]),
);

export function toolsForAccess(access: AccessLevel): ToolDefinition[] {
  return tools.filter(
    (tool) => tool.access === "public" || access === "private",
  );
}

export function mergeSemanticWriting<
  TCitation extends { slug: string; score?: number },
  TWriting extends { slug: string },
>(
  citations: TCitation[],
  writing: TWriting[],
  limit: number,
): Array<TWriting & TCitation> {
  const bySlug = new Map(writing.map((article) => [article.slug, article]));
  const bestBySlug = new Map<string, TCitation>();

  for (const citation of citations) {
    if (!bySlug.has(citation.slug)) continue;
    const current = bestBySlug.get(citation.slug);
    if (!current || (citation.score ?? 0) > (current.score ?? 0)) {
      bestBySlug.set(citation.slug, citation);
    }
  }

  return [...bestBySlug.values()].slice(0, limit).map((citation) => ({
    ...bySlug.get(citation.slug)!,
    ...citation,
  }));
}

function requiredString(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} is required`);
  }
  return value.trim();
}

function optionalString(
  input: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new Error(`${key} must be a string`);
  return value.trim();
}

function optionalNullableString(
  input: Record<string, unknown>,
  key: string,
): string | null | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new Error(`${key} must be a string or null`);
  }
  return value.trim();
}

function optionalNumber(
  input: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${key} must be a number`);
  }
  return value;
}

function requiredNumber(input: Record<string, unknown>, key: string): number {
  const value = optionalNumber(input, key);
  if (value === undefined) throw new Error(`${key} is required`);
  return value;
}

function optionalNullableNumber(
  input: Record<string, unknown>,
  key: string,
): number | null | undefined {
  const value = input[key];
  if (value === undefined || value === null) return value;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${key} must be a number or null`);
  }
  return value;
}

function optionalNullableBoolean(
  input: Record<string, unknown>,
  key: string,
): boolean | null | undefined {
  const value = input[key];
  if (value === undefined || value === null) return value;
  if (typeof value !== "boolean") {
    throw new Error(`${key} must be a boolean or null`);
  }
  return value;
}

function requiredEnum<const T extends readonly string[]>(
  input: Record<string, unknown>,
  key: string,
  values: T,
): T[number] {
  const value = requiredString(input, key);
  if (!values.includes(value)) {
    throw new Error(`${key} must be one of: ${values.join(", ")}`);
  }
  return value as T[number];
}

function optionalEnum<const T extends readonly string[]>(
  input: Record<string, unknown>,
  key: string,
  values: T,
): T[number] | undefined {
  const value = optionalString(input, key);
  if (value === undefined) return undefined;
  if (!values.includes(value)) {
    throw new Error(`${key} must be one of: ${values.join(", ")}`);
  }
  return value as T[number];
}
