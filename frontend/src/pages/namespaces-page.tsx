import { Box, Typography, Alert } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useKubeContext } from "../lib/kube-context";
import { useKubeNamespace } from "../lib/kube-namespace";
import { fetchNamespaces, setGlobalNamespace } from "../lib/api-client";
import { NamespaceList } from "../components/namespace-list";

// Full-page view listing namespaces for the active context with filter, sort,
// tab-local selection, and optional terminal-default controls.
export function NamespacesPage() {
    const { current: context, contexts } = useKubeContext();
    const { namespace, setNamespace } = useKubeNamespace();
    const qc = useQueryClient();

    const currentCtx = contexts.find((c) => c.name === context);
    const globalDefault = currentCtx?.namespace ?? null;

    const { data, isLoading, error } = useQuery({
        queryKey: ["namespaces", context],
        queryFn: () => fetchNamespaces(context!),
        enabled: context !== null,
    });

    const setGlobalMutation = useMutation({
        mutationFn: ({ ctx, ns }: { ctx: string; ns: string | null }) => setGlobalNamespace(ctx, ns),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ["contexts"] });
        },
    });

    if (context === null) {
        return (
            <Typography color="text.secondary">
                Select a context to view namespaces.
            </Typography>
        );
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <Typography variant="h5">Namespaces</Typography>
            {setGlobalMutation.isError && (
                <Alert severity="error">
                    {(setGlobalMutation.error as Error).message}
                </Alert>
            )}
            <NamespaceList
                namespaces={data?.namespaces ?? []}
                active={namespace}
                terminalDefault={globalDefault}
                isLoading={isLoading}
                error={(error as Error | null)}
                onUse={setNamespace}
                onSetDefault={(ns) => setGlobalMutation.mutate({ ctx: context, ns })}
            />
        </Box>
    );
}
