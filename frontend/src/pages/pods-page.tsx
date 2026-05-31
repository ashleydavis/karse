import { Typography } from "@mui/material";
import { useKubeContext } from "../lib/kube-context";
import { PodsTable } from "../components/pods-table";

// Full-page view listing pods for the active context.
// Scopes to the tab-local namespace when one is selected; shows all pods otherwise.
export function PodsPage() {
    const { current: context } = useKubeContext();

    if (context === null) {
        return (
            <Typography color="text.secondary">
                Select a context to view pods.
            </Typography>
        );
    }

    return <PodsTable />;
}
