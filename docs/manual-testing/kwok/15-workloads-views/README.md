# Scenario 15: Workloads views

A cluster with one deployment, one stateful set, and one daemon set. Exercises the Deployments, StatefulSets, and DaemonSets pages.

## Prerequisites

- `kwokctl` and `kubectl` on `PATH`.
- Karse running locally: `bun start` or `bun run dev` from the repo root.

## Setup

```sh
./docs/manual-testing/kwok/15-workloads-views/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

Start Karse with fake log mode enabled:

```sh
KARSE_FAKE_LOGS=1 bun start
```

## What to check

- **Deployments page**: navigate to `/deployments`. The `nginx` deployment appears with columns Name, Namespace, Ready, Up-to-date, Available, Age. Rows have a pointer cursor on hover.
- **StatefulSets page**: navigate to `/statefulsets`. The `postgres` stateful set appears with columns Name, Namespace, Ready, Age.
- **DaemonSets page**: navigate to `/daemonsets`. The `fluentd` daemon set appears in the `kube-system` namespace with columns Name, Namespace, Desired, Current, Ready, Up-to-date, Available, Age.
- **Sidebar**: Deployments, StatefulSets, and DaemonSets nav items are visible and highlighted correctly when active.
- **Page titles**: confirm the header shows "Deployments", "StatefulSets", and "DaemonSets" as the page title on each respective page.
- **Namespace scoping**: select the `kube-system` namespace. The Deployments and StatefulSets tables show empty state; the DaemonSets table shows `fluentd`. Clear the namespace; all tables show their full data again.
- **Search**: type `nginx` in the deployments search box and confirm only the `nginx` row is shown. Type a non-matching string and confirm the "No deployments match the search." message appears.
- **Clickable rows**: click the `nginx` deployment row and confirm the browser navigates to `/deployments/default/nginx`.

## Teardown

```sh
./docs/manual-testing/kwok/15-workloads-views/teardown.sh
```
