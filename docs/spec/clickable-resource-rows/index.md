# clickable-resource-rows

**ID:** clickable-resource-rows
**Spec:** Settled
**Implementation:** Complete

Every reference to a concrete resource on any page links to that resource's detail page, so any resource is one click away from its full detail view. Applies to table rows (nodes, pods, deployments, stateful sets, daemon sets, and pods on detail pages) and to inline references (a pod's node/namespace, a workload's namespace, a container's pod, and the related/involved object both in the errors/events tables and on the error/event detail pages). A shared `ResourceRef` component and `resourcePath` resolver build every link, and an unresolvable reference degrades to plain text. The breadcrumb trail on the destination is path-aware: each link is tagged with the page it was followed from, so the same resource shows the trail of the path actually taken to reach it and its origin crumb (and the pod detail back button) return to the exact view left behind.

## Sub-features
None.
