# errors-feed manual tests

Manual tests for the Errors page. See the spec: [errors-feed](../../spec/errors-feed/detail.md).

## Scenario: Errors view

A cluster seeded with one error condition from each source the Errors page surfaces: a pod stuck in `ImagePullBackOff` (a problem pod) and a `Warning` event (`FailedScheduling`). A healthy pod is also created and must never appear. Note: kwok does not generate lifecycle events or container states on its own, so the setup script patches the broken pod's container state and creates the `Warning` `Event` object by hand.

**Fixture:** [_fixtures-kwok/32-errors-view](../_fixtures-kwok/32-errors-view/)

```sh
./docs/testing-manual/_fixtures-kwok/32-errors-view/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

### What to check
- **Sidebar bottom link**: the "Errors" nav item (circle-exclamation icon) is pinned to the **bottom** of the left sidebar, below a divider that separates it from the main nav items at the top. Clicking it opens the Errors page.
- **Page title**: the header shows "Errors".
- **Errors page**: the table shows columns Age, Source, Object, Reason, Message, Count, Namespace.
- **Problem pod row**: a row for `Pod/broken` with reason `ImagePullBackOff`, a red "Pod" source chip, and count 1.
- **Warning event row**: a row for `Pod/broken` with reason `FailedScheduling`, a yellow "Event" source chip, and count 4.
- **Healthy pod excluded**: there is no row for the `healthy` pod.
- **Namespace scoping**: select the `default` namespace; both error rows still appear.
- **Search**: type `ImagePullBackOff` in the search box and confirm only the problem-pod row is shown. Type a non-matching string and confirm the "No errors match the search." message appears.
- **Sort**: click the Source header and confirm the table re-sorts.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/32-errors-view/teardown.sh
```
