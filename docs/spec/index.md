# Karse spec

This is the top-level index of Karse's features. Karse is a local-only, read-only Kubernetes dashboard that shells out to the locally-installed `kubectl` (and optionally `stern`) for every cluster query. See `README.md` for the layout and ID rules, and `docs/architecture.md` for how it is built.

The spec is reverse-engineered from the shipped code and the prose docs (`docs/architecture.md`, `docs/api.md`, `docs/user-guide.md`, `docs/security.md`, `docs/audit-log.md`) as of bootstrap. Every statement is backed by existing code or docs.

## Features

| ID | Spec | Implementation | Summary |
|---|---|---|---|
| [read-only-invariant](./read-only-invariant/index.md) | Settled | Complete | Karse never runs a mutating kubectl subcommand against a cluster. |
| [context-switching](./context-switching/index.md) | Settled | Complete | List kubeconfig contexts and switch the active one (tab-local and persisted). |
| [namespace-selector](./namespace-selector/index.md) | Settled | Complete | Scope views to a chosen namespace; tab-local active vs persisted default. |
| [namespace-detail](./namespace-detail/index.md) | Settled | Complete | `/namespaces/:name` page: phase, labels, annotations, quotas/limits, contained resources, commands, YAML. |
| [cluster-overview](./cluster-overview/index.md) | Settled | Complete | Cluster home page with four stat tiles for the active context. |
| [nodes-view](./nodes-view/index.md) | Settled | Complete | Read-only, sortable, searchable nodes table. |
| [node-detail](./node-detail/index.md) | Settled | Complete | `/nodes/:name` page: conditions, capacity/allocatable, addresses, pods, events. |
| [pods-view](./pods-view/index.md) | Settled | Complete | Read-only pods table, scoped to the active namespace or cluster-wide. |
| [pod-detail](./pod-detail/index.md) | Settled | Complete | `/pods/:namespace/:name` page: containers, status, restarts, events, logs. |
| [deployments-view](./deployments-view/index.md) | Settled | Complete | Read-only deployments table. |
| [statefulsets-view](./statefulsets-view/index.md) | Settled | Complete | Read-only stateful sets table. |
| [daemonsets-view](./daemonsets-view/index.md) | Settled | Complete | Read-only daemon sets table. |
| [workload-detail](./workload-detail/index.md) | Settled | Complete | Shared detail page for a deployment, stateful set, or daemon set. |
| [clickable-resource-rows](./clickable-resource-rows/index.md) | Settled | Complete | Every resource table row links to that resource's detail page. |
| [log-viewer](./log-viewer/index.md) | Settled | Complete | Read-only pod/container log viewer with container + tail selectors and a live follow. |
| [stern-live-logs](./stern-live-logs/index.md) | Settled | Complete | Multi-pod live log streaming via the `stern` binary. |
| [events-feed](./events-feed/index.md) | Settled | Complete | Recent cluster events view, sorted newest-first. |
| [errors-feed](./errors-feed/index.md) | Settled | Complete | Unified view of Warning events and problem pods. |
| [resource-search](./resource-search/index.md) | Settled | Complete | In-table search and column sorting; fuzzy on most tables, plain substring on events and errors. |
| [resource-stats](./resource-stats/index.md) | Settled | Complete | Per-page Total / Healthy / Error stats header on each resource list page. |
| [loading-indicators](./loading-indicators/index.md) | Settled | Complete | Shared loading spinner shown while a page's primary data query is in flight, across list and detail pages. |
| [quick-find](./quick-find/index.md) | Settled | Partial | Header quick-pickers for context and namespace. Global cross-kind quick-find is not yet shipped. |
| [guided-commands](./guided-commands/index.md) | Settled | Complete | Copy-only kubectl command suggestions per resource; never executed. |
| [yaml-viewer](./yaml-viewer/index.md) | Settled | Complete | View the raw YAML of a viewable resource on a detail-page sub tab. |
| [audit-log](./audit-log/index.md) | Settled | Complete | Every kubectl call is appended to a rolling on-disk audit log. |

## Not yet shipped

The following are on the roadmap (`docs/roadmap.md`) and are deliberately absent from this spec until built: namespace-aware quota/metrics views, multi-cluster overview, auto-refresh/polling controls, a global all-resources browser, networking/storage/config/batch/RBAC/CRD views, performance and metrics dashboards, and the Host-header allowlist / DNS-rebinding guard. The audit log is surfaced on disk only; an in-UI audit-log viewer is not yet shipped.
