import { AppBar, Toolbar, Typography, IconButton, Alert } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useQueryClient } from "@tanstack/react-query";
import { useKubeContext } from "../lib/kube-context";
import { ContextPicker } from "./context-picker";

export function Header() {
    const { contexts, current, isLoading, error, switchTo } = useKubeContext();
    const qc = useQueryClient();

    async function handleRefresh() {
        await qc.invalidateQueries({ queryKey: ["contexts"] });
        await qc.invalidateQueries({ queryKey: ["cluster"] });
    }

    return (
        <>
            <AppBar position="static">
                <Toolbar sx={{ gap: 1 }}>
                    <FontAwesomeIcon icon={["fas", "dharmachakra"]} />
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                        Karse
                    </Typography>
                    <ContextPicker contexts={contexts} current={current} onSwitch={switchTo} />
                    <IconButton color="inherit" onClick={handleRefresh} disabled={isLoading} aria-label="refresh">
                        <FontAwesomeIcon icon={["fas", "rotate"]} />
                    </IconButton>
                </Toolbar>
            </AppBar>
            {error && (
                <Alert severity="error" sx={{ borderRadius: 0 }}>
                    {error.message}
                </Alert>
            )}
        </>
    );
}
