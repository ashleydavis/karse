import { Box, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useKubeContext } from "../../lib/kube-context";
import { fetchPodPerformance } from "../../lib/api-client";
import { LoadingIndicator } from "../loading-indicator";
import { LoadError } from "../load-error";
import { MetricsUnavailable } from "./metrics-unavailable";
import { PodResourcePanel } from "../resource-utilization/pod-resource-panel";

// Props for the pod Performance tab. `active` is true only when this tab is the
// selected one, so the data fetch is lazy (matching the cluster and node tabs and
// YamlTabPanel): the snapshot is not requested until the user opens the tab.
type PodPerformanceTabProps = {
    namespace: string;
    name: string;
    active: boolean;
};

// The pod Performance view (the leaf of the feature): a CPU section and a Memory section,
// each with Requested / Limit / Usage-now tiles and a combined bar plotting live usage
// against the request and limit (the PodResourcePanel), with a Percentage / Absolute toggle
// switching the tile figures between a percentage of the pod's own request and the raw
// values. Data comes from GET /pods/:namespace/:name/performance, fetched lazily when the
// tab is active. There is no treemap, and no "Share of node" subsection (the pod's share of
// its scheduling node lives on the Status tab's "Node resources" panel instead); disk and
// network are not shown at all (the Metrics API reports no pod disk/network usage). When the
// Metrics API is unavailable the usage figures degrade to "—" and the MetricsUnavailable
// notice is shown (requests and limits, read from the spec, remain).
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
                Resource utilization
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
                CPU and memory: what this pod requests, its limit, and how much it is using now.
            </Typography>

            {!data.metricsAvailable && <MetricsUnavailable />}

            <PodResourcePanel data={data} active={active} />
        </Box>
    );
}
