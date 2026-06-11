import { useState } from "react";
import { Box, Paper, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import type { PerformanceMetric } from "karse-types";
import { useKubeContext } from "../../lib/kube-context";
import { fetchNodePerformance } from "../../lib/api-client";
import { buildNodeTreemap } from "../../lib/performance";
import { LoadingIndicator } from "../loading-indicator";
import { LoadError } from "../load-error";
import { MetricToggle } from "./metric-toggle";
import { UsageTreemap } from "./usage-treemap";
import { ProvisioningBars } from "./provisioning-bars";
import { MetricsUnavailable } from "./metrics-unavailable";

// Props for the node Performance tab. `active` is true only when this tab is the
// selected one, so the data fetch is lazy (matching the cluster tab and YamlTabPanel):
// the snapshot is not requested until the user opens the tab.
type NodePerformanceTabProps = {
    nodeName: string;
    active: boolean;
};

// A titled section wrapping one of the node views (Breakdown / Provisioning), matching
// the cluster hub's panel layout so the two read consistently.
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

// The node Performance view: a CPU/Memory toggle over a node-scoped Breakdown treemap
// (namespace → pod → container) and a Provisioning view (per-container usage vs request
// vs limit bars) for the pods scheduled on this node. Data comes from
// GET /nodes/:name/performance, fetched lazily when the tab is active. The provisioning
// bars render even with no Metrics API (requests/limits come from specs); when usage is
// unavailable the MetricsUnavailable alert is shown above the bars and the treemap is
// hidden (it has no usage to size by).
export function NodePerformanceTab({ nodeName, active }: NodePerformanceTabProps) {
    const { current } = useKubeContext();
    const [metric, setMetric] = useState<PerformanceMetric>("cpu");

    const { data, error, isLoading, refetch } = useQuery({
        queryKey: ["node-performance", current, nodeName],
        queryFn: () => fetchNodePerformance(current!, nodeName),
        enabled: active && current !== null,
    });

    if (error) {
        return <LoadError message={(error as Error).message} onRetry={() => refetch()} />;
    }

    if (isLoading || !data) {
        return <LoadingIndicator />;
    }

    const treemap = buildNodeTreemap(data.pods, metric);

    return (
        <Box data-test-id="perf-node" sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Performance
                </Typography>
                <Box sx={{ flexGrow: 1 }} />
                <MetricToggle value={metric} onChange={setMetric} />
            </Box>

            {!data.metricsAvailable && <MetricsUnavailable />}

            {data.metricsAvailable && (
                <Section title="Breakdown">
                    <UsageTreemap root={treemap} colorByUtilisation />
                </Section>
            )}

            <Section title="Provisioning">
                <ProvisioningBars pods={data.pods} metric={metric} />
            </Section>
        </Box>
    );
}
