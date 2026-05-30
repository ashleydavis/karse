import { Card, CardContent, Typography, Alert, Grid } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconProp } from "@fortawesome/fontawesome-svg-core";
import { useQuery } from "@tanstack/react-query";
import { useKubeContext } from "../lib/kube-context";
import { fetchClusterOverview } from "../lib/api-client";

type StatTileProps = {
    icon: IconProp;
    label: string;
    value: string | number;
    testId: string;
};

function StatTile({ icon, label, value, testId }: StatTileProps) {
    return (
        <Card data-test-id={testId}>
            <CardContent sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                <FontAwesomeIcon icon={icon} size="2x" />
                <Typography variant="h5">{value}</Typography>
                <Typography variant="body2" color="text.secondary">
                    {label}
                </Typography>
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
                <StatTile icon={["fas", "server"]} label="Server version" value={data.serverVersion ?? "-"} testId="stat-server-version" />
            </Grid>
            <Grid size={3}>
                <StatTile icon={["fas", "dharmachakra"]} label="Nodes" value={data.nodeCount} testId="stat-nodes" />
            </Grid>
            <Grid size={3}>
                <StatTile icon={["fas", "layer-group"]} label="Namespaces" value={data.namespaceCount} testId="stat-namespaces" />
            </Grid>
            <Grid size={3}>
                <StatTile icon={["fas", "cube"]} label="Pods" value={data.podCount} testId="stat-pods" />
            </Grid>
        </Grid>
    );
}
