import { Box, Typography, useTheme } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import type { PodPerformance } from "karse-types";
import { useKubeContext } from "../../lib/kube-context";
import { fetchPodPerformance } from "../../lib/api-client";
import { LoadingIndicator } from "../loading-indicator";
import { LoadError } from "../load-error";
import { MetricsUnavailable } from "./metrics-unavailable";
import { formatCpu, formatMemory, podNodeShares } from "../../lib/performance";
import type { PodNodeShareRow } from "../../lib/performance";

// Formats a row's raw usage and the node's allocatable base for the small secondary
// annotation under the percentage, using the metric's own formatter (cpu in m/cores,
// memory in Mi/Gi). A null on either side renders as the em-dash placeholder.
function formatUsageOfCapacity(row: PodNodeShareRow): string {
    const fmt = row.resource === "cpu" ? formatCpu : formatMemory;
    return `${fmt(row.usage)} / ${fmt(row.allocatable)}`;
}

// One resource row: the pod's percentage of the node for that resource as the primary
// figure, a bar filled to that percentage, and the usage/capacity as small secondary
// text. A null percentage (no usage reading, or no node allocatable base) renders an
// empty track with an em-dash percentage so an unknown share reads honestly rather than
// as a misleading 0%.
function ShareRow({ row, color, testId }: { row: PodNodeShareRow; color: string; testId: string }) {
    const label = row.resource === "cpu" ? "CPU" : "Memory";
    const width = row.percentage === null ? 0 : Math.min(100, row.percentage);
    return (
        <Box data-test-id={testId} sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {label}
                </Typography>
                <Box sx={{ flexGrow: 1 }} />
                <Typography
                    variant="body2"
                    data-test-id={`${testId}-percent`}
                    sx={{ fontWeight: 700, fontFamily: "monospace" }}
                >
                    {row.percentage === null ? "—" : `${row.percentage}%`}
                </Typography>
            </Box>
            <Box sx={{ position: "relative", height: 12, bgcolor: "action.hover", borderRadius: 1 }}>
                <Box
                    sx={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        height: "100%",
                        width: `${width}%`,
                        bgcolor: color,
                        borderRadius: 1,
                    }}
                />
            </Box>
            <Typography variant="caption" sx={{ color: "text.secondary", fontFamily: "monospace" }}>
                {formatUsageOfCapacity(row)}
            </Typography>
        </Box>
    );
}

// The pod's percentage-of-node indicator: how much of its scheduling node the pod is
// consuming for CPU and memory (pod usage ÷ node allocatable, the percentage as the
// primary value). Only cpu and memory are shown — the Metrics API reports no pod disk or
// network usage, so those are omitted entirely (never surfaced as "not reported"). Shared
// by the pod Performance tab and the pod Status "Node resources" panel. The percentage
// degrades to "—" when there is no usage (no Metrics API) or no node base (unscheduled
// pod / failed node read). READ-ONLY.
export function PodNodeShare({ data }: { data: PodPerformance }) {
    const theme = useTheme();
    // Read the pod usage and node base defensively: an absent usage (no Metrics API) or
    // node (unscheduled pod / failed node read) degrades each row to "—" rather than
    // throwing, so the indicator never breaks the page.
    const podUsage = data.pod?.usage ?? { cpuMillicores: null, memoryBytes: null };
    const rows = podNodeShares(podUsage, data.node?.allocatable ?? null);
    const colorFor: Record<string, string> = {
        cpu: theme.palette.primary.main,
        memory: theme.palette.info.main,
    };
    return (
        <Box data-test-id="pod-node-share" sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {rows.map((row) => (
                <ShareRow
                    key={row.resource}
                    row={row}
                    color={colorFor[row.resource]!}
                    testId={`pod-node-share-${row.resource}`}
                />
            ))}
        </Box>
    );
}

// The pod Status page's "Node resources" panel: fetches the pod's performance snapshot and
// renders the percentage-of-node indicator (CPU and memory). `active` keeps the fetch lazy
// — the Status tab is the default, so it fetches as soon as the page opens, but the query
// is only enabled while Status is the selected tab. Shows the MetricsUnavailable notice
// above the indicator when there is no live usage. READ-ONLY.
export function PodNodeResourcesPanel({
    namespace,
    name,
    active,
}: {
    namespace: string;
    name: string;
    active: boolean;
}) {
    const { current } = useKubeContext();
    const { data, error, isLoading, refetch } = useQuery({
        queryKey: ["pod-performance", current, namespace, name],
        queryFn: () => fetchPodPerformance(current!, namespace, name),
        enabled: active && current !== null,
    });

    if (error) {
        return <LoadError message={(error as Error).message} onRetry={() => refetch()} />;
    }

    if (isLoading || !data) {
        return <LoadingIndicator />;
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {!data.metricsAvailable && <MetricsUnavailable />}
            <PodNodeShare data={data} />
        </Box>
    );
}
