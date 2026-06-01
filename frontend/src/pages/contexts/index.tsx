import { Box, Alert } from "@mui/material";
import { useKubeContext } from "../../lib/kube-context";
import { ContextsTable } from "./components/contexts-table";

export function ContextsPage() {
    const { contexts, current, terminalDefault, switchTo, setTerminalDefaultContext } = useKubeContext();

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {current === null && (
                <Alert severity="info">No context is selected. Choose one below to get started.</Alert>
            )}
            {setTerminalDefaultContext.isError && (
                <Alert severity="error">
                    {setTerminalDefaultContext.error.message}
                </Alert>
            )}
            <ContextsTable
                contexts={contexts}
                active={current}
                terminalDefault={terminalDefault}
                onUse={switchTo}
                onSetDefault={(name) => setTerminalDefaultContext.mutate(name)}
            />
        </Box>
    );
}
