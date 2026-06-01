# Scenario 22: Breadcrumb navigation

A cluster with one node and one pod. Exercises the breadcrumb trail shown in the
top navbar and confirms breadcrumb links navigate back to list pages. The first
crumb (the main page) is shown in large, title-sized text; the remaining
sub-page crumbs use the regular breadcrumb size.

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

- Navigate to `/pods`. Confirm the breadcrumb trail appears in the top navbar showing a single, title-sized crumb "Pods".
- Navigate to `/nodes`, `/deployments`, `/statefulsets`, `/daemonsets`, `/namespaces`, `/contexts`, and `/cluster`. Confirm each shows a single crumb matching the page (Nodes, Deployments, StatefulSets, DaemonSets, Namespaces, Contexts, Cluster).

### Pod detail page

- Navigate to `/pods` and click the `web` row. Confirm the breadcrumb trail shows "Pods > default > web > Detail / Status", with "Pods" in large title-sized text.
- Switch to the Containers and Logs tabs. Confirm the last crumb updates to "Containers" then "Logs", matching the selected sub tab.
- Confirm "Pods" and the pod name ("web") are clickable links, while the namespace ("default") and the current sub-tab crumbs are not links.
- Click the "Pods" breadcrumb. Confirm the browser navigates back to `/pods` and the trail collapses to a single "Pods" crumb.

### Node detail page

- Navigate to `/nodes` and click the `fake-node-1` row. Confirm the breadcrumb trail shows "Nodes > fake-node-1".
- Click the "Nodes" breadcrumb. Confirm the browser navigates back to `/nodes` and the trail collapses to a single "Nodes" crumb.

## Teardown

```sh
./docs/manual-testing/kwok/22-breadcrumbs/teardown.sh
```
