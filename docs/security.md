# Karse security

## Is Karse safe to run against my production clusters?

Yes. Karse is read-only by design. It never sends `apply`, `create`, `delete`, `edit`, `patch`, `replace`, `scale`, `rollout`, `expose`, `label`, `annotate`, or any other mutating kubectl subcommand to a cluster. The only cluster-touching commands it runs are:

- `kubectl get nodes -o json`
- `kubectl get namespaces -o json`
- `kubectl get pods --all-namespaces -o json`
- `kubectl version -o json`
- `kubectl config view -o json`
- `kubectl config current-context`

The one thing Karse writes is the active context in your local `~/.kube/config` (via `kubectl config use-context`). That is a local file change, not a cluster operation.

## Does Karse ever talk to the internet?

No. Karse is entirely local. The backend binds to `127.0.0.1:5172` and never makes outbound network connections of its own. The only external communication is between `kubectl` and the Kubernetes API server of the cluster your context points to -- the same connection `kubectl` makes when you run it yourself in a terminal.

## Can another machine on my network reach the Karse backend?

No. The backend binds to `127.0.0.1` (loopback) only, not to `0.0.0.0`. Connections from any other machine -- even on the same LAN -- are refused at the OS level before they reach the application.

## Can a malicious website silently send requests to Karse while my browser has it open?

For the read-only `GET` routes, a foreign origin can make a cross-origin request, but the browser's same-origin policy blocks the response, so the site sees nothing. For the one mutating route (`POST /api/contexts/current`), the browser enforces a CORS preflight before sending a non-simple cross-origin JSON POST. Because the backend does not send permissive CORS headers, the preflight fails and the browser never sends the actual request.

This is a defense-in-depth position: the backend relies on CORS preflight for the mutating route rather than an explicit `Host` header allowlist. A Host-header allowlist / DNS-rebinding guard is on the roadmap (`docs/roadmap.md`, item 10) and will add a second layer of protection when implemented.

## Can someone trick Karse into running arbitrary kubectl commands?

No. The backend has no "run any kubectl" interface. The kubectl adapter exposes exactly five hard-coded functions (`listContexts`, `getCurrentContext`, `setCurrentContext`, `listNodes`, `getClusterOverview`), each of which calls a fixed argv. There is no endpoint that accepts free-form kubectl arguments. Mutating cluster commands (`apply`, `create`, `delete`, `edit`, `patch`, `replace`, `scale`, `rollout`, `expose`, `label`, `annotate`, etc.) must never be added to the adapter. Karse is for information only.

The one user-supplied input that reaches kubectl is the context name passed to `POST /api/contexts/current`. That value is:

1. Validated to be a non-empty string.
2. Rejected if it starts with `-` (which would be interpreted by kubectl as a flag).
3. Passed as a positional argument after `--`, not interpolated into a shell command, so shell injection is not possible.

## What does Karse store on my machine?

Only the audit log. Every kubectl call is appended to a rolling text file at `logs/<YYYY>/<MM>/<DD>/<HH>.log` under the repo root (or the path set by `KARSE_LOGS_DIR`). Log lines contain the timestamp and the exact kubectl command that was run -- no cluster credentials, no response data, no personal information beyond what is in a kubectl command string. Logs older than 3 months are pruned automatically at backend startup.

Karse does not write any cookies, local storage entries, databases, or other persistent state.

## Does Karse create clusters or configure authentication?

No. Karse does not create clusters, configure credentials, or add or modify entries in your kubeconfig. It expects kubectl to already be working and configured. Beyond the audit log it writes under the repo root, Karse never directly reads or writes files on your machine. Your kubeconfig, credentials, certificates, and tokens are never opened, parsed, or cached by Karse: kubectl reads what it needs and Karse only sees the command output.

## Does Karse store my kubeconfig credentials?

No. Karse reads `~/.kube/config` indirectly through `kubectl` -- it never opens, parses, or caches that file itself. Credentials (tokens, certificates, keys) that kubectl reads are never passed to, seen by, or logged by Karse.

## What does the audit log contain?

One line per kubectl invocation:

```
2026-05-29T16:42:35.123+10:00 kubectl get nodes -o json
```

Timestamps carry an explicit timezone offset. The log records the command arguments (which include context names and resource kinds) but nothing from the response. See `docs/audit-log.md` for the full format and retention policy.

## Can a Karse bug corrupt my kubeconfig?

The risk is low and bounded. The only kubeconfig write Karse performs is `kubectl config use-context <name>`, which atomically updates the `current-context` field in `~/.kube/config`. Contexts, clusters, users, and credentials are not modified. The worst a bug here can do is set the active context to an unexpected value -- the same risk as running `kubectl config use-context` yourself.

## Does Karse require any special permissions or elevated privileges?

No. Karse runs as your regular user account and inherits whatever kubeconfig contexts and cluster RBAC permissions you already have. It does not request sudo, does not install system services, and does not modify anything outside the repo directory (except `~/.kube/config` for context switching, via kubectl).

## Is the HTTP API authenticated?

No. The API is intentionally unauthenticated because it binds to `127.0.0.1` only and the sole intended client is the same-machine browser. Any process running on your machine as the same user can reach it. If you share a machine with other users, note that `127.0.0.1` is accessible to all local users, not just you -- this is an accepted risk for a local development tool.

## What is the accepted risk surface?

Two low-severity issues are accepted and documented rather than mitigated in code:

- **kubectl stderr in 500 responses**: error messages returned to the browser may contain cluster or kubeconfig detail such as server addresses or context names. This is accepted because the local user already has full access to that information -- there is no privilege boundary to protect.
- **No Host-header allowlist**: the mutating route (`POST /api/contexts/current`) is protected only by CORS preflight, not an explicit Host-header allowlist. A browser on another origin cannot silently issue a non-simple cross-origin JSON POST, so the preflight is an effective guard, but it is not the strongest possible defence. A dedicated allowlist is on the roadmap (`docs/roadmap.md`, item 10).

Both risks apply only while Karse is running on your local machine and do not affect cluster state.
