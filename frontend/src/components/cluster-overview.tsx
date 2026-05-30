import { Card, CardContent, Typography, Alert, Grid, Box } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconProp } from "@fortawesome/fontawesome-svg-core";
import { useQuery } from "@tanstack/react-query";
import { useKubeContext } from "../lib/kube-context";
import { fetchClusterOverview } from "../lib/api-client";

type StatTileProps = {
    icon: IconProp;
    label: string;
    value: string | number;
    color: "primary" | "success" | "warning" | "info";
    testId: string;
};

function StatTile({ icon, label, value, color, testId }: StatTileProps) {
    return (
        <Card data-test-id={testId}>
            <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, py: "14px !important" }}>
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
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1 }}>{value}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                        {label}
                    </Typography>
                </Box>
            </CardContent>
        </Card>
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

    return (
        <Grid container spacing={2} data-test-id="stat-tiles">
            <Grid size={3}>
                <StatTile icon={["fas", "server"]} label="Server version" value={data.serverVersion ?? "-"} color="primary" testId="stat-server-version" />
            </Grid>
            <Grid size={3}>
                <StatTile icon={["fas", "dharmachakra"]} label="Nodes" value={data.nodeCount} color="info" testId="stat-nodes" />
            </Grid>
            <Grid size={3}>
                <StatTile icon={["fas", "layer-group"]} label="Namespaces" value={data.namespaceCount} color="success" testId="stat-namespaces" />
            </Grid>
            <Grid size={3}>
                <StatTile icon={["fas", "cube"]} label="Pods" value={data.podCount} color="warning" testId="stat-pods" />
            </Grid>
        </Grid>
    );
}
