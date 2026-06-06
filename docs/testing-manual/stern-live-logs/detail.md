# stern-live-logs manual tests

Manual tests for the Logs page (`/logs`): stern-style multi-pod streaming. See the spec: [stern-live-logs](../../spec/stern-live-logs/detail.md).

Streaming uses `kubectl logs -f` (read-only follow) on the backend, aggregated and pushed to the browser over Server-Sent Events. With `KARSE_FAKE_LOGS=1` (set by `bun run dev:test`) each pod stream emits simulated log lines so the page can be exercised against a kwok cluster that has no real container runtime.

## Scenario: Multi-pod streaming

One node, three pods (`nginx-one`, `nginx-two`, `redis-main`).

**Fixture:** [_fixtures-kwok/25-live-logs](../_fixtures-kwok/25-live-logs/)

```sh
./docs/testing-manual/_fixtures-kwok/25-live-logs/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

### Navigation
- The sidebar shows a "Logs" item with a stream icon. Click it.
- The URL becomes `/logs` and the page title shows "Logs".

### Controls
- A "Namespace" dropdown defaults to "All namespaces" and lists `default`.
- A "Pod" dropdown defaults to "All pods (use filter)" and lists `nginx-one`, `nginx-two`, and `redis-main`.
- A "Pod filter" text field accepts a substring or wildcard (for example `nginx-*`).

### Streaming all pods
- Leave the filter empty and press "Stream".
- The Stream button is replaced by a red "Stop" button.
- A "Streaming N pod(s)" row shows a colored chip for each matched pod.
- The log panel fills with lines, each prefixed with `default/<pod>` in a color unique to that pod, including `kube-probe` health-check entries and worker process notices (the simulated content from `KARSE_FAKE_LOGS`).
- Press "Stop". The Stream button returns and streaming halts.

### Filtering by substring
- Type `nginx` into the Pod filter and press "Stream".
- Only `nginx-one` and `nginx-two` appear as matched chips and in the log prefixes.
- `redis-main` does not appear.

### Filtering by wildcard
- Type `nginx-*` into the Pod filter and press "Stream".
- Both `nginx-one` and `nginx-two` are streamed; `redis-main` is excluded.

### Scoping by pod
- Select `redis-main` from the Pod dropdown (this disables the text filter) and press "Stream". Only `redis-main` is streamed.

### Scoping by namespace
- Select `default` from the Namespace dropdown and press "Stream". Only pods in `default` are streamed (all three pods here).

### Read-only invariant
- Tail `logs/audit-*.log` while streaming and confirm only `logs -f` and `get` kubectl commands are recorded. No mutating verbs ever appear.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/25-live-logs/teardown.sh
```
