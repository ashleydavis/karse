# loading-indicators manual tests

Manual tests for the shared loading progress indicator. Each scenario uses a populated KWOK cluster; select the `kwok-karse-test` context in Karse. Because the indicator is only visible briefly while data is in flight, the network is deliberately slowed so it can be observed.

## Setup

Stand up any populated cluster. The list-and-detail data is what matters, not its exact shape; `09-many-pods-many-namespaces` gives plenty of rows to load.

**Fixture:** [_fixtures-kwok/09-many-pods-many-namespaces](../_fixtures-kwok/09-many-pods-many-namespaces/)

```sh
./docs/testing-manual/_fixtures-kwok/09-many-pods-many-namespaces/setup.sh
```

Open the browser dev tools, go to the Network tab, and set throttling to "Slow 3G" (or add a custom profile with high latency) so the `/api/*` responses are slow enough to see the loading state.

## What to check

### List pages
- With throttling on, navigate to `/pods`. Confirm a large, clearly visible circular spinner alone (no text) appears in place of the table, then is replaced by the pods table once data arrives.
- Repeat for `/nodes`, `/deployments`, `/statefulsets`, `/daemonsets`, `/namespaces`, `/events`, and `/errors`. Confirm each shows the same prominent loading spinner before its table appears.
- Navigate to `/cluster` (home). Confirm the loading spinner appears before the stat tiles render.

### Detail pages
- From `/pods`, click a pod row. Confirm the loading spinner appears before the pod detail content renders.
- From `/nodes`, click a node row. Confirm the loading spinner appears before the node detail content renders.
- From `/deployments` (or stateful sets / daemon sets), click a row. Confirm the loading spinner appears before the workload detail content renders.

### Streaming and YAML panels (progress indicator only, never loading text)
The same spinner stands in for every loading state in the app, never plain text like "Loading" or "Waiting for logs":
- Open a pod detail page and the Logs tab. While the stream is connecting and before the first line arrives, confirm the spinner is shown in the log panel, not "(waiting for logs...)" or any loading text. Once lines arrive they replace it; an idle (non-streaming) panel shows "(no logs)".
- On the Logs page (`/logs`), press Stream. Before the first line arrives, confirm the spinner is shown in the viewer, not "Waiting for log lines...". The idle (pre-stream) viewer still shows the "Pick a scope and press Stream." prompt, which is guidance, not a loading state.
- On a detail page, open the YAML sub-tab. While the YAML is loading, confirm the spinner is shown, not "Loading...". An empty result still shows "(no yaml)".

### Removal and error state
- On each page, confirm the spinner disappears once the data has loaded and the page content is shown.
- Stop the backend (or point at an unreachable context) and reload a page. Confirm that on failure the spinner is replaced by an error alert, not left spinning forever.

### Load timeout and connectivity error
- In the dev tools Network tab, block the `/api/*` requests (right-click a request, "Block request URL"), or disconnect the network / VPN, then reload a page such as `/pods`. Within about 15 seconds confirm the spinner stops and a red error alert (`data-test-id="load-error"`) appears, with text ending "Make sure your internet or VPN is connected". Confirm the spinner is not left running forever.
- Confirm the error alert shows a **Retry** button (`data-test-id="load-error-retry"`).
- Restore the network (unblock the requests), then click **Retry**. Confirm the page re-attempts the load and renders the table content, replacing the error.
- Spot-check the same timeout-then-error-then-retry behaviour on a detail page (for example open a pod from `/pods`, then block `/api/*` and reload).

## Teardown

```sh
./docs/testing-manual/_fixtures-kwok/09-many-pods-many-namespaces/teardown.sh
```
