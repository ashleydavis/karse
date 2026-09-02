import { KINDS_BY_DISPLAY_KIND, knownResourceKind } from "karse-types";

// How a kind is named in the UI, given the `:type` token from a generic detail route. A
// kind Karse knows gives its singular display kind; any other token names itself, which
// is the best the app can say before the cluster answers with the resource's real kind.
export function resourceKindLabel(token: string): string {
    return knownResourceKind(token)?.kind ?? token;
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
