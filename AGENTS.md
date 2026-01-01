# Agent Instructions

Guidelines for AI agents working on this repository.

## Git Operations

- **Never auto-push**: After committing changes, wait for the user to review and push manually. Only push when explicitly requested.
- **Commit often**: Small, focused commits with clear messages are preferred.
- **Use conventional commits**: `type(scope): message` format.

## Build & Deploy

- Always run `bun run fmt` after making code changes.
- Test locally with `bun run preview` before committing.
- The `pages:build` script is for Cloudflare — it doesn't run Vite.

## Content Management

- Use the MCP writing tools for article CRUD operations.
- Articles should follow the tone in `context/GUILHERME_TONE_OF_VOICE.md`.
- Don't publish articles without user review.

## Code Style

- Follow existing patterns in the codebase.
- Prefer simplicity over abstraction.
- No unnecessary dependencies.
