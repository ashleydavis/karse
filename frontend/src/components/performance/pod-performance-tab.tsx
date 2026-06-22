import { Box, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useKubeContext } from "../../lib/kube-context";
import { fetchPodPerformance } from "../../lib/api-client";
import { LoadingIndicator } from "../loading-indicator";
import { LoadError } from "../load-error";
import { MetricsUnavailable } from "./metrics-unavailable";
import { PodNodeShare } from "./pod-node-share";

// Props for the pod Performance tab. `active` is true only when this tab is the
// selected one, so the data fetch is lazy (matching the cluster and node tabs and
// YamlTabPanel): the snapshot is not requested until the user opens the tab.
type PodPerformanceTabProps = {
    namespace: string;
    name: string;
    active: boolean;
};

// The pod Performance view (the leaf of the feature): how much of its node the pod is
// consuming, as a percentage of the node for CPU and memory (pod usage ÷ node allocatable).
// Data comes from GET /pods/:namespace/:name/performance, fetched lazily when the tab is
// active. There is no treemap and no "Share of node" heading; disk and network are not
// shown at all (the Metrics API reports no pod disk/network usage). When the Metrics API
// is unavailable the percentages degrade to "—" and the MetricsUnavailable notice is shown.
export function PodPerformanceTab({ namespace, name, active }: PodPerformanceTabProps) {
    const { current } = useKubeContext();

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

    return (
        <Box data-test-id="perf-pod" sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Performance
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
                How much of its node this pod is using, as a percentage of the node.
            </Typography>

            {!data.metricsAvailable && <MetricsUnavailable />}

            <PodNodeShare data={data} />
        </Box>
    );
}
