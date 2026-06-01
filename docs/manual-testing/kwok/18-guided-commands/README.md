# Scenario 18: Guided commands

A cluster with one node and one pod. Exercises the guided-commands feature: a
"Commands" button on the pod and node detail pages that opens a dialog listing
display-only `kubectl` command suggestions with copy-to-clipboard buttons.

Karse is strictly READ-ONLY. These commands are NEVER executed by Karse: the
dialog only shows command strings for the user to copy and run themselves.

## Prerequisites

- `kwokctl` and `kubectl` on `PATH`.
- Karse running locally: `bun run dev:test` from the repo root.

## Setup

```sh
./docs/manual-testing/kwok/18-guided-commands/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

## What to check

### Pod commands

- Navigate to `/pods` and click the `web` row to open `/pods/default/web`.
- A "Commands" button with a terminal icon appears in the header row, to the right of the phase chip.
- Click "Commands". A dialog opens titled "Commands for web".
- An info banner confirms Karse is read-only and never runs the commands.
- The list includes (each with a copy button) at least:
  - `kubectl describe pod web -n default`
  - `kubectl logs web -n default`
  - `kubectl logs -f web -n default`
  - `kubectl exec -it web -- sh -n default`
  - `kubectl get pod web -o yaml -n default`
  - `kubectl delete pod web -n default`
- Click a copy button. The icon briefly changes to a check mark and the command text is on your clipboard (paste somewhere to confirm).
- Press Escape or click outside to close the dialog.

### Node commands

- Navigate to `/nodes` and click the `fake-node-1` row to open `/nodes/fake-node-1`.
- A "Commands" button appears in the header row, to the right of the status chip.
- Click "Commands". A dialog opens titled "Commands for fake-node-1".
- Node commands have no `-n` namespace flag. The list includes:
  - `kubectl describe node fake-node-1`
  - `kubectl get node fake-node-1 -o yaml`
  - `kubectl get pods --all-namespaces --field-selector spec.nodeName=fake-node-1`
  - `kubectl cordon fake-node-1`
  - `kubectl drain fake-node-1 --ignore-daemonsets --delete-emptydir-data`
  - `kubectl uncordon fake-node-1`
- Confirm copy buttons work as above.

### Read-only invariant

- Confirm that opening the dialog and clicking copy never triggers any network request to the backend (check the browser dev tools network tab). The commands are generated entirely in the frontend and are never executed.

## Teardown

```sh
./docs/manual-testing/kwok/18-guided-commands/teardown.sh
```
