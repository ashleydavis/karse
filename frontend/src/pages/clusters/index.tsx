import { useEffect, useState } from "react";
import { Box, Typography, Alert } from "@mui/material";
import { useNavigate } from "react-router-dom";
import type { ClusterSummary, MultiClusterTotals } from "karse-types";
import { openClusterOverviewStream } from "../../lib/api-client";
import { LoadingIndicator } from "../../components/loading-indicator";
import { LoadError } from "../../components/load-error";
import { NoContextsGuidance } from "../../components/no-contexts-guidance";
import { MetricsUnavailable } from "../../components/performance/metrics-unavailable";
import { MetricCard } from "../../components/resource-utilization/metric-card";
import { ViewToggles } from "../../components/resource-utilization/view-toggles";
import {
    ResourceUtilizationProvider,
    useResourceUtilization,
} from "../../lib/resource-utilization-context";
import {
    clusterPercent,
    formatAbsoluteCpu,
    formatAbsoluteMemory,
    classifyClusterCpuUsage,
    classifyClusterCpuRequests,
    classifyClusterMemoryUsage,
    classifyClusterMemoryRequests,
    type ThresholdResult,
} from "../../lib/resource-utilization";
import { ClustersTable } from "./components/clusters-table";

// The uppercase caption heading above each section, matching the cluster home page.
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

// Builds one aggregate card's display props for the selected metric, driven by the
// shared View-mode (usage/requests) and Value-format (percent/absolute) toggles. The
// base is the summed allocatable capacity across the covered clusters and the used
// figure their summed usage or requests, so the percentage is derived from absolute
// sums and a large cluster weighs more than a small one. A null used value yields a
// null percent, shown as an em-dash rather than a fabricated zero.
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
    return {
        label,
        valueText,
        sublabel,
        percent,
        level: result.level,
        testId,
    };
}

// The aggregate CPU and memory cards, plus the coverage line that states how many
// clusters the totals actually cover. Reads the shared toggles, so the totals read the
// same way as the per-cluster page's Cluster-wide resources cards.
function TotalsCards({ totals }: { totals: MultiClusterTotals }) {
    const { mode, format } = useResourceUtilization();
    const summed = totals.totals;

    const cpu = buildCardProps(
        "CPU",
        mode === "usage" ? summed.usage.cpuMillicores : summed.requests.cpuMillicores,
        summed.allocatable.cpuMillicores,
        classifyClusterCpuUsage,
        classifyClusterCpuRequests,
        mode,
        format,
        formatAbsoluteCpu,
        "clusters-util-cpu",
    );
    const memory = buildCardProps(
        "Memory",
        mode === "usage" ? summed.usage.memoryBytes : summed.requests.memoryBytes,
        summed.allocatable.memoryBytes,
        classifyClusterMemoryUsage,
        classifyClusterMemoryRequests,
        mode,
        format,
        formatAbsoluteMemory,
        "clusters-util-memory",
    );

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                <SectionHeading>Across all clusters</SectionHeading>
                <ViewToggles />
            </Box>
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr 1fr" },
                    gap: 2,
                }}
            >
                <MetricCard
                    label="Clusters"
                    valueText={String(totals.contextCount)}
                    sublabel={totals.contextCount === 1 ? "configured context" : "configured contexts"}
                    percent={null}
                    level="info"
                    testId="clusters-total-clusters"
                />
                <MetricCard
                    label="Nodes"
                    valueText={String(totals.nodeCount)}
                    sublabel={`across ${totals.coveredCount} of ${totals.contextCount} clusters`}
                    percent={null}
                    level="info"
                    testId="clusters-total-nodes"
                />
                <MetricCard {...cpu} />
                <MetricCard {...memory} />
            </Box>
            <Typography variant="body2" color="text.secondary" data-test-id="clusters-coverage">
                {`Totals cover ${totals.coveredCount} of ${totals.contextCount} clusters`}
                {totals.failedCount > 0
                    ? ` (${totals.failedCount} could not be read; see the Status column below).`
                    : "."}
            </Typography>
            {totals.coveredCount > 0 && !totals.metricsAvailable && <MetricsUnavailable />}
        </Box>
    );
}

// The multi-cluster overview page (`/clusters`): a total across every configured
// kubeconfig context, above a per-cluster table.
//
// Data arrives over the Server-Sent Events stream GET /api/clusters/overview: one event
// per cluster as its read lands, so a row appears the moment its cluster answers rather
// than the page waiting on the slowest context, then the aggregate totals. The shared
// loading indicator stays up while results are outstanding. Every read goes through the
// backend's cluster cache, so revisiting the page inside the staleness window costs no
// kubectl calls.
export function ClustersPage() {
    const navigate = useNavigate();
    const [clusters, setClusters] = useState<ClusterSummary[]>([]);
    const [totals, setTotals] = useState<MultiClusterTotals | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);
    // Bumped by Retry to re-open the stream: the effect below keys off it.
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        setClusters([]);
        setTotals(null);
        setError(null);
        setDone(false);
        const close = openClusterOverviewStream({
            onCluster: (summary) => {
                setClusters((prev) => [...prev, summary]);
            },
            onTotals: (next) => {
                setTotals(next);
            },
            onError: (message) => {
                setError(message);
                setDone(true);
            },
            onEnd: () => {
                setDone(true);
            },
        });
        return close;
    }, [attempt]);

    if (error !== null) {
        return <LoadError message={error} onRetry={() => setAttempt((prev) => prev + 1)} />;
    }

    // A finished stream that produced no clusters means the kubeconfig has no contexts
    // at all: show the same guidance the contexts page shows, not a page of zeroes.
    if (done && clusters.length === 0) {
        return (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }} data-test-id="clusters-page">
                <Alert severity="info">No kubeconfig contexts are configured, so there is nothing to summarise.</Alert>
                <NoContextsGuidance />
            </Box>
        );
    }

    return (
        <ResourceUtilizationProvider>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }} data-test-id="clusters-page">
                {totals !== null && <TotalsCards totals={totals} />}
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <SectionHeading>Clusters</SectionHeading>
                    <ClustersTable
                        clusters={clusters}
                        onOpen={(summary) => navigate(`/cluster?context=${encodeURIComponent(summary.context)}`)}
                    />
                </Box>
                {!done && <LoadingIndicator />}
            </Box>
        </ResourceUtilizationProvider>
    );
}
