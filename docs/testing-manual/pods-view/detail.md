# pods-view manual tests

Manual tests for the pods page (`/pods`). See the spec: [pods-view](../../spec/pods-view/detail.md).

Namespace scoping is exercised here but specified under [namespace-selector](../namespace-selector/detail.md). Each scenario's fixture stands up a `karse-test` KWOK cluster; `kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse. Run the matching `teardown.sh` when done.

## Scenario A: Two pods in one namespace

**Fixture:** [_fixtures-kwok/07-two-pods-one-namespace](../_fixtures-kwok/07-two-pods-one-namespace/)

```sh
./docs/testing-manual/_fixtures-kwok/07-two-pods-one-namespace/setup.sh
```

### What to check
- **Pods page**: two rows visible with no namespace selected (all-namespaces view). Both pods show a Running phase chip and the Namespace column shows `default`. Click either row to navigate to the pod detail page; confirm the pod name, phase chip, containers table, and log viewer button are shown.
- **Namespace scoping**: open the namespace picker (layers icon or Ctrl+Shift+K), select `default`. Both pods are still shown and the Namespace column remains visible. Select a different namespace. The empty state appears.
- **Namespaces page**: navigate to `/namespaces`, click "Set as active" on `default`. Confirm the `active` chip appears and the Pods page scopes to that namespace.
- **Overview tiles**: pod count shows `2`.

## Scenario B: Two pods across two namespaces

**Fixture:** [_fixtures-kwok/08-two-pods-two-namespaces](../_fixtures-kwok/08-two-pods-two-namespaces/)

```sh
./docs/testing-manual/_fixtures-kwok/08-two-pods-two-namespaces/setup.sh
```

### What to check
- **Pods page with `namespace-a` selected**: only `pod-a` appears. Click the row to confirm navigation to the pod detail page at `/pods/namespace-a/pod-a`.
- **Pods page with `namespace-b` selected**: only `pod-b` appears.
- **Namespace picker**: `namespace-a` and `namespace-b` appear alongside the system namespaces.
- **Overview tiles**: pod count shows `2`.

## Scenario C: Many pods across many namespaces (sort, search, scoping)

5 namespaces (`team-1`..`team-5`), 4 pods each, 20 pods total across 2 nodes.

**Fixture:** [_fixtures-kwok/09-many-pods-many-namespaces](../_fixtures-kwok/09-many-pods-many-namespaces/)

```sh
./docs/testing-manual/_fixtures-kwok/09-many-pods-many-namespaces/setup.sh
```

### What to check
- **Namespace picker** (layers icon or Ctrl+Shift+K): lists `team-1` through `team-5` alongside system namespaces. Selecting one scopes all views.
- **Namespaces page**: navigate to `/namespaces` and confirm all 5 team namespaces appear. Click "Set as active" on `team-1` and confirm the `active` chip appears. Click "Set as default" and confirm the `default` chip appears.
- **Pods page per namespace**: with `team-1` active, exactly 4 pods are shown and the Namespace column is still visible.
- **All namespaces**: open the namespace picker and click "All namespaces". All 20 pods appear.
- **Sort**: click column headers to reorder pods; click again to reverse.
- **Search**: type `pod-2` and confirm only pods named `pod-2` appear across the selected namespace.
- **Overview tiles**: pod count shows `20`.

## Scenario D: Mixed pod phases (chip colours)

Four pods in `default`, one each in Running, Pending, Failed, Succeeded.

**Fixture:** [_fixtures-kwok/10-mixed-pod-phases](../_fixtures-kwok/10-mixed-pod-phases/)

```sh
./docs/testing-manual/_fixtures-kwok/10-mixed-pod-phases/setup.sh
```

### What to check
- **Pods page**: four rows in `default`, one per phase. Each row shows the correct phase chip colour.
- If KWOK overrides the patched `Failed` or `Succeeded` status back to `Running`, re-run the patch commands from the setup script and reload.

## Scenario E: Pod phase filter

Five pods in `default`, one each in Running, Pending, Succeeded, Failed, Unknown.

**Fixture:** [_fixtures-kwok/21-pod-phase-filter](../_fixtures-kwok/21-pod-phase-filter/)

```sh
./docs/testing-manual/_fixtures-kwok/21-pod-phase-filter/setup.sh
```

### What to check
- **Pods page**: five rows in `default`, one per phase. The phase filter button reads `Phase: All`.
- Click the **Phase** button (filter icon) to open the dropdown. All five phases are checked.
- **Uncheck a phase** (for example `Pending`): the matching pod row disappears and the button updates to `Phase: 4 selected`.
- **Check only one phase**: uncheck the others until just `Running` remains. Only `pod-running` is listed and the button reads `Phase: 1 selected`.
- **Uncheck every phase**: the table shows the "No pods match the search." message.
- **Re-check all phases**: all five rows return and the button reads `Phase: All`.
- The phase filter combines with the search box: searching while a subset of phases is selected narrows results further.
- If KWOK overrides a patched terminal phase back to `Running`, re-run the patch commands from the setup script and reload.
