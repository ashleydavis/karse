import { Typography } from "@mui/material";
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

    return <NodesTable />;
}
