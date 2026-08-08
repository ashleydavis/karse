import { RESOURCE_KINDS, isReadableResourceKind, knownResourceKind, type ResourceKindInfo } from "karse-types";

// The first path segment of the generic detail route, the page shown for a kind that has
// no purpose-built detail page of its own: /resources/:type/:name for a cluster-scoped
// kind and /resources/:type/:namespace/:name for a namespaced one.
export const GENERIC_DETAIL_ROOT = "resources";

// Builds the route for a resource of a given kind, from its name and namespace, or null
// when that kind cannot be identified from what was supplied.
type DetailRouteBuilder = (name: string, namespace: string) => string | null;

// The kinds that have their own purpose-built detail page, mapped to that page's route.
// A kind listed here always resolves to its own page: the generic route never shadows one.
// The precedence is this table being consulted before the generic fallback, rather than
// the order two branches happen to be written in.
const SPECIFIC_DETAIL_PAGES: Record<string, DetailRouteBuilder | undefined> = {
    Pod: (name, namespace) => namespace === "" ? null : `/pods/${namespace}/${name}`,
    Node: (name) => `/nodes/${name}`,
    Namespace: (name) => `/namespaces/${name}`,
    Deployment: (name, namespace) => namespace === "" ? null : `/deployments/${namespace}/${name}`,
    StatefulSet: (name, namespace) => namespace === "" ? null : `/statefulsets/${namespace}/${name}`,
    DaemonSet: (name, namespace) => namespace === "" ? null : `/daemonsets/${namespace}/${name}`,
    HorizontalPodAutoscaler: (name, namespace) => namespace === "" ? null : `/autoscalers/${namespace}/${name}`,
};

// The kinds Karse knows, keyed by their singular display kind ("HorizontalPodAutoscaler")
// rather than by their URL token, because that is what a resource reference names them by.
// Derived from the shared RESOURCE_KINDS table so the two sides cannot drift apart on a
// kind's token or its scope.
const KINDS_BY_DISPLAY_KIND: Record<string, (ResourceKindInfo & { token: string }) | undefined> =
    Object.fromEntries(
        Object.entries(RESOURCE_KINDS).map(([token, info]) => [info.kind, { ...info, token }]),
    );

// How a kind is named in the UI, given the `:type` token from a generic detail route. A
// kind Karse knows gives its singular display kind; any other token names itself, which
// is the best the app can say before the cluster answers with the resource's real kind.
export function resourceKindLabel(token: string): string {
    return knownResourceKind(token)?.kind ?? token;
}

// Maps a Kubernetes resource reference (its kind, name, and namespace) to the
// in-app detail route for that resource, so any inline mention of a resource can
// link through to its own detail page. This is the single place that knows how to
// turn a (kind, namespace, name) triple into a route, so every reference across
// the app resolves routes the same way.
//
// A kind with its own purpose-built page (Pod, Node, Namespace, Deployment, StatefulSet,
// DaemonSet, HorizontalPodAutoscaler) always resolves to that page. Every other kind falls
// back to the generic detail route, so a reference to a ReplicaSet, a Job, a Service or a
// kind Karse has never heard of is a working link rather than dead text.
//
// A kind Karse knows contributes its route token and its scope from the shared table. For
// any other kind the token is the kind's own lowercase name (which is how kubectl names
// the resource), and the scope is read from the reference itself: a namespace was supplied
// or it was not.
//
// Returns null when the reference cannot be resolved to a detail page, in which
// case the caller renders plain text rather than a broken link. A reference is
// unresolvable when:
//   - the name is empty, or
//   - the kind is one Karse refuses to read (a Secret), or is not a kind name at all, or
//   - the kind is known to be namespaced but no namespace was supplied.
//
// Cluster-scoped kinds carry only a name; namespaced kinds carry both namespace and name.
export function resourcePath(
    kind: string,
    name: string,
    namespace: string,
): string | null {
    if (name === "")
    {
        return null;
    }
    const specific = SPECIFIC_DETAIL_PAGES[kind];
    if (specific !== undefined)
    {
        return specific(name, namespace);
    }
    const known = KINDS_BY_DISPLAY_KIND[kind];
    const token = known?.token ?? kind.toLowerCase();
    if (!isReadableResourceKind(token))
    {
        return null;
    }
    // A kind Karse knows is placed by its recorded scope; any other kind is placed by
    // whether the reference carried a namespace, that being the only signal available.
    const namespaced = known === undefined ? namespace !== "" : known.namespaced;
    if (!namespaced)
    {
        return `/${GENERIC_DETAIL_ROOT}/${token}/${name}`;
    }
    if (namespace === "")
    {
        return null;
    }
    return `/${GENERIC_DETAIL_ROOT}/${token}/${namespace}/${name}`;
}

// The path segments below the kubeconfig context that identify a resource, ready to hand
// to the copy menu (CopyNameButton / CopyNameCell) so it can build the short and long
// forms. This is the single place that knows a Node or a Namespace has no namespace
// segment, so every reference across the app derives the same path for the same resource.
// It reads the scope from the same shared table `resourcePath` uses, so the copy menu and
// the route can never disagree about which kinds carry a namespace.
//
// A namespaced kind gives [namespace, name] and a cluster-scoped one gives [name]. A
// namespaced reference that arrived without a namespace falls back to [name] rather than
// leaving an empty segment in the middle of the path. A kind Karse does not know is
// treated as namespaced, since the caller supplying a namespace is then the only signal.
export function resourceNameSegments(
    kind: string,
    name: string,
    namespace: string,
): string[] {
    const info = KINDS_BY_DISPLAY_KIND[kind];
    if ((info !== undefined && !info.namespaced) || namespace === "")
    {
        return [name];
    }
    return [namespace, name];
}
