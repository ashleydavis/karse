import { useState } from "react";
import { AppBar, Toolbar, IconButton, Alert, Tooltip, Box, Menu, MenuItem, ListItemIcon, ListItemText } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
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
            <AppBar position="static" color="default" elevation={0}>
                <Toolbar variant="dense" sx={{ gap: 0.5, minHeight: 48 }}>
                    <Box sx={{ flexGrow: 1 }} />
                    <ContextPicker contexts={contexts} current={current} onSwitch={switchTo} />
                    <Tooltip title="Quick pick (Ctrl+K)">
                        <IconButton size="small" onClick={onOpenPicker} aria-label="quick picker">
                            <FontAwesomeIcon icon={["fas", "layer-group"]} />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Color mode">
                        <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)} aria-label="color mode">
                            <FontAwesomeIcon icon={["fas", colorModeIcon]} />
                        </IconButton>
                    </Tooltip>
                    <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
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
                    <Tooltip title="Refresh">
                        <IconButton size="small" onClick={handleRefresh} disabled={isLoading} aria-label="refresh">
                            <FontAwesomeIcon icon={["fas", "rotate"]} />
                        </IconButton>
                    </Tooltip>
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
