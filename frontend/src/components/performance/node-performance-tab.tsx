import { useState } from "react";
import { Box, Paper, Tab, Tabs, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import type { PerformanceMetric } from "karse-types";
import { useKubeContext } from "../../lib/kube-context";
import { fetchNodePerformance } from "../../lib/api-client";
import { buildNodeTreemap } from "../../lib/performance";
import { LoadingIndicator } from "../loading-indicator";
import { LoadError } from "../load-error";
import { MetricToggle } from "./metric-toggle";
import { UsageTreemap } from "./usage-treemap";
import { FROM_NODE_PERFORMANCE } from "../../lib/breadcrumb-trail";
import { ProvisioningTable } from "./provisioning-table";
import { MetricsUnavailable } from "./metrics-unavailable";

// Props for the node Performance tab. `active` is true only when this tab is the
// selected one, so the data fetch is lazy (matching the cluster tab and YamlTabPanel):
// the snapshot is not requested until the user opens the tab.
type NodePerformanceTabProps = {
    nodeName: string;
    active: boolean;
};

// The two subtabs of the node Performance view. Breakdown is the usage treemap;
// Provisioning is the searchable/sortable/filterable per-container table.
type NodePerformanceSubtab = "breakdown" | "provisioning";

// A titled section wrapping one of the node views, matching the cluster hub's panel
// layout so the two read consistently.
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

// The node Performance view: a CPU/Memory toggle over two subtabs. The Breakdown
// subtab is a node-scoped treemap (namespace → pod → container); the Provisioning
// subtab is the per-container usage/request/limit table (searchable, sortable, and
// filterable by the shared Logs Pod filter) for the pods scheduled on this node.
// Data comes from GET /nodes/:name/performance, fetched lazily when the tab is
// active. The provisioning rows render even with no Metrics API (requests/limits
// come from specs); when usage is unavailable the MetricsUnavailable alert is shown
// and the Breakdown treemap is hidden (it has no usage to size by).
export function NodePerformanceTab({ nodeName, active }: NodePerformanceTabProps) {
    const { current } = useKubeContext();
    const [metric, setMetric] = useState<PerformanceMetric>("cpu");
    const [subtab, setSubtab] = useState<NodePerformanceSubtab>("breakdown");

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

            <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
                <Tabs
                    value={subtab}
                    onChange={(_, value) => setSubtab(value)}
                    data-test-id="perf-node-subtabs"
                >
                    <Tab label="Breakdown" value="breakdown" data-test-id="perf-node-subtab-breakdown" />
                    <Tab label="Provisioning" value="provisioning" data-test-id="perf-node-subtab-provisioning" />
                </Tabs>
            </Box>

            {subtab === "breakdown" && (
                <Box data-test-id="perf-node-panel-breakdown">
                    {data.metricsAvailable ? (
                        <Section title="Breakdown">
                            <UsageTreemap root={treemap} colorByUtilisation origin={`${FROM_NODE_PERFORMANCE}:${nodeName}`} />
                        </Section>
                    ) : (
                        <Typography color="text.secondary" data-test-id="perf-node-breakdown-unavailable">
                            The Breakdown treemap needs live usage from the Metrics API, which is
                            unavailable. Use the Provisioning subtab to see requests and limits.
                        </Typography>
                    )}
                </Box>
            )}

            {subtab === "provisioning" && (
                <Box data-test-id="perf-node-panel-provisioning">
                    <Section title="Provisioning">
                        <ProvisioningTable pods={data.pods} metric={metric} />
                    </Section>
                </Box>
            )}
        </Box>
    );
}
