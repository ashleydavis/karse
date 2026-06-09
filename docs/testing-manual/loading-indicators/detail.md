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

### Removal and error state
- On each page, confirm the spinner disappears once the data has loaded and the page content is shown.
- Stop the backend (or point at an unreachable context) and reload a page. Confirm that on failure the spinner is replaced by an error alert, not left spinning forever.

## Teardown

```sh
./docs/testing-manual/_fixtures-kwok/09-many-pods-many-namespaces/teardown.sh
```
