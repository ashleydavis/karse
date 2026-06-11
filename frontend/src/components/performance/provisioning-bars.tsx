import { Box, Typography, useTheme } from "@mui/material";
import type { PodUsage, PerformanceMetric } from "karse-types";
import { formatCpu, formatMemory, metricValue } from "../../lib/performance";

// One provisioning row: a container's usage, request, and limit for the selected
// metric. namespace/pod identify the owning pod so the row label reads in full.
type ProvisioningRow = {
    namespace: string;
    pod: string;
    container: string;
    usage: number | null;
    request: number | null;
    limit: number | null;
};

// Flattens the node's pods into one provisioning row per container for the selected
// metric. Every container is kept (including those with no usage reading) so the bars
// still show the provisioned request/limit even when live usage is unavailable.
function buildRows(pods: PodUsage[], metric: PerformanceMetric): ProvisioningRow[] {
    const rows: ProvisioningRow[] = [];
    for (const pod of pods) {
        for (const container of pod.containers) {
            rows.push({
                namespace: pod.namespace,
                pod: pod.name,
                container: container.name,
                usage: metricValue(container.usage, metric),
                request: metricValue(container.requests, metric),
                limit: metricValue(container.limits, metric),
            });
        }
    }
    return rows;
}

// Formats one metric figure for display, "—" when it is null/unset.
function formatValue(value: number | null, metric: PerformanceMetric): string {
    return metric === "cpu" ? formatCpu(value) : formatMemory(value);
}

// The width track for a row's bars is the largest of usage/request/limit, so the three
// bars share one scale within the row and stay comparable. Returns 0 when nothing is
// known (the row then renders empty bars rather than dividing by zero).
function rowScale(row: ProvisioningRow): number {
    return Math.max(row.usage ?? 0, row.request ?? 0, row.limit ?? 0);
}

// Percentage width (0–100) of one value against the row's scale, clamped so a value at
// the scale fills the track exactly. Null or a zero scale yields 0 width.
function widthPercent(value: number | null, scale: number): number {
    if (value === null || scale === 0) {
        return 0;
    }
    return Math.min(100, (value / scale) * 100);
}

// A single labelled bar (usage / request / limit) within a row. The colour is passed
// in so the three measures stay visually distinct, and the formatted value is shown
// alongside so the figure is readable without hovering.
function Bar({
    label,
    value,
    scale,
    color,
    metric,
}: {
    label: string;
    value: number | null;
    scale: number;
    color: string;
    metric: PerformanceMetric;
}) {
    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="caption" sx={{ width: 56, color: "text.secondary" }}>
                {label}
            </Typography>
            <Box sx={{ flexGrow: 1, position: "relative", height: 10, bgcolor: "action.hover", borderRadius: 1 }}>
                <Box
                    sx={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        height: "100%",
                        width: `${widthPercent(value, scale)}%`,
                        bgcolor: color,
                        borderRadius: 1,
                    }}
                />
            </Box>
            <Typography variant="caption" sx={{ width: 64, textAlign: "right", fontFamily: "monospace" }}>
                {formatValue(value, metric)}
            </Typography>
        </Box>
    );
}

// Per-container provisioning bars for a node's pods: each container gets three overlaid
// bars (usage, request, limit) on a shared per-row scale, with the formatted figures
// alongside, so over- and under-provisioning is visible at a glance. Renders for the
// selected metric (CPU or memory). Works with the Metrics API unavailable too: usage is
// then "—" with an empty bar, while request/limit from the pod spec still render.
export function ProvisioningBars({
    pods,
    metric,
}: {
    pods: PodUsage[];
    metric: PerformanceMetric;
}) {
    const theme = useTheme();
    const rows = buildRows(pods, metric);

    if (rows.length === 0) {
        return (
            <Box
                data-test-id="perf-provisioning-empty"
                sx={{ color: "text.secondary", py: 2 }}
            >
                No containers scheduled on this node.
            </Box>
        );
    }

    return (
        <Box data-test-id="perf-provisioning" sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {rows.map((row) => {
                const scale = rowScale(row);
                return (
                    <Box
                        key={`${row.namespace}/${row.pod}/${row.container}`}
                        data-test-id="perf-provisioning-row"
                        sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}
                    >
                        <Typography variant="body2" sx={{ fontFamily: "monospace", fontWeight: 600 }}>
                            {row.namespace}/{row.pod} · {row.container}
                        </Typography>
                        <Bar label="Usage" value={row.usage} scale={scale} color={theme.palette.primary.main} metric={metric} />
                        <Bar label="Request" value={row.request} scale={scale} color={theme.palette.info.main} metric={metric} />
                        <Bar label="Limit" value={row.limit} scale={scale} color={theme.palette.warning.main} metric={metric} />
                    </Box>
                );
            })}
        </Box>
    );
}
