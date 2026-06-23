import { Box, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import type { ClusterResourceTotals } from "karse-types";
import { useKubeContext } from "../../../lib/kube-context";
import { fetchClusterPerformance } from "../../../lib/api-client";
import { LoadingIndicator } from "../../../components/loading-indicator";
import { LoadError } from "../../../components/load-error";
import { MetricsUnavailable } from "../../../components/performance/metrics-unavailable";
import { MetricCard } from "../../../components/resource-utilization/metric-card";
import { ViewToggles } from "../../../components/resource-utilization/view-toggles";
import {
    ResourceUtilizationProvider,
    useResourceUtilization,
} from "../../../lib/resource-utilization-context";
import {
    clusterPercent,
    formatAbsoluteCpu,
    formatAbsoluteMemory,
    classifyClusterCpuUsage,
    classifyClusterCpuRequests,
    classifyClusterMemoryUsage,
    classifyClusterMemoryRequests,
    type ThresholdResult,
} from "../../../lib/resource-utilization";

// The section heading rendered above the resource cards, matching the other Overview
// sections' uppercase caption style.
function SectionHeading({ children }: { children: string }) {
    return (
        <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}
        >
            {children}
        </Typography>
    );
}

// Builds one cluster card's display props for the selected metric, driven by the shared
// View-mode (usage/requests) and Value-format (percent/absolute) toggles. The base is the
// cluster's allocatable total for the metric; the used figure is the cluster usage total in
// usage mode or the requests total in requests mode. A null used value (usage absent
// because the Metrics API is unavailable) yields a null percent so the card shows an
// em-dash rather than a fabricated zero.
function buildCardProps(
    label: string,
    used: number | null,
    base: number | null,
    usageClassifier: (percent: number | null) => ThresholdResult,
    requestsClassifier: (percent: number | null) => ThresholdResult,
    mode: "usage" | "requests",
    format: "percent" | "absolute",
    formatAbsolute: (used: number | null, total: number | null) => string,
    testId: string,
): {
    label: string;
    valueText: string;
    sublabel: string;
    percent: number | null;
    level: ThresholdResult["level"];
    testId: string;
} {
    const percent = clusterPercent(used, base);
    const result = mode === "usage" ? usageClassifier(percent) : requestsClassifier(percent);
    const valueText = format === "percent"
        ? (percent === null ? "—" : `${percent}%`)
        : formatAbsolute(used, base);
    const sublabel = format === "percent"
        ? `${result.label} · ${formatAbsolute(used, base)}`
        : (percent === null ? result.label : `${result.label} · ${percent}%`);
    return { label, valueText, sublabel, percent, level: result.level, testId };
}

// The inner panel (inside the provider): reads the shared toggles and renders the two
// cluster resource cards (CPU and memory) from the cluster totals.
function UtilizationCards({
    totals,
    metricsAvailable,
}: {
    totals: ClusterResourceTotals;
    metricsAvailable: boolean;
}) {
    const { mode, format } = useResourceUtilization();

    const cpuUsed = mode === "usage" ? totals.usage.cpuMillicores : totals.requests.cpuMillicores;
    const cpuBase = totals.allocatable.cpuMillicores;
    const memUsed = mode === "usage" ? totals.usage.memoryBytes : totals.requests.memoryBytes;
    const memBase = totals.allocatable.memoryBytes;

    const cpu = buildCardProps(
        "CPU",
        cpuUsed,
        cpuBase,
        classifyClusterCpuUsage,
        classifyClusterCpuRequests,
        mode,
        format,
        formatAbsoluteCpu,
        "cluster-util-cpu",
    );
    const memory = buildCardProps(
        "Memory",
        memUsed,
        memBase,
        classifyClusterMemoryUsage,
        classifyClusterMemoryRequests,
        mode,
        format,
        formatAbsoluteMemory,
        "cluster-util-memory",
    );

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                <SectionHeading>Cluster-wide resources</SectionHeading>
                <ViewToggles />
            </Box>
            {!metricsAvailable && <MetricsUnavailable />}
            <Box
                data-test-id="cluster-util-cards"
                sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                    gap: 2,
                }}
            >
                <MetricCard {...cpu} />
                <MetricCard {...memory} />
            </Box>
        </Box>
    );
}

// The cluster-wide utilisation panel on the Overview tab: a Usage/Requests + %/Absolute
// toggle group driving a two-column grid of CPU and memory cards. The cards' percentage
// base is the cluster's allocatable total (see docs/spec/resource-utilization). Data comes
// from GET /cluster/performance (reusing the ["cluster-performance", current] query key the
// nodes table and the other Overview sections share). When the cluster has no Metrics API
// the MetricsUnavailable alert is shown and the usage cards read em-dash while the requests
// cards still populate from pod specs.
export function ClusterUtilizationPanel() {
    const { current } = useKubeContext();
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

    return (
        <ResourceUtilizationProvider>
            <UtilizationCards totals={data.totals} metricsAvailable={data.metricsAvailable} />
        </ResourceUtilizationProvider>
    );
}
