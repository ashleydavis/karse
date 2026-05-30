import { Box, Typography } from "@mui/material";
import { useKubeContext } from "../lib/kube-context";
import { NodesTable } from "../components/nodes-table";

export function NodesPage() {
    const { current: context } = useKubeContext();

    if (context === null) {
        return (
            <Typography color="text.secondary">
                Select a context to view nodes.
            </Typography>
        );
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <Typography variant="h5">Nodes</Typography>
            <NodesTable />
        </Box>
    );
}
