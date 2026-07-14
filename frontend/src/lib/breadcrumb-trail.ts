// Pure helpers that shape the nav-bar breadcrumb trail so it never wraps onto a
// second line or grows the nav-bar height: middle-truncation of long resource
// names and collapsing of over-long trails. Kept UI-free so it is unit-testable.

// One entry in the breadcrumb trail; a missing "to" marks the current (non-linked) page.
export type Crumb = {
    label: string;
    to?: string;
};

// Maximum number of crumbs shown in the trail before inner crumbs are collapsed
// into a single "..." crumb. The deepest current trail (pod detail) is four
// crumbs, so four keeps every existing trail intact while capping anything deeper.
export const MAX_TRAIL_ITEMS = 4;

// Maximum number of characters shown for a single resource-name crumb before it
// is middle-truncated. Long Kubernetes names would otherwise widen the nav bar.
export const MAX_NAME_LENGTH = 24;

// The placeholder used for the collapsed inner crumbs and the middle of a
// truncated name.
export const ELLIPSIS = "...";

// Middle-truncates a label that exceeds the limit, keeping the start and end
// visible and replacing the middle with "...". Shorter labels are returned
// unchanged. The result is never longer than the limit.
export function middleTruncate(label: string, limit: number): string {
    if (label.length <= limit)
    {
        return label;
    }
    const keep = limit - ELLIPSIS.length;
    const head = Math.ceil(keep / 2);
    const tail = Math.floor(keep / 2);
    return label.slice(0, head) + ELLIPSIS + label.slice(label.length - tail);
}

// Collapses a trail longer than maxItems by keeping the first crumb and the
// last (maxItems - 2) crumbs, inserting a single non-linked "..." crumb between
// them. The first (root) and last (current) crumbs always stay visible. Trails
// at or under the cap are returned unchanged.
export function collapseCrumbs(crumbs: Crumb[], maxItems: number): Crumb[] {
    if (crumbs.length <= maxItems)
    {
        return crumbs;
    }
    const tailCount = maxItems - 2;
    const tail = crumbs.slice(crumbs.length - tailCount);
    return [
        crumbs[0],
        { label: ELLIPSIS },
        ...tail,
    ];
}

// Maps a pod detail tab value (from the "tab" query param) to its breadcrumb
// display label, so the trail reflects the currently selected sub tab. Every tab
// the pod detail page renders must appear here; a missing entry would silently
// fall back to the Detail label and show the wrong (stale) crumb.
export const POD_TAB_LABELS: Record<string, string> = {
    detail: "Status",
    containers: "Containers",
    "init-containers": "Init Containers",
    labels: "Labels",
    performance: "Resource utilization",
    logs: "Logs",
    commands: "Commands",
    yaml: "YAML",
};

// Maps a container detail tab value (from the "tab" query param) to its
// breadcrumb display label. Every tab the container detail page renders must
// appear here, for the same reason as POD_TAB_LABELS.
export const CONTAINER_TAB_LABELS: Record<string, string> = {
    detail: "Status",
    logs: "Logs",
    commands: "Commands",
    yaml: "YAML",
};

// Resolves a "tab" query-param value to its breadcrumb label using the given
// tab-label map, falling back to the Detail label (the default tab) for a
// missing or unrecognised value, so the leaf crumb always has a label.
export function tabLabel(labels: Record<string, string>, tab: string | null): string {
    return labels[tab ?? "detail"] ?? labels.detail;
}

// Maps a top-level list-page segment to its display label. Used both by the
// pathname-derived trail and by the origin trail (which labels the page a link was
// followed from), so a page is named the same way wherever it appears in a trail.
export const LIST_LABELS: Record<string, string> = {
    cluster: "Cluster",
    "all-resources": "All resources",
    contexts: "Contexts",
    nodes: "Nodes",
    namespaces: "Namespaces",
    pods: "Pods",
    deployments: "Deployments",
    statefulsets: "StatefulSets",
    daemonsets: "DaemonSets",
    autoscalers: "Autoscalers",
    logs: "Logs",
    events: "Events",
    errors: "Errors",
    about: "About",
    config: "Config",
};

