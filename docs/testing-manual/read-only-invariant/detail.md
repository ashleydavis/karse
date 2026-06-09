# read-only-invariant manual tests

Manual tests for the read-only invariant. See the spec: [read-only-invariant](../../spec/read-only-invariant/detail.md).

Karse never runs a mutating kubectl subcommand against a cluster (the one write it makes is `kubectl config use-context`, which edits the local kubeconfig, not the cluster). The on-disk audit log (`logs/audit-*.log`) is the proof surface: every line is the exact kubectl argv Karse spawned.

These checks ride along with other scenarios rather than needing their own cluster shape.

Start the app first. From the repo root run:

```sh
bun run dev
```

Then open the frontend at `http://127.0.0.1:5173`. Each check then runs the referenced scenario's `setup.sh` and exercises it. Tear the clusters down with the Teardown step at the end of this doc.

## Check A: YAML view issues only reads

**Fixture:** [_fixtures-kwok/17-raw-yaml-view](../_fixtures-kwok/17-raw-yaml-view/)

- Run the [yaml-viewer scenario](../yaml-viewer/detail.md). Open YAML for several resource kinds.
- Tail `logs/audit-*.log`. Every line should be a `kubectl get ... -o yaml` style read. No `apply`, `edit`, `patch`, `delete`, `create`, `scale`, `cordon`, `drain`, etc.

## Check B: Guided commands never execute

**Fixture:** [_fixtures-kwok/18-guided-commands](../_fixtures-kwok/18-guided-commands/)

- Run the [guided-commands scenario](../guided-commands/detail.md). The dialog lists mutating commands (`kubectl delete pod ...`, `kubectl drain ...`) as copyable text only.
- Confirm that opening the dialog and clicking copy triggers NO backend network request (browser dev tools network tab), and NO new line appears in `logs/audit-*.log`. The strings are generated in the frontend and never executed.

## Check C: Live streaming uses follow-reads only

**Fixture:** [_fixtures-kwok/25-live-logs](../_fixtures-kwok/25-live-logs/)

- Run the [stern-live-logs scenario](../stern-live-logs/detail.md). Stream logs from multiple pods.
- Tail `logs/audit-*.log` while streaming and confirm only `logs -f` and `get` kubectl commands are recorded. No mutating verbs ever appear.

## Check D: The only write is the context switch

- Switch the active context (see [context-switching](../context-switching/detail.md), set-as-default). Confirm the only mutating-looking audit entry is `kubectl config use-context <name>`, which writes the local kubeconfig, not the cluster. No cluster object is ever mutated.

Teardown the fixtures used by checks A, B, and C:

```sh
./docs/testing-manual/_fixtures-kwok/17-raw-yaml-view/teardown.sh
./docs/testing-manual/_fixtures-kwok/18-guided-commands/teardown.sh
./docs/testing-manual/_fixtures-kwok/25-live-logs/teardown.sh
```
