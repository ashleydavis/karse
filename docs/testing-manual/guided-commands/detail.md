# guided-commands manual tests

Manual tests for the guided-commands tab. See the spec: [guided-commands](../../spec/guided-commands/detail.md).

Karse is strictly READ-ONLY. These commands are NEVER executed by Karse: the Commands tab only shows command strings for the user to copy and run themselves.

Start the app first. From the repo root run:

```sh
bun run dev
```

Then open the frontend at `http://127.0.0.1:5173`. The scenario's fixture stands up a KWOK cluster; select the `kwok-karse-test` context in Karse and run the matching `teardown.sh` when done.

## Scenario: Guided commands

One node and one pod.

**Fixture:** [_fixtures-kwok/18-guided-commands](../_fixtures-kwok/18-guided-commands/)

```sh
./docs/testing-manual/_fixtures-kwok/18-guided-commands/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

### Pod commands
- Navigate to `/pods` and click the `web` row to open `/pods/default/web`.
- The detail page has a "Commands" tab in the tab bar (after Logs).
- Click the "Commands" tab. The tab content fills the page width.
- An info banner confirms Karse is read-only and never runs the commands.
- The list includes (each with a copy button) at least:
  - `kubectl describe pod web -n default`
  - `kubectl logs web -n default`
  - `kubectl logs -f web -n default`
  - `kubectl exec -it web -- sh -n default`
  - `kubectl get pod web -o yaml -n default`
  - `kubectl delete pod web -n default`
- Commands word-wrap: even a long command is fully visible with no horizontal scroll bar.
- Type `delete` in the "Search commands" box. The list filters down to the delete command only. Clear the box to restore the full list.
- Click a copy button. The icon briefly changes to a check mark and the command text is on your clipboard (paste somewhere to confirm).

### Node commands
- Navigate to `/nodes` and click the `fake-node-1` row to open `/nodes/fake-node-1`.
- Click the "Commands" tab (after Events).
- Node commands have no `-n` namespace flag. The list includes:
  - `kubectl describe node fake-node-1`
  - `kubectl get node fake-node-1 -o yaml`
  - `kubectl get pods --all-namespaces --field-selector spec.nodeName=fake-node-1`
  - `kubectl cordon fake-node-1`
  - `kubectl drain fake-node-1 --ignore-daemonsets --delete-emptydir-data`
  - `kubectl uncordon fake-node-1`
- Confirm search and copy buttons work as above.

### Workload commands
- Navigate to `/deployments` and open any deployment's detail page.
- The detail page has "Detail" and "Commands" tabs. Click "Commands".
- The list includes describe, get YAML, restart rollout, rollout status, scale, and delete suggestions, each with a copy button and the read-only banner.

### Read-only invariant
- Confirm that opening the Commands tab and clicking copy never triggers any network request to the backend (check the browser dev tools network tab). The commands are generated entirely in the frontend and are never executed.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/18-guided-commands/teardown.sh
```
