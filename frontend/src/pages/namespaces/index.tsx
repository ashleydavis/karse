import { Box, Alert } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useKubeContext } from "../../lib/kube-context";
import { useKubeNamespace } from "../../lib/kube-namespace";
import { useShareableNavigate } from "../../lib/nav-state";
import { fetchNamespaces } from "../../lib/api-client";
import { NamespaceList } from "./components/namespace-list";

// Full-page view listing namespaces for the active context with filter, sort,
// tab-local selection, and optional terminal-default controls.
export function NamespacesPage() {
    const { current: context, contexts, setDefaultNamespace } = useKubeContext();
    const { namespace, setNamespace } = useKubeNamespace();
    const navigate = useShareableNavigate();

    const currentCtx = contexts.find((c) => c.name === context);
    const globalDefault = currentCtx?.namespace ?? null;

    const { data, isLoading, error } = useQuery({
        queryKey: ["namespaces", context],
        queryFn: () => fetchNamespaces(context!),
        enabled: context !== null,
    });

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {setDefaultNamespace.isError && (
                <Alert severity="error">
                    {setDefaultNamespace.error.message}
                </Alert>
            )}
            <NamespaceList
                namespaces={data?.namespaces ?? []}
                active={namespace}
                terminalDefault={globalDefault}
                isLoading={isLoading}
                error={(error as Error | null)}
                onUse={setNamespace}
                onSetDefault={(ns) => setDefaultNamespace.mutate({ context: context!, namespace: ns })}
                onOpen={(ns) => navigate(`/namespaces/${ns}`)}
            />
        </Box>
    );
}
