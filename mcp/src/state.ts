import type { Env } from "./env.ts";

type ProjectLifecycle = "draft" | "active" | "archived";
type GoalStatus = "active" | "paused" | "completed" | "cancelled";
type MemoryKind =
  | "fact"
  | "observation"
  | "preference"
  | "lesson"
  | "reflection";

export interface SaveProjectInput {
  id?: string;
  name: string;
  description?: string;
  spirit?: string;
  repository?: string | null;
  lifecycle?: ProjectLifecycle;
  current_outcome?: string;
  success_criteria?: string;
  next_review?: string | null;
  progress_percent?: number | null;
  progress_note?: string;
}

export interface CreateGoalInput {
  project_id?: string | null;
  parent_goal_id?: string | null;
  title: string;
  desired_outcome: string;
  success_criteria?: string;
  horizon?: string | null;
  current_assessment?: string;
  next_review?: string | null;
}

export interface UpdateGoalInput {
  id: string;
  title?: string;
  desired_outcome?: string;
  success_criteria?: string;
  horizon?: string | null;
  status?: GoalStatus;
  current_assessment?: string;
  next_review?: string | null;
}

export interface RememberInput {
  project_id?: string | null;
  kind: MemoryKind;
  content: string;
  source: string;
  confidence?: number;
  expires_at?: string | null;
  supersedes_id?: string | null;
}

export async function getDeclarationDashboard(env: Env) {
  const [results, scorecard] = await Promise.all([
    env.DB.prepare("SELECT * FROM strategic_results ORDER BY position").all<
      Record<string, unknown>
    >(),
    env.DB.prepare("SELECT * FROM scorecard_items ORDER BY position").all(),
  ]);

  return {
    strategic_results: results.results.map((result) => ({
      ...result,
      acceptance_criteria: parseJsonArray(result.acceptance_criteria),
      metrics: parseJsonArray(result.metrics),
    })),
    scorecard: scorecard.results,
  };
}

export async function setStrategicResultProgress(
  env: Env,
  id: string,
  progressPercent: number,
  progressNote = "",
) {
  const progress = Math.min(100, Math.max(0, Math.round(progressPercent)));
  const result = await env.DB.prepare(
    `UPDATE strategic_results
     SET progress_percent = ?, progress_note = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  )
    .bind(progress, progressNote.trim(), id)
    .run();
  if (!result.meta.changes) {
    throw new Error(`Strategic result not found: ${id}`);
  }
  return env.DB.prepare("SELECT * FROM strategic_results WHERE id = ?")
    .bind(id)
    .first();
}

export async function updateScorecardItem(
  env: Env,
  input: {
    id: string;
    current_value?: number | null;
    boolean_value?: boolean | null;
    note?: string;
  },
) {
  const existing = await env.DB.prepare(
    "SELECT * FROM scorecard_items WHERE id = ?",
  )
    .bind(input.id)
    .first<Record<string, unknown>>();
  if (!existing) throw new Error(`Scorecard item not found: ${input.id}`);

  await env.DB.prepare(
    `UPDATE scorecard_items
     SET current_value = ?, boolean_value = ?, note = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  )
    .bind(
      input.current_value === undefined
        ? existing.current_value
        : input.current_value,
      input.boolean_value === undefined
        ? existing.boolean_value
        : input.boolean_value === null
          ? null
          : input.boolean_value
            ? 1
            : 0,
      input.note === undefined ? existing.note : input.note.trim(),
      input.id,
    )
    .run();
  return env.DB.prepare("SELECT * FROM scorecard_items WHERE id = ?")
    .bind(input.id)
    .first();
}

