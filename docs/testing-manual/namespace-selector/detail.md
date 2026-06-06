# namespace-selector manual tests

Manual tests for namespace scoping. See the spec: [namespace-selector](../../spec/namespace-selector/detail.md).

Namespace scoping is exercised by the pods fixtures. The full pods-side steps live in [pods-view](../pods-view/detail.md); the namespace-specific checks are collected here. The dropdown-picker placement and keyboard shortcuts are covered under [quick-find](../quick-find/detail.md).

Each fixture stands up a `karse-test` KWOK cluster; select the `kwok-karse-test` context in Karse. Run the matching `teardown.sh` when done.

## Scenario A: Single-namespace scoping

**Fixture:** [_fixtures-kwok/07-two-pods-one-namespace](../_fixtures-kwok/07-two-pods-one-namespace/)

```sh
./docs/testing-manual/_fixtures-kwok/07-two-pods-one-namespace/setup.sh
```

### What to check
- Open the namespace picker (layers icon or Ctrl+Shift+K), select `default`. Both pods are shown and the Namespace column remains visible. Select a different namespace: the empty state appears.
- Navigate to `/namespaces`, click "Set as active" on `default`. Confirm the `active` chip appears and views scope to that namespace.
- The namespace picker lists the system namespaces only (no user namespaces in this fixture).

## Scenario B: Two namespaces

**Fixture:** [_fixtures-kwok/08-two-pods-two-namespaces](../_fixtures-kwok/08-two-pods-two-namespaces/)

```sh
./docs/testing-manual/_fixtures-kwok/08-two-pods-two-namespaces/setup.sh
```

### What to check
- With `namespace-a` selected, only `pod-a` appears; with `namespace-b` selected, only `pod-b`.
- The namespace picker lists `namespace-a` and `namespace-b` alongside the system namespaces.

## Scenario C: Many namespaces, active vs default

**Fixture:** [_fixtures-kwok/09-many-pods-many-namespaces](../_fixtures-kwok/09-many-pods-many-namespaces/)

```sh
./docs/testing-manual/_fixtures-kwok/09-many-pods-many-namespaces/setup.sh
```

### What to check
- The picker lists `team-1`..`team-5` alongside system namespaces; selecting one scopes all views.
- On `/namespaces`, "Set as active" shows the `active` chip; "Set as default" shows the `default` chip (tab-local active vs persisted default).
- With `team-1` active, exactly 4 pods are shown.
- "All namespaces" clears the selection; all 20 pods appear and the header namespace chip is removed.
