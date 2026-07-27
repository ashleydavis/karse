// Maps a Kubernetes resource reference (its kind, name, and namespace) to the
// in-app detail route for that resource, so any inline mention of a resource can
// link through to its own detail page. This is the single place that knows how to
// turn a (kind, namespace, name) triple into a route, so every reference across
// the app resolves routes the same way.
//
// Returns null when the reference cannot be resolved to a detail page, in which
// case the caller renders plain text rather than a broken link. A reference is
// unresolvable when:
//   - the name is empty, or
//   - the kind has no detail page in Karse (e.g. ReplicaSet, Job, Service), or
//   - the kind is namespaced but no namespace was supplied.
//
// Cluster-scoped kinds (Node, Namespace) carry only a name; namespaced kinds
// (Pod, Deployment, StatefulSet, DaemonSet) carry both namespace and name.
export function resourcePath(
    kind: string,
    name: string,
    namespace: string,
): string | null {
    if (name === "")
    {
        return null;
    }
    switch (kind)
    {
        case "Pod":
            return namespace === "" ? null : `/pods/${namespace}/${name}`;
        case "Node":
            return `/nodes/${name}`;
        case "Namespace":
            return `/namespaces/${name}`;
        case "Deployment":
            return namespace === "" ? null : `/deployments/${namespace}/${name}`;
        case "StatefulSet":
            return namespace === "" ? null : `/statefulsets/${namespace}/${name}`;
        case "DaemonSet":
            return namespace === "" ? null : `/daemonsets/${namespace}/${name}`;
        default:
            return null;
    }
}

// The kinds that carry no namespace, so a reference to one identifies it by name alone.
const CLUSTER_SCOPED_KINDS = ["Node", "Namespace"];

// The path segments below the kubeconfig context that identify a resource, ready to hand
// to the copy menu (CopyNameButton / CopyNameCell) so it can build the short and long
// forms. This is the single place that knows a Node or a Namespace has no namespace
// segment, so every reference across the app derives the same path for the same resource.
//
// A namespaced kind gives [namespace, name] and a cluster-scoped one gives [name]. A
// namespaced reference that arrived without a namespace falls back to [name] rather than
// leaving an empty segment in the middle of the path.
export function resourceNameSegments(
    kind: string,
    name: string,
    namespace: string,
): string[] {
    if (CLUSTER_SCOPED_KINDS.includes(kind) || namespace === "")
    {
        return [name];
    }
    return [namespace, name];
}
