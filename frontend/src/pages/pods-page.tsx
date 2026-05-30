import { Box, Typography, Chip } from "@mui/material";
import { useKubeContext } from "../lib/kube-context";
import { useKubeNamespace } from "../lib/kube-namespace";
import { PodsTable } from "../components/pods-table";

// Full-page view listing pods for the active context.
// Scopes to the tab-local namespace when one is selected; shows all pods otherwise.
export function PodsPage() {
    const { current: context } = useKubeContext();
    const { namespace } = useKubeNamespace();

    if (context === null) {
        return (
            <Typography color="text.secondary">
                Select a context to view pods.
            </Typography>
        );
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Typography variant="h5">Pods</Typography>
                {namespace !== null && (
                    <Chip label={namespace} size="small" variant="outlined" />
                )}
            </Box>
            <PodsTable />
        </Box>
    );
}
