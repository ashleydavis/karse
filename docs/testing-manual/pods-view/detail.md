# pods-view manual tests

Manual tests for the pods page (`/pods`). See the spec: [pods-view](../../spec/pods-view/detail.md).

Start the app first. From the repo root run:

```sh
bun run dev
```

Then open the frontend at `http://127.0.0.1:5173`. Namespace scoping is exercised here but specified under [namespace-selector](../namespace-selector/detail.md). Each scenario's fixture stands up a `karse-test` KWOK cluster; `kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse. Tear each one down with the Teardown step at the end of this doc.

## Scenario A: Two pods in one namespace

**Fixture:** [_fixtures-kwok/07-two-pods-one-namespace](../_fixtures-kwok/07-two-pods-one-namespace/)

```sh
./docs/testing-manual/_fixtures-kwok/07-two-pods-one-namespace/setup.sh
```

### What to check
- **Pods page**: two rows visible with no namespace selected (all-namespaces view). Both pods show a Running status chip (under the **Status** column) and the Namespace column shows `default`. Click either row to navigate to the pod detail page; confirm the pod name, status chip, containers table, and log viewer button are shown.
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
- **Pods page**: four rows in `default`, one per phase. Each row shows the correct status chip colour (under the **Status** column).
- If KWOK overrides the patched `Failed` or `Succeeded` status back to `Running`, re-run the patch commands from the setup script and reload.

## Scenario E: Pod status filter

Five pods in `default`, one each in Running, Pending, Succeeded, Failed, Unknown.

**Fixture:** [_fixtures-kwok/21-pod-phase-filter](../_fixtures-kwok/21-pod-phase-filter/)

```sh
./docs/testing-manual/_fixtures-kwok/21-pod-phase-filter/setup.sh
```

### What to check
- **Pods page**: five rows in `default`, one per phase. The status filter button reads `Status: All` (the filter is labelled **Status**, not "Phase").
- Click the **Status** button (filter icon) to open the dropdown. All five statuses are checked.
- **Uncheck a status** (for example `Pending`): the matching pod row disappears and the button updates to `Status: 4 selected`.
- **Check only one status**: uncheck the others until just `Running` remains. Only `pod-running` is listed and the button reads `Status: 1 selected`.
- **Uncheck every status**: the table shows the "No pods match the search." message.
- **Re-check all statuses**: all five rows return and the button reads `Status: All`.
- **Deselect all / Select all**: open the dropdown and click **Deselect all** (top of the dropdown): every status unticks, the table shows the "No pods match the search." message, and the button reads `Status: 0 selected`. Click **Select all**: every status re-ticks, all five rows return, and the button reads `Status: All`. With everything ticked, **Select all** is greyed out; with nothing ticked, **Deselect all** is greyed out.
- The status filter combines with the search box: searching while a subset of statuses is selected narrows results further.
- If KWOK overrides a patched terminal phase back to `Running`, re-run the patch commands from the setup script and reload.

## Scenario E.2: Pod health filter

Reuses the phase-filter fixture: five pods in `default`, one per phase. By health these are 2 healthy (Running, Succeeded), 2 error (Failed, Unknown), and 1 "Other" (Pending). Verifies the Healthy/Error health filter beside the phase filter.

**Fixture:** [_fixtures-kwok/21-pod-phase-filter](../_fixtures-kwok/21-pod-phase-filter/)

```sh
./docs/testing-manual/_fixtures-kwok/21-pod-phase-filter/setup.sh
```

### What to check
- **Pods page**: five rows. Beside the **Phase** button is a **Health** button (filter icon) reading `Health: All`. The stats header reads `Healthy: 2` and `Error: 2`.
- Click the **Health** button. Two checkboxes are shown: **Healthy** and **Error**, both ticked.
- **Check only Error**: untick `Healthy`. Only `pod-failed` and `pod-unknown` remain (two rows) and the button reads `Health: 1 selected`. (The Pending pod is hidden too: it is neither healthy nor error.)
- **Check only Healthy**: re-tick `Healthy`, then untick `Error`. Only `pod-running` and `pod-succeeded` remain and the button reads `Health: 1 selected`.
- **Deselect all / Select all**: open the dropdown and click **Deselect all**: both boxes untick, the table shows "No pods match the search.", and the button reads `Health: 0 selected`. Click **Select all**: both boxes re-tick, all five rows return, and the button reads `Health: All`.
- The health filter combines with the search box and the phase filter: a row must pass all active filters to show.

## Scenario F: Labels column

Three pods in `default`: `web-pod` (labels `app=web`, `tier=frontend`), `db-pod` (label `app=db`), and `many-pod` (five labels: `app=many`, `tier=backend`, `env=prod`, `region=eu-west`, `version=1.2.3`), plus a labelled deployment. Verifies the Labels column renders, is searchable, and truncates many labels behind a `+N ...` control that opens a searchable modal. The same fixture also covers the deployments view's Labels column.

**Fixture:** [_fixtures-kwok/33-labels-column](../_fixtures-kwok/33-labels-column/)

```sh
./docs/testing-manual/_fixtures-kwok/33-labels-column/setup.sh
```

### What to check
- **Pods page**: a **Labels** column appears after the Age column. `web-pod` shows `app=web` and `tier=frontend` chips; `db-pod` shows an `app=db` chip.
- **Row height stays fixed**: `many-pod` has five labels but its row is the same height as the others. It shows the first three chips inline plus a `+2 ...` chip; the labels do not wrap or run off-screen.
- **Open the labels modal**: click `many-pod`'s `+2 ...` chip. A modal opens listing all five labels as chips. The pods list stays put (it does not navigate to the pod detail page).
- **Search inside the modal**: type `region` in the modal's search box. Only `region=eu-west` remains. Clear it to restore all five. Close the modal with the X.
- **Search by label value**: type `tier=frontend` in the table search box. Only `web-pod` remains (the search still matches labels hidden behind the `...` control).
- **Search by label key/value shared form**: type `app=db`. Only `db-pod` remains. Clear the search to restore all rows.
- **Deployments page** (`/deployments`): the `web-deploy` row shows `app=web` and `tier=frontend` chips in its Labels column.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/07-two-pods-one-namespace/teardown.sh
./docs/testing-manual/_fixtures-kwok/08-two-pods-two-namespaces/teardown.sh
./docs/testing-manual/_fixtures-kwok/09-many-pods-many-namespaces/teardown.sh
./docs/testing-manual/_fixtures-kwok/10-mixed-pod-phases/teardown.sh
./docs/testing-manual/_fixtures-kwok/21-pod-phase-filter/teardown.sh
./docs/testing-manual/_fixtures-kwok/33-labels-column/teardown.sh
```
