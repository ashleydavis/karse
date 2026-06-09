# loading-indicators

## Overview

While a page is waiting for its primary data from the cluster, Karse shows a shared loading progress indicator instead of a blank page. The indicator is a large, clearly visible circular spinner alone, centred in the content area, with no text. It is rendered by the shared `LoadingIndicator` component (`frontend/src/components/loading-indicator.tsx`) and driven by the TanStack Query loading state (`isLoading`/`isPending`) of each page's primary query.

Applied consistently across every resource list page and detail page:

- **List pages**: nodes, pods, deployments, stateful sets, daemon sets, namespaces, events, errors, and the cluster overview (home) stat tiles.
- **Detail pages**: pod detail, node detail, and the shared workload detail.

## Behaviour

- While a page's primary data query is loading, the `LoadingIndicator` (a prominent centred spinner alone, with no text) is shown in place of the page content.
- Once the data loads, the indicator is removed and the data (table or detail panels) is rendered.
- If the query fails, the indicator is removed and an error state (the shared `LoadError` component, an MUI `Alert`) is shown instead.
- The same component is used everywhere so the loading experience is identical across pages.
- The indicator carries `data-test-id="loading-indicator"` so e2e tests can assert it appears and is then removed.

## Load timeout and connectivity error

So the spinner can never spin forever (for example when the cluster is unreachable because the VPN or internet is down), every data request has a short timeout and a failed load shows a clear, recoverable error state.

- Every `/api/*` request made through the shared axios client (`frontend/src/lib/api-client.ts`) has a default timeout of `LOAD_TIMEOUT_MS` (15 seconds, defined in `frontend/src/lib/load-error.ts`). If the cluster has not responded by then, the request is aborted and the query fails instead of staying in flight.
- A failed load (a timeout, or a request that never reached a responding server) is reported as a connectivity error whose message ends with "Make sure your internet or VPN is connected". A load that did get an HTTP error response keeps the server-provided message. This mapping lives in `loadErrorMessage` (`frontend/src/lib/load-error.ts`).
- The error state is rendered by the shared `LoadError` component (`frontend/src/components/load-error.tsx`): an MUI `Alert` (`data-test-id="load-error"`) showing the message plus a **Retry** button (`data-test-id="load-error-retry"`) that re-runs the page's primary query via TanStack Query's `refetch`.
- This applies across every resource and cluster data load: the nodes, pods, deployments, stateful sets, daemon sets, namespaces, events, and errors list pages, the cluster overview, and the pod, node, namespace, and workload detail pages.

## Acceptance Criteria

- [x] While a page's primary data query is loading, a clear progress indicator is shown instead of a blank page.
- [x] The indicator is removed once data loads (or an error state is shown on failure).
- [x] Applied consistently across resource list pages and detail pages.
- [x] A shared `LoadingIndicator` component keeps the behaviour consistent.
- [x] Data loads have a short timeout (15s) after which the spinner stops.
- [x] On timeout (or an unreachable cluster) the view shows a connectivity error state, not a spinner.
- [x] The connectivity error includes the text "Make sure your internet or VPN is connected".
- [x] The error state offers a Retry path that re-attempts the load.

## Open Questions

None.
