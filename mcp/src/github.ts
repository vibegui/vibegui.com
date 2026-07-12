import type { Env } from "./env.ts";

interface ProjectRepo {
  id: string;
  name: string;
  repository: string;
}

interface GitHubUser {
  login?: string;
}

interface GitHubLabel {
  name?: string;
}

interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: string;
  html_url: string;
  user?: GitHubUser;
  labels?: GitHubLabel[];
  created_at: string;
  updated_at: string;
  pull_request?: unknown;
}

interface GitHubPull {
  id: number;
  number: number;
  title: string;
  state: string;
  html_url: string;
  user?: GitHubUser;
  labels?: GitHubLabel[];
  created_at: string;
  updated_at: string;
}

interface GitHubCommit {
  sha: string;
  html_url: string;
  commit?: {
    message?: string;
    author?: { name?: string; date?: string };
  };
  author?: GitHubUser;
}

const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export async function refreshGitHub(
  env: Env,
  projectId?: string,
): Promise<{
  refreshed: Array<{
    project_id: string;
    repository: string;
    issues: number;
    pull_requests: number;
    commits: number;
  }>;
}> {
  if (!env.GITHUB_TOKEN) {
    throw new Error(
      "GITHUB_TOKEN is not configured. Set a fine-grained read-only token as a Worker secret.",
    );
  }

  const result = projectId
    ? await env.DB.prepare(
        `SELECT id, name, repository FROM projects
         WHERE id = ? AND repository IS NOT NULL`,
      )
        .bind(projectId)
        .all<ProjectRepo>()
    : await env.DB.prepare(
        `SELECT id, name, repository FROM projects
         WHERE repository IS NOT NULL AND status = 'active'
         ORDER BY investment_mode, name
         LIMIT 25`,
      ).all<ProjectRepo>();

  const projects = result.results.filter((project) =>
    REPOSITORY_PATTERN.test(project.repository),
  );
  const refreshed = [];

  for (const project of projects) {
    const summary = await refreshProject(env, project);
    refreshed.push(summary);
  }

  return { refreshed };
}

async function refreshProject(env: Env, project: ProjectRepo) {
  const encodedRepo = project.repository
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();

  try {
    const [issuesResponse, pullsResponse, commitsResponse] = await Promise.all([
      githubFetch<GitHubIssue[]>(
        env,
        `/repos/${encodedRepo}/issues?state=open&per_page=30&sort=updated&direction=desc`,
      ),
      githubFetch<GitHubPull[]>(
        env,
        `/repos/${encodedRepo}/pulls?state=open&per_page=30&sort=updated&direction=desc`,
      ),
      githubFetch<GitHubCommit[]>(
        env,
        `/repos/${encodedRepo}/commits?author=${encodeURIComponent(env.GITHUB_USERNAME || "vibegui")}&since=${encodeURIComponent(since)}&per_page=30`,
      ),
    ]);

    const issues = issuesResponse.filter((issue) => !issue.pull_request);
    const statements: D1PreparedStatement[] = [];

    for (const issue of issues) {
      statements.push(
        upsertWorkItem(env, project.id, "issue", issue),
        upsertActivity(
          env,
          project.id,
          "issue_open",
          `${project.repository}#${issue.number}: ${issue.title}`,
          issue.html_url,
          issue.updated_at,
          issue.id,
        ),
      );
    }

    for (const pull of pullsResponse) {
      statements.push(
        upsertWorkItem(env, project.id, "pull_request", pull),
        upsertActivity(
          env,
          project.id,
          "pull_request_open",
          `${project.repository}#${pull.number}: ${pull.title}`,
          pull.html_url,
          pull.updated_at,
          pull.id,
        ),
      );
    }

    for (const commit of commitsResponse) {
      const occurredAt =
        commit.commit?.author?.date ?? new Date().toISOString();
      const firstLine =
        commit.commit?.message?.split("\n")[0] || commit.sha.slice(0, 8);
      statements.push(
        upsertActivity(
          env,
          project.id,
          "commit",
          `${project.repository}: ${firstLine}`,
          commit.html_url,
          occurredAt,
          commit.sha,
        ),
      );
    }

    statements.push(
      env.DB.prepare(
        `INSERT INTO sync_state (
          source, cursor, last_attempt_at, last_success_at, last_error
        ) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)
        ON CONFLICT(source) DO UPDATE SET
          cursor = excluded.cursor,
          last_attempt_at = CURRENT_TIMESTAMP,
          last_success_at = CURRENT_TIMESTAMP,
          last_error = NULL`,
      ).bind(`github:${project.repository}`, new Date().toISOString()),
    );

    if (statements.length > 0) {
      await env.DB.batch(statements);
    }

    return {
      project_id: project.id,
      repository: project.repository,
      issues: issues.length,
      pull_requests: pullsResponse.length,
      commits: commitsResponse.length,
    };
  } catch (error) {
    await env.DB.prepare(
      `INSERT INTO sync_state (
        source, last_attempt_at, last_error
      ) VALUES (?, CURRENT_TIMESTAMP, ?)
      ON CONFLICT(source) DO UPDATE SET
        last_attempt_at = CURRENT_TIMESTAMP,
        last_error = excluded.last_error`,
    )
      .bind(
        `github:${project.repository}`,
        error instanceof Error ? error.message : String(error),
      )
      .run();
    throw error;
  }
}

function upsertWorkItem(
  env: Env,
  projectId: string,
  kind: "issue" | "pull_request",
  item: GitHubIssue | GitHubPull,
): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT INTO work_items (
      id, project_id, source, kind, number, title, state, url, author,
      labels, created_at, updated_at, synced_at
    ) VALUES (?, ?, 'github', ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(source, project_id, kind, number) DO UPDATE SET
      title = excluded.title,
      state = excluded.state,
      url = excluded.url,
      author = excluded.author,
      labels = excluded.labels,
      updated_at = excluded.updated_at,
      synced_at = CURRENT_TIMESTAMP`,
  ).bind(
    `github:${projectId}:${kind}:${item.number}`,
    projectId,
    kind,
    item.number,
    item.title,
    item.state,
    item.html_url,
    item.user?.login ?? null,
    JSON.stringify(
      (item.labels ?? []).map((label) => label.name).filter(Boolean),
    ),
    item.created_at,
    item.updated_at,
  );
}

function upsertActivity(
  env: Env,
  projectId: string,
  kind: string,
  summary: string,
  url: string,
  occurredAt: string,
  nativeId: string | number,
): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT INTO activity_events (
      id, project_id, source, kind, summary, url, confidence, occurred_at
    ) VALUES (?, ?, 'github', ?, ?, ?, 1, ?)
    ON CONFLICT(source, kind, url, occurred_at) DO UPDATE SET
      summary = excluded.summary`,
  ).bind(
    `github:${projectId}:${kind}:${nativeId}:${occurredAt}`,
    projectId,
    kind,
    summary,
    url,
    occurredAt,
  );
}

async function githubFetch<T>(env: Env, path: string): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "user-agent": "vibegui-personal-ai-os",
      "x-github-api-version": "2022-11-28",
    },
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`GitHub request failed (${response.status}): ${detail}`);
  }
  return response.json() as Promise<T>;
}
