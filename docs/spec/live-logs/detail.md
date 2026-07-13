# live-logs

## Overview

The Logs page (`/logs`) streams live, aggregated logs from one or more pods using `kubectl logs -f` (read-only follow) on the backend, merged and pushed to the browser over Server-Sent Events. Unlike the kubectl-based single-container pod log viewer (`log-viewer`), which follows one container, this page lets the user pick several pods (or every pod matching a substring/wildcard) and streams them together.

Backed by: `GET /api/logs/stream`, `backend/src/routes/logs-stream-route.ts`, `frontend/src/pages/live-logs/`, and the shared `frontend/src/components/log-viewer.tsx`.

## Behaviour

### Logs page (`/logs`) pod picker and scoping before streaming

The kubectl-based multi-pod Logs page (`/logs`, `frontend/src/pages/live-logs/`) streams `kubectl logs -f` from every chosen pod. Once a stream is open the logs are live and update automatically (no manual refresh): each `kubectl logs -f` follow pushes new lines to the backend, which forwards them over SSE to the viewer as they arrive. The page passes the checked pods (or, with nothing checked, a wildcard/substring filter) to `GET /api/logs/stream`; the backend opens one follow per matching pod and merges their output into a single `line` event stream (each `LogStreamLine` carries the source `namespace` and `pod`). A `started` event reports the set of pods the stream attached to.

The Logs page and the Pod detail Logs tab render a single shared component, `frontend/src/components/log-viewer.tsx` (`LogViewer`), so both surfaces expose the same options. The Logs page uses its full picker mode (namespace selector + pod picker + Stream/Stop); the Pod detail Logs tab passes a `fixedPod` so the component hides the picker and auto-streams that one pod. Neither surface has a "Tail" option or a Refresh button (see [log-viewer](../log-viewer/detail.md)).

The page uses a **searchable, multi-select pod picker dropdown** so it stays usable when there are many pods. This picker is the single, shared `frontend/src/components/pod-filter.tsx` (`PodFilter`) used everywhere pods can be selected, rather than re-implemented per page. The picker is a trigger button (labelled "Search pods...", or summarising the current selection/search) that, when clicked, drops an overlay panel DOWN below it. The pod list is collapsed until the trigger is used, rather than always expanded inline on the page. The dropdown panel holds, top to bottom:

- A visible **"Search pods..."** input that filters the pod list by case-insensitive substring (the pure `filterPods` helper in `frontend/src/lib/filter-pods.ts`).
- An **"N selected" count** and a **Clear** button in a header row directly above the list, that report and reset the current selection. They sit above the list (not in a footer) so they stay visible however long the list grows: only the pod list scrolls.
- A scrollable **checkbox list**, one checkbox per pod, so the user can pick several pods to stream at once. The list is **ordered selected-first**: the ticked pods appear at the top, the unticked pods below, with each group sorted alphanumerically (case-insensitive, number-aware, the pure `orderPods` helper in `frontend/src/lib/filter-pods.ts`), so the current selection is easy to find. A **divider** is drawn between the selected and unselected groups, rendered only when both groups are non-empty (none when nothing is ticked, or when every visible pod is ticked). The order updates live as pods are ticked and unticked. The dropdown panel is sized generously so many pods are visible at once without scrolling: the panel is a wide overlay (440px, capped to the viewport width) and the list grows up to 60% of the viewport height (capped at 520px) before it starts to scroll, so a typical multi-pod namespace needs little or no scrolling while a very long list still scrolls past the visible area. Because the app's browser renders the native scrollbar as an invisible auto-hiding overlay (the `::-webkit-scrollbar` pseudo-elements are ignored), the native bar is hidden and the list draws **its own always-visible scrollbar** — the same approach and pure helpers as the log viewer (`thumbMetrics`/`scrollTopForThumbTop` in `frontend/src/lib/log-autoscroll.ts`): a track down the list's right edge with a draggable grey thumb, drawn only while the list overflows, so it is plainly visible on screen that a long pod list overflows and scrolls, and the offscreen pods stay reachable (by wheel or by dragging the thumb).

The dropdown collapses again when dismissed (click away or Escape). The trigger then summarises the scope: "N pod(s) selected" when pods are checked, "Search: <text>" when a search is typed, or "Search pods..." when neither.

Streaming every pod in a context at once is not feasible, so the page requires the user to scope the stream before it will start:

