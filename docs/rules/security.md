# Security

Karse is a local-only, read-only Kubernetes dashboard wrapping the locally-installed `kubectl` binary. Every change must follow every rule below.

## kubectl is read-only (invariant)

Karse is for viewing a cluster, never changing it. Every kubectl command it runs must be read-only against the cluster. This is a hard invariant, not a default: it must hold for every change, with no exceptions.

**Why.** Karse is a dashboard. A bug, a stray click, or a malformed request must never be able to alter, restart, or delete anything in the cluster. Keeping the command set read-only means the worst case is a failed read, never an unwanted mutation.

**What "read-only" means here.** A command is read-only if it only queries the cluster. The single exception is local kubeconfig changes (see below), which touch a file on the user's machine, not the cluster.

**Allowed commands** (the only ones the adapter may run):

- `get` (list and describe resources).
- `version`.
- `config view`, `config current-context` (read local kubeconfig).
- `config use-context`, and setting a context's default namespace: the only writes Karse performs. These edit the user's local kubeconfig file, not the cluster.

**Forbidden commands** (never add these to `kubectl-adapter.ts`): any command that changes cluster state, including `apply`, `create`, `delete`, `edit`, `patch`, `replace`, `scale`, `rollout`, `expose`, `label`, `annotate`, `cordon`, `drain`, `taint`, `exec`, `cp`, `port-forward`, and `run`. The list is illustrative, not exhaustive: if a command can mutate the cluster, it is forbidden.

**How it is enforced.** The adapter exposes only specific named functions, each building a fixed argv. There is no "run arbitrary kubectl" interface, and arguments are never assembled from raw user input. To stay read-only, add a new named function with a hard-coded read command; never widen an existing one to accept caller-supplied subcommands or flags.

**Displaying commands is fine; executing them is not.** The invariant constrains what Karse *runs*, not what it *shows*. The per-resource "Commands" tab displays write, create, and destroy commands (`apply`, `delete`, `scale`, etc.) for the user to copy and run themselves in their own terminal. That is allowed, because Karse never executes them: they are text for display only. The rule is solely about commands Karse itself spawns through the adapter, all of which must be read-only.

## kubectl assumption

- `kubectl` must be on `PATH` and the user owns their kubeconfig. Karse only mutates kubeconfig via `kubectl config use-context`.

## Audit log

- Every kubectl invocation is logged via `audit(LOGS_DIR, "kubectl", args)` from `audit-log.ts` before the spawn. `LOGS_DIR` is a module-level constant in `kubectl-adapter.ts` set to `process.env.KARSE_LOGS_DIR ?? "../logs"`. With the backend's cwd being `backend/`, the default resolves to the repo root `logs/`. The private `kubectl(args)` helper in the adapter is the only path that calls `run("kubectl", ...)`. Do not bypass it. See `docs/audit-log.md`.

## Deployment

- **Local only.** The backend binds to `127.0.0.1` only. No CORS configuration. Karse is never deployed.

## Environment rules

- **Never use `/tmp`.** Do not read from or write to `/tmp` (no redirecting command output there, no scratch files, no logs). Background commands already capture their own output. If a scratch file is genuinely required, keep it inside the repo (e.g. a git-ignored path) rather than `/tmp`.
- **Never permanently switch directories.** Do not run a bare `cd` that persists across commands. The working directory is the repo root and must stay there. Always use absolute paths, or scope a directory change to a single command with a subshell (e.g. `(cd e2e && bunx playwright test)`).
