import { useState } from "react";
import { Box, Paper, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import type { PerformanceMetric } from "karse-types";
import { useKubeContext } from "../../lib/kube-context";
import { useShareableNavigate } from "../../lib/nav-state";
import { fetchClusterPerformance } from "../../lib/api-client";
import { buildClusterTreemap, buildNodeHeatmap } from "../../lib/performance";
import { LoadingIndicator } from "../loading-indicator";
import { LoadError } from "../load-error";
import { MetricToggle } from "./metric-toggle";
import { UsageTreemap } from "./usage-treemap";
import { FROM_CLUSTER_PERFORMANCE } from "../../lib/breadcrumb-trail";
import { UsageHeatmap } from "./usage-heatmap";
import { TopConsumersTable } from "./top-consumers-table";
import { MetricsUnavailable } from "./metrics-unavailable";

// Props for the cluster Performance tab. `active` is true only when this tab is the
// selected one, so the data fetch is lazy (matching YamlTabPanel): the snapshot is
// not requested until the user opens the tab.
type ClusterPerformanceTabProps = {
    active: boolean;
};

// A titled section wrapping one of the three views (Breakdown / Hot spots / Top
// consumers), so the cluster hub reads as a stack of labelled panels.
function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                {title}
            </Typography>
            {children}
        </Paper>
    );
}

// The cluster Performance hub: a CPU/Memory toggle over a Breakdown treemap
// (node → namespace → pod), a Hot spots heatmap (node × metric), and a Top consumers
// table. Data comes from GET /cluster/performance, fetched lazily when the tab is
// active. When the cluster has no Metrics API the MetricsUnavailable alert is shown
// instead of the usage charts.
export function ClusterPerformanceTab({ active }: ClusterPerformanceTabProps) {
    const { current } = useKubeContext();
    const navigate = useShareableNavigate();
    const [metric, setMetric] = useState<PerformanceMetric>("cpu");

    const { data, error, isLoading, refetch } = useQuery({
        queryKey: ["cluster-performance", current],
        queryFn: () => fetchClusterPerformance(current!),
        enabled: active && current !== null,
    });

    if (error) {
        return <LoadError message={(error as Error).message} onRetry={() => refetch()} />;
    }

    if (isLoading || !data) {
        return <LoadingIndicator />;
    }

    const treemap = buildClusterTreemap(data.pods, metric);
    const heatmap = buildNodeHeatmap(data.nodes);

    return (
        <Box data-test-id="perf-cluster" sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Performance
                </Typography>
                <Box sx={{ flexGrow: 1 }} />
                <MetricToggle value={metric} onChange={setMetric} />
            </Box>

            {!data.metricsAvailable && <MetricsUnavailable />}

            {data.metricsAvailable && (
                <>
                    <Section title="Breakdown">
                        <UsageTreemap root={treemap} colorByUtilisation origin={FROM_CLUSTER_PERFORMANCE} metric={metric} />
                    </Section>

                    <Section title="Hot spots">
                        <UsageHeatmap
                            data={heatmap}
                            onCellClick={(nodeName) => navigate(`/nodes/${nodeName}`, { tab: "performance" })}
                        />
                    </Section>

                    <Section title="Top consumers">
                        <TopConsumersTable pods={data.pods} metric={metric} />
                    </Section>
                </>
            )}
        </Box>
    );
}
