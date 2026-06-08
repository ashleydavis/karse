# Testing manual

Step-by-step manual testing guides for Karse. This directory mirrors `docs/spec/` exactly: the same subdirectory layout, the same feature IDs, and an `index.md` in every directory.

## Layout

Where the spec has `detail.md` (the full spec), the testing manual has `detail.md` (the full manual test steps for that feature). So `docs/spec/<feature>/detail.md` has a matching `docs/testing-manual/<feature>/detail.md`.

Each feature directory contains two files:
- `index.md`: lightweight surface. ID, brief description, and the fixtures the manual uses.
- `detail.md`: the full manual test steps for that feature.

The `index.md` at this top level is the central index of manual test guides.

## KWOK fixtures

The manual tests run against [KWOK](https://kwok.sigs.k8s.io)-simulated clusters so they need no real cluster. The reusable cluster fixtures (the `setup.sh` / `teardown.sh` scripts that were the original numbered KWOK scenarios) live under [`_fixtures-kwok/`](_fixtures-kwok/FIXTURES.md). Each feature's `detail.md` names the fixture(s) it uses and links to the scripts.

Single-test-cluster discipline (per `readme.md`): there is only ever ONE test cluster at a time for single-cluster fixtures, all named `karse-test`. Each fixture's `setup.sh` is teardown-then-build, and `teardown.sh` removes the single cluster. Multi-cluster fixtures (contexts, shareable URLs) use `karse-test-N` names. [`_fixtures-kwok/teardown-all.sh`](_fixtures-kwok/teardown-all.sh) removes every `karse-test*` cluster.

## Features

| ID | Manual test guide |
|---|---|
| [read-only-invariant](./read-only-invariant/index.md) | Karse never issues a mutating kubectl verb. |
| [context-switching](./context-switching/index.md) | List and switch kubeconfig contexts. |
| [namespace-selector](./namespace-selector/index.md) | Scope views to a chosen namespace. |
| [namespace-detail](./namespace-detail/index.md) | Namespace detail page and its tabs. |
| [cluster-overview](./cluster-overview/index.md) | Cluster home page stat tiles. |
| [nodes-view](./nodes-view/index.md) | Read-only, sortable, searchable nodes table. |
| [node-detail](./node-detail/index.md) | Node detail page and its tabs. |
| [pods-view](./pods-view/index.md) | Read-only pods table with phase filter. |
| [pod-detail](./pod-detail/index.md) | Pod detail page, tabs, containers, logs. |
| [deployments-view](./deployments-view/index.md) | Read-only deployments table. |
| [statefulsets-view](./statefulsets-view/index.md) | Read-only stateful sets table. |
| [daemonsets-view](./daemonsets-view/index.md) | Read-only daemon sets table. |
| [workload-detail](./workload-detail/index.md) | Deployment / stateful set / daemon set detail pages. |
| [clickable-resource-rows](./clickable-resource-rows/index.md) | Rows link to detail pages; consistent row hover. |
| [log-viewer](./log-viewer/index.md) | Pod/container log viewer and live follow. |
| [stern-live-logs](./stern-live-logs/index.md) | Multi-pod live log streaming. |
| [events-feed](./events-feed/index.md) | Recent cluster events view. |
| [errors-feed](./errors-feed/index.md) | Warning events and problem pods. |
| [resource-search](./resource-search/index.md) | Fuzzy search and column sorting. |
| [quick-find](./quick-find/index.md) | Header context and namespace dropdown pickers. |
| [guided-commands](./guided-commands/index.md) | Copy-only kubectl command suggestions. |
| [yaml-viewer](./yaml-viewer/index.md) | Raw YAML sub tab on resource detail pages. |
| [audit-log](./audit-log/index.md) | On-disk kubectl audit log. |

## Cross-cutting guides

Some KWOK scenarios exercise behaviour that has no single dedicated spec feature. They are kept under [`cross-cutting/`](./cross-cutting/index.md): long resource names, breadcrumb navigation, and shareable URL state.

## Keeping it in sync

The testing manual mirrors the spec. When the spec structure changes (a feature added, renamed, or removed), make the matching change here. A feature in `docs/spec/<id>/` must have a corresponding `docs/testing-manual/<id>/`.
