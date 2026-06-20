import { useState } from "react";
import { Box, Paper, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import type { PerformanceMetric } from "karse-types";
import { useKubeContext } from "../../lib/kube-context";
import { fetchClusterPerformance } from "../../lib/api-client";
import { buildClusterNodeTreemap } from "../../lib/performance";
import { LoadingIndicator } from "../loading-indicator";
import { LoadError } from "../load-error";
import { MetricToggle } from "./metric-toggle";
import { UsageTreemap } from "./usage-treemap";
import { FROM_CLUSTER_PERFORMANCE } from "../../lib/breadcrumb-trail";
import { MetricsUnavailable } from "./metrics-unavailable";

// Props for the cluster Performance tab. `active` is true only when this tab is the
// selected one, so the data fetch is lazy (matching YamlTabPanel): the snapshot is
// not requested until the user opens the tab.
type ClusterPerformanceTabProps = {
    active: boolean;
};

// A titled section wrapping the treemap, so the cluster Performance tab reads as a
// labelled panel.
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

// The cluster Performance tab: a CPU/Memory toggle over a Breakdown treemap of the
// cluster's nodes, each node box sized by its usage for the selected metric and
// labelled with its share of the cluster total. Clicking a node box opens that node's
// detail page on its Performance tab. Data comes from GET /cluster/performance,
// fetched lazily when the tab is active. When the cluster has no Metrics API the
// MetricsUnavailable alert is shown instead of the treemap.
export function ClusterPerformanceTab({ active }: ClusterPerformanceTabProps) {
    const { current } = useKubeContext();
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

    const treemap = buildClusterNodeTreemap(data.nodes, metric);

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
                <Section title="Nodes">
                    <UsageTreemap
                        root={treemap}
                        colorByUtilisation
                        origin={FROM_CLUSTER_PERFORMANCE}
                        metric={metric}
                    />
                </Section>
            )}
        </Box>
    );
}