// The list-page segments whose detail route carries a namespace segment before the
// resource name (/pods/:namespace/:name). Every other detail route names the
// resource directly (/nodes/:name), so the leaf sits one segment earlier.
const NAMESPACED_ROOTS = ["pods", "deployments", "statefulsets", "daemonsets"];

// The list-page segments whose detail route ends in an opaque id (an error's index,
// an event's uid) rather than a resource name. Their origin crumb shows this generic
// label, so the trail never displays a raw index or GUID.
const OPAQUE_LEAF_LABELS: Record<string, string> = {
    errors: "Error",
    events: "Event",
};

// The "from" value the All resources page tags its row links with, so a detail
// page reached from that page can show it as the breadcrumb origin.
export const FROM_ALL_RESOURCES = "all-resources";

// The "from" prefix a Performance treemap tags its pod-drill links with, so the
// pod detail page knows it was reached from a Performance page and can both render
// the right breadcrumb origin and send the back button to that page rather than the
// Pods list. The cluster treemap uses the bare prefix; the node treemap appends the
// node name ("node-performance:<nodeName>") so the origin's page can be rebuilt.
export const FROM_CLUSTER_PERFORMANCE = "cluster-performance";
export const FROM_NODE_PERFORMANCE = "node-performance";

// A resolved Performance origin: the origin page's pathname and the breadcrumb
// label its origin crumb shows. `path` is just the pathname; the Performance tab is
// selected via the "tab" query param the caller overlays (PERFORMANCE_TAB), so the
// origin page reopens on its Performance tab. `backTo` is the same target as a single
// path+query string, for the breadcrumb <Link>.
export type PerformanceOrigin = {
    path: string;
    backTo: string;
    crumbLabel: string;
};

// The "tab" query-param value that selects a page's Performance tab, used when the
// back button / origin crumb returns to a Performance page so it reopens there.
export const PERFORMANCE_TAB = "performance";

// Resolves a "from" value set by a Performance treemap into the origin page it came
// from. Returns the cluster Performance hub for FROM_CLUSTER_PERFORMANCE, and the
// originating node's Performance tab for "node-performance:<nodeName>". Returns null
// for any other "from" (so the caller falls back to the normal Pods trail / back
// target), and also when a node origin carries no node name (so we never build a
// half-formed "/nodes/" path).
export function performanceOrigin(from: string | null): PerformanceOrigin | null {
    if (from === FROM_CLUSTER_PERFORMANCE)
    {
        return {
            path: "/cluster",
            backTo: `/cluster?tab=${PERFORMANCE_TAB}`,
            crumbLabel: "Cluster",
        };
    }
    if (from !== null && from.startsWith(FROM_NODE_PERFORMANCE + ":"))
    {
        const nodeName = from.slice(FROM_NODE_PERFORMANCE.length + 1);
        if (nodeName === "")
        {
            return null;
        }
        return {
            path: `/nodes/${nodeName}`,
            backTo: `/nodes/${nodeName}?tab=${PERFORMANCE_TAB}`,
            crumbLabel: middleTruncate(nodeName, MAX_NAME_LENGTH),
        };
    }
    return null;
}

// The breadcrumb trail for a resource detail page reached from another page,
// showing the originating page followed by the specific resource, e.g.
// "All resources > nginx-abc". The origin crumb links back to the page the user
// came from; the resource is the current (non-linked) leaf, showing only the
// resource name (no kind prefix), middle-truncated to keep the trail on one line.
//
// `kind` is still required (non-null) so the origin trail is only built for the
// recognised detail routes the All resources page links to; it is no longer shown
// in the leaf label.
//
// Returns null when no origin trail applies, so the caller falls back to the
// normal pathname-derived trail. That happens when `from` is not a recognised
// origin, or the kind/name needed for the leaf is missing (so we never render a
// half-formed "All resources > " trail).
export function originCrumbs(
    from: string | null,
    kind: string | null,
    name: string | null,
): Crumb[] | null {
    if (name === "" || name === null)
    {
        return null;
    }
    const origin = resolveOrigin(from, kind);
    if (origin === null)
    {
        return null;
    }
    return [
        ...origin.crumbs,
        { label: middleTruncate(name, MAX_NAME_LENGTH) },
    ];
}

