# Karse

This is the project repo: the application code and its docs. The spec is in `docs/spec/`.

## Purpose

A local-only Kubernetes dashboard wrapping the locally-installed `kubectl` binary. Read-only cluster information plus context switching. Never deployed.

- **Every commit in this repo was made by Claude.** Do not disclaim ownership of any code in this repo. If something is wrong, broken, or poorly written, own it and fix it.

## Stack

- Backend: Bun + TypeScript + Express 5. Tests use Jest (via `@swc/jest`).
- Frontend: Vite + React 19 + React Router 7 + MUI 7 + Tailwind 4, with axios, TanStack Query, TanStack Table, and Font Awesome.
- E2E tests: Playwright (`@playwright/test`).

## Repo layout

- Root `package.json` (bun workspaces).
- `backend/`: Express app and kubectl adapter.
- `frontend/`: React app.
- `e2e/`: Playwright e2e tests.
- `docs/`: guides and plans.
- `scripts/`: smoke tests and e2e runner.

## How to run

- `bun start` (or `bun run dev` for hot reload) from the repo root starts both processes concurrently via bun workspaces: backend on port 5172, frontend on port 5173. Vite proxies `/api` to the backend.
- `bun run tests:all` from the repo root runs compile, unit tests, smoke tests, and e2e tests in sequence.
- Bun workspace scripts run with each package's directory as cwd. The audit log directory is set by `KARSE_LOGS_DIR` (default `"../logs"`, resolving to the repo root `logs/` with cwd `backend/`). `scripts/smoke-tests.sh` also explicitly `cd backend` before launching.
- Local only: the backend binds to `127.0.0.1` only, with no CORS configuration.

## Rules

The enforced rule set is in `docs/rules/` (coding style, testing, documentation, security, and any others). Every change must follow it.

## Communication style

- Be simple and direct.
- Only give directly relevant information. No waffle.
- Use bullet points where possible.
- Keep it easy to understand.
