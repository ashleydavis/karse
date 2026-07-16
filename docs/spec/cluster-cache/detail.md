# cluster-cache

## Overview

To avoid re-running `kubectl` on every request, Karse caches each read-only cluster query on disk. A read is served from the cache while it is still fresh; once it is older than the configured staleness threshold it is re-fetched from the cluster. The cache holds read output only and never a cluster write, so the read-only invariant (see `read-only-invariant`) still holds.

Backed by: `backend/src/kubectl/cache.ts` (the cache store and config), `backend/src/kubectl/kubectl-adapter.ts` (the private `kubectl(args)` helper reads/writes the cache), `backend/src/routes/cache-route.ts` (the config + clear endpoints), `frontend/src/pages/config/index.tsx` (the config page), and `frontend/src/components/header.tsx` (the navbar refresh button clears the cache).

## Behaviour

- Every successful *cluster* read routed through the adapter's `kubectl(args)` helper (`kubectl get …`, `kubectl version`, the raw Metrics API reads) is written to the cache as a JSON file, stamped with the local-ISO date/time it was saved.
- The per-query cache key is a SHA-256 digest of the kubectl argv (joined by spaces), so distinct argvs — including different `--context`, namespace, or resource kind — never collide on one key.
- On a read, if a cached entry exists and its saved stamp is within the staleness threshold, the cached result is returned without spawning `kubectl`. Otherwise (stale or absent) `kubectl` is run live and the fresh successful result re-cached.
- A failed read (non-zero exit) is never cached, so a transient error is not served back on the next request.
- No `kubectl config …` command is cached. The writes (`config use-context`, `config set-context --namespace`, `config unset contexts.*.namespace`) always run live; the local-kubeconfig reads (`config view`, `config current-context`) are also always read fresh so a context/namespace switch is reflected immediately rather than masked by a still-fresh cache entry. Streamed reads (`kubectl logs -f`) are not cached.
- The staleness threshold is configurable in the UI on the Config page (`/config`), persisted server-side, and read on every request. A threshold of `0` disables the cache (every read is treated as stale and re-fetched).
- The cache directory is `KARSE_CACHE_DIR` (default `../cache`, which resolves to the repo-root `cache/` given the backend's `backend/` cwd). It holds one JSON file per cached query plus a single `config.json` holding the threshold.
- Clicking the navbar refresh button empties the cache (deletes every cached entry, preserving the threshold) and then re-fetches, so the next request returns fresh `kubectl` data.
- Refresh re-fetches **every** view, on whatever page it is clicked: it invalidates all client-side queries rather than a named subset, so each page currently on screen (Cluster, Nodes, Pods, Deployments, StatefulSets, DaemonSets, Events, Errors, All resources, the detail pages, and the performance panels) issues its own fresh request. This is a requirement, not an implementation detail: a page added later must be refreshed without anyone remembering to register its query key.
- The refresh button gives visible feedback so a click is unmistakably acknowledged even when the refetched data is identical: while the refetch is in flight the icon spins and the button is disabled (in-progress) and a bottom "Refreshing…" toast shows, and on completion it briefly shows a check and a "Refreshed" toast before returning to its resting state. The prominent toast is what makes the acknowledgement unmissable; the small header icon alone is easy to overlook. Without this a working refresh that returns unchanged data is indistinguishable from a dead button.
- This feedback is driven on a timer, not on the query invalidation completing. Invalidating all queries returns a promise that only settles once every active background refetch has (the shared cluster-performance query among them), so gating the feedback on it held the acknowledgement hostage to the slowest request on the page: on a cluster with no Metrics API the performance refetch does not come back promptly and aborts only at the 15s load timeout (`LOAD_TIMEOUT_MS`), which pinned the button in the in-progress state for that whole window and delayed the acknowledgement and re-enable by some 15 seconds — long enough to read as a dead button (reported on the Cluster page). The refetch requests still fire; the acknowledgement simply does not wait on them.

## API

- `GET /api/cache/config` → `{ stalenessSeconds: number }`: the current threshold.
- `PUT /api/cache/config` with `{ stalenessSeconds: number }` → the stored config. Rejects a non-number or negative value with 400.
- `POST /api/cache/clear` → `{ cleared: true }`: empties the cache (entries only; the config is preserved).

## Acceptance Criteria

- [x] `kubectl` results are cached to local JSON files as they are fetched.
- [x] Each cached file is stamped with the local date/time it was saved.
- [x] When cached data is older than the configured threshold, Karse fetches fresh data via `kubectl`; otherwise it serves the cache.
- [x] The staleness threshold is configurable from a config page in the UI and persisted.
- [x] The navbar refresh button empties the local cache (then re-fetches).
- [x] Refresh re-fetches on every page that shows cluster data, not a fixed subset of them.
- [x] The refresh button visibly acknowledges a click: a spinning, disabled in-progress state plus a prominent toast while refetching and a brief completion confirmation, on every page including Cluster (the acknowledgement never hangs), so a refresh returning identical data is not mistaken for a dead button.
- [x] The read-only invariant is preserved: only read output is cached, never a cluster write, and write commands bypass the cache.
- [x] A failed read is not cached.

## Open Questions

None.
