# Scenario 22: Breadcrumb navigation

A cluster with one node and one pod. Exercises the breadcrumb trail shown above
every page and confirms breadcrumb links navigate back to list pages.

## Prerequisites

- `kwokctl` and `kubectl` on `PATH`.
- Karse running locally: `bun run dev:test` from the repo root.

## Setup

```sh
./docs/manual-testing/kwok/22-breadcrumbs/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

## What to check

### List pages

- Navigate to `/pods`. Confirm a breadcrumb bar appears below the header showing a single crumb "Pods".
- Navigate to `/nodes`, `/deployments`, `/statefulsets`, `/daemonsets`, `/namespaces`, `/contexts`, and `/cluster`. Confirm each shows a single crumb matching the page (Nodes, Deployments, StatefulSets, DaemonSets, Namespaces, Contexts, Cluster).

### Pod detail page

- Navigate to `/pods` and click the `web` row. Confirm the breadcrumb trail shows "Pods > default > web".
- Confirm the namespace ("default") and pod name ("web") crumbs are the current (non-linked) tail, and "Pods" is a clickable link.
- Click the "Pods" breadcrumb. Confirm the browser navigates back to `/pods` and the trail collapses to a single "Pods" crumb.

### Node detail page

- Navigate to `/nodes` and click the `fake-node-1` row. Confirm the breadcrumb trail shows "Nodes > fake-node-1".
- Click the "Nodes" breadcrumb. Confirm the browser navigates back to `/nodes` and the trail collapses to a single "Nodes" crumb.

## Teardown

```sh
./docs/manual-testing/kwok/22-breadcrumbs/teardown.sh
```
