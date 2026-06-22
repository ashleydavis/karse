import { useState } from "react";
import { Box, Paper, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import type { PerformanceMetric } from "karse-types";
import { useKubeContext } from "../../lib/kube-context";
import { fetchNodePerformance } from "../../lib/api-client";
import { buildNodeShareTreemap } from "../../lib/performance";
import { LoadingIndicator } from "../loading-indicator";
import { LoadError } from "../load-error";
import { MetricToggle } from "./metric-toggle";
import { UsageTreemap } from "./usage-treemap";
import { FROM_NODE_PERFORMANCE } from "../../lib/breadcrumb-trail";
import { MetricsUnavailable } from "./metrics-unavailable";

// Props for the node Performance tab. `active` is true only when this tab is the
// selected one, so the data fetch is lazy (matching the cluster tab and YamlTabPanel):
// the snapshot is not requested until the user opens the tab.
type NodePerformanceTabProps = {
    nodeName: string;
    active: boolean;
};

// A titled section wrapping the treemap, matching the cluster hub's panel layout so the
// two read consistently.
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

// The node Performance view: a single Breakdown treemap under a CPU/Memory toggle. The
// treemap drills namespace → pod, with each pod box sized by the pod's percentage of the
// node it runs on (pod usage ÷ node allocatable) for the selected metric, so the boxes
// read as "share of the node". Leaves are coloured green→amber→red by utilisation
// (usage ÷ limit) and a leaf click opens the owning pod's detail page on its Performance
// tab. Data comes from GET /nodes/:name/performance, fetched lazily when the tab is
// active. The treemap needs live usage, so when the Metrics API is unavailable the view
// shows the MetricsUnavailable notice in place of the treemap (there is no usage to size
// the boxes by). The Provisioning and standalone Breakdown subtabs were removed
// (node-performance-1): Breakdown is now the Performance tab itself.
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

    const treemap = buildNodeShareTreemap(data.pods, data.node.allocatable, metric);

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

            <Box data-test-id="perf-node-panel-breakdown">
                {data.metricsAvailable ? (
                    <Section title="Breakdown — each pod's share of the node">
                        <UsageTreemap
                            root={treemap}
                            colorByUtilisation
                            origin={`${FROM_NODE_PERFORMANCE}:${nodeName}`}
                            metric={metric}
                            valueKind="percent"
                        />
                    </Section>
                ) : (
                    <Typography color="text.secondary" data-test-id="perf-node-breakdown-unavailable">
                        The Breakdown treemap needs live usage from the Metrics API, which is
                        unavailable, so each pod's share of the node cannot be computed.
                    </Typography>
                )}
            </Box>
        </Box>
    );
}
