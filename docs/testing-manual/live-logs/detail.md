# live-logs manual tests

Manual tests for the Logs page (`/logs`): multi-pod live log streaming. See the spec: [live-logs](../../spec/live-logs/detail.md).

Streaming uses `kubectl logs -f` (read-only follow) on the backend, aggregated and pushed to the browser over Server-Sent Events. With `KARSE_FAKE_LOGS=1` (set by `bun run dev:test`) each pod stream emits a short backlog of simulated log lines and then keeps emitting a new line roughly every 100ms until you stop the stream, so the page can be exercised against a kwok cluster that has no real container runtime — including the live behaviour (auto-follow) that only shows up once the viewer overflows.

Start the app first. From the repo root run the `dev:test` variant of `bun run dev` (it sets `KARSE_FAKE_LOGS=1` for continuously streaming simulated log lines):

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
- The URL becomes `/logs` and the navbar page title shows "Logs". The title appears only in the navbar; the page body does not repeat it as an in-page heading.

### Controls
- A "Namespace" dropdown defaults to "All namespaces" and lists `default`.
- A pod picker: a "Search pods..." button (the dropdown trigger). The pod list is not shown until you open it.

### The pod picker is a searchable, multi-select dropdown
- This is the single shared pod picker (`PodFilter`) used everywhere pods can be selected; there is no separate per-page selector.
- Initially the picker is collapsed: only the "Search pods..." trigger button is shown, with no pod list expanded on the page.
- Click the trigger. A dropdown drops DOWN below it as an overlay, holding (top to bottom): a "Search pods..." input, an "N selected" count next to a "Clear" button, and a checkbox list of `nginx-one`, `nginx-two`, and `redis-main`.
- The "N selected" count and the "Clear" button sit in a header row directly above the checkbox list (not below it). Only the pod list scrolls, so the count and Clear stay visible however long the list is.
- The dropdown panel is a wide overlay (440px) and the pod list is tall (up to 60% of the window height), so with only three pods the whole list is visible at once with no scrolling. In a namespace with many pods (e.g. a kwok fixture with 20+), the list shows a large number of pods at once before it needs scrolling, and a very long list still scrolls to reach the rest.
- With a namespace whose pod list is longer than the panel, confirm a clearly visible scrollbar runs down the right edge of the pod list: a track with a draggable grey thumb, plainly standing out. (This is the picker's own always-visible bar; the browser's native overlay scrollbar is invisible here, so do not rely on it.) The thumb sits near the top when the list is unscrolled, showing there are more pods below. Drag the thumb (or put the mouse over the pod list and wheel down): the list scrolls inside the panel all the way to its end — the thumb reaches the bottom of the track, the very last pod is fully visible inside the panel, not cut off, and its checkbox can still be ticked. No pod is unreachable. Narrow the list (e.g. search for a single pod) so it fits the panel: the scrollbar disappears, as there is nothing to scroll.
- Type `nginx` into the "Search pods..." input. The checkbox list narrows to `nginx-one` and `nginx-two`; `redis-main` disappears. Clear the input and all three return.
- The "N selected" count and the "Clear" button sit inside the same dropdown as the search input and checkbox list, not floating on the page.
- Click outside the dropdown (or press Escape). It collapses again, leaving only the trigger. When pods are checked the trigger reads "N pod(s) selected"; with a search typed it reads "Search: <text>".

### Selected pods sort to the top, with a divider
- Open the picker with nothing checked. The three pods are listed in one alphanumerical group (`nginx-one`, `nginx-two`, `redis-main`), with no divider line.
- Check `redis-main`. It immediately jumps to the top of the list (the selected group), above the unchecked `nginx-one` and `nginx-two`, and a divider line appears between it and the unchecked pods.
- Check `nginx-two` as well. Both checked pods sit at the top in alphanumerical order (`nginx-two`, `redis-main`), then the divider, then the remaining unchecked `nginx-one`.
- Check the last pod so every pod is selected. The divider disappears (one group again). Press "Clear": all pods return to one alphanumerical group with no divider.

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

