import { Breadcrumbs as MuiBreadcrumbs, Link as MuiLink, Typography } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Link, useLocation, useParams } from "react-router-dom";

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
};

// Builds the breadcrumb trail from the current pathname and route params.
function buildCrumbs(pathname: string, params: Record<string, string | undefined>): Crumb[] {
    const segments = pathname.split("/").filter((s) => s.length > 0);
    if (segments.length === 0)
    {
        return [{ label: "Cluster" }];
    }

    const root = segments[0];
    const listLabel = LIST_LABELS[root] ?? root;

    // Pod detail: /pods/:namespace/:name -> Pods > <namespace> > <name>
    if (root === "pods" && params.namespace && params.name)
    {
        return [
            { label: "Pods", to: "/pods" },
            { label: params.namespace },
            { label: params.name },
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

// Renders a breadcrumb trail derived from the current route, linking back to list pages.
export function Breadcrumbs() {
    const { pathname } = useLocation();
    const params = useParams();
    const crumbs = buildCrumbs(pathname, params);

    return (
        <MuiBreadcrumbs
            data-test-id="breadcrumbs"
            aria-label="breadcrumb"
            separator={<FontAwesomeIcon icon={["fas", "chevron-right"]} style={{ fontSize: "0.6rem" }} />}
            sx={{ fontSize: "0.875rem" }}
        >
            {crumbs.map((crumb, index) => {
                const isLast = index === crumbs.length - 1;
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
                            sx={{ fontSize: "0.875rem" }}
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
                        sx={{ fontSize: "0.875rem", fontWeight: 600 }}
                    >
                        {crumb.label}
                    </Typography>
                );
            })}
        </MuiBreadcrumbs>
    );
}