- The user scopes either by checking one or more pods, or by typing a substring into the search box (with nothing checked) so every matching pod is streamed. An explicit checkbox selection takes precedence: while pods are checked the search box is disabled, and the checked pod names are sent verbatim to the backend in `pods` query parameters. With nothing checked, the search text is sent as the wildcard/substring `filter` instead.
- Pressing Stream with no pod checked and an empty search does **not** open a stream. Instead the page shows an info message ("Pick which pods to stream first") explaining that the user must check pods or type a substring, then press Stream again.
- The message clears as soon as the user checks a pod or types into the search box. Once a pod or search is given, pressing Stream opens the stream as normal.

The "Streaming N pod(s)" row of pod-name chips above the logs is capped: at most 8 chips are shown. When more pods are streaming, a "... +M more" chip appears after them; clicking it expands the row to show every streaming pod, and a "Show fewer" chip then collapses it back to the cap. This keeps a large multi-pod stream from consuming the page's vertical space.

#### Removing a pod from the stream

Each pod-name chip in the "Streaming N pod(s)" row carries a close ("x") button at the end of its label, so a pod can be dropped from the stream without going back through the pod picker:

- Clicking a chip's close button removes that pod from the streamed set: its chip disappears, the "Streaming N pod(s)" count decrements, and its log lines stop arriving.
- The pods left over become the explicit picker selection and the stream is restarted over just them, so the removed pod's `kubectl logs -f` follow is torn down (no leaked lines) and the viewer shows only the remaining pods' output. The resulting state is exactly the one the user would reach by unticking that pod in the picker and pressing Stream again, so the two routes to removal stay consistent.
- Removing the last streaming pod stops the stream and returns the page to its empty state: the chip row disappears, the button flips back to "Stream", the picker is cleared, the "Updated ..." caption resets to "No logs yet", and the viewer shows its "Check pods or type a search, then press Stream." guidance.

The viewer auto-scrolls to the newest line and caps its in-memory buffer (5000 lines) so a long-running stream cannot exhaust memory. The stream is torn down on Stop and on page unmount (closing the SSE connection, which the backend uses to terminate the `kubectl logs -f` processes).

#### Auto-follow and the visible scrollbar

The Logs viewer keeps up with a live stream without trapping the user:

- New streamed lines are appended to the viewer as they arrive.
- The view auto-follows the newest line (stays pinned to the bottom) **only while it is already at the bottom**. The follow decision is the pure helper `frontend/src/lib/log-autoscroll.ts` (`isAtBottom`/`shouldFollow`/`bottomScrollTop`), read from the viewer's scroll metrics before the new lines grow the content.
- Once the user scrolls up to read earlier output, auto-follow stops: new lines are still appended, but the scroll position is left alone (the user is not yanked back to the bottom).
- **Returning to the bottom always re-arms following**, and it does so however the user got there: the mouse wheel, the keyboard, or dragging the viewer's custom scrollbar thumb. Follow is not a latch that a scroll turns off for good; it is derived from where the view currently sits. Every path that moves the viewer therefore recomputes the flag from the position it lands on. This matters most for the custom scrollbar: assigning `scrollTop` only fires a `scroll` event when the value actually changes, so a thumb drag that lands on the bottom (or a jitter while already pinned there) fires no scroll event at all, and a drag handler that simply switched following off would leave it off with nothing left to switch it back on — auto-follow would work only until the user first touched the scrollbar, and never again for the rest of the session.
- The viewer is the **sole scroll container** for the streamed output: it shrinks to whatever height its parents leave it and never imposes a fixed minimum tall enough to push the page past the viewport. This matters because the Logs page stacks extra chrome above the viewer (the pod picker and the "Streaming N pod(s)" bar) that the Pod detail Logs tab does not. If the viewer held a fixed floor that overflowed the page, `<main>` would become a second scroll container: auto-follow would still pin the viewer to its own bottom, but that bottom would sit below the page fold, so the newest line would be offscreen and the view would only *look* like it stopped following. Keeping the viewer as the only thing that scrolls means the followed newest line stays on-screen on the Logs page exactly as it does on the Pod detail Logs tab.
- The viewer always shows a clearly visible, usable scrollbar so the streamed history is reachable. The app's browser renders the native scrollbar as an invisible auto-hiding overlay (the `::-webkit-scrollbar` pseudo-elements are ignored), so the native bar is hidden and the viewer draws **its own always-visible scrollbar**: a fixed track down the panel's right edge with a light-grey thumb (`rgb(203, 213, 225)`) that stands out against the dark `grey.900` panel. The thumb's size and position come from the pure helper `thumbMetrics`, and dragging it scrolls the viewer (`scrollTopForThumbTop`); the drag then re-derives auto-follow from where it landed, so dragging up off the bottom stops following and dragging back down to the bottom resumes it. This makes the streamed history reachable: the user can always see and grab the bar to scroll back through it, which is also what makes "scrolled up → don't yank back" reachable in the first place.

