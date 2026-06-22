import { Box, Typography, useTheme } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useKubeContext } from "../../lib/kube-context";
import { fetchNodePerformance } from "../../lib/api-client";
import { formatCpu, formatMemory, usagePercent } from "../../lib/performance";
import { LoadingIndicator } from "../loading-indicator";
import { LoadError } from "../load-error";
import { MetricsUnavailable } from "./metrics-unavailable";

// Props for the node Status consumed-vs-free indicator. nodeName scopes the performance
// fetch; podCount is the number of pods scheduled on the node (from the node detail) so
// the pods row can show scheduled-vs-allocatable without a second usage source.
type NodeResourceIndicatorProps = {
    nodeName: string;
    podCount: number;
    podsAllocatable: string;
};

// One consumed-vs-free row: a labelled bar showing the consumed share of a node resource
// (the filled part) against the free remainder (the track), with the consumed percentage
// and the consumed/allocatable figures alongside. A null consumedPercent (usage or the
// allocatable base is missing) renders an empty track with an em-dash percentage.
function ResourceBar({
    label,
    consumedPercent,
    usedText,
    allocatableText,
    color,
    testId,
}: {
    label: string;
    consumedPercent: number | null;
    usedText: string;
    allocatableText: string;
    color: string;
    testId: string;
}) {
    const width = consumedPercent === null ? 0 : Math.min(100, consumedPercent);
    const freePercent = consumedPercent === null ? null : Math.max(0, 100 - consumedPercent);
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
                    {consumedPercent === null ? "—" : `${consumedPercent}% used`}
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
                {usedText} of {allocatableText}
                {freePercent === null ? "" : ` · ${freePercent}% free`}
            </Typography>
        </Box>
    );
}

// The node Status page's consumed-vs-free resource indicator. Fetches the node's
// point-in-time performance snapshot and shows, per resource, how much of the node's
// allocatable capacity is consumed versus free. CPU and memory come from the Metrics API
// (live usage ÷ allocatable); pods come from the node detail (scheduled ÷ allocatable).
// Only cpu, memory, and pods are shown: Karse's only usage source is the Metrics API,
// which does not report disk or network, so those resources are omitted entirely. When
// the Metrics API is unavailable the CPU/memory bars degrade to the em-dash percentage
// (the pods row, which needs no metrics, still shows a real figure). READ-ONLY.
export function NodeResourceIndicator({ nodeName, podCount, podsAllocatable }: NodeResourceIndicatorProps) {
    const { current } = useKubeContext();
    const theme = useTheme();

    const { data, error, isLoading, refetch } = useQuery({
        queryKey: ["node-performance", current, nodeName],
        queryFn: () => fetchNodePerformance(current!, nodeName),
        enabled: current !== null,
    });

    if (error) {
        return <LoadError message={(error as Error).message} onRetry={() => refetch()} />;
    }

    if (isLoading || !data) {
        return <LoadingIndicator />;
    }

    const { usage, allocatable } = data.node;
    const cpuPercent = usagePercent(usage.cpuMillicores, allocatable.cpuMillicores);
    const memPercent = usagePercent(usage.memoryBytes, allocatable.memoryBytes);

    // Pods: scheduled count vs the node's allocatable pod slots (from node detail, so it
    // does not depend on the Metrics API).
    const podBase = Number.parseInt(podsAllocatable, 10);
    const podsKnown = Number.isFinite(podBase) && podBase > 0;
    const podPercent = podsKnown ? usagePercent(podCount, podBase) : null;

    return (
        <Box data-test-id="node-resource-indicator" sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {!data.metricsAvailable && <MetricsUnavailable />}

            <ResourceBar
                label="CPU"
                consumedPercent={cpuPercent}
                usedText={formatCpu(usage.cpuMillicores)}
                allocatableText={formatCpu(allocatable.cpuMillicores)}
                color={theme.palette.primary.main}
                testId="node-resource-cpu"
            />
            <ResourceBar
                label="Memory"
                consumedPercent={memPercent}
                usedText={formatMemory(usage.memoryBytes)}
                allocatableText={formatMemory(allocatable.memoryBytes)}
                color={theme.palette.info.main}
                testId="node-resource-memory"
            />
            <ResourceBar
                label="Pods"
                consumedPercent={podPercent}
                usedText={`${podCount}`}
                allocatableText={podsKnown ? `${podBase}` : "—"}
                color={theme.palette.success.main}
                testId="node-resource-pods"
            />
        </Box>
    );
}
