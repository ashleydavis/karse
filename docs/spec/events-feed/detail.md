# events-feed

## Overview

A table of recent Kubernetes events, drawn from many resources and shown together, to aid quick triage.

Backed by: `GET /api/events`, `backend/src/routes/events-route.ts`, `backend/src/kubectl/kubectl-adapter.ts` (`listEvents`), `frontend/src/pages/events/`.

## Behaviour

- `GET /api/events?context=<ctx>&namespace=<ns?>` returns `{ events: ClusterEvent[] }`. `context` is required; `namespace` is optional (omit for all namespaces, `-A`). Returns 500 with kubectl's stderr on failure.
- Each `ClusterEvent` has `uid` (metadata.uid; the stable identifier the detail route uses), `type` (Normal/Warning), `reason`, `message`, `count`, `source` (the reporting component, e.g. `kubelet`, from `source.component` falling back to `reportingComponent`; `""` when unknown), `firstSeen` (ISO; first occurrence, `""` when unknown), `lastSeen` (ISO; the UI computes age), `namespace`, `objectKind` (involvedObject.kind), and `objectName`. The richer `objectKind`/`objectName`/`namespace` fields let events from many resources be shown in one table.
- Events are sorted newest-first by `lastSeen`.
- The table is sortable and searchable (see `resource-search`).
- The **Object** cell (`kind/name`) is a link to that resource's own detail page, using the same shared `ResourceRef` / `resourcePath` resolver as the event detail page (see `clickable-resource-rows`). It stops click propagation, so clicking the object opens the referenced resource while clicking anywhere else on the row opens the event detail page. An object kind with no detail page renders as plain text.
- The table declares its `type` column filterable in the shared column-filter editor (see `resource-search`), so the single "Filter" dropdown beside the search box offers a **Type** group listing the event types (`Warning`, `Normal`). It shows every event by default (nothing checked); checking one or more types narrows the table to just those types. A "Clear" control clears the selection, restoring the show-all default. The button reads "Filter: All" / "Filter: N selected". The filter is a frontend-only concern (a TanStack column filter); `GET /api/events` is unchanged. Backed by `frontend/src/components/table-filter.tsx` and `frontend/src/lib/table-filter-state.ts`.
- Each row is clickable (the standard `clickable-resource-rows` affordance) and navigates to the event detail page `/events/:uid`. See `event-detail`.

### Row filtering (the per-row "..." menu)

A busy cluster reports the same handful of events over and over, so each row carries a "..." menu that hides (or shows only) the events *like* that one. The errors feed carries the identical filter; both are backed by `frontend/src/lib/event-filter.ts`, `frontend/src/lib/use-event-filters.ts`, `frontend/src/components/row-filter-menu.tsx`, and `frontend/src/components/active-row-filters.tsx`. It is a frontend-only concern (`GET /api/events` is unchanged) and it composes with the search box and the Type filter.

**The governing principle.** Grouping decides what a single click hides, so it errs towards **splitting** a group rather than merging two. Merging two kinds of problem into one group means a user who hides the harmless one also loses the serious one without being told, which is the one failure this feature must not have. Where the grouping cannot be sure, it under-groups (the user hides less than they hoped, and can see that they did), and the UI states what a group covers **before** it is applied and while it is active (see **Showing what a group covers**).

**Hashes.** Every event is given two stable hashes, so like events can be recognised as a group:

- The **details hash** is taken over the event's `reason` plus its *normalised* message.
- The **service name** is `<namespace>/<service>` (see **Service name** below).
- The **extended hash** is the details extended with the service name, so it identifies like events **for one named service**. The same failure from a different service gets a different extended hash.
- Both hashes are FNV-1a rendered as 8 hex characters. Nothing security-sensitive depends on them.

**Normalised message.** A message is normalised by masking the parts that say *where* something happened and keeping the parts that say *what* happened, then lower-casing and collapsing whitespace.

- Masked: the involved object's name (`<object>`), the namespace (`<namespace>`), the name of **any other object Kubernetes named itself** that the message mentions (also `<object>` — a replicaset's "Created pod: web-7d9f8b6c5-x2k9p" names the *pod*, not the replicaset, so without this every such event would be its own group and "hide all like this" would hide exactly one row), pod UIDs (`<uid>`), and IPv4 addresses with any port (`<address>`).
- Kept: **every other number**. An exit code, an HTTP status code, a count of nodes, and an image tag each say what went wrong, so they separate groups: "Container exited with code 1" and "Container exited with code 137" (an OOM kill) are different groups, as are a 404 and a 500 probe failure. Hiding one must never silently hide the other.
- A name is masked only where it is a whole word, so an object named `api` does not mask the "api" inside "rapid".

**Service name.** `<namespace>/<service>`, where `<service>` is the involved object's name with the suffixes Kubernetes' own name generators added taken back off. Kubernetes builds those suffixes from one alphabet — `bcdfghjklmnpqrstvwxz2456789`, which holds no vowel, no "y" and no "0", "1" or "3" — and that is what lets a generated segment be told from a hand-written one. Two consequences matter:

