# loading-indicators

## Overview

While a page is waiting for its primary data from the cluster, Karse shows a shared loading progress indicator instead of a blank page. The indicator is a large, clearly visible circular spinner alone, centred in the content area, with no text. It is rendered by the shared `LoadingIndicator` component (`frontend/src/components/loading-indicator.tsx`) and driven by the TanStack Query loading state (`isLoading`/`isPending`) of each page's primary query.

Applied consistently across every resource list page and detail page:

- **List pages**: nodes, pods, deployments, stateful sets, daemon sets, namespaces, events, errors, and the cluster overview (home) stat tiles.
- **Detail pages**: pod detail, node detail, and the shared workload detail.

## Behaviour

- While a page's primary data query is loading, the `LoadingIndicator` (a prominent centred spinner alone, with no text) is shown in place of the page content.
- Once the data loads, the indicator is removed and the data (table or detail panels) is rendered.
- If the query fails, the indicator is removed and the existing error state (an MUI `Alert`) is shown instead.
- The same component is used everywhere so the loading experience is identical across pages.
- The indicator carries `data-test-id="loading-indicator"` so e2e tests can assert it appears and is then removed.

## Acceptance Criteria

- [x] While a page's primary data query is loading, a clear progress indicator is shown instead of a blank page.
- [x] The indicator is removed once data loads (or an error state is shown on failure).
- [x] Applied consistently across resource list pages and detail pages.
- [x] A shared `LoadingIndicator` component keeps the behaviour consistent.

## Open Questions

None.
