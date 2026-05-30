import { AppBar, Toolbar, Typography, IconButton, Alert, Tooltip, Box } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useKubeContext } from "../lib/kube-context";
import { ContextPicker } from "./context-picker";

// Props for the Header component.
type Props = {
    onOpenPicker: () => void;
};

// Top application bar with navigation, context picker, quick picker trigger, and refresh.
export function Header({ onOpenPicker }: Props) {
    const { contexts, current, isLoading, error, switchTo } = useKubeContext();
    const qc = useQueryClient();

    async function handleRefresh(): Promise<void> {
        await qc.invalidateQueries({ queryKey: ["contexts"] });
        await qc.invalidateQueries({ queryKey: ["cluster"] });
        await qc.invalidateQueries({ queryKey: ["namespaces"] });
    }

    return (
        <>
            <AppBar position="static">
                <Toolbar sx={{ gap: 1 }}>
                    <FontAwesomeIcon icon={["fas", "dharmachakra"]} />
                    <Typography
                        variant="h6"
                        component={Link}
                        to="/"
                        data-test-id="karse-title"
                        sx={{
                            textDecoration: "none",
                            color: "inherit",
                        }}
                    >
                        Karse
                    </Typography>
                    <Tooltip title="Namespaces">
                        <IconButton
                            color="inherit"
                            component={Link}
                            to="/namespaces"
                            aria-label="namespaces"
                        >
                            <FontAwesomeIcon icon={["fas", "layer-group"]} />
                        </IconButton>
                    </Tooltip>
                    <Box sx={{ flexGrow: 1 }} />
                    <ContextPicker contexts={contexts} current={current} onSwitch={switchTo} />
                    <Tooltip title="Quick pick (Ctrl+K)">
                        <IconButton
                            color="inherit"
                            onClick={onOpenPicker}
                            aria-label="quick picker"
                        >
                            <FontAwesomeIcon icon={["fas", "magnifying-glass"]} />
                        </IconButton>
                    </Tooltip>
                    <IconButton
                        color="inherit"
                        onClick={handleRefresh}
                        disabled={isLoading}
                        aria-label="refresh"
                    >
                        <FontAwesomeIcon icon={["fas", "rotate"]} />
                    </IconButton>
                </Toolbar>
            </AppBar>
            {error !== null && (
                <Alert severity="error" sx={{ borderRadius: 0 }}>
                    {error.message}
                </Alert>
            )}
        </>
    );
}
