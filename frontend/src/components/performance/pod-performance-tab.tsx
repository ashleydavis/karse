import { useState } from "react";
import { Box, Paper, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import type { PerformanceMetric } from "karse-types";
import { useKubeContext } from "../../lib/kube-context";
import { fetchPodPerformance } from "../../lib/api-client";
import { LoadingIndicator } from "../loading-indicator";
import { LoadError } from "../load-error";
import { MetricToggle } from "./metric-toggle";
import { ProvisioningBars } from "./provisioning-bars";
import { MetricsUnavailable } from "./metrics-unavailable";

// Props for the pod Performance tab. `active` is true only when this tab is the
// selected one, so the data fetch is lazy (matching the cluster and node tabs and
// YamlTabPanel): the snapshot is not requested until the user opens the tab.
type PodPerformanceTabProps = {
    namespace: string;
    name: string;
    active: boolean;
};

// A titled section wrapping the provisioning view, matching the node and cluster
// hub layout so the three Performance tabs read consistently.
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

// The pod Performance view (the leaf of the feature): a CPU/Memory toggle over a
// Provisioning view of the pod's containers (per-container usage vs request vs limit
// bars). Data comes from GET /pods/:namespace/:name/performance, fetched lazily when
// the tab is active. There is no treemap at the leaf. The provisioning bars render
// even with no Metrics API (requests/limits come from the pod spec); when usage is
// unavailable the MetricsUnavailable alert is shown above the bars.
export function PodPerformanceTab({ namespace, name, active }: PodPerformanceTabProps) {
    const { current } = useKubeContext();
    const [metric, setMetric] = useState<PerformanceMetric>("cpu");

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

    // ProvisioningBars flattens a list of pods into one row per container; the pod
    // tab has a single pod, so wrap it in a one-element array.
    const pods = [data.pod];

    return (
        <Box data-test-id="perf-pod" sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Performance
                </Typography>
                <Box sx={{ flexGrow: 1 }} />
                <MetricToggle value={metric} onChange={setMetric} />
            </Box>

            {!data.metricsAvailable && <MetricsUnavailable />}

            <Section title="Provisioning">
                <ProvisioningBars pods={pods} metric={metric} />
            </Section>
        </Box>
    );
}
