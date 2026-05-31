# Scenario 17: Pod phase filter

A cluster with five pods in the `default` namespace, one in each phase: Running, Pending, Succeeded, Failed, Unknown. Exercises the phase filter dropdown on the pods page.

## Prerequisites

- `kwokctl` and `kubectl` on `PATH`.
- Karse running locally: `bun run dev:test` from the repo root.

## Setup

```sh
./docs/manual-testing/kwok/21-pod-phase-filter/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

## What to check

- **Pods page**: five rows in `default`, one per phase. The phase filter button reads `Phase: All`.
- Click the **Phase** button (filter icon) to open the dropdown. All five phases are checked.
- **Uncheck a phase** (for example `Pending`): the matching pod row disappears and the button updates to `Phase: 4 selected`.
- **Check only one phase**: uncheck the others until just `Running` remains. Only `pod-running` is listed and the button reads `Phase: 1 selected`.
- **Uncheck every phase**: the table shows the "No pods match the search." message.
- **Re-check all phases**: all five rows return and the button reads `Phase: All`.
- The phase filter combines with the search box: searching while a subset of phases is selected narrows results further.
- If KWOK overrides a patched terminal phase back to `Running`, re-run the patch commands from the setup script and reload.

## Teardown

```sh
./docs/manual-testing/kwok/21-pod-phase-filter/teardown.sh
```
