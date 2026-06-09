import type { NamespaceResource } from "karse-types";

// A namespace's "Resources" count is defined as the number of pods in it, the
// same definition used by the namespaces list column (a cluster-wide pod count).
// The namespace detail page receives every contained resource (pods, deployments,
// stateful sets, daemon sets) in `resources[]`; this derives the headline
// Resources count from that list by counting pods only, so the same namespace
// shows the same number on the list and the detail page.
//
// When the pod sub-read failed, the backend degrades it to no Pod entries, so
// this naturally returns 0 rather than throwing.
export function namespaceResourceCount(resources: NamespaceResource[]): number {
    return resources.filter((resource) => resource.kind === "Pod").length;
}
