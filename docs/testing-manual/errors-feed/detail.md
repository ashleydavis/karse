# errors-feed manual tests

Manual tests for the Errors page. See the spec: [errors-feed](../../spec/errors-feed/detail.md).

Start the app first. From the repo root run:

```sh
bun run dev
```

Then open the frontend at `http://127.0.0.1:5173`. The scenario's fixture stands up a KWOK cluster; select the `kwok-karse-test` context in Karse. Tear each cluster down with the Teardown step at the end of this doc.

## Scenario: Errors view

A cluster seeded with one error condition from each source the Errors page surfaces: a pod stuck in `ImagePullBackOff` (a problem pod) and a `Warning` event (`FailedScheduling`). A healthy pod is also created and must never appear. Note: kwok does not generate lifecycle events or container states on its own, so the setup script patches the broken pod's container state and creates the `Warning` `Event` object by hand.

**Fixture:** [_fixtures-kwok/32-errors-view](../_fixtures-kwok/32-errors-view/)

```sh
./docs/testing-manual/_fixtures-kwok/32-errors-view/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

### What to check
- **Sidebar top link**: the "Errors" nav item (circle-exclamation icon) is the **first** item at the **top** of the left sidebar's nav list, above the other nav items. Clicking it opens the Errors page.
- **Page title**: the header shows "Errors".
- **Errors page**: the table shows columns Age, Source, Object, Reason, Message, Count, Namespace.
- **Problem pod row**: a row for `Pod/broken` with reason `ImagePullBackOff`, a red "Pod" source chip, and count 1.
- **Warning event row**: a row for `Pod/broken` with reason `FailedScheduling`, a yellow "Event" source chip, and count 4.
- **Healthy pod excluded**: there is no row for the `healthy` pod.
- **Namespace scoping**: select the `default` namespace; both error rows still appear.
- **Search**: type `ImagePullBackOff` in the search box and confirm only the problem-pod row is shown. Type a non-matching string and confirm the "No errors match the search." message appears.
- **Cross-column search**: the search box matches the text shown in *any* column, not just the reason. Confirm each of the following narrows the table to the one matching row, then clear the box and confirm both rows return:
  - **Source column**: type `Event` and confirm only the `FailedScheduling` (yellow "Event" chip) row is shown.
  - **Count column**: type `4` and confirm only the `FailedScheduling` row (count 4) is shown.
  - **Message column**: type a fragment of one row's message that does not appear in the other (e.g. part of the `FailedScheduling` event's message) and confirm only that row is shown.
  - Clearing the box restores both rows.
- **Sort**: click the Source header and confirm the table re-sorts.
- **Reason filter**: the shared "Filter: All" dropdown sits beside the search box. Open it; under the **Reason** heading it lists the error types present (`FailedScheduling` and `ImagePullBackOff`), each with a checkbox, all unchecked by default and both rows visible. Check `ImagePullBackOff` and confirm only the problem-pod row remains and the button reads "Filter: 1 selected". Check `FailedScheduling` too and confirm both rows return ("Filter: 2 selected"). Click "Clear" and confirm the selection clears, the button reads "Filter: All" again, and both rows are shown.

### Row filtering (the "..." menu)

The fixture seeds a `noisy` namespace holding exactly four Warning events (which the Errors page surfaces as errors): the same `BackOff` on two pods of the `web` deployment (`web-7d9f8b6c5-x2k9p`, `web-7d9f8b6c5-q4m2t`) and on one pod of the `api` deployment (`api-6c4bdf295-jmnbk`), plus an unrelated `FailedScheduling` on a `web` pod. So `web` and `api` report *like* errors, and `web` reports two different kinds.

**Select the `noisy` namespace** in Karse before these checks, so the table holds just those four errors and the counts below match.

- **Count**: with no row filter active, the count beside the Filter dropdown reads "4 of 4 errors" and there is no filter bar above the table.
- **The menu**: each row ends with a "..." button. Click the one on a `web` `BackOff` row. A menu opens with six actions under two headings: **Hide** (all like this / all like this, for this service / all from this service) and **Show only** (ones like this / ones like this, for this service / this service). Press Escape: the menu closes and you have *not* navigated to the error detail page.
- **Each action says what it covers**: on the `web-7d9f8b6c5-x2k9p` `BackOff` row, read the second line under each action. **Hide all like this** reads `Matches 3 of 4 errors: "BackOff: back-off restarting failed container app in pod <object>" from any service`, and **Hide all from this service** reads `Matches 3 of 4 errors: everything from noisy/web`. Nothing can be hidden without the menu first saying how much it takes out and what the group is.
- **A pod whose suffix has no digit still resolves to its service**: open the menu on the `api-6c4bdf295-jmnbk` row (its random suffix is all consonants — an ordinary shape, since Kubernetes builds suffixes from a mostly-consonant alphabet). **Hide all from this service** must read `everything from noisy/api`, *not* `everything from noisy/api-6c4bdf295-jmnbk`.
- **Hide all like this**: on a `web` `BackOff` row, choose **Hide all like this**. Every `BackOff` disappears — both `web` pods *and* the `api` pod, because they are like errors (same reason, same message once the pod name is masked out). The `FailedScheduling` error stays.
- **Hidden indicator and count**: a bar appears above the table reading "3 errors hidden by filters", with a chip for the filter (`Hide (any service): BackOff: back-off restarting failed container…`, its full text on the chip's tooltip) and a **Reset filters** button. The count reads "1 of 4 errors". The chip must name the *group* — the reason and the message — not just the reason.
- **Reset**: click **Reset filters**. The bar disappears, every error returns, and the count reads "4 of 4 errors".
- **Hide all like this, for this service**: on a `web` `BackOff` row, choose it. Only the two `web` `BackOff` errors go; the `api` `BackOff` remains (like, but a different service), as does `web`'s `FailedScheduling`. Reset.
- **Hide all from this service**: on a `web` row, choose it. Every `web` error goes; only the `api` error remains. Reset.
- **Show only ones like this**: on a `web` `BackOff` row, choose it. Only the three `BackOff` errors show. Reset.
- **Show only ones like this, for this service**: only the two `web` `BackOff` errors show. Reset.
- **Show only this service**: only `web`'s three errors show. Reset.
- **Filters accumulate**: hide the `BackOff` errors, then use the `FailedScheduling` row's menu to hide those too. The bar shows two chips, the table shows "No errors match the current filters.", and the count reads "0 of 4 errors".
- **Removing one filter**: click the X on one chip. Just that filter is dropped; the other stays active.
- **Reset restores everything**: click **Reset filters**. All four errors return and the bar disappears.

### Error detail drill-down
- **Row click**: hover an error row and confirm the cursor becomes a pointer and the row highlights (the same affordance as other resource tables). Click the `ImagePullBackOff` row and confirm the URL changes to `/errors/<n>` and an error detail page opens.
- **Breadcrumb**: the breadcrumb trail reads "Errors > Error"; clicking "Errors" returns to the list.
- **Fields**: the Details panel shows Source (`Pod`), Object (`Pod/broken`), Reason (`ImagePullBackOff`), Namespace (`default`), Count, Age, First seen, and Last seen. The First/Last seen rows show absolute timestamps with a relative age.
- **Full message**: the Message panel shows the complete error message untruncated (compare with the clipped Message column on the list).
- **Related-object link**: the Object value is a link; click it and confirm it navigates to the related pod's detail page (`/pods/default/broken`).
- **Back control**: from a detail page click the left-arrow back button and confirm it returns to the Errors list.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/32-errors-view/teardown.sh
```
