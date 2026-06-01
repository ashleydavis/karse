import { Breadcrumbs as MuiBreadcrumbs, Link as MuiLink, Typography } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";

// One entry in the breadcrumb trail; a missing "to" marks the current (non-linked) page.
type Crumb = {
    label: string;
    to?: string;
};

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
    detail: "Detail / Status",
    containers: "Containers",
    "init-containers": "Init Containers",
    logs: "Logs",
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

    // Pod detail: /pods/:namespace/:name -> Pods > <namespace> > <name> > <tab>
    if (root === "pods" && params.namespace && params.name)
    {
        const tabLabel = POD_TAB_LABELS[tab ?? "detail"] ?? POD_TAB_LABELS.detail;
        return [
            { label: "Pods", to: "/pods" },
            { label: params.namespace },
            { label: params.name, to: `/pods/${params.namespace}/${params.name}` },
            { label: tabLabel },
        ];
    }

    // Node detail: /nodes/:name -> Nodes > <name>
    if (root === "nodes" && params.name)
    {
        return [
            { label: "Nodes", to: "/nodes" },
            { label: params.name },
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
    const crumbs = buildCrumbs(pathname, params, searchParams.get("tab"));

    return (
        <MuiBreadcrumbs
            data-test-id="breadcrumbs"
            aria-label="breadcrumb"
            separator={<FontAwesomeIcon icon={faChevronRight} style={{ fontSize: "0.7rem" }} />}
            sx={{ "& .MuiBreadcrumbs-li": { display: "flex", alignItems: "center" } }}
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
                            sx={{ fontSize, fontWeight: 600 }}
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
                        sx={{ fontSize, fontWeight: 600 }}
                    >
                        {crumb.label}
                    </Typography>
                );
            })}
        </MuiBreadcrumbs>
    );
}
