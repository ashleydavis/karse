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

    // A pod drilled into from a Performance treemap shows that Performance page as
    // the origin, e.g. "node-cp > web" (the node's Performance tab) or "Cluster >
    // web" (the cluster hub). The origin crumb links back to that same page the back
    // button returns to, so trail and back target never diverge. The kind is not
    // needed here (the treemap only links to pods).
    const performance = performanceOrigin(from);
    if (performance !== null)
    {
        return [
            { label: performance.crumbLabel, to: performance.backTo },
            { label: middleTruncate(name, MAX_NAME_LENGTH) },
        ];
    }

    if (from !== FROM_ALL_RESOURCES || kind === null)
    {
        return null;
    }
    return [
        { label: "All resources", to: "/all-resources" },
        { label: middleTruncate(name, MAX_NAME_LENGTH) },
    ];
}
