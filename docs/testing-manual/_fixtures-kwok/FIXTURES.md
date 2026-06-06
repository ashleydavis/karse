# KWOK fixtures

Reusable cluster fixtures for the manual tests. Each subdirectory holds a `setup.sh` and `teardown.sh` that stand up (and tear down) a KWOK-simulated cluster with a specific shape. These were the original numbered KWOK scenarios; the manual test steps that used to live in each scenario's `README.md` now live in the matching feature's `detail.md` under `docs/testing-manual/`, which links back to the fixture(s) it uses.

## Single-test-cluster discipline

Per `readme.md`: there is only ever ONE test cluster at a time for single-cluster fixtures, all named `karse-test`. Each fixture's `setup.sh` is teardown-then-build, and its `teardown.sh` removes that single cluster. Multi-cluster fixtures (context switching, shareable URL state) intentionally run several clusters named `karse-test-N`.

To tear down every test cluster at once (after running several fixtures, or to clean up leftovers from an interrupted run), use [`teardown-all.sh`](teardown-all.sh), which deletes all `karse-test*` clusters:

```sh
./docs/testing-manual/_fixtures-kwok/teardown-all.sh
```

## Prerequisites

- `kwokctl` and `kubectl` on `PATH`.
- Karse running locally: `bun run dev:test` from the repo root (this sets `KARSE_FAKE_LOGS=1` so the log fixtures emit simulated lines against KWOK, which runs no real containers).

`kwokctl` adds the `kwok-karse-test` context to your kubeconfig automatically; select it in Karse.

## Fixtures

| Fixture | Cluster shape | Used by feature(s) |
|---|---|---|
| [01-empty-cluster-two-nodes](01-empty-cluster-two-nodes/) | Two worker nodes, no user pods | cluster-overview, nodes-view |
| [02-empty-cluster-no-nodes](02-empty-cluster-no-nodes/) | No nodes registered | cluster-overview, nodes-view |
| [03-many-nodes](03-many-nodes/) | 20 worker nodes | nodes-view |
| [04-mixed-node-statuses](04-mixed-node-statuses/) | Ready, NotReady, cordoned nodes | nodes-view |
| [05-nodes-with-no-roles](05-nodes-with-no-roles/) | Two nodes with no role labels | nodes-view |
| [06-nodes-with-multiple-roles](06-nodes-with-multiple-roles/) | Node with multiple roles | nodes-view |
| [07-two-pods-one-namespace](07-two-pods-one-namespace/) | Two pods in `default` | pods-view, namespace-selector |
| [08-two-pods-two-namespaces](08-two-pods-two-namespaces/) | One pod each in two namespaces | pods-view, namespace-selector |
| [09-many-pods-many-namespaces](09-many-pods-many-namespaces/) | 20 pods across 5 namespaces | pods-view, namespace-selector |
| [10-mixed-pod-phases](10-mixed-pod-phases/) | One pod per phase | pods-view |
| [11-long-resource-names](11-long-resource-names/) | Names near k8s length limits | cross-cutting |
| [12-no-contexts](12-no-contexts/) | Empty kubeconfig | context-switching |
| [13-two-contexts](13-two-contexts/) | Two simultaneous clusters | context-switching |
| [14-many-contexts](14-many-contexts/) | Five simultaneous clusters | context-switching |
| [15-workloads-views](15-workloads-views/) | One deployment, stateful set, daemon set | deployments-view, statefulsets-view, daemonsets-view |
| [16-detail-pages-and-logs](16-detail-pages-and-logs/) | One node, one multi-container pod | node-detail, pod-detail, log-viewer, clickable-resource-rows |
| [17-raw-yaml-view](17-raw-yaml-view/) | One node + each workload kind | yaml-viewer |
| [18-guided-commands](18-guided-commands/) | One node, one pod | guided-commands |
| [19-multi-container-pods](19-multi-container-pods/) | Single, sidecar, and init-container pods | pod-detail |
| [20-pod-detail-tabs](20-pod-detail-tabs/) | One multi-container pod | pod-detail |
| [21-pod-phase-filter](21-pod-phase-filter/) | Five pods, one per phase | pods-view |
| [22-breadcrumbs](22-breadcrumbs/) | One node, one pod | cross-cutting |
| [23-shareable-url-state](23-shareable-url-state/) | Two clusters, namespaced pods | cross-cutting |
| [24-navbar-dropdown-pickers](24-navbar-dropdown-pickers/) | Two clusters, extra namespaces | quick-find |
| [25-live-logs](25-live-logs/) | One node, three pods | stern-live-logs |
| [26-table-row-hover](26-table-row-hover/) | One node, one multi-container pod | clickable-resource-rows |
| [27-live-pod-logs](27-live-pod-logs/) | One node, one multi-container pod | log-viewer |
| [28-events-view](28-events-view/) | Seeded events across two namespaces | events-feed |
| [29-fuzzy-search](29-fuzzy-search/) | Pods with shared characters | resource-search |
| [30-workload-detail-pages](30-workload-detail-pages/) | One deployment, stateful set, daemon set | workload-detail |
| [31-node-detail-tabs](31-node-detail-tabs/) | One node, two pods, node events | node-detail |
| [32-errors-view](32-errors-view/) | Problem pod + Warning event + healthy pod | errors-feed |
| [33-labels-column](33-labels-column/) | Labelled pods + a labelled deployment in `default` | pods-view, deployments-view |
