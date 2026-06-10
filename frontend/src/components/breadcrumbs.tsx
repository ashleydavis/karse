import { Breadcrumbs as MuiBreadcrumbs, Link as MuiLink, Typography } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { collapseCrumbs, middleTruncate, MAX_NAME_LENGTH, MAX_TRAIL_ITEMS } from "../lib/breadcrumb-trail";
import type { Crumb } from "../lib/breadcrumb-trail";

// Maps a top-level list-page segment to its display label.
const LIST_LABELS: Record<string, string> = {
    cluster: "Cluster",
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
};

// Maps a pod detail tab value (from the "tab" query param) to its display label,
// so the breadcrumb trail reflects the currently selected sub tab.
const POD_TAB_LABELS: Record<string, string> = {
    detail: "Status",
    containers: "Containers",
    "init-containers": "Init Containers",
    logs: "Logs",
};

// Maps a container detail tab value (from the "tab" query param) to its display
// label, so the breadcrumb trail reflects the currently selected container sub tab.
const CONTAINER_TAB_LABELS: Record<string, string> = {
    detail: "Status",
    logs: "Logs",
    commands: "Commands",
    yaml: "YAML",
};

// Builds the breadcrumb trail from the current pathname, route params, and the
// active sub tab (the "tab" query param, used by resources that have sub tabs).
function buildCrumbs(
    pathname: string,
    params: Record<string, string | undefined>,
    tab: string | null,
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
        const tabLabel = CONTAINER_TAB_LABELS[tab ?? "detail"] ?? CONTAINER_TAB_LABELS.detail;
        return [
            { label: "Pods", to: "/pods" },
            { label: params.namespace },
            { label: params.name, to: `/pods/${params.namespace}/${params.name}` },
            { label: params.container, to: `/pods/${params.namespace}/${params.name}/containers/${params.container}` },
            { label: tabLabel },
        ];
    }

    // Pod detail: /pods/:namespace/:name -> Pods > <namespace> > <name> > <tab>
    if (root === "pods" && params.namespace && params.name)
    {
        const tabLabel = POD_TAB_LABELS[tab ?? "detail"] ?? POD_TAB_LABELS.detail;
        return [
            { label: "Pods", to: "/pods" },
            { label: middleTruncate(params.namespace, MAX_NAME_LENGTH) },
            { label: middleTruncate(params.name, MAX_NAME_LENGTH), to: `/pods/${params.namespace}/${params.name}` },
            { label: tabLabel },
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
    const crumbs = collapseCrumbs(buildCrumbs(pathname, params, searchParams.get("tab")), MAX_TRAIL_ITEMS);

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
