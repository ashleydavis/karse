import { Card, CardContent, CardActionArea, Typography, Alert, Grid, Box, Divider } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconProp } from "@fortawesome/fontawesome-svg-core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useKubeContext } from "../lib/kube-context";
import { fetchClusterOverview } from "../lib/api-client";

type StatTileProps = {
    icon: IconProp;
    label: string;
    value: string | number;
    sublabel?: string;
    sublabelColor?: string;
    color: "primary" | "success" | "warning" | "info";
    to?: string;
    testId: string;
};

function StatTile({ icon, label, value, sublabel, sublabelColor, color, to, testId }: StatTileProps) {
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
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
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
                <CardActionArea component={Link} to={to} sx={{ height: "100%" }}>{inner}</CardActionArea>
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
    const { data, error, isLoading } = useQuery({
        queryKey: ["cluster", "overview", current],
        queryFn: () => fetchClusterOverview(current!),
        enabled: current !== null,
    });

    if (current === null) {
        return (
            <Typography color="text.secondary" data-test-id="no-context-message">
                Select a context to see cluster overview.
            </Typography>
        );
    }

    if (error) {
        return <Alert severity="error">{(error as Error).message}</Alert>;
    }

    if (isLoading || !data) {
        return null;
    }

    const allNodesReady = data.readyNodeCount === data.nodeCount;
    const nodeSubLabel = `${data.readyNodeCount} of ${data.nodeCount} ready`;
    const nodeSubColor = allNodesReady ? "success.main" : "warning.main";

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Grid container spacing={2} alignItems="stretch" data-test-id="stat-tiles">
                <Grid size={3}>
                    <StatTile
                        icon={["fas", "server"]}
                        label="Server version"
                        value={data.serverVersion ?? "-"}
                        sublabel={data.clientVersion ? `Client: ${data.clientVersion}` : undefined}
                        color="primary"
                        testId="stat-server-version"
                    />
                </Grid>
                <Grid size={3}>
                    <StatTile
                        icon={["fas", "dharmachakra"]}
                        label="Nodes"
                        value={data.nodeCount}
                        sublabel={nodeSubLabel}
                        sublabelColor={nodeSubColor}
                        color="info"
                        to="/nodes"
                        testId="stat-nodes"
                    />
                </Grid>
                <Grid size={3}>
                    <StatTile
                        icon={["fas", "layer-group"]}
                        label="Namespaces"
                        value={data.namespaceCount}
                        color="success"
                        to="/namespaces"
                        testId="stat-namespaces"
                    />
                </Grid>
                <Grid size={3}>
                    <StatTile
                        icon={["fas", "cube"]}
                        label="Pods"
                        value={data.podCount}
                        sublabel={`${data.runningPodCount} running`}
                        sublabelColor={data.runningPodCount === data.podCount ? "success.main" : "text.secondary"}
                        color="warning"
                        to="/pods"
                        testId="stat-pods"
                    />
                </Grid>
            </Grid>
            <PodPhaseRow
                running={data.runningPodCount}
                pending={data.pendingPodCount}
                failed={data.failedPodCount}
                total={data.podCount}
            />
        </Box>
    );
}