export async function getPortfolio(env: Env) {
  const projects = await env.DB.prepare(
    `SELECT
      p.*,
      (SELECT COUNT(*) FROM goals g WHERE g.project_id = p.id AND g.status = 'active') AS active_goal_count,
      (SELECT MAX(a.occurred_at) FROM activity_events a WHERE a.project_id = p.id) AS last_activity_at,
      (SELECT COUNT(*) FROM captures c WHERE c.project_id = p.id AND c.status = 'inbox') AS inbox_count,
      (SELECT COUNT(*) FROM work_items w WHERE w.project_id = p.id AND w.state = 'open') AS open_work_item_count
    FROM projects p
    ORDER BY
      CASE p.lifecycle
        WHEN 'active' THEN 0
        WHEN 'draft' THEN 1
        ELSE 3
      END,
      p.name`,
  ).all();

  const dailyBrief = await env.DB.prepare(
    "SELECT * FROM daily_briefs ORDER BY brief_date DESC LIMIT 1",
  ).first();

  return { daily_brief: dailyBrief, projects: projects.results };
}

export async function saveProject(env: Env, input: SaveProjectInput) {
  const id = input.id?.trim() || slugify(input.name);
  if (!id) throw new Error("Project id or name is required");

  await env.DB.prepare(
    `INSERT INTO projects (
        id, name, description, spirit, repository, lifecycle,
        current_outcome, success_criteria, next_review, progress_percent,
        progress_note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        spirit = excluded.spirit,
        repository = excluded.repository,
        lifecycle = excluded.lifecycle,
        current_outcome = excluded.current_outcome,
        success_criteria = excluded.success_criteria,
        next_review = excluded.next_review,
        progress_percent = excluded.progress_percent,
        progress_note = excluded.progress_note,
        updated_at = CURRENT_TIMESTAMP`,
  )
    .bind(
      id,
      input.name.trim(),
      input.description?.trim() ?? "",
      input.spirit?.trim() ?? "",
      input.repository?.trim() || null,
      input.lifecycle ?? "draft",
      input.current_outcome?.trim() ?? "",
      input.success_criteria?.trim() ?? "",
      input.next_review ?? null,
      input.progress_percent ?? null,
      input.progress_note?.trim() ?? "",
    )
    .run();
  return getProject(env, id);
}

