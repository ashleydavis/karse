# Scenario 19: Multi-container pods

A cluster with three pods in the `default` namespace exercising the multi-container support:

- `single-container`: one container (`app`).
- `web-with-sidecars`: three containers (`app`, `envoy`, `log-shipper`).
- `with-init-container`: one init container (`setup`) plus two regular containers (`app`, `metrics`).

## Prerequisites

- `kwokctl` and `kubectl` on `PATH`.
- Karse running locally: `bun run dev:test` from the repo root.

## Setup

```sh
./docs/manual-testing/kwok/19-multi-container-pods/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

## What to check

- **Pods list - Containers column**: navigate to `/pods`. There is a `Containers` column between `Ready` and `Restarts`. Confirm the counts:
  - `single-container` shows `1`.
  - `web-with-sidecars` shows `3`.
  - `with-init-container` shows `2` (init containers are not counted in this column; they appear separately on the detail page).
- **Sorting**: click the `Containers` column header. Rows sort ascending by container count, then descending on a second click.
- **Drill down - many containers**: click the `web-with-sidecars` row. On the pod detail page the Containers table lists all three containers (`app`, `envoy`, `log-shipper`) with their image, state chip, ready Yes/No, and restart count.
- **Drill down - init container**: click the `with-init-container` row. The Containers table shows `app` and `metrics`; a separate Init Containers table shows `setup`.
- **Per-container logs**: on `web-with-sidecars`, click "Show logs". A Container selector appears (only shown when more than one container). Switch between `app`, `envoy`, and `log-shipper` and confirm the log viewer refetches. (Under kwok, run with `KARSE_FAKE_LOGS=1` to see sample log lines.)

## Teardown

```sh
./docs/manual-testing/kwok/19-multi-container-pods/teardown.sh
```
