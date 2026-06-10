# events-feed manual tests

Manual tests for the Events page (`/events`). See the spec: [events-feed](../../spec/events-feed/detail.md).

Start the app first. From the repo root run:

```sh
bun run dev
```

Then open the frontend at `http://127.0.0.1:5173`. The scenario's fixture stands up a KWOK cluster; select the `kwok-karse-test` context in Karse. Tear each cluster down with the Teardown step at the end of this doc.

## Scenario: Events view

A cluster seeded with a few events (one Warning, two Normal) across two namespaces. Note: kwok does not generate lifecycle events on its own, so the setup script creates representative `Event` objects by hand.

**Fixture:** [_fixtures-kwok/28-events-view](../_fixtures-kwok/28-events-view/)

```sh
./docs/testing-manual/_fixtures-kwok/28-events-view/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

### What to check
- **Events page**: navigate to `/events` (or click "Events" in the sidebar). The table shows columns Last seen, Type, Reason, Object, Message, Count, Namespace.
- **Type chips**: the `BackOff` event shows a yellow "Warning" chip; the `Scheduled` and `ScalingReplicaSet` events show a "Normal" chip.
- **Object column**: the `BackOff` row shows `Pod/nginx`; the `ScalingReplicaSet` row shows `Deployment/api`.
- **Count column**: the `BackOff` row shows a count of 9.
- **Sidebar**: the Events nav item (bell icon) is visible and highlighted when active.
- **Page title**: the header shows "Events".
- **Namespace scoping**: select the `default` namespace. Only the two `default` events (`Scheduled`, `BackOff`) appear; the `demo` `ScalingReplicaSet` event is hidden. Select the `demo` namespace and confirm only the `ScalingReplicaSet` event appears. Clear the namespace and all three events appear again.
- **Sort by Type**: click the Type header. Warning events sort to the top.
- **Search**: type `BackOff` in the search box and confirm only that row is shown. Type a non-matching string and confirm the "No events match the search." message appears.
- **Type filter (default)**: the shared filter button next to the search reads "Filter: All" and every event is shown.
- **Type filter (narrow)**: open the filter and, under the **Type** heading, check `Warning`. The button reads "Filter: 1 selected" and only the `Warning` event (`BackOff`) remains; the `Normal` events are hidden. Also check `Normal`: the button reads "Filter: 2 selected" and all events return.
- **Type filter (only Normal)**: uncheck `Warning` so only `Normal` is checked. Only the `Normal` events appear.
- **Deselect all**: open the filter and click "Deselect all". The button returns to "Filter: All" and every event is shown again.
- **Row click drills down**: hover an event row; the cursor becomes a pointer and the row highlights (the standard clickable-row affordance). Click the `BackOff` row. The app navigates to that event's detail page (`/events/:uid`); see the `event-detail` manual tests.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/28-events-view/teardown.sh
```
