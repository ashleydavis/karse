# errors-feed

## Overview

A triage view that surfaces things going wrong in the cluster, unifying two read-only sources into a single table.

Backed by: `GET /api/errors`, `backend/src/routes/errors-route.ts`, `backend/src/kubectl/kubectl-adapter.ts` (`listClusterErrors`), `frontend/src/pages/errors/`, `frontend/src/pages/error-detail/`.

## Behaviour

- `GET /api/errors?context=<ctx>&namespace=<ns?>` returns `{ errors: ClusterError[] }`. `context` is required; `namespace` is optional (omit for all namespaces, `-A`).
- The adapter runs two parallel reads: `get events --field-selector=type=Warning` and `get pods`. A failure of either returns 500 with kubectl's stderr.
- Each `ClusterError` has `source` (`Event` | `Pod`), `namespace`, `objectKind`, `objectName`, `reason`, `message`, `count`, `firstSeen`, and `lastSeen`. `firstSeen` is the event's `firstTimestamp` (or the pod's `creationTimestamp`); `lastSeen` is the event's `lastTimestamp` (or the pod's start time).
- Warning events become `source: "Event"` rows. Pods are flagged as `source: "Pod"` when a container is in a known problem state (CrashLoopBackOff, ImagePullBackOff, ErrImagePull, CreateContainerConfigError, CreateContainerError, InvalidImageName, RunContainerError, Error, ContainerCannotRun, OOMKilled, ...) or the pod phase is Failed/Unknown.
- Rows are sorted newest-first by `lastSeen`. The table is sortable and searchable (see `resource-search`).
- The **Object** cell (`kind/name`) is a link to that resource's own detail page, using the same shared `ResourceRef` / `resourcePath` resolver as the detail page (see `clickable-resource-rows`). It stops click propagation, so clicking the object opens the referenced resource while clicking anywhere else on the row opens the error detail page. An object kind with no detail page renders as plain text.
- The table declares its `reason` column filterable in the shared column-filter editor (see `resource-search`), so the single "Filter" dropdown beside the search box offers a **Reason** group listing the distinct error types present, one checkbox each, in alphabetical order. Include semantics: with nothing checked (the default) every error shows; checking one or more reasons narrows the table to errors of those reasons. A "Clear" control clears the selection. The button reads "Filter: All" when nothing is checked and "Filter: N selected" otherwise. The filter composes with the search box and column sorting.

### Row filtering (the per-row "..." menu)

A busy cluster reports the same handful of errors over and over, so each row carries a "..." menu that hides (or shows only) the errors *like* that one. This is the same filter the events feed carries, described in full in [events-feed](../events-feed/detail.md#row-filtering-the-per-row--menu) and backed by the same shared code (`frontend/src/lib/event-filter.ts`, `frontend/src/lib/use-event-filters.ts`, `frontend/src/components/row-filter-menu.tsx`, `frontend/src/components/active-row-filters.tsx`). In summary:

- Every error gets a **details hash** (its reason plus its normalised message — like errors across every service) and an **extended hash** (the details plus its **service name** — like errors for one named service). The message is normalised by masking what says *where* (object names, the namespace, pod UIDs, IP addresses) and keeping what says *what* — every other number, so exit code 1 and exit code 137 stay different groups, as do a 404 and a 500. The service name is `<namespace>/<service>`, the involved object's name with the suffixes Kubernetes' own name generators added taken back off, so a pod, its replicaset and its deployment all resolve to the one service **for objects Kubernetes named itself**; anything else keeps its literal name.
- Grouping errs towards splitting a group rather than merging two, because a merged group would hide errors the user never agreed to lose.
- The "..." menu at the end of each row offers three hide actions and three show-only actions, matching on the details hash ("all like this"), the extended hash ("like this, for this service"), and the service name ("everything from this service"). Each action states how many of the loaded errors it covers and the group it is keyed on, before it is applied. Using the menu never triggers the row's own navigation to the error detail page.
- Filters accumulate: while a show-only filter is active an error must match one of them, and a hide then removes whatever it matches (a hide beats an overlapping show-only).
- A count beside the Filter dropdown always reads "N of M errors", so hidden errors are reflected in the count. While any row filter is active a bar above the table says how many errors are hidden, lists each filter as a removable chip naming the service it reaches and the group's details (its full text on the chip's tooltip), and carries a **Reset filters** button restoring the full list. With everything hidden the table shows "No errors match the current filters."
- It is frontend-only (`GET /api/errors` is unchanged), per-session, and does not affect the cluster-overview **Errors** stat tile (a backend-computed, cluster-level count).