export async function setProjectProgress(
  env: Env,
  id: string,
  progressPercent: number,
  progressNote = "",
) {
  const boundedProgress = Math.min(
    100,
    Math.max(0, Math.round(progressPercent)),
  );
  const result = await env.DB.prepare(
    `UPDATE projects
     SET progress_percent = ?, progress_note = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  )
    .bind(boundedProgress, progressNote.trim(), id)
    .run();
  if (!result.meta.changes) throw new Error(`Project not found: ${id}`);
  return getProject(env, id);
}

export async function getProject(env: Env, id: string) {
  const project = await env.DB.prepare("SELECT * FROM projects WHERE id = ?")
    .bind(id)
    .first();
  if (!project) throw new Error(`Project not found: ${id}`);

  const [goals, memories, decisions, captures, activity, workItems] =
    await Promise.all([
      env.DB.prepare(
        `SELECT * FROM goals
       WHERE project_id = ?
       ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END,
                COALESCE(next_review, '9999-12-31'), created_at DESC`,
      )
        .bind(id)
        .all(),
      env.DB.prepare(
        `SELECT * FROM memories
       WHERE project_id = ? AND status = 'active'
         AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
       ORDER BY created_at DESC LIMIT 50`,
      )
        .bind(id)
        .all(),
      env.DB.prepare(
        "SELECT * FROM decisions WHERE project_id = ? ORDER BY decided_at DESC LIMIT 50",
      )
        .bind(id)
        .all(),
      env.DB.prepare(
        "SELECT * FROM captures WHERE project_id = ? AND status = 'inbox' ORDER BY created_at DESC",
      )
        .bind(id)
        .all(),
      env.DB.prepare(
        "SELECT * FROM activity_events WHERE project_id = ? ORDER BY occurred_at DESC LIMIT 50",
      )
        .bind(id)
        .all(),
      env.DB.prepare(
        `SELECT * FROM work_items
       WHERE project_id = ? AND state = 'open'
       ORDER BY updated_at DESC LIMIT 100`,
      )
        .bind(id)
        .all(),
    ]);

  return {
    project,
    goals: goals.results,
    memories: memories.results,
    decisions: decisions.results,
    captures: captures.results,
    activity: activity.results,
    work_items: workItems.results,
  };
}

export async function getAttentionMap(env: Env, days = 30) {
  const safeDays = Math.min(365, Math.max(1, days));
  const modifier = `-${safeDays} days`;
  const events = await env.DB.prepare(
    `SELECT
      p.id AS project_id,
      p.name AS project_name,
      p.lifecycle,
      a.source,
      a.kind,
      COUNT(*) AS event_count,
      MAX(a.occurred_at) AS last_activity_at
    FROM activity_events a
    JOIN projects p ON p.id = a.project_id
    WHERE a.occurred_at >= datetime('now', ?)
    GROUP BY p.id, p.name, p.lifecycle, a.source, a.kind
    ORDER BY event_count DESC, last_activity_at DESC`,
  )
    .bind(modifier)
    .all();

  return {
    days: safeDays,
    disclaimer:
      "Activity events are evidence of attention, not a measurement of hours or effort.",
    events: events.results,
  };
}

export async function getStaleProjects(env: Env, days = 14) {
  const safeDays = Math.min(365, Math.max(1, days));
  const modifier = `-${safeDays} days`;
  const result = await env.DB.prepare(
    `SELECT
      p.*,
      MAX(a.occurred_at) AS last_activity_at
    FROM projects p
    LEFT JOIN activity_events a ON a.project_id = p.id
    WHERE p.lifecycle = 'active'
    GROUP BY p.id
    HAVING COALESCE(MAX(a.occurred_at), p.updated_at) < datetime('now', ?)
    ORDER BY COALESCE(MAX(a.occurred_at), p.updated_at) ASC`,
  )
    .bind(modifier)
    .all();

  return { days: safeDays, projects: result.results };
}

export async function listGoals(
  env: Env,
  projectId?: string,
  status: GoalStatus | "all" = "active",
) {
  const clauses: string[] = [];
  const bindings: unknown[] = [];
  if (projectId) {
    clauses.push("g.project_id = ?");
    bindings.push(projectId);
  }
  if (status !== "all") {
    clauses.push("g.status = ?");
    bindings.push(status);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const result = await env.DB.prepare(
    `SELECT g.*, p.name AS project_name
     FROM goals g
     LEFT JOIN projects p ON p.id = g.project_id
     ${where}
     ORDER BY COALESCE(g.next_review, '9999-12-31'), g.created_at DESC`,
  )
    .bind(...bindings)
    .all();
  return { goals: result.results };
}

export async function createGoal(env: Env, input: CreateGoalInput) {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO goals (
      id, project_id, parent_goal_id, title, desired_outcome, success_criteria,
      horizon, current_assessment, next_review
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      input.project_id ?? null,
      input.parent_goal_id ?? null,
      input.title.trim(),
      input.desired_outcome.trim(),
      input.success_criteria?.trim() ?? "",
      input.horizon ?? null,
      input.current_assessment?.trim() ?? "",
      input.next_review ?? null,
    )
    .run();
  return env.DB.prepare("SELECT * FROM goals WHERE id = ?").bind(id).first();
}

export async function updateGoal(env: Env, input: UpdateGoalInput) {
  const existing = await env.DB.prepare("SELECT * FROM goals WHERE id = ?")
    .bind(input.id)
    .first<Record<string, unknown>>();
  if (!existing) throw new Error(`Goal not found: ${input.id}`);

  const nextStatus = input.status ?? (existing.status as GoalStatus);
  await env.DB.prepare(
    `UPDATE goals SET
      title = ?,
      desired_outcome = ?,
      success_criteria = ?,
      horizon = ?,
      status = ?,
      current_assessment = ?,
      next_review = ?,
      completed_at = CASE
        WHEN ? = 'completed' THEN COALESCE(completed_at, CURRENT_TIMESTAMP)
        ELSE NULL
      END,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`,
  )
    .bind(
      input.title ?? existing.title,
      input.desired_outcome ?? existing.desired_outcome,
      input.success_criteria ?? existing.success_criteria,
      input.horizon === undefined ? existing.horizon : input.horizon,
      nextStatus,
      input.current_assessment ?? existing.current_assessment,
      input.next_review === undefined
        ? existing.next_review
        : input.next_review,
      nextStatus,
      input.id,
    )
    .run();

  return env.DB.prepare("SELECT * FROM goals WHERE id = ?")
    .bind(input.id)
    .first();
}

export async function recallMemory(env: Env, projectId?: string, limit = 50) {
  const safeLimit = Math.min(200, Math.max(1, limit));
  const scopeClause = projectId
    ? "(project_id IS NULL OR project_id = ?)"
    : "project_id IS NULL";
  const statement = env.DB.prepare(
    `SELECT * FROM memories
     WHERE ${scopeClause}
       AND status = 'active'
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
     ORDER BY project_id IS NULL DESC, created_at DESC
     LIMIT ?`,
  );
  const result = projectId
    ? await statement.bind(projectId, safeLimit).all()
    : await statement.bind(safeLimit).all();
  return { memories: result.results };
}

export async function remember(env: Env, input: RememberInput) {
  const id = crypto.randomUUID();
  const confidence = Math.min(1, Math.max(0, input.confidence ?? 1));
  const statements: D1PreparedStatement[] = [];
  if (input.supersedes_id) {
    statements.push(
      env.DB.prepare(
        `UPDATE memories
         SET status = 'superseded', updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      ).bind(input.supersedes_id),
    );
  }
  statements.push(
    env.DB.prepare(
      `INSERT INTO memories (
        id, project_id, kind, content, source, confidence, supersedes_id, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      id,
      input.project_id ?? null,
      input.kind,
      input.content.trim(),
      input.source.trim(),
      confidence,
      input.supersedes_id ?? null,
      input.expires_at ?? null,
    ),
  );
  await env.DB.batch(statements);
  return env.DB.prepare("SELECT * FROM memories WHERE id = ?").bind(id).first();
}

export async function forgetMemory(env: Env, id: string) {
  const result = await env.DB.prepare(
    `UPDATE memories
     SET status = 'forgotten', updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  )
    .bind(id)
    .run();
  if (!result.meta.changes) throw new Error(`Memory not found: ${id}`);
  return { id, status: "forgotten" };
}

