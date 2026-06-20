import { Card, CardContent, Typography, Box, useTheme } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useKubeContext } from "../../../lib/kube-context";
import { fetchClusterPerformance } from "../../../lib/api-client";
import {
    clusterResourceShare,
    formatCpu,
    formatMemory,
} from "../../../lib/performance";
import { LoadingIndicator } from "../../../components/loading-indicator";
import { LoadError } from "../../../components/load-error";
import { MetricsUnavailable } from "../../../components/performance/metrics-unavailable";

// One consumed-vs-free row: a labelled bar showing the consumed share of a cluster
// resource (the filled part) against the free remainder (the track), with the consumed
// percentage and the consumed/allocatable figures alongside.
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

// The cluster resource indicator on the Status page: a consumed-vs-free bar per
// resource showing how much of the cluster's allocatable capacity is in use. CPU and
// memory are shown because those are the resources the Kubernetes Metrics API reports;
// disk and network usage are not available from the Metrics API and so are not shown
// (see docs/spec/cluster-overview). Data comes from GET /cluster/performance (the same
// per-node usage-vs-allocatable snapshot the Performance tab uses), summed across
// nodes. When the cluster has no Metrics API the MetricsUnavailable alert is shown.
export function ClusterResourceIndicator() {
    const { current } = useKubeContext();
    const theme = useTheme();
    const { data, error, isLoading, refetch } = useQuery({
        queryKey: ["cluster-performance", current],
        queryFn: () => fetchClusterPerformance(current!),
        enabled: current !== null,
    });

    if (error) {
        return <LoadError message={(error as Error).message} onRetry={() => refetch()} />;
    }

    if (isLoading || !data) {
        return <LoadingIndicator />;
    }

    const cpu = clusterResourceShare(data.nodes, "cpu");
    const memory = clusterResourceShare(data.nodes, "memory");

    return (
        <Card data-test-id="cluster-resource-indicator">
            <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}
                >
                    Cluster resources
                </Typography>

                {!data.metricsAvailable && <MetricsUnavailable />}

                {data.metricsAvailable && (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <ResourceBar
                            label="CPU"
                            consumedPercent={cpu.consumedPercent}
                            usedText={formatCpu(cpu.used)}
                            allocatableText={formatCpu(cpu.allocatable)}
                            color={theme.palette.primary.main}
                            testId="cluster-resource-cpu"
                        />
                        <ResourceBar
                            label="Memory"
                            consumedPercent={memory.consumedPercent}
                            usedText={formatMemory(memory.used)}
                            allocatableText={formatMemory(memory.allocatable)}
                            color={theme.palette.info.main}
                            testId="cluster-resource-memory"
                        />
                    </Box>
                )}
            </CardContent>
        </Card>
    );
}
