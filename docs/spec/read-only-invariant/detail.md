# read-only-invariant

## Overview

Karse is a viewer, not a management tool. The kubectl adapter (`backend/src/kubectl/kubectl-adapter.ts`) is the only place that invokes kubectl. It exposes a fixed set of named async functions, each of which builds a hard-coded argv and runs it through the private `kubectl(args)` helper (or `streamPodLogs`). There is no endpoint or function that accepts free-form kubectl arguments.

## Behaviour

- Every cluster-touching command is a read: `kubectl get ...`, `kubectl version`, `kubectl config view`, `kubectl config current-context`, `kubectl logs`, `kubectl logs -f`.
- The only writes Karse performs are to the local kubeconfig, never to a cluster:
  - `kubectl config use-context <name>` (switch active context).
  - `kubectl config set-context <ctx> --namespace=<ns>` and `kubectl config unset contexts.<ctx>.namespace` (set/clear a context's default namespace).
- No mutating cluster subcommand (`apply`, `create`, `delete`, `edit`, `patch`, `replace`, `scale`, `rollout`, `expose`, `label`, `annotate`, etc.) is ever invoked by the adapter.
- The only user-supplied value that reaches kubectl as a write argument is the context name on `POST /api/contexts/current`. It is validated to be a non-empty string, rejected if it begins with `-`, and passed as a positional argument (not interpolated into a shell), so shell injection is not possible.
- The guided-commands feature (see `guided-commands`) generates mutating kubectl strings as text for the user to copy, but Karse itself never executes them.
- The stern integration (see `stern-live-logs`) runs the external `stern` binary in read/tail mode only.

## Acceptance Criteria

- [x] The kubectl adapter is the only module that invokes kubectl.
- [x] No mutating cluster subcommand is present anywhere in the adapter.
- [x] The only kubeconfig writes are `config use-context`, `config set-context --namespace`, and `config unset contexts.*.namespace`.
- [x] No endpoint accepts free-form kubectl arguments; each adapter function builds a fixed argv.
- [x] The context name on `POST /api/contexts/current` is validated (non-empty, no leading `-`) and passed as a positional argument.

## Open Questions

None. (The `docs/security.md` "five hard-coded functions" wording predates later read-only additions such as `listPods`, `listEvents`, `getPodLogs`, and the YAML and workload reads; the invariant it states still holds, but the function count is out of date. Updating that prose is tracked separately and out of scope here.)