export async function listDecisions(env: Env, projectId?: string) {
  const result = projectId
    ? await env.DB.prepare(
        "SELECT * FROM decisions WHERE project_id = ? ORDER BY decided_at DESC",
      )
        .bind(projectId)
        .all()
    : await env.DB.prepare(
        "SELECT * FROM decisions ORDER BY decided_at DESC LIMIT 200",
      ).all();
  return { decisions: result.results };
}

export async function recordDecision(
  env: Env,
  input: {
    project_id?: string | null;
    title: string;
    decision: string;
    rationale?: string;
    source?: string;
  },
) {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO decisions (
      id, project_id, title, decision, rationale, source
    ) VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      input.project_id ?? null,
      input.title.trim(),
      input.decision.trim(),
      input.rationale?.trim() ?? "",
      input.source?.trim() ?? "studio",
    )
    .run();
  return env.DB.prepare("SELECT * FROM decisions WHERE id = ?")
    .bind(id)
    .first();
}

export async function capture(
  env: Env,
  input: {
    project_id?: string | null;
    kind?: string;
    content: string;
    source?: string;
  },
) {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO captures (id, project_id, kind, content, source)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      input.project_id ?? null,
      input.kind ?? "idea",
      input.content.trim(),
      input.source?.trim() ?? "studio",
    )
    .run();
  return env.DB.prepare("SELECT * FROM captures WHERE id = ?").bind(id).first();
}