### Error detail page

- Each error row is clickable and navigates to a per-error detail page at `/errors/:index`, following the cross-cutting `clickable-resource-rows` pattern (whole-row click, shared hover/cursor style). The Errors list has no stable per-error identifier, so a row links by its index into the unfiltered, newest-first list returned by `GET /api/errors`; the detail page re-fetches that same list and selects the matching row.
- The detail page (`frontend/src/pages/error-detail/`) shows every field shown in the table: source, object (`kind/name`), reason, namespace, count, and age, plus the **full, untruncated** message (the table clips it) and the **first-seen** and **last-seen** timestamps rendered absolutely with a relative age.
- The detail page links the related object to its own detail page via the shared `ResourceRef` / `resourcePath` resolver (see `clickable-resource-rows`): a `Pod` links to `/pods/:namespace/:name`, a `Node` to `/nodes/:name`, a `Namespace` to `/namespaces/:name`, and a Deployment / StatefulSet / DaemonSet to `/<kind>/:namespace/:name`. Object kinds without a detail page (e.g. ReplicaSet, Job) render as plain text.
- A back control (left-arrow icon button) and the breadcrumb trail (`Errors > Error`) return to the Errors list. Navigation preserves the shareable `context`/`namespace` query params.
- If the index no longer resolves to an error in the current list (e.g. the error cleared), the page shows an "Error not found" message with a back control.

## Acceptance Criteria

- [x] `GET /api/errors` requires `context` and optionally scopes to `namespace`.
- [x] Warning-type events and problem pods are unified into one `ClusterError` shape.
- [x] A pod is flagged on a known problem container reason or a Failed/Unknown phase.
- [x] Rows carry source, involved object, reason, message, count, and last-seen, sorted newest-first.
- [x] The table is sortable and searchable.
- [x] Each row's Object cell links to the referenced resource's detail page, degrading to plain text for a kind with no detail page.
- [x] A type-filter dropdown lists the error types present, one checkbox each.
- [x] Checking one or more types narrows the table to those types; the default (nothing checked) shows all errors.
- [x] A "Clear" control clears the selection, restoring the show-all default.
- [x] Every error has a stable details hash (like errors across services) and an extended hash (details plus service name).
- [x] Each row has a "..." menu offering three hide actions (all like this / like this for this service / everything from this service) and the three matching show-only actions.
- [x] Hidden errors are excluded from the table and reflected in the "N of M errors" count.
- [x] While a row filter is active the UI indicates it: a bar states how many errors are hidden and lists each active filter as a removable chip naming the group it covers.
- [x] A "Reset filters" control clears every row filter, restoring the full list and count.
- [x] Each "..." menu action states how many of the loaded errors it covers and the group it is keyed on, before it is applied.
- [x] Two errors that differ only in a number that says what went wrong (an exit code, an HTTP status) are different groups, so hiding one does not hide the other.
- [x] Each error row is clickable and navigates to a per-error detail page (`/errors/:index`).
- [x] The detail page shows every table field (source, object, reason, namespace, count, age) plus the full untruncated message.
- [x] The detail page shows the first-seen and last-seen times.
- [x] The detail page links the related object to its own detail page (via the shared resolver, any kind with a detail page), and there is a back control to the Errors list.

## Open Questions

None.