### Removing a pod from the stream with its close button
- Open the picker dropdown, check `nginx-one` and `redis-main`, close the dropdown and press "Stream". The row above the logs reads "Streaming 2 pod(s):" with a chip for each pod, and both pods' lines are arriving.
- Each chip has a close ("x") button at the end of the pod name.
- Click the close button on the `redis-main` chip. Its chip disappears, the row reads "Streaming 1 pod(s):", and no further `redis-main` lines arrive: the viewer now shows only `nginx-one` output.
- Open the picker dropdown. The count reads "1 selected" and only `nginx-one` is checked, i.e. the same state you would get by unticking `redis-main` in the picker and pressing Stream again.
- Click the close button on the last remaining chip (`nginx-one`). The stream stops and the page returns to its empty state: the "Streaming N pod(s)" row is gone, the button reads "Stream" (not "Stop"), the picker trigger is back to "Search pods...", the caption reads "No logs yet", and the log panel shows "Check pods or type a search, then press Stream." No error is shown and the page is still usable: pick pods and press Stream to start again.

### Scoping by namespace
- Select `default` from the Namespace dropdown and press "Stream". Only pods in `default` are streamed (all three pods here).

### Auto-follow and the scrollbar
- Started with `bun run dev:test` (above), the backend runs with `KARSE_FAKE_LOGS=1`, so every streamed pod emits a short backlog and then **keeps streaming**, a new line roughly every 100ms, for as long as the stream is open. That is what makes this section testable by hand: stream any pod and the viewer fills and keeps filling on its own.
- Stream a pod and let it fill past one screen (a few seconds).
- While the viewer is scrolled to the bottom, watch new lines arrive: the view stays pinned to the bottom, always showing the newest line.
- Confirm the log panel shows a clearly visible scrollbar down its right edge: a track with a light-grey draggable thumb that plainly stands out against the dark panel. (This is the app's own custom bar; the browser's native overlay scrollbar is invisible against the dark panel, so do not rely on it.)
- Drag the thumb up with the mouse (or use the mouse wheel) to scroll into the earlier output. Dragging the thumb scrolls the view and the earliest streamed lines remain reachable. New lines keep arriving but the view stays where you left it: it is not yanked back to the bottom.
- Scroll back to the bottom with the mouse wheel. Auto-follow resumes: new lines again keep the view pinned to the end.
- Now repeat it using the scrollbar, which is the path that used to break: **drag the thumb** up into the history, watch a few lines arrive (the view holds still), then **drag the thumb all the way back down** to the bottom of the track and let go. Auto-follow must resume: the lines that arrive after the drag keep the view pinned to the newest line. It must not stay stuck at the bottom while new lines pile up below the fold.
- Follow is not a one-shot: repeat the scroll-up/scroll-back cycle several times, mixing the wheel and the thumb. Following must resume every single time the view returns to the bottom, for the whole session.
- Make the window short (or open the browser dev tools to shrink the viewport) while a pod streams. The log panel shrinks to fit the remaining height rather than pushing the page past the window: the page itself must not gain its own scrollbar, and the newest line stays visible at the bottom of the panel as lines arrive. It must not slide below the window edge (which would leave auto-follow pinning an offscreen bottom, so the view only appears to stop following).

### Jump to top and jump to bottom
- Look at the far right of the toolbar row that holds the Stream button. Two buttons sit there, clear of Stream and to its right: "Top" (an up chevron) and "Bottom" (a down chevron), with "Bottom" rightmost.
- Stream a pod (as above) and let the viewer fill past one screen so there is history to jump through.
- Press "Top". The view jumps straight to the very first streamed line. New lines keep arriving, but the view stays at the top: it is not yanked back down.
- Press "Bottom". The view jumps to the newest line, and it **sticks**: as further lines arrive the view stays pinned to the end, exactly as if you had scrolled back down by hand. It must not scroll to the end once and then be left behind by the next line.
- Repeat the Top/Bottom cycle a few times, and mix in the wheel and the scrollbar thumb. Every press of "Bottom" must re-engage the follow behaviour for the rest of the stream.

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

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/25-live-logs/teardown.sh
```
</content>
