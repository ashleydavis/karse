# namespace-detail manual tests

Manual tests for the namespace detail page. See the spec: [namespace-detail](../../spec/namespace-detail/detail.md).

The fixture stands up a `karse-test` KWOK cluster; `kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse. Tear it down with the Teardown step at the end of this doc.

## Scenario: Namespace detail page and its tabs

A namespace `team-a` with labels and annotations, holding a deployment and a stateful set (and their pods), plus a resource quota and a limit range.

**Fixture:** [_fixtures-kwok/34-namespace-detail](../_fixtures-kwok/34-namespace-detail/)

```sh
./docs/testing-manual/_fixtures-kwok/34-namespace-detail/setup.sh
```

### Navigating to the page
- Navigate to `/namespaces`. Confirm a `team-a` row appears.
- Click the `team-a` row body (the name cell, not an action button). Confirm the browser navigates to `/namespaces/team-a`.
- Confirm clicking a row's "Set as active" / "Set as default" button does NOT navigate to the detail page (it stays on `/namespaces`).
- The breadcrumb trail shows `Namespaces > team-a`. The back arrow returns to `/namespaces`.

### Header
- The namespace name `team-a` appears as the heading.
- A green `Active` status chip appears next to the name.
- A tab bar shows four tabs: "Status", "Resources", "Commands", "YAML". "Status" is selected by default.

### Status tab (default)
- The Details card shows Name, Status (`Active`), Age, and a Resources count.
- The Resources count is the **pod count only** (3: the two `web` deployment pods plus the one `db` stateful set pod), not the total of all kinds. It must match the number shown in the `team-a` row's Resources column on the `/namespaces` list page. Cross-check: note the Resources count on the `/namespaces` list for `team-a`, open the detail page, and confirm the Details-tab Resources count is the same number.
- The Labels card shows `team=alpha` and `tier=backend`.
- The Annotations table shows `owner` (= `platform-team`) and `description`.
- The Resource Quotas table shows the `compute-quota` rows: `requests.cpu` = `4`, `requests.memory` = `8Gi`, `pods` = `10`.
- The Limit Ranges table shows a `Container` / `memory` row with min `64Mi`, max `1Gi`, default request `128Mi`, default limit `256Mi`.

### Resources tab
- Click the "Resources" tab.
- A searchable, sortable table lists the resources in the namespace: the `web` Deployment, the `db` StatefulSet, and the pods they create (kind `Pod`).
- Type `Deployment` in the search box. The table narrows to the `web` Deployment row. Clear the search to restore all rows.
- Click the "Kind" header to sort. Confirm the rows reorder by kind.
- Click a Pod row. Confirm navigation to that pod's detail page (`/pods/team-a/<pod>`). Use the back arrow to return.

### Commands tab
- Click the "Commands" tab.
- The read-only note appears. The command list includes `kubectl describe namespace team-a`, `kubectl get all -n team-a`, and `kubectl get resourcequotas -n team-a`.
- The search box narrows the command list.

### YAML tab
- Click the "YAML" tab.
- The raw namespace YAML renders, including `kind: Namespace` and `name: team-a`.

### Tab switching
- Switch back to "Status". Confirm the Details cards reappear and the Resources table disappears.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/34-namespace-detail/teardown.sh
```
