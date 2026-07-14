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
- **Clear**: open the filter and click "Clear". The button returns to "Filter: All" and every event is shown again.
- **Row click drills down**: hover an event row; the cursor becomes a pointer and the row highlights (the standard clickable-row affordance). Click the `BackOff` row. The app navigates to that event's detail page (`/events/:uid`); see the `event-detail` manual tests.

### Row filtering (the "..." menu)

The fixture seeds a `noisy` namespace holding exactly four events for this: the same `BackOff` on two pods of the `web` deployment (`web-7d9f8b6c5-x2k9p`, `web-7d9f8b6c5-q4m2t`) and on one pod of the `api` deployment (`api-6c4bdf295-jmnbk`), plus an unrelated `FailedScheduling` on a `web` pod. So `web` and `api` report *like* events, and `web` reports two different kinds of event.

**Select the `noisy` namespace** in Karse before these checks, so the table holds just those four events and the counts below match.

- **Count**: with no row filter active, the count beside the Filter dropdown reads "N of N events" (shown of total) and there is no filter bar above the table.
- **The menu**: each row ends with a "..." button. Click the one on a `BackOff` row. A menu opens with six actions under two headings: **Hide** (all like this / all like this, for this service / all from this service) and **Show only** (ones like this / ones like this, for this service / this service). Press Escape: the menu closes and you have *not* navigated to the event detail page.
- **Each action says what it covers**: open the menu on the `web-7d9f8b6c5-x2k9p` `BackOff` row and read the second line under each action. **Hide all like this** reads `Matches 3 of 4 events: "BackOff: back-off restarting failed container app in pod <object>" from any service`; **Hide all like this, for this service** reads the same group but `from noisy/web` and matches 2; **Hide all from this service** reads `Matches 3 of 4 events: everything from noisy/web`. Nothing can be hidden without the menu first saying how much it takes out and what the group is.
- **A pod whose suffix has no digit still resolves to its service**: open the menu on the `api-6c4bdf295-jmnbk` row (its random suffix is all consonants — an ordinary shape, since Kubernetes builds suffixes from an alphabet that is mostly consonants). **Hide all from this service** must read `everything from noisy/api`, *not* `everything from noisy/api-6c4bdf295-jmnbk`. If it names the whole pod, the pod is not being resolved to its service and none of its events group with its siblings'.
- **Hide all like this**: on a `web` `BackOff` row, choose **Hide all like this**. Every `BackOff` disappears — both `web` pods *and* the `api` pod, because they are like events (same reason, same message once the pod name is masked out). The `FailedScheduling` event stays.
- **Hidden indicator and count**: with that filter active, a bar appears above the table reading "3 events hidden by filters", with a chip for the filter (`Hide (any service): BackOff: back-off restarting failed container…`, its full text on the chip's tooltip) and a **Reset filters** button. The count now reads "1 of 4 events". The chip must name the *group* — the reason and the message — not just the reason: a reason alone does not say which problem was hidden.
- **Reset**: click **Reset filters**. The bar disappears, every event returns, and the count reads "4 of 4 events".
- **Hide all like this, for this service**: on a `web` `BackOff` row, choose **Hide all like this, for this service**. Only the two `web` `BackOff` events go; the `api` `BackOff` remains (it is like, but from a different service), as does `web`'s `FailedScheduling`. Reset.
- **Hide all from this service**: on a `web` row, choose **Hide all from this service**. Every `web` event goes (both `BackOff`s and the `FailedScheduling`); only the `api` event remains. Reset.
- **Show only ones like this**: on a `web` `BackOff` row, choose **Show only ones like this**. Only the three `BackOff` events show (`web` ×2 and `api`); `FailedScheduling` is hidden. Reset.
- **Show only ones like this, for this service**: only the two `web` `BackOff` events show. Reset.
- **Show only this service**: only `web`'s three events show; the `api` event is hidden. Reset.
- **Filters accumulate**: hide the `BackOff` events, then use the `FailedScheduling` row's menu to hide those too. The bar shows two chips, the table shows "No events match the current filters.", and the count reads "0 of 4 events".
- **Removing one filter**: click the X on one chip. Just that filter is dropped; the other stays active and its events remain hidden.
- **Reset restores everything**: click **Reset filters**. All four events return and the bar disappears.
- **Composes with search and the Type filter**: with a hide filter active, typing in the search box narrows further; the count always reflects what is shown.
- **Different numbers are different problems**: switch to the **`exit-codes` namespace**, which holds two `Failed` events on two pods of one `cruncher` deployment — one reading "Container exited with code 1" (a clean exit) and one "Container exited with code 137" (an out-of-memory kill). On the code-1 row choose **Hide all like this**: its menu line must read `Matches 1 of 2 events`, and after hiding, the code-137 event must still be showing. Two failures that differ only in a number saying *what* went wrong are not alike, and hiding the harmless one must never take the serious one with it. Reset.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/28-events-view/teardown.sh
```
