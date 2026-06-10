# event-detail manual tests

Manual tests for the event detail page (`/events/:uid`). See the spec: [event-detail](../../spec/event-detail/detail.md).

Start the app first. From the repo root run:

```sh
bun run dev
```

Then open the frontend at `http://127.0.0.1:5173` and select the `kwok-karse-test` context.

## Scenario: Event drill-down

Reuses the events fixture (one Warning, two Normal events across two namespaces).

**Fixture:** [_fixtures-kwok/28-events-view](../_fixtures-kwok/28-events-view/)

```sh
./docs/testing-manual/_fixtures-kwok/28-events-view/setup.sh
```

### What to check
- **Drill down**: on `/events`, click the `BackOff` row. The URL becomes `/events/<uid>` and the detail page opens.
- **Header**: the page heading shows the event reason (`BackOff`) and a yellow "Warning" type chip.
- **Fields**: the Details panel shows Type, Reason, Object (`Pod/nginx`), Source / Component, Count (9), Namespace, Age, First seen, and Last seen. First seen and Last seen show an absolute date-time with the relative age in parentheses.
- **Full message**: the Message panel shows the event's complete message, not clipped.
- **Object link**: click the Object value (`Pod/nginx`). The app navigates to that pod's detail page (`/pods/default/nginx`).
- **Back navigation**: from the event detail page, click the back arrow (top-left). The app returns to `/events`. The "Events" breadcrumb also returns to the list; the trail reads `Events > <reason>`, with the trailing crumb showing the event's own name (e.g. `Events > BackOff`), not the literal word `Event`.
- **Normal event**: go back to `/events` and click the `Scheduled` row. Its detail page shows a grey "Normal" chip and the same field layout.
- **Not found**: manually visit `/events/does-not-exist`. The page shows a "This event was not found" message with a working back button rather than an error.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/28-events-view/teardown.sh
```
