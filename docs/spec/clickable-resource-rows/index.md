# clickable-resource-rows

**ID:** clickable-resource-rows
**Spec:** Settled
**Implementation:** Complete

Every reference to a concrete resource on any page links to that resource's detail page, so any resource is one click away from its full detail view. Applies to table rows (nodes, pods, deployments, stateful sets, daemon sets, and pods on detail pages) and to inline references (a pod's node/namespace, a workload's namespace, a container's pod, the related/involved object on the error and event detail pages). A shared `ResourceRef` component and `resourcePath` resolver build every link, and an unresolvable reference degrades to plain text.

## Sub-features
None.
