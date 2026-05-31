# Scenario 28: Events view

A cluster seeded with a few Kubernetes events (one Warning, two Normal) across two
namespaces. Exercises the cluster- and namespace-wide Events page.

## Prerequisites

- `kwokctl` and `kubectl` on `PATH`.
- Karse running locally: `bun run dev:test` from the repo root.

## Setup

```sh
./docs/manual-testing/kwok/28-events-view/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

Note: kwok does not generate lifecycle events on its own, so the setup script
creates representative `Event` objects by hand.

## What to check

- **Events page**: navigate to `/events` (or click "Events" in the sidebar). The table
  shows columns Last seen, Type, Reason, Object, Message, Count, Namespace.
- **Type chips**: the `BackOff` event shows a yellow "Warning" chip; the `Scheduled`
  and `ScalingReplicaSet` events show a "Normal" chip.
- **Object column**: the `BackOff` row shows `Pod/nginx`; the `ScalingReplicaSet` row
  shows `Deployment/api`.
- **Count column**: the `BackOff` row shows a count of 9.
- **Sidebar**: the Events nav item (bell icon) is visible and highlighted when active.
- **Page title**: the header shows "Events".
- **Namespace scoping**: select the `default` namespace. Only the two `default` events
  (`Scheduled`, `BackOff`) appear; the `demo` `ScalingReplicaSet` event is hidden. Select
  the `demo` namespace and confirm only the `ScalingReplicaSet` event appears. Clear the
  namespace and all three events appear again.
- **Sort by Type**: click the Type header. Warning events sort to the top.
- **Search**: type `BackOff` in the search box and confirm only that row is shown. Type a
  non-matching string and confirm the "No events match the search." message appears.

## Teardown

```sh
./docs/manual-testing/kwok/28-events-view/teardown.sh
```
