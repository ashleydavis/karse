import { Box, useTheme } from "@mui/material";
import { ResponsiveTreeMap } from "@nivo/treemap";
import { useShareableNavigate } from "../../lib/nav-state";
import type { TreemapNode } from "../../lib/performance";

// Colours a leaf green→amber→red by its utilisation (usage ÷ limit). A leaf with no
// known limit (utilisation null) gets a neutral blue so it is still visible without
// implying a utilisation it does not have.
function leafColor(utilisation: number | null | undefined): string {
    if (utilisation === null || utilisation === undefined) {
        return "#64748b"; // slate: unknown utilisation
    }
    if (utilisation >= 0.9) {
        return "#dc2626"; // red: at or over limit
    }
    if (utilisation >= 0.7) {
        return "#f59e0b"; // amber: getting hot
    }
    return "#16a34a"; // green: comfortable
}

// Wraps nivo's ResponsiveTreeMap to render the Breakdown view. Leaves are coloured by
// utilisation when colorByUtilisation is set; clicking a leaf navigates to that pod's
// detail page (its Performance tab), tagging it with `origin` (a "from" value) so the
// pod page's breadcrumb and back button return here rather than to the Pods list.
// Interior nodes (nodes/namespaces) are not navigable. The chart needs an explicit
// height because its parent is flex/auto-sized.
export function UsageTreemap({
    root,
    colorByUtilisation,
    origin,
}: {
    root: TreemapNode;
    colorByUtilisation: boolean;
    origin: string;
}) {
    const navigate = useShareableNavigate();
    const muiTheme = useTheme();
    // Parent-row labels (node / namespace) follow the MUI theme so they stay readable
    // against the panel background in both light and dark mode.
    const chartTheme = { text: { fill: muiTheme.palette.text.primary } };

    const hasLeaves = (root.children ?? []).some((node) =>
        (node.children ?? []).some((ns) => (ns.children ?? []).length > 0),
    );

    if (!hasLeaves) {
        return (
            <Box
                data-test-id="perf-treemap-empty"
                sx={{ color: "text.secondary", py: 4, textAlign: "center" }}
            >
                No usage to break down for this metric.
            </Box>
        );
    }

    return (
        <Box data-test-id="perf-treemap" sx={{ height: 360 }}>
            <ResponsiveTreeMap
                data={root}
                theme={chartTheme}
                identity="id"
                value="value"
                // Show the pod name (the segment after the last "/") on each leaf.
                label={(node) => {
                    const id = String(node.id);
                    const slash = id.lastIndexOf("/");
                    return slash === -1 ? id : id.slice(slash + 1);
                }}
                labelSkipSize={16}
                leavesOnly={false}
                enableParentLabel
                parentLabelPosition="top"
                borderWidth={1}
                borderColor={{ from: "color", modifiers: [["darker", 0.3]] }}
                colors={(node) =>
                    colorByUtilisation
                        ? leafColor(node.data.utilisation)
                        : "#3b82f6"
                }
                colorBy="id"
                nodeOpacity={0.9}
                onClick={(node) => {
                    const data = node.data;
                    if (data.podNamespace && data.podName) {
                        navigate(`/pods/${data.podNamespace}/${data.podName}`, {
                            tab: "performance",
                            from: origin,
                        });
                    }
                }}
                margin={{ top: 20, right: 0, bottom: 0, left: 0 }}
            />
        </Box>
    );
}
