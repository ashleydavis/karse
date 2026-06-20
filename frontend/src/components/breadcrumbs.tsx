import { Breadcrumbs as MuiBreadcrumbs, Link as MuiLink, Typography } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { collapseCrumbs, middleTruncate, originCrumbs, tabLabel, POD_TAB_LABELS, CONTAINER_TAB_LABELS, MAX_NAME_LENGTH, MAX_TRAIL_ITEMS } from "../lib/breadcrumb-trail";
import type { Crumb } from "../lib/breadcrumb-trail";
import { useKubeContext } from "../lib/kube-context";
import { fetchEvents } from "../lib/api-client";

// Maps a top-level list-page segment to its display label.
const LIST_LABELS: Record<string, string> = {
    cluster: "Cluster",
    "all-resources": "All resources",
    contexts: "Contexts",
    nodes: "Nodes",
    namespaces: "Namespaces",
    pods: "Pods",
    deployments: "Deployments",
    statefulsets: "StatefulSets",
    daemonsets: "DaemonSets",
    logs: "Logs",
    stern: "Stern",
    events: "Events",
    errors: "Errors",
    about: "About",
};

// Maps a detail route's list-page segment to the singular kind label shown in an
// origin breadcrumb trail (e.g. "Pod nginx-abc"). Only the kinds the All resources
// page links to are listed; an unmapped root yields no origin trail.
const ORIGIN_KIND_LABELS: Record<string, string> = {
    pods: "Pod",
    nodes: "Node",
    namespaces: "Namespace",
    deployments: "Deployment",
    statefulsets: "StatefulSet",
    daemonsets: "DaemonSet",
};

// Builds the breadcrumb trail from the current pathname, route params, and the
// active sub tab (the "tab" query param, used by resources that have sub tabs).
function buildCrumbs(
    pathname: string,
    params: Record<string, string | undefined>,
    tab: string | null,
    eventName: string | null,
): Crumb[] {
    const segments = pathname.split("/").filter((s) => s.length > 0);
    if (segments.length === 0)
    {
        return [{ label: "Cluster" }];
    }

    const root = segments[0];
    const listLabel = LIST_LABELS[root] ?? root;

    // Container detail: /pods/:namespace/:name/containers/:container ->
    // Pods > <namespace> > <name> > <container> > <tab>
    if (root === "pods" && params.namespace && params.name && params.container)
    {
        return [
            { label: "Pods", to: "/pods" },
            { label: params.namespace },
            { label: params.name, to: `/pods/${params.namespace}/${params.name}` },
            { label: params.container, to: `/pods/${params.namespace}/${params.name}/containers/${params.container}` },
            { label: tabLabel(CONTAINER_TAB_LABELS, tab) },
        ];
    }

    // Pod detail: /pods/:namespace/:name -> Pods > <namespace> > <name> > <tab>
    if (root === "pods" && params.namespace && params.name)
    {
        return [
            { label: "Pods", to: "/pods" },
            { label: middleTruncate(params.namespace, MAX_NAME_LENGTH) },
            { label: middleTruncate(params.name, MAX_NAME_LENGTH), to: `/pods/${params.namespace}/${params.name}` },
            { label: tabLabel(POD_TAB_LABELS, tab) },
        ];
    }

    // Node detail: /nodes/:name -> Nodes > <name>
    if (root === "nodes" && params.name)
    {
        return [
            { label: "Nodes", to: "/nodes" },
            { label: middleTruncate(params.name, MAX_NAME_LENGTH) },
        ];
    }

    // Error detail: /errors/:index -> Errors > Error
    if (root === "errors" && params.index !== undefined)
    {
        return [
            { label: "Errors", to: "/errors" },
            { label: "Error" },
        ];
    }

    // Event detail: /events/:uid -> Events > <reason>. The uid is an opaque GUID,
    // so the leaf crumb shows the event's own name (its reason), resolved from the
    // events data; it falls back to the generic "Event" until the data is loaded.
    if (root === "events" && params.uid)
    {
        return [
            { label: "Events", to: "/events" },
            { label: eventName !== null ? middleTruncate(eventName, MAX_NAME_LENGTH) : "Event" },
        ];
    }

    // Namespace detail: /namespaces/:name -> Namespaces > <name>
    if (root === "namespaces" && params.name)
    {
        return [
            { label: "Namespaces", to: "/namespaces" },
            { label: middleTruncate(params.name, MAX_NAME_LENGTH) },
        ];
    }

    // Any other top-level list page is a single, current crumb.
    return [{ label: listLabel }];
}

