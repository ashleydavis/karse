# loading-indicators

**ID:** loading-indicators
**Spec:** Settled
**Implementation:** Complete

A shared loading progress indicator shown while a page's primary data query is in flight, used consistently across every resource list page and detail page. Replaces the previously blank page during the wait. Backed by the TanStack Query `isLoading`/`isPending` state and the shared `LoadingIndicator` component. Data loads have a short timeout: if the cluster does not respond (for example the VPN or internet is down), the spinner stops and a connectivity error with a Retry button is shown instead, via the shared `LoadError` component.

## Sub-features
None.