#### Logs page "last updated" indicator

Next to the Stream/Stop button the Logs page shows a small caption telling the user how fresh the streamed output is, so they can tell whether the stream is still active:

- Before any line has arrived (and after a new stream is started) it reads "No logs yet".
- Once a line lands it reads "Updated just now", then ages into "Updated Ns ago", "Updated Nm ago", and "Updated Nh ago" relative to the most recent appended log line.
- It ticks once a second so the relative time advances on its own, and it resets to "No logs yet" whenever a fresh stream is started.

## Acceptance Criteria

- [x] The kubectl-based Logs page (`/logs`) streams multi-pod `kubectl logs -f` output over SSE, merged into one viewer.
- [x] A namespace selector and a searchable, multi-select pod picker scope the stream; with nothing checked the search text is the substring/wildcard filter.
- [x] The streaming-pod label row is capped at 8 chips with a "... +M more" expander that reveals the full list (and a "Show fewer" control to collapse it), so a large stream does not eat vertical space.
- [x] The viewer auto-scrolls and caps its buffer to bound memory; the stream is torn down on Stop and on unmount.
- [x] The kubectl-based Logs page (`/logs`) does not stream all pods at once: with no pod selected and an empty filter, pressing Stream shows guidance ("Pick which pods to stream first") instead of streaming, and streaming proceeds once a pod or wildcard is given.
- [x] The Logs page (`/logs`) auto-follows the newest line only while the view is at the bottom; once the user scrolls up, new lines do not force-scroll them back down, and the viewer keeps a clearly visible, usable scrollbar so the streamed history stays reachable.
- [x] Auto-follow re-arms whenever the view returns to the bottom, by any means (wheel, keyboard, or a drag of the custom scrollbar thumb), so following resumes for the lines that arrive after the user comes back to the end. It is never left permanently off by a scroll.
- [x] The Logs page shows an "Updated ..." indicator next to the Stream/Stop button: "No logs yet" until the first line, then "Updated just now" / "Updated Ns/Nm/Nh ago" tracking the most recent appended log line, ticking once a second and resetting when a new stream starts.
- [x] The Logs page (`/logs`) pod selector is a searchable, multi-select **dropdown** picker: a trigger drops an overlay panel holding a "Search pods..." box, the "N selected" count + Clear control in a header row above the list, and a checkbox list (one per pod), all inside the dropdown, so the list is not expanded inline and it stays usable with many pods. Checked pods stream verbatim; with nothing checked the search text is the substring filter.
- [x] Each pod-name chip in the "Streaming N pod(s)" row has a close button at the end of its label. Clicking it removes that pod from the streamed set (its chip goes, the count decrements, its lines stop), leaving the same state as unticking the pod in the picker and re-streaming; removing the last pod stops the stream and returns the page to its empty state.
- [x] The pod picker is the single shared `PodFilter` component (`frontend/src/components/pod-filter.tsx`) used everywhere pods can be selected, with no bespoke per-page selector. Its list shows selected pods at the top and unselected below, each group sorted alphanumerically, with a divider between the two groups drawn only when both are non-empty; the count and Clear sit in a header above the scrolling list.
- [x] The pod picker dropdown is sized generously (a wide 440px panel, capped to the viewport width, and a list growing up to 60% of the viewport height, capped at 520px) so a typical multi-pod namespace is visible at once with little or no scrolling, while a very long list still scrolls past the visible area. Because the native scrollbar renders as an invisible auto-hiding overlay in the app's browser, the list draws its own always-visible scrollbar (track + draggable grey thumb, shown only while the list overflows), so it is plainly visible that an overflowing pod list scrolls.

## Open Questions

None.
</content>
