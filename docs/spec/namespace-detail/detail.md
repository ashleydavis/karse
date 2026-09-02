# namespace-detail

## Overview

A drill-down page for a single namespace, reached by clicking a row in the namespaces table. Organised into four tabs: Status, Resources, Commands, and YAML. The Commands and YAML tabs reuse the app-wide tab components (`commands-tab`, `yaml-tab-panel`), not parallel implementations.

Backed by: `GET /api/namespaces/:name`, `backend/src/routes/namespace-detail-route.ts`, `backend/src/kubectl/kubectl-adapter.ts` (`getNamespaceDetail`), `frontend/src/pages/namespace-detail/`.

## Behaviour

- The namespace name in the heading carries the two-form copy menu; a namespace is cluster-scoped, so its full path has no namespace segment. See [copy-button](../copy-button/detail.md).

- Namespace rows on `/namespaces` are clickable and navigate to `/namespaces/:name`. Clicking a row's action button (Set as active / Set as default) does not navigate; the button click is isolated from the row click.
- `GET /api/namespaces/:name` returns a `NamespaceDetail`: `name`, `phase` (status.phase, e.g. "Active"/"Terminating"), `createdAt`, `labels`, `annotations`, `resources[]`, `quotas[]`, `limits[]`. Returns 500 with kubectl's stderr when the namespace read fails; returns 400 when the `context` query parameter is missing or empty.
- The adapter runs the namespace read plus one namespace-scoped read (`-n <name>`) per kind listed on the Resources tab, all in parallel. The kinds are declared once, as a table (`NAMESPACE_RESOURCE_KINDS` in the adapter) pairing each kind's `RESOURCE_KINDS` token with the function that summarises one of its items, so adding a kind is one table entry rather than another read-and-map block.
- **The kinds listed.** Pod, Deployment, StatefulSet, DaemonSet, ReplicaSet, Job, CronJob, Service, Ingress, ConfigMap, PersistentVolumeClaim, ResourceQuota, LimitRange. Rows are grouped by kind in that declared order, the same way the All resources page groups its rows, so the two pages do not disagree about how a mixed list is arranged.
- **Secrets are never listed, in any form.** Karse refuses to read them at all (`isReadableResourceKind` in `packages/karse-types`, which rejects every form kubectl accepts, including `secrets.v1.`), because it would be rendering their contents verbatim. Listing them here would either break that refusal or produce rows that cannot be opened, so the kind is absent from the table and no secrets read is ever issued.
- **Per-kind status summaries.** Each row carries a short summary in the same style as the workload kinds: a pod's phase; a deployment's, stateful set's and replica set's `<ready>/<desired> ready`; a daemon set's `<ready>/<desired> ready` from its scheduled counts; a job's `<succeeded>/<completions> complete`; a cron job's schedule, with `(suspended)` appended when it is suspended; a service's type and cluster IP; an ingress's hosts, comma-separated (`*` for a rule with no host, `no hosts` for none); a config map's data-key count (`1 key` / `N keys`, counting binary data too); a persistent volume claim's phase; a resource quota's hard-limit count; a limit range's limit types.
- The namespace read is authoritative and re-throws on failure. Every per-kind sub-read is tolerant: if one fails, that kind contributes an empty list rather than failing the whole request, and the rest of the response is intact.
- **Quotas and limits are read once.** The `resourcequotas` and `limitranges` reads that produce the Resources-tab rows are the same reads the Status tab's Resource Quotas and Limit Ranges tables are parsed from. Neither kind is read twice.
- Each contained resource carries `kind`, `name`, a short `status` summary, and a `detailPath`. The route comes from the single shared `resourcePath` resolver (`packages/karse-types`, see [clickable-resource-rows](../clickable-resource-rows/detail.md)), so a kind with a purpose-built page lands on that page (pods, deployments, stateful sets, daemon sets) and every other kind falls back to the generic detail page (see [generic-detail](../generic-detail/detail.md)) rather than being dead text. No route strings are built by hand. The Resources tab table is searchable (fuzzy) and sortable across every listed kind; rows with a `detailPath` navigate on click, and the table renders in capped batches (the shared row-render limit) so a namespace holding many config maps stays usable.
- The Status tab shows the namespace's status (its lifecycle phase, e.g. Active/Terminating, under a row labelled "Status"; phase and status are the same concept here, see the **Status vs phase naming** note in `resource-search`), age, a **Resources** count, annotations, resource quotas (each quota's hard limits), and limit ranges (one row per limit type/resource with min/max/default). The namespace's labels live on their own Labels tab (see `labels-tab`), not inline on the Status tab.
- **Resources count.** The Status-tab Resources stat is the number of **pods** in the namespace, the same definition the namespaces list column uses (see `namespace-selector`), so the same namespace shows the same number on the list and the detail page. It is derived from the `resources[]` already returned (counting `kind === "Pod"`), not a separate call, so a tolerated/failed pod sub-read degrades to 0 rather than breaking the page. The Resources **tab** lists every kind above; only the headline count is pods, and widening the tab's kinds does not move it.
- The Commands tab shows guided, copy-only `kubectl` commands for the namespace (describe, get YAML, get all, get events, get resource quotas, delete); these are never executed (see `guided-commands`).
- The Labels tab shows the namespace's own labels as a searchable, sortable Key / Value table (see `labels-tab`).
- The YAML tab renders the namespace's raw YAML via the shared YAML tab panel (see `yaml-viewer`).
- The breadcrumb trail for `/namespaces/:name` is `Namespaces > <name>`.
- **Breadcrumb truncation (cross-cutting).** The nav-bar breadcrumb trail never wraps onto a second line or grows the nav-bar height. Two rules keep it on one line, applied to every detail page's trail (pod, node, namespace, and any deeper trail):
  - **Trail cap.** The trail shows at most 4 crumbs. A longer trail keeps the first (root) crumb and the last 2 crumbs and replaces the inner crumbs with a single non-linked `...` crumb. The first (root) and last (current) crumbs are always visible.
  - **Name middle-truncation.** A single resource-name crumb longer than 24 characters is middle-truncated: the middle is replaced with `...` so the start and end of the name stay visible (e.g. `really-long-pod-...0123456789`). Static labels (list-page names, sub-tab names) are never truncated.

## Acceptance Criteria

- [x] A `/namespaces/:name` route exists and namespace rows link to it.
- [x] Tabs present: Status (stats), Resources (with search + sort), Labels, Commands, YAML.
- [x] The Status tab shows useful namespace info beyond the name: phase, annotations, and resource quotas / limit ranges when present; labels are on the Labels tab (see `labels-tab`).
- [x] The Status-tab Resources count is pods-only, matching the namespaces list column, so the same namespace shows the same number on both pages.
- [x] `GET /api/namespaces/:name` returns phase, labels, annotations, contained resources, quotas, and limits; a failed namespace read returns HTTP 500; failed sub-reads degrade to empty lists.
- [x] Contained resources link to their own detail pages.
- [x] The Resources tab lists ConfigMaps, Services, ResourceQuotas, LimitRanges, PersistentVolumeClaims, Jobs, CronJobs, ReplicaSets and Ingresses as well as the four workload kinds, each with a kind-appropriate status summary and a route resolved through `resourcePath`.
- [x] Secrets are never listed and never read.
- [x] The resource-quota and limit-range reads are not duplicated between the Status tab and the Resources tab.
- [x] The YAML and Commands tabs reuse the app-wide tab components rather than parallel implementations.

## Open Questions

None.
