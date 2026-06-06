# Security

Karse is a local-only, read-only Kubernetes dashboard wrapping the locally-installed `kubectl` binary. Every change must follow every rule below.

## kubectl is read-only (invariant)

- The kubectl adapter only ever runs read commands (`get`, `version`, `config view`, `config current-context`) and the one local-kubeconfig command needed to switch contexts (`config use-context`).
- **Create / write / edit kubectl commands (`apply`, `create`, `delete`, `edit`, `patch`, `replace`, `scale`, `rollout`, `expose`, `label`, `annotate`, etc.) must never be added to `kubectl-adapter.ts`.** Karse is for information only; it must not mutate cluster state.
- The adapter exposes only specific named functions, never a "run any kubectl" interface.

## kubectl assumption

- `kubectl` must be on `PATH` and the user owns their kubeconfig. Karse only mutates kubeconfig via `kubectl config use-context`.

## Audit log

- Every kubectl invocation is logged via `audit(LOGS_DIR, "kubectl", args)` from `audit-log.ts` before the spawn. `LOGS_DIR` is a module-level constant in `kubectl-adapter.ts` set to `process.env.KARSE_LOGS_DIR ?? "../logs"`. With the backend's cwd being `backend/`, the default resolves to the repo root `logs/`. The private `kubectl(args)` helper in the adapter is the only path that calls `run("kubectl", ...)`. Do not bypass it. See `docs/audit-log.md`.

## Deployment

- **Local only.** The backend binds to `127.0.0.1` only. No CORS configuration. Karse is never deployed.

## Environment rules

- **Never use `/tmp`.** Do not read from or write to `/tmp` (no redirecting command output there, no scratch files, no logs). Background commands already capture their own output. If a scratch file is genuinely required, keep it inside the repo (e.g. a git-ignored path) rather than `/tmp`.
- **Never permanently switch directories.** Do not run a bare `cd` that persists across commands. The working directory is the repo root and must stay there. Always use absolute paths, or scope a directory change to a single command with a subshell (e.g. `(cd e2e && bunx playwright test)`).
