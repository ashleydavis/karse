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
- **Reason filter**: the shared "Filter: All" dropdown sits beside the search box. Open it; under the **Reason** heading it lists the error types present (`FailedScheduling` and `ImagePullBackOff`), each with a checkbox, all unchecked by default and both rows visible. Check `ImagePullBackOff` and confirm only the problem-pod row remains and the button reads "Filter: 1 selected". Check `FailedScheduling` too and confirm both rows return ("Filter: 2 selected"). Click "Deselect all" and confirm the selection clears, the button reads "Filter: All" again, and both rows are shown.

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