// Rebuilds the trail of the page a link was followed from, given that page's own
// location as tagged in the "from" param (e.g. "/nodes/node-cp?tab=pods"). This is
// what makes a destination's breadcrumb reflect the path the user actually took
// rather than a fixed list-page trail: every crumb links back, and the last crumb
// links to the exact view (tab included) the user left.
//
// The trail is the origin's list page followed by the origin resource itself, e.g.
// "Nodes > node-cp", and for a container origin the pod as well ("Pods > web > nginx").
// An origin that is itself a list page is a single crumb ("Errors").
//
// Returns null when `from` is not a page path (it is one of the fixed origin tokens,
// or absent), or names a root with no known label, or is missing the leaf segment its
// route needs, so the caller falls back to the normal pathname-derived trail rather
// than rendering a half-formed one.
export function pathOriginCrumbs(from: string | null): Crumb[] | null {
    if (from === null || !from.startsWith("/"))
    {
        return null;
    }
    const pathname = from.split("?")[0];
    const segments = pathname.split("/").filter((s) => s.length > 0);
    if (segments.length === 0)
    {
        return null;
    }

    const root = segments[0];
    const listLabel = LIST_LABELS[root];
    if (listLabel === undefined)
    {
        return null;
    }

    // The origin was a list page (or the cluster hub): a single crumb linking back to it.
    if (segments.length === 1)
    {
        return [{ label: listLabel, to: from }];
    }

    // A container detail origin (/pods/:namespace/:name/containers/:container) keeps the
    // pod between the list page and the container, so the trail still shows how the user
    // reached the container they left.
    if (root === "pods" && segments[3] === "containers" && segments[4] !== undefined)
    {
        return [
            { label: listLabel, to: `/${root}` },
            { label: middleTruncate(segments[2], MAX_NAME_LENGTH), to: `/pods/${segments[1]}/${segments[2]}` },
            { label: middleTruncate(segments[4], MAX_NAME_LENGTH), to: from },
        ];
    }

    const leaf = NAMESPACED_ROOTS.includes(root) ? segments[2] : segments[1];
    if (leaf === undefined || leaf === "")
    {
        return null;
    }
    const leafLabel = OPAQUE_LEAF_LABELS[root] ?? middleTruncate(leaf, MAX_NAME_LENGTH);
    return [
        { label: listLabel, to: `/${root}` },
        { label: leafLabel, to: from },
    ];
}

// The page a detail page was reached from, resolved from its "from" tag: the crumbs
// that precede the destination in the breadcrumb trail, plus the single target the back
// button returns to and the label naming it. Trail and back target come from the same
// place, so the two can never diverge.
export type Origin = {
    to: string;
    label: string;
    crumbs: Crumb[];
};

// Resolves the "from" tag on a detail page's URL into the origin page it was reached
// from. Three kinds of origin are recognised, in order: a Performance treemap drill,
// the All resources list, and any other page, which tags its links with its own path
// (see `pathOriginCrumbs`). Returns null when the tag names none of them, so the caller
// falls back to the page's own pathname-derived trail and back target.
//
// `kind` gates only the All resources origin, whose trail is built solely for the
// recognised detail routes that page links to.
export function resolveOrigin(from: string | null, kind: string | null): Origin | null {
    // A pod drilled into from a Performance treemap shows that Performance page as the
    // origin, e.g. "node-cp > web" (the node's Performance tab) or "Cluster > web" (the
    // cluster hub). The kind is not needed here (the treemap only links to pods).
    const performance = performanceOrigin(from);
    if (performance !== null)
    {
        return {
            to: performance.backTo,
            label: performance.crumbLabel,
            crumbs: [{ label: performance.crumbLabel, to: performance.backTo }],
        };
    }

    if (from === FROM_ALL_RESOURCES)
    {
        if (kind === null)
        {
            return null;
        }
        return {
            to: "/all-resources",
            label: "All resources",
            crumbs: [{ label: "All resources", to: "/all-resources" }],
        };
    }

    const crumbs = pathOriginCrumbs(from);
    if (crumbs === null)
    {
        return null;
    }
    const last = crumbs[crumbs.length - 1];
    return {
        to: last.to ?? "/",
        label: last.label,
        crumbs,
    };
}