export async function getInbox(env: Env, limit = 100) {
  const safeLimit = Math.min(500, Math.max(1, limit));
  const result = await env.DB.prepare(
    `SELECT c.*, p.name AS project_name
     FROM captures c
     LEFT JOIN projects p ON p.id = c.project_id
     WHERE c.status = 'inbox'
     ORDER BY c.created_at DESC
     LIMIT ?`,
  )
    .bind(safeLimit)
    .all();
  return { captures: result.results };
}

export async function getDailyBriefInput(env: Env, date = today()) {
  const [portfolio, goals, stale, inbox, previousBrief, decisions, activity] =
    await Promise.all([
      getPortfolio(env),
      listGoals(env, undefined, "active"),
      getStaleProjects(env, 14),
      getInbox(env, 50),
      env.DB.prepare(
        "SELECT * FROM daily_briefs WHERE brief_date < ? ORDER BY brief_date DESC LIMIT 1",
      )
        .bind(date)
        .first(),
      env.DB.prepare(
        "SELECT * FROM decisions WHERE decided_at >= datetime('now', '-7 days') ORDER BY decided_at DESC",
      ).all(),
      getAttentionMap(env, 7),
    ]);

  return {
    brief_date: date,
    generated_at: new Date().toISOString(),
    instructions: [
      "State what changed since the previous brief.",
      "Identify which goals moved and which are stale or blocked.",
      "Compare observed activity with active project goals without calling activity hours.",
      "Surface pending decisions.",
      "Recommend the smallest high-leverage next steps.",
    ],
    portfolio,
    goals: goals.goals,
    stale_projects: stale.projects,
    inbox: inbox.captures,
    recent_decisions: decisions.results,
    attention: activity,
    previous_brief: previousBrief,
  };
}

export async function saveDailyBrief(
  env: Env,
  input: { brief_date?: string; content: string; source_snapshot?: unknown },
) {
  const briefDate = input.brief_date ?? today();
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO daily_briefs (id, brief_date, content, source_snapshot)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(brief_date) DO UPDATE SET
       content = excluded.content,
       source_snapshot = excluded.source_snapshot,
       updated_at = CURRENT_TIMESTAMP`,
  )
    .bind(
      id,
      briefDate,
      input.content.trim(),
      JSON.stringify(input.source_snapshot ?? {}),
    )
    .run();
  return env.DB.prepare("SELECT * FROM daily_briefs WHERE brief_date = ?")
    .bind(briefDate)
    .first();
}

export async function getDailyBrief(env: Env, date?: string) {
  const brief = date
    ? await env.DB.prepare("SELECT * FROM daily_briefs WHERE brief_date = ?")
        .bind(date)
        .first()
    : await env.DB.prepare(
        "SELECT * FROM daily_briefs ORDER BY brief_date DESC LIMIT 1",
      ).first();
  return { brief };
}

export async function getStatus(env: Env) {
  const tables = [
    "projects",
    "goals",
    "memories",
    "decisions",
    "captures",
    "activity_events",
    "work_items",
    "daily_briefs",
  ] as const;
  const results = await env.DB.batch(
    tables.map((table) =>
      env.DB.prepare(`SELECT COUNT(*) AS count FROM ${table}`),
    ),
  );
  return {
    ok: true,
    service: "vibegui-personal-ai-os",
    private_state: Object.fromEntries(
      tables.map((table, index) => [
        table,
        Number(
          (
            results[index]?.results[0] as
              | { count?: number | string }
              | undefined
          )?.count ?? 0,
        ),
      ]),
    ),
    generated_at: new Date().toISOString(),
  };
}

export async function markBriefDue(env: Env) {
  await env.DB.prepare(
    `INSERT INTO sync_state (source, last_attempt_at, last_success_at)
     VALUES ('daily-brief-due', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(source) DO UPDATE SET
       cursor = ?,
       last_attempt_at = CURRENT_TIMESTAMP,
       last_success_at = CURRENT_TIMESTAMP,
       last_error = NULL`,
  )
    .bind(today())
    .run();
}

function slugify(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseJsonArray(value: unknown): unknown[] {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
