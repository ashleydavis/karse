import { Box, Alert, Paper } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import type { YamlResourceType } from "karse-types";
import { useKubeContext } from "../lib/kube-context";
import { fetchResourceYaml } from "../lib/api-client";

// Which resource to fetch YAML for. namespace is omitted for cluster-scoped
// resources (nodes, namespaces) and supplied for namespaced ones.
type YamlTarget = {
    type: YamlResourceType;
    name: string;
    namespace?: string;
};

// Renders the raw YAML for a single resource inside a detail-page sub tab.
// Fetching is gated on `active` so the request only fires when the tab is open.
export function YamlTabPanel({ target, active }: { target: YamlTarget; active: boolean }) {
    const { current } = useKubeContext();

    const { data, error, isLoading } = useQuery({
        queryKey: ["yaml", current, target.type, target.namespace ?? "", target.name],
        queryFn: () => fetchResourceYaml(current!, target.type, target.name, target.namespace),
        enabled: active && current !== null,
    });

    return (
        <Box data-test-id="yaml-panel">
            {error && <Alert severity="error">{(error as Error).message}</Alert>}
            <Paper
                variant="outlined"
                sx={{
                    p: 1.5,
                    bgcolor: "grey.900",
                    color: "grey.100",
                    fontFamily: "monospace",
                    fontSize: "0.75rem",
                    overflow: "auto",
                    maxHeight: "70vh",
                    whiteSpace: "pre",
                }}
                data-test-id="yaml-content"
            >
                {isLoading ? "Loading..." : (data?.yaml || "(no yaml)")}
            </Paper>
        </Box>
    );
}
