import { Card, CardContent, CardActionArea, Typography, Grid, Box, Divider } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleExclamation, faCube, faDharmachakra, faLayerGroup, faServer } from "@fortawesome/free-solid-svg-icons";
import type { IconProp } from "@fortawesome/fontawesome-svg-core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useKubeContext } from "../../../lib/kube-context";
import { useShareableTo } from "../../../lib/nav-state";
import { fetchClusterOverview, fetchClusterPerformance } from "../../../lib/api-client";
import { LoadingIndicator } from "../../../components/loading-indicator";
import { LoadError } from "../../../components/load-error";
import { ClusterUtilizationPanel } from "./cluster-utilization-panel";
import { ClusterHealthSignalsSection } from "./cluster-health-signals";
import { ClusterWorkloadsTable } from "./cluster-workloads-table";
import { NodeSummaryStrip } from "../../../components/resource-utilization/node-summary-strip";
import { buildNodeUtilizationSummary } from "../../../lib/resource-utilization";

type StatTileProps = {
    icon: IconProp;
    label: string;
    value: string | number;
    sublabel?: string;
    sublabelColor?: string;
    color: "primary" | "success" | "warning" | "info" | "error";
    to?: string;
    testId: string;
};

function StatTile({ icon, label, value, sublabel, sublabelColor, color, to, testId }: StatTileProps) {
    const buildTo = useShareableTo();
    const inner = (
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, py: "14px", px: 2 }}>
            <Box
                sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 2,
                    bgcolor: `${color}.main`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    flexShrink: 0,
                    fontSize: "1.1rem",
                }}
            >
                <FontAwesomeIcon icon={icon} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
                <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1 }}>{value}</Typography>
                <Typography component="p" variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                    {label}
                </Typography>
                {sublabel && (
                    <Typography variant="caption" sx={{ display: "block", color: sublabelColor ?? "text.secondary" }}>
                        {sublabel}
                    </Typography>
                )}
            </Box>
        </Box>
    );

    return (
        <Card data-test-id={testId} sx={{ height: "100%" }}>
            {to ? (
                <CardActionArea component={Link} to={buildTo(to)} sx={{ height: "100%" }}>{inner}</CardActionArea>
            ) : (
                <CardContent sx={{ p: "0 !important", height: "100%" }}>{inner}</CardContent>
            )}
        </Card>
    );
}

type PodPhaseRowProps = {
    running: number;
    pending: number;
    failed: number;
    total: number;
};

function PodPhaseRow({ running, pending, failed, total }: PodPhaseRowProps) {
    const succeeded = total - running - pending - failed;
    return (
        <Card>
            <CardContent sx={{ py: 1.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                    Pod status
                </Typography>
                <Box sx={{ display: "flex", gap: 3, mt: 1, flexWrap: "wrap" }}>
                    <PhaseCount label="Running"   count={running}   color="success.main" />
                    <Divider orientation="vertical" flexItem />
                    <PhaseCount label="Pending"   count={pending}   color="warning.main" />
                    <Divider orientation="vertical" flexItem />
                    <PhaseCount label="Failed"    count={failed}    color="error.main" />
                    <Divider orientation="vertical" flexItem />
                    <PhaseCount label="Succeeded" count={succeeded} color="text.secondary" />
                </Box>
            </CardContent>
        </Card>
    );
}

function PhaseCount({ label, count, color }: { label: string; count: number; color: string }) {
    return (
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color }}>{count}</Typography>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
        </Box>
    );
}

export function ClusterOverview() {
    const { current } = useKubeContext();
    const { data, error, isLoading, refetch } = useQuery({
        queryKey: ["cluster", "overview", current],
        queryFn: () => fetchClusterOverview(current!),
        enabled: current !== null,
    });
    // The cluster performance snapshot drives the health-signals row, the workloads
    // table, and the node-utilization summary strip below. The utilisation panel issues
    // its own query against the same ["cluster-performance", current] key, so TanStack
    // Query dedupes to a single fetch.
    const performance = useQuery({
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

    const allNodesReady = data.readyNodeCount === data.nodeCount;
    const nodeSubLabel = `${data.readyNodeCount} of ${data.nodeCount} ready`;
    const nodeSubColor = allNodesReady ? "success.main" : "warning.main";

    // Node-utilization band counts (over/healthy/under by CPU-requests share of
    // allocatable), from the Performance snapshot. Shown only when the snapshot has nodes
    // and at least one falls in a band, so the strip is omitted (rather than shown as all
    // zeros) when metrics are unavailable or no node's requests/allocatable are readable.
    const performanceNodes = performance.data?.nodes ?? [];
    const nodeSummary = buildNodeUtilizationSummary(performanceNodes);
    const showNodeSummary =
        nodeSummary.over + nodeSummary.healthy + nodeSummary.under > 0;

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Grid container spacing={2} data-test-id="stat-tiles">
                <Grid size={2.4}>
                    <StatTile
                        icon={faServer}
                        label="Server version"
                        value={data.serverVersion ?? "-"}
                        sublabel={data.clientVersion ? `Client: ${data.clientVersion}` : undefined}
                        color="primary"
                        testId="stat-server-version"
                    />
                </Grid>
                <Grid size={2.4}>
                    <StatTile
                        icon={faDharmachakra}
                        label="Nodes"
                        value={data.nodeCount}
                        sublabel={nodeSubLabel}
                        sublabelColor={nodeSubColor}
                        color="info"
                        to="/nodes"
                        testId="stat-nodes"
                    />
                </Grid>
                <Grid size={2.4}>
                    <StatTile
                        icon={faLayerGroup}
                        label="Namespaces"
                        value={data.namespaceCount}
                        color="success"
                        to="/namespaces"
                        testId="stat-namespaces"
                    />
                </Grid>
                <Grid size={2.4}>
                    <StatTile
                        icon={faCube}
                        label="Pods"
                        value={data.podCount}
                        sublabel={`${data.runningPodCount} running`}
                        sublabelColor={data.runningPodCount === data.podCount ? "success.main" : "text.secondary"}
                        color="warning"
                        to="/pods"
                        testId="stat-pods"
                    />
                </Grid>
                <Grid size={2.4}>
                    <StatTile
                        icon={faCircleExclamation}
                        label="Errors"
                        value={data.errorCount}
                        sublabel={data.errorCount === 0 ? "none active" : "active"}
                        sublabelColor={data.errorCount > 0 ? "error.main" : "success.main"}
                        color={data.errorCount > 0 ? "error" : "info"}
                        to="/errors"
                        testId="stat-errors"
                    />
                </Grid>
            </Grid>
            {showNodeSummary && <NodeSummaryStrip summary={nodeSummary} />}
            <PodPhaseRow
                running={data.runningPodCount}
                pending={data.pendingPodCount}
                failed={data.failedPodCount}
                total={data.podCount}
            />
            <ClusterUtilizationPanel />
            {performance.data && (
                <>
                    <ClusterHealthSignalsSection
                        health={performance.data.health}
                        metricsAvailable={performance.data.metricsAvailable}
                    />
                    <ClusterWorkloadsTable
                        workloads={performance.data.workloads}
                        totals={performance.data.totals}
                    />
                </>
            )}
        </Box>
    );
}
