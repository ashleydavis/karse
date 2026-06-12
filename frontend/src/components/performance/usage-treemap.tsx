import { Box, Paper, Typography, useTheme } from "@mui/material";
import { ResponsiveTreeMap } from "@nivo/treemap";
import type { PerformanceMetric } from "karse-types";
import { useShareableNavigate } from "../../lib/nav-state";
import { formatCpu, formatMemory } from "../../lib/performance";
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

// The display label for a treemap cell: the segment after the last "/" of its id (the
// pod name on a cluster leaf, the container name on a node leaf, the namespace/pod on
// an interior row), falling back to the whole id when there is no "/".
function cellLabel(id: string): string {
    const slash = id.lastIndexOf("/");
    return slash === -1 ? id : id.slice(slash + 1);
}

// Wraps nivo's ResponsiveTreeMap to render the Breakdown view. Leaves are coloured by
// utilisation when colorByUtilisation is set; clicking a leaf navigates to that pod's
// detail page (its Performance tab), tagging it with `origin` (a "from" value) so the
// pod page's breadcrumb and back button return here rather than to the Pods list.
// Interior nodes (nodes/namespaces) are not navigable. Hovering a leaf shows a tooltip
// with the cell label and its usage for the selected metric (replacing nivo's empty
// default tooltip). The chart needs an explicit height because its parent is
// flex/auto-sized.
export function UsageTreemap({
    root,
    colorByUtilisation,
    origin,
    metric,
}: {
    root: TreemapNode;
    colorByUtilisation: boolean;
    origin: string;
    metric: PerformanceMetric;
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
                label={(node) => cellLabel(String(node.id))}
                // Replace nivo's empty default tooltip with the cell label and its usage
                // for the selected metric (CPU in m/cores, memory in Mi/Gi).
                tooltip={({ node }) => (
                    <Paper
                        data-test-id="perf-treemap-tooltip"
                        elevation={3}
                        sx={{ px: 1.5, py: 1 }}
                    >
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {cellLabel(String(node.id))}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                            {metric === "cpu"
                                ? formatCpu(node.value)
                                : formatMemory(node.value)}
                        </Typography>
                    </Paper>
                )}
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
