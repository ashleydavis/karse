# guided-commands manual tests

Manual tests for the guided-commands tab. See the spec: [guided-commands](../../spec/guided-commands/detail.md).

Karse is strictly READ-ONLY. These commands are NEVER executed by Karse: the Commands tab only shows command strings for the user to copy and run themselves.

Start the app first. From the repo root run:

```sh
bun run dev
```

Then open the frontend at `http://127.0.0.1:5173`. The scenario's fixture stands up a KWOK cluster; select the `kwok-karse-test` context in Karse. Tear each cluster down with the Teardown step at the end of this doc.

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
- The detail page has "Status" and "Commands" tabs. Click "Commands".
- The list includes describe, get YAML, restart rollout, rollout status, scale, and delete suggestions, each with a copy button and the read-only banner.

### Page help: where this data comes from
The header carries a question-mark button ("Where does this data come from?") next to the colour-mode button. It opens a panel naming the current page's data source and the read-only commands that reproduce it.

- Navigate to `/nodes`. The panel is closed: nothing but the question-mark button is visible.
- Click the question-mark button. A panel slides in from the right, titled "Nodes".
- Under "Where this data comes from" it says the node table is one kubectl query for every node in the selected context.
- Under "Run it yourself" an info banner says these are the read-only commands behind the page, and the list shows (with a copy button):
  - `kubectl --context kwok-karse-test get nodes -o json`
- Copy that command and run it in your terminal. It returns the same nodes the table shows.
- Close the panel (the X, or click outside it).
- Navigate to `/pods` with no namespace selected. Open the help: the source text says all namespaces are covered, and the command is `kubectl --context kwok-karse-test get pods -A -o json`.
- Select the `default` namespace with the namespace picker (`Ctrl+Shift+K`). Open the help again: the command is now `kubectl --context kwok-karse-test get pods -n default -o json`, and the source text names the `default` namespace.
- Open the `web` pod's detail page (`/pods/default/web`) and open the help. The title reads "Pod: web"; the commands query that pod, its events, and its logs, all scoped to `-n default` (the pod's own namespace, regardless of which namespace is selected). The logs command carries `-f` and `--tail=100`, matching what the Logs tab streams — run it and you see the same lines the tab shows.
- Open `/errors` and open the help. It explains that Kubernetes has no "error" object and that Karse derives the feed from the Warning events plus the pods, and lists both queries.
- Navigate to `/about`. There is **no** question-mark button: no cluster data backs that page.

#### Page help: the commands are the ones Karse really runs
The panel claims Karse runs these commands to build the view, so each must actually reproduce the page. Check the cases where the real query is not the obvious one:

- Open a deployment's detail page (`/deployments/default/nginx`) and open the help. The source text explains that a deployment owns ReplicaSets, which own the pods. The commands include **both** `kubectl --context kwok-karse-test get replicasets -n default -l <selector> -o json` and `kubectl --context kwok-karse-test get pods -n default -l <selector> -o json`. There is **no** bare `get pods -n default -o json`: that would return every pod in the namespace, not the deployment's.
- Substitute the deployment's own selector for `<selector>` (read it from the Status tab, or from `kubectl get deployment nginx -n default -o jsonpath='{.spec.selector.matchLabels}'`) and run both commands. They return the ReplicaSets and pods the Pods tab lists.
- Open a stateful set's or daemon set's detail page and open the help. It lists the selector-scoped pod query but **no** ReplicaSet query: those workloads own their pods directly.
- Open a container's detail page (`/pods/default/web/containers/web`) and open the help. It lists the pod query and the container's logs command, and **no** `kubectl describe`: the container's spec and status are read out of the pod's JSON, so Karse runs no second query for it.

### Read-only invariant
- Confirm that opening the Commands tab and clicking copy never triggers any network request to the backend (check the browser dev tools network tab). The commands are generated entirely in the frontend and are never executed.
- The same holds for the page help panel: opening it and copying a command issues no request. Every command it lists is a read-only query (`get`, `version`, `logs`, `config view`); no command it shows can change the cluster.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/18-guided-commands/teardown.sh
```
