// Maps an event's involved object (its Kubernetes kind, name, and namespace) to
// the in-app detail route for that resource, so an event can link through to the
// Pod / Node / workload it concerns. Returns null when the kind has no detail
// page in Karse (e.g. ReplicaSet, Job), in which case the object is shown as
// plain text rather than a link.
export function involvedObjectPath(
    objectKind: string,
    objectName: string,
    namespace: string,
): string | null {
    if (objectName === "")
    {
        return null;
    }
    switch (objectKind)
    {
        case "Pod":
            return namespace === "" ? null : `/pods/${namespace}/${objectName}`;
        case "Node":
            return `/nodes/${objectName}`;
        case "Namespace":
            return `/namespaces/${objectName}`;
        case "Deployment":
            return namespace === "" ? null : `/deployments/${namespace}/${objectName}`;
        case "StatefulSet":
            return namespace === "" ? null : `/statefulsets/${namespace}/${objectName}`;
        case "DaemonSet":
            return namespace === "" ? null : `/daemonsets/${namespace}/${objectName}`;
        default:
            return null;
    }
}
