# VibeGui Personal AI OS

One MCP server that becomes a persistent personal agent when connected to deco Studio.

The code is public and copyable. Personal projects, goals, memory, decisions, captures, daily briefs, credentials, and activity stay in the owner's private Cloudflare D1 database and Worker secrets.

## Capability boundary

The same `/mcp` endpoint has two modes:

- **Public, without a token:** published VibeGui writing tools only.
- **Private, with `MCP_PRIVATE_TOKEN`:** public tools plus the Personal AI OS tools and MCP App.

Private tools are omitted from `tools/list` and private resources are omitted from `resources/list` for unauthenticated clients. Guessing a private tool or resource name does not bypass the server-side check.

A bearer token proves possession, not Studio identity. Store the token only in the private Studio connection. A later version can replace it with Studio-issued OAuth/JWT validation.

## Private model

The private agent is read-only toward GitHub and project repositories. It writes only to its own state:

- projects with a draft, active, or archived lifecycle
- portfolio and project goals
- source-backed, correctable memory
- immutable decisions
- low-friction captures
- observed activity evidence
- daily briefs

Activity is evidence of attention, not a measurement of hours.

## Article corpus

`blog/articles/*.md` in Git is the only article source of truth. Articles are never stored in D1.

R2 contains a derived mirror of published Markdown under `articles/` solely for AI Search/AutoRAG:

```bash
bun run corpus:upload:remote
```

Drafts are excluded. `SEARCH_PUBLIC_WRITING` uses AI Search when indexed results are available and falls back to lexical manifest search while indexing is pending or unavailable.

## Run locally

```bash
bun install
bun run build
bunx wrangler d1 migrations apply vibegui-personal-ai-os --local
```

Create `.dev.vars`:

```dotenv
MCP_PRIVATE_TOKEN=replace-with-a-long-random-value
GITHUB_TOKEN=replace-with-a-classic-personal-access-token
```

Then:

```bash
bun run dev
```

Public MCP URL: `http://localhost:8787/mcp`

Private Studio connection:

```text
URL: http://localhost:8787/mcp
Authorization: Bearer <MCP_PRIVATE_TOKEN>
```

Never commit `.dev.vars`.

## Initial private tools

- `GET_PORTFOLIO`, `SAVE_PROJECT`, `GET_PROJECT`, `SET_PROJECT_PROGRESS`
- `GET_ATTENTION_MAP`, `GET_STALE_PROJECTS`, `REFRESH_GITHUB`
- `LIST_GOALS`, `CREATE_GOAL`, `UPDATE_GOAL`, `COMPLETE_GOAL`
- `RECALL_MEMORY`, `REMEMBER`, `SUPERSEDE_MEMORY`, `FORGET_MEMORY`
- `LIST_DECISIONS`, `RECORD_DECISION`
- `CAPTURE`, `GET_INBOX`
- `GET_DAILY_BRIEF_INPUT`, `SAVE_DAILY_BRIEF`, `GET_DAILY_BRIEF`
- `GET_DECLARATION`
- `GET_STATUS`
- `GET_CORPUS_STATUS`

The hourly cron refreshes read-only GitHub evidence when `GITHUB_TOKEN` exists and marks the daily brief as due. The first private Studio conversation can ask local Claude Code to synthesize `GET_DAILY_BRIEF_INPUT` and persist the result with `SAVE_DAILY_BRIEF`.

## Copy for yourself

This package is intentionally one-person-per-deployment:

1. Copy or fork the repository.
2. Change the Worker name and public writing adapter, or remove the public tools.
3. Create a D1 database and apply `migrations/`.
4. Set `MCP_PRIVATE_TOKEN` and `GITHUB_TOKEN`. The current single-token MVP uses a classic PAT with `repo` scope so it can read repositories owned by different accounts and organizations. The Worker itself only issues GET requests, but the credential's scope is broader than ideal; GitHub App authentication should replace it later.
5. Deploy the Worker.
6. Add its `/mcp` URL to a private Studio connection with the bearer token.
7. Ask the agent to `SAVE_PROJECT` for the first project and create its first goal.
8. Ask for `GET_DAILY_BRIEF_INPUT`, then save the resulting brief.

The project/goals/memory/briefing core has no hardcoded VibeGui project data. The public writing tools are an example module for this site.
