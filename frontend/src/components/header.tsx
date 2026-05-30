import { useState } from "react";
import { AppBar, Toolbar, Typography, IconButton, Alert, Tooltip, Box, Menu, MenuItem, ListItemIcon, ListItemText } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useKubeContext } from "../lib/kube-context";
import { useConfig } from "../lib/config";
import { ContextPicker } from "./context-picker";

type Props = {
    onOpenPicker: () => void;
};

export function Header({ onOpenPicker }: Props) {
    const { contexts, current, isLoading, error, switchTo } = useKubeContext();
    const { config: { colorMode }, setColorMode } = useConfig();
    const qc = useQueryClient();
    const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

    const colorModeIcon = colorMode === "dark" ? "sun" : colorMode === "light" ? "moon" : "circle-half-stroke";

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
                    <Tooltip title="Pods">
                        <IconButton
                            color="inherit"
                            component={Link}
                            to="/pods"
                            aria-label="pods"
                        >
                            <FontAwesomeIcon icon={["fas", "cube"]} />
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
                    <Tooltip title="Color mode">
                        <IconButton
                            color="inherit"
                            onClick={(e) => setMenuAnchor(e.currentTarget)}
                            aria-label="color mode"
                        >
                            <FontAwesomeIcon icon={["fas", colorModeIcon]} />
                        </IconButton>
                    </Tooltip>
                    <Menu
                        anchorEl={menuAnchor}
                        open={Boolean(menuAnchor)}
                        onClose={() => setMenuAnchor(null)}
                    >
                        {(["light", "dark", "system"] as const).map((m) => (
                            <MenuItem
                                key={m}
                                selected={colorMode === m}
                                onClick={() => { setColorMode(m); setMenuAnchor(null); }}
                            >
                                <ListItemIcon>
                                    <FontAwesomeIcon icon={["fas", m === "dark" ? "moon" : m === "light" ? "sun" : "circle-half-stroke"]} />
                                </ListItemIcon>
                                <ListItemText>{m.charAt(0).toUpperCase() + m.slice(1)}</ListItemText>
                            </MenuItem>
                        ))}
                    </Menu>
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
