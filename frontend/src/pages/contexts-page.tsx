import { Box, Alert } from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useKubeContext } from "../lib/kube-context";
import { switchContext } from "../lib/api-client";
import { ContextsTable } from "../components/contexts-table";

export function ContextsPage() {
    const { contexts, current, terminalDefault, switchTo } = useKubeContext();
    const qc = useQueryClient();

    const setTerminalDefaultMutation = useMutation({
        mutationFn: (name: string) => switchContext(name),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ["contexts"] });
        },
    });

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {setTerminalDefaultMutation.isError && (
                <Alert severity="error">
                    {(setTerminalDefaultMutation.error as Error).message}
                </Alert>
            )}
            <ContextsTable
                contexts={contexts}
                active={current}
                terminalDefault={terminalDefault}
                onUse={switchTo}
                onSetDefault={(name) => setTerminalDefaultMutation.mutate(name)}
            />
        </Box>
    );
}
