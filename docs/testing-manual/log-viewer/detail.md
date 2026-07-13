# log-viewer manual tests

Manual tests for the pod log viewer embedded on the pod detail page (the Logs tab). See the spec: [log-viewer](../../spec/log-viewer/detail.md).

The Logs tab uses the **same shared component** as the dedicated Logs page (`/logs`), so both surfaces expose the same options; on the Logs tab the pod is fixed, so its namespace/pod picker is hidden. Neither surface has a "Tail" option or a Refresh button. Multi-pod streaming on the Logs page is covered by [live-logs](../live-logs/detail.md).

The single-container log panel on the container detail page is a separate surface (it keeps its own container/tail/refresh controls) and is not covered here.

Start the app first. From the repo root run the `dev:test` variant of `bun run dev` (it sets `KARSE_FAKE_LOGS=1` so simulated log lines are emitted, since kwok runs no real containers):

```sh
bun run dev:test
```

Then open the frontend at `http://127.0.0.1:5173`. Each scenario's fixture stands up a KWOK cluster; select the `kwok-karse-test` context in Karse. Tear each cluster down with the Teardown step at the end of this doc.

## Scenario A: Logs tab uses the shared viewer with no Tail option and no Refresh button

**Fixture:** [_fixtures-kwok/16-detail-pages-and-logs](../_fixtures-kwok/16-detail-pages-and-logs/) (one node, one multi-container pod)

```sh
./docs/testing-manual/_fixtures-kwok/16-detail-pages-and-logs/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

### What to check
- On the `web` pod detail page, open the Logs tab. Confirm the log panel appears and immediately streams log lines, each prefixed with its `namespace/pod` name, with no button to load logs or start streaming.
- Confirm there is **no "Tail" selector** and **no Refresh button** on the Logs tab.
- Confirm the Logs tab does **not** show the Logs page's namespace selector or pod picker (the pod is fixed here).
- Open the Logs page from the sidebar (`/logs`). Confirm it offers the same viewer (namespace selector + searchable pod picker + Stream/Stop), and that it too has no "Tail" option and no Refresh button. The two surfaces are the same component.
- On both surfaces confirm the dark log text area **stretches down to fill the remaining height**, with its bottom edge sitting just above the bottom of the window (only the page padding below it). It must not stop short at a small fixed height with empty space beneath. Resize the window taller and shorter and confirm the log area grows and shrinks to keep filling the space.

## Scenario B: Live (follow) pod logs

One node, one multi-container pod. The Logs tab streams the pod's logs via Server-Sent Events automatically when the log view opens, using the shared multi-pod stream scoped to that one pod.

**Fixture:** [_fixtures-kwok/27-live-pod-logs](../_fixtures-kwok/27-live-pod-logs/)

```sh
./docs/testing-manual/_fixtures-kwok/27-live-pod-logs/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

### Auto-load and stream on open
- Navigate to `/pods`, click the `web` row, then open the Logs tab.
- Confirm the viewer shows log lines straight away with no load/start button. The viewer auto-scrolls to the bottom as lines arrive.
- In the browser dev tools Network tab, confirm a single long-lived request to `/api/logs/stream` (with `pods=web`) of type `eventsource`/`text/event-stream` opens on mount.

### Against a real cluster
- On a cluster with real running containers, repeat with `bun run dev` (no fake logs). New log lines should append in real time as they are produced, with no user action. The backend stops the follow when the log view is left (the SSE connection closes).

## Scenario C: "error" and "warning" are highlighted in the log text

The shared viewer highlights the severity keywords in each rendered log line: "error" in red and "warning" in yellow. This applies on both the Pod detail Logs tab and the Logs page (`/logs`), since they are the same component.

**Fixture:** [_fixtures-kwok/27-live-pod-logs](../_fixtures-kwok/27-live-pod-logs/)

```sh
./docs/testing-manual/_fixtures-kwok/27-live-pod-logs/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse. The fake log stream (`bun run dev:test`) emits lines containing "error" and "warning" so the highlighting is visible.

### What to check
- Open the `web` pod detail page and its Logs tab (or the Logs page and stream the `web` pod). In the streamed lines, confirm occurrences of "error" are coloured red and "warning" coloured yellow, while the rest of each line stays the default log colour.
- Confirm matching is case-insensitive: `ERROR`, `Error`, and `error` are all highlighted, as are `WARNING`/`Warning`/`warning`.
- Confirm a keyword surrounded by punctuation (for example `[error]` or `level=warning`) is still highlighted, and that a keyword appearing as a substring of a larger word (for example "terror") is **not** highlighted.
- Confirm every occurrence on a line is highlighted when a line contains the keyword more than once.
- Confirm the `namespace/pod` prefix at the start of each line (and the pod's chip in the "Streaming N pod(s)" row on the Logs page) is coloured cyan, blue, teal, green, or purple — **never red or yellow**, so an ordinary line is never mistaken for an error or a warning. Stream several pods at once (type a substring into the Logs page search box) and confirm every pod's colour stays out of the red/yellow range while each pod keeps one stable colour.
- Toggle the app between light and dark theme (top bar) and confirm the red/yellow highlights, and the pod-name colours, stay legible on the dark log panel in both.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/16-detail-pages-and-logs/teardown.sh
./docs/testing-manual/_fixtures-kwok/27-live-pod-logs/teardown.sh
```