- A generated suffix **need contain no digit**: most of the alphabet is consonants, so `coredns-5d78c9869d-jmnbk` is an ordinary pod name and resolves to `coredns`.
- A segment holding a vowel **cannot** have been generated, so `etcd-kind-control-plane` and `nginx-alpine3` keep their whole names and are not merged with `etcd-kind-control` or `nginx`.

What is stripped depends on the object's kind, and nothing else is touched:

| Kind | Stripped |
|---|---|
| Pod | a 5-character random suffix, then its replicaset's pod-template hash (5-10 characters) or its job's cronjob timestamp (8-10 digits); or, for a statefulset's pod, an ordinal of up to 3 digits |
| ReplicaSet | its pod-template hash |
| Job | the timestamp a cronjob puts in the name of each job it creates |
| any other kind | nothing — a deployment, statefulset, daemonset, node or service carries the name a human gave it |

So an event about a pod, about its replicaset, and about its deployment all resolve to the one service — **for objects Kubernetes named itself**. That is the limit of the claim, and it is a heuristic, not a guarantee: an object named by something other than Kubernetes' own generator (a hand-made pod, or one named by an operator that generates suffixes its own way) resolves to its own literal name. The failure is then always the safe one — the object forms a service of its own rather than being merged into someone else's.

**The menu.** The last column of each row is a "..." button opening a menu of six actions — three that hide, three that show only:

| Action | Matches on |
|---|---|
| Hide all like this / Show only ones like this | the details hash |
| Hide all like this, for this service / Show only ones like this, for this service | the extended hash |
| Hide all from this service / Show only this service | the service name |

Using the menu never triggers the row's own navigation to the event detail page.

**Showing what a group covers.** A user may not hide what they cannot see, so the group is spelled out at both moments:

- **Before applying**, each action in the "..." menu carries a second line reading `Matches N of M events: "<reason>: <normalised message>" from <service | any service>` (or `everything from <service>` for a whole-service action). The count is over every event loaded, so the reach of the filter is visible before it is chosen.
- **While active**, each chip on the filter bar names the service it reaches and the group's details: `Hide (any service): BackOff: back-off restarting failed container…` (cut short to keep the chip one line, with the whole of it on the chip's tooltip). The service comes first, so it is never the part cut off. A chip reading only the reason would not say *which* problem of that reason was hidden.

**Semantics.** Filters accumulate. While any show-only filter is active an event must match at least one of them to show; any hide filter then removes whatever it matches, so a hide always beats an overlapping show-only. Adding an identical filter twice is a no-op.

**Count, indication, and reset.** A count beside the Filter dropdown always reads "N of M events" (rows shown of the total returned), so hidden events are reflected in the count. While any row filter is active, an information bar above the table indicates the filtering: it says how many events are hidden ("N events hidden by filters"), lists each active filter as a chip (which can be removed on its own), and carries a **Reset filters** button that clears every filter and restores the full list and count. When the filters hide everything the table shows "No events match the current filters."

Filters are per-page and per-session: they are not persisted, and they do not affect the cluster-overview **Errors** stat tile (a backend-computed, cluster-level count).

## Acceptance Criteria

- [x] `GET /api/events` requires `context` and optionally scopes to `namespace`.
- [x] Each event reports type, reason, message, count, last-seen, and the involved object (kind, name, namespace).
- [x] Events are sorted newest-first by last-seen.
- [x] The table is sortable and searchable.
- [x] Each row's Object cell links to the referenced resource's detail page, degrading to plain text for a kind with no detail page.
- [x] The table has a type-filter dropdown listing the event types; nothing checked shows all events, and checking types narrows to just those. A "Clear" control clears the selection back to showing all.
- [x] Every event has a stable details hash (like events across services) and an extended hash (details plus service name).
- [x] Each row has a "..." menu offering three hide actions (all like this / like this for this service / everything from this service) and the three matching show-only actions.
- [x] Hidden events are excluded from the table and reflected in the "N of M events" count.
- [x] While a row filter is active the UI indicates it: a bar states how many events are hidden and lists each active filter as a removable chip.
- [x] A "Reset filters" control clears every row filter, restoring the full list and count.
- [x] A pod named by Kubernetes resolves to the service that owns it whether or not its random suffix holds a digit (`coredns-5d78c9869d-jmnbk` → `kube-system/coredns`), and a pod, its replicaset and its deployment share one service.
- [x] A name Kubernetes did not generate is not stripped: `etcd-kind-control-plane`, `nginx-alpine3` and `my-service-v2beta1` keep their whole names, so distinct workloads are never merged into one service.
- [x] Numbers that say what went wrong separate groups: exit code 1 and exit code 137 have different details hashes, as do a 404 and a 500 probe failure.
- [x] Messages naming another object group across it: a replicaset's `SuccessfulCreate` events for different pods share one details hash.
- [x] Each "..." menu action states how many of the loaded events it covers and the group it is keyed on, before it is applied; each active chip names the service it reaches and the group's details.

## Open Questions

None.
