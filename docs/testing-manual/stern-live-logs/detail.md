# stern-live-logs manual tests

Manual tests for the Logs page (`/logs`): stern-style multi-pod streaming. See the spec: [stern-live-logs](../../spec/stern-live-logs/detail.md).

Streaming uses `kubectl logs -f` (read-only follow) on the backend, aggregated and pushed to the browser over Server-Sent Events. With `KARSE_FAKE_LOGS=1` (set by `bun run dev:test`) each pod stream emits simulated log lines so the page can be exercised against a kwok cluster that has no real container runtime.

Start the app first. From the repo root run the `dev:test` variant of `bun run dev` (it sets `KARSE_FAKE_LOGS=1` for simulated log lines):

```sh
bun run dev:test
```

Then open the frontend at `http://127.0.0.1:5173`. The scenario's fixture stands up a KWOK cluster; select the `kwok-karse-test` context in Karse. Tear each cluster down with the Teardown step at the end of this doc.

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
- A pod picker: a "Search pods..." button (the dropdown trigger). The pod list is not shown until you open it.

### The pod picker is a searchable, multi-select dropdown
- Initially the picker is collapsed: only the "Search pods..." trigger button is shown, with no pod list expanded on the page.
- Click the trigger. A dropdown drops DOWN below it as an overlay, holding (top to bottom): a "Search pods..." input, a checkbox list of `nginx-one`, `nginx-two`, and `redis-main`, and a "N selected" count next to a "Clear" button.
- Type `nginx` into the "Search pods..." input. The checkbox list narrows to `nginx-one` and `nginx-two`; `redis-main` disappears. Clear the input and all three return.
- The "N selected" count and the "Clear" button sit inside the same dropdown as the search input and checkbox list, not floating on the page.
- Click outside the dropdown (or press Escape). It collapses again, leaving only the trigger. When pods are checked the trigger reads "N pod(s) selected"; with a search typed it reads "Search: <text>".

### Streaming requires picking pods first
- Streaming every pod at once is not supported, so the page makes you scope the stream first.
- Check no pods and leave the "Search pods..." input empty, then press "Stream".
- No stream starts. Instead an info message appears headed "Pick which pods to stream first", explaining you must check one or more pods or type a substring (for example `nginx`) into the search box, then press Stream.
- The button stays on "Stream" (it does not switch to "Stop") and no log lines appear.
- The message clears as soon as you check a pod or type into the search box.

### Streaming checked pods
- Open the picker dropdown and check `nginx-one` and `redis-main`. The count reads "2 selected" and the search input is disabled. Close the dropdown; the trigger now reads "2 pod(s) selected".
- Press "Stream". Exactly `nginx-one` and `redis-main` are streamed (matched chips and log prefixes); `nginx-two` does not appear.
- Open the dropdown and press "Clear" to reset the selection; the count returns to "0 selected" and the search input re-enables.

### Streaming by search substring (no pods checked)
- With no pod checked, open the dropdown, type `nginx` into the "Search pods..." input, close the dropdown, then press "Stream".
- Only `nginx-one` and `nginx-two` appear as matched chips and in the log prefixes; `redis-main` does not appear.
- A wildcard such as `nginx-*` works the same way: both `nginx-one` and `nginx-two` are streamed, `redis-main` excluded.

### Scoping by namespace
- Select `default` from the Namespace dropdown and press "Stream". Only pods in `default` are streamed (all three pods here).

### Auto-follow and the scrollbar
- Stream a pod that produces a steady flow of lines (the fake-logs mode emits lines continuously). Let it fill past one screen.
- While the viewer is scrolled to the bottom, watch new lines arrive: the view stays pinned to the bottom, always showing the newest line.
- Confirm the log panel shows a clearly visible scrollbar down its right edge: a track with a light-grey draggable thumb that plainly stands out against the dark panel. (This is the app's own custom bar; the browser's native overlay scrollbar is invisible against the dark panel, so do not rely on it.)
- Drag the thumb up with the mouse (or use the mouse wheel) to scroll into the earlier output. Dragging the thumb scrolls the view and the earliest streamed lines remain reachable. New lines keep arriving but the view stays where you left it: it is not yanked back to the bottom.
- Scroll back to the bottom. Auto-follow resumes: new lines again keep the view pinned to the end.

### "Updated" indicator
- Before streaming, the caption next to the Stream button reads "No logs yet".
- Type `nginx` into the Pod filter and press "Stream". As soon as the first line arrives the caption reads "Updated just now".
- Leave the stream idle (or watch a stream whose lines have stopped). After a few seconds the caption ages: "Updated Ns ago", then "Updated Nm ago" after a minute, then "Updated Nh ago" after an hour. It tracks the most recent line and ticks on its own.
- Press "Stream" again (or start a fresh stream). The caption resets to "No logs yet" until the first new line lands.

### Read-only invariant
- Tail `logs/audit-*.log` while streaming and confirm only `logs -f` and `get` kubectl commands are recorded. No mutating verbs ever appear.

### Capped streaming-pod labels
- This needs more than 8 streaming pods to exercise the cap. Use a namespace/fixture with at least 9 pods (for example scale the fixture up, or stream across all namespaces on a busier cluster).
- Open the picker dropdown, type a substring that matches every pod (or check more than 8 pods), close the dropdown, and press "Stream".
- The "Streaming N pod(s)" row shows at most 8 pod chips, followed by a "... +M more" chip (where M is the number of hidden pods). The row does not grow to list every pod.
- Click the "... +M more" chip. The row expands to show a chip for every streaming pod, and the "..." chip is replaced by a "Show fewer" chip.
- Click "Show fewer". The row collapses back to 8 chips with the "... +M more" chip again.

## Scenario: Whole-cluster firehose stays bounded (CPU/memory)

This guards against the regression proven in Debug item `stern-all-logs-1`: an unbounded all-namespaces `.*` stream pegged a CPU core (and an unbounded coalescing buffer OOM-crashed the backend). The fix caps stern fan-out at the source and adds bounded drop-oldest backpressure.

This is a profiling/load check, run against the real backend SSE path with a fake high-volume `stern`. The reusable harness and method are captured in the work item's evidence (`stern-all-logs-2/evidence/`: `fake-stern.sh`, `cpu-before-after.txt`).

1. Build a fake `stern` that emits stern-template lines at a high, controllable rate, with its total firehose rate scaling with `--max-log-requests` (each request models one concurrent pod watch). Put it first on `PATH`.
2. Start the real backend and `curl` the production SSE path: `GET /api/stern/stream?context=x&query=.*&tail=10` (whole-cluster, all namespaces, bare `.*`).
3. Watch backend CPU via `top -b` (the backend event loop is single-threaded, so ~100% of one core = a pegged core).

Expected:
- With the fix's default cap (`--max-log-requests 10`), backend CPU stays well below a pegged core (observed ~20-25% of one core) under the same firehose the Debug item saturated.
- Backend RSS holds flat (~100-110MB) under the full firehose; it does not grow without bound (no OOM).
- The SSE stream emits `event: dropped` events when the buffer is full, proving the bounded drop-oldest buffer sheds the oldest lines instead of growing.
- `KARSE_STERN_MAX_LOG_REQUESTS=50` reproduces the old uncapped fan-out for an explicit before/after comparison.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/25-live-logs/teardown.sh
```