// Renders a breadcrumb trail derived from the current route, linking back to
// list pages. The first crumb (the main page) is rendered in large, title-sized
// text; the remaining sub-page crumbs use the regular breadcrumb size.
export function Breadcrumbs() {
    const { pathname } = useLocation();
    const params = useParams();
    const [searchParams] = useSearchParams();
    const { current } = useKubeContext();

    // On the event detail route the URL only carries the event's opaque uid, so the
    // trailing crumb's name (the event's reason) has to come from the events data.
    // This reuses the same cluster-wide query key the detail page populates, so it
    // reads from the cache rather than triggering an extra fetch.
    const onEventDetail = pathname.split("/").filter((s) => s.length > 0)[0] === "events"
        && params.uid !== undefined;
    const { data: eventsData } = useQuery({
        queryKey: ["events", current, null],
        queryFn: () => fetchEvents(current!),
        enabled: onEventDetail && current !== null,
    });
    const eventName = onEventDetail
        ? (eventsData?.events.find((e) => e.uid === params.uid)?.reason ?? null)
        : null;

    // When the detail page was reached from another page (tagged via the "from"
    // query param), show that page as the breadcrumb origin followed by the
    // resource name, e.g. "All resources > nginx-abc", instead of the page's own
    // list-page trail. Falls back to the normal trail when no origin applies.
    const root = pathname.split("/").filter((s) => s.length > 0)[0] ?? "";
    const originKind = ORIGIN_KIND_LABELS[root] ?? null;
    const origin = originCrumbs(searchParams.get("from"), originKind, params.name ?? null);

    const crumbs = collapseCrumbs(
        origin ?? buildCrumbs(pathname, params, searchParams.get("tab"), eventName),
        MAX_TRAIL_ITEMS,
    );

    return (
        <MuiBreadcrumbs
            data-test-id="breadcrumbs"
            aria-label="breadcrumb"
            separator={<FontAwesomeIcon icon={faChevronRight} style={{ fontSize: "0.7rem" }} />}
            sx={{
                "& .MuiBreadcrumbs-li": {
                    display: "flex",
                    alignItems: "center",
                },
                // Keep the trail on a single line so it never wraps and grows the
                // nav-bar height; individual crumbs are already length-capped.
                "& .MuiBreadcrumbs-ol": {
                    flexWrap: "nowrap",
                },
            }}
        >
            {crumbs.map((crumb, index) => {
                const isLast = index === crumbs.length - 1;
                const isFirst = index === 0;
                // The first crumb is the main page and is shown title-sized; the
                // rest use the regular breadcrumb size.
                const fontSize = isFirst ? "1.25rem" : "0.875rem";
                if (crumb.to && !isLast)
                {
                    return (
                        <MuiLink
                            key={crumb.label + index}
                            component={Link}
                            to={crumb.to}
                            underline="hover"
                            color="inherit"
                            data-test-id="breadcrumb-item"
                            sx={{ fontSize, fontWeight: 600, whiteSpace: "nowrap" }}
                        >
                            {crumb.label}
                        </MuiLink>
                    );
                }
                return (
                    <Typography
                        key={crumb.label + index}
                        color="text.primary"
                        data-test-id="breadcrumb-item"
                        sx={{ fontSize, fontWeight: 600, whiteSpace: "nowrap" }}
                    >
                        {crumb.label}
                    </Typography>
                );
            })}
        </MuiBreadcrumbs>
    );
}
