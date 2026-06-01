import { useState, useEffect, useRef } from "react";
import { AppBar, Toolbar, IconButton, Alert, Tooltip, Box, Menu, MenuItem, ListItemIcon, ListItemText, Typography, Chip } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { useKubeContext } from "../lib/kube-context";
import { useKubeNamespace } from "../lib/kube-namespace";
import { useConfig } from "../lib/config";
import { ContextPicker } from "./context-picker";
import { ContextQuickPicker } from "./context-quick-picker";
import { NamespaceQuickPicker } from "./namespace-quick-picker";

function getPageTitle(pathname: string): string {
    if (pathname === "/" || pathname === "/cluster") {
        return "Cluster";
    }
    if (pathname === "/nodes") {
        return "Nodes";
    }
    if (pathname.startsWith("/nodes/")) {
        return "Node";
    }
    if (pathname === "/pods") {
        return "Pods";
    }
    if (pathname.startsWith("/pods/")) {
        return "Pod";
    }
    if (pathname === "/namespaces") {
        return "Namespaces";
    }
    if (pathname === "/contexts") {
        return "Contexts";
    }
    if (pathname === "/deployments") {
        return "Deployments";
    }
    if (pathname.startsWith("/deployments/")) {
        return "Deployment";
    }
    if (pathname === "/statefulsets") {
        return "StatefulSets";
    }
    if (pathname.startsWith("/statefulsets/")) {
        return "StatefulSet";
    }
    if (pathname === "/daemonsets") {
        return "DaemonSets";
    }
    if (pathname.startsWith("/daemonsets/")) {
        return "DaemonSet";
    }
    if (pathname === "/logs") {
        return "Live Logs";
    }
    if (pathname === "/events") {
        return "Events";
    }
    return "Karse";
}

export function Header() {
    const { contexts, current, isLoading, error, switchTo } = useKubeContext();
    const { namespace } = useKubeNamespace();
    const { config: { colorMode }, setColorMode } = useConfig();
    const qc = useQueryClient();
    const { pathname } = useLocation();
    const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
    const [copied, setCopied] = useState(false);
    const [contextPickerAnchor, setContextPickerAnchor] = useState<HTMLElement | null>(null);
    const [namespacePickerAnchor, setNamespacePickerAnchor] = useState<HTMLElement | null>(null);
    const contextButtonRef = useRef<HTMLButtonElement | null>(null);
    const namespaceButtonRef = useRef<HTMLButtonElement | null>(null);

    // Keyboard shortcuts to open the pickers, anchored to their header buttons.
    useEffect(() => {
        function onKey(e: KeyboardEvent): void {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "K") {
                e.preventDefault();
                setNamespacePickerAnchor(namespaceButtonRef.current);
            }
            else if ((e.ctrlKey || e.metaKey) && e.key === "k") {
                e.preventDefault();
                setContextPickerAnchor(contextButtonRef.current);
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    const pageTitle = getPageTitle(pathname);

    const colorModeIcon = colorMode === "dark" ? "sun" : colorMode === "light" ? "moon" : "circle-half-stroke";

    async function handleRefresh(): Promise<void> {
        await qc.invalidateQueries({ queryKey: ["contexts"] });
        await qc.invalidateQueries({ queryKey: ["cluster"] });
        await qc.invalidateQueries({ queryKey: ["namespaces"] });
    }

    // Copy the current page URL (page, resource, context, and namespace) to the clipboard so it can be shared.
    async function handleShare(): Promise<void> {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
    }

    return (
        <>
            <AppBar position="static" color="default" elevation={0}>
                <Toolbar variant="dense" sx={{ gap: 0.5, minHeight: 48 }}>
                    <Typography
                        variant="subtitle1"
                        data-test-id="page-title"
                        sx={{ fontWeight: 600, mr: 1 }}
                    >
                        {pageTitle}
                    </Typography>
                    {namespace !== null && (
                        <Chip
                            label={namespace}
                            size="small"
                            variant="outlined"
                            data-test-id="header-namespace-chip"
                        />
                    )}
                    <Box sx={{ flexGrow: 1 }} />
                    <ContextPicker contexts={contexts} current={current} onSwitch={switchTo} />
                    <Tooltip title="Context picker (Ctrl+K)">
                        <IconButton
                            size="small"
                            ref={contextButtonRef}
                            onClick={(e) => setContextPickerAnchor(e.currentTarget)}
                            aria-label="context picker"
                        >
                            <FontAwesomeIcon icon={["fas", "link"]} />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Namespace picker (Ctrl+Shift+K)">
                        <IconButton
                            size="small"
                            ref={namespaceButtonRef}
                            onClick={(e) => setNamespacePickerAnchor(e.currentTarget)}
                            aria-label="namespace picker"
                        >
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
                                onClick={() => {
                                    setColorMode(m);
                                    setMenuAnchor(null);
                                }}
                            >
                                <ListItemIcon>
                                    <FontAwesomeIcon icon={["fas", m === "dark" ? "moon" : m === "light" ? "sun" : "circle-half-stroke"]} />
                                </ListItemIcon>
                                <ListItemText>{m.charAt(0).toUpperCase() + m.slice(1)}</ListItemText>
                            </MenuItem>
                        ))}
                    </Menu>
                    <Tooltip title={copied ? "Link copied" : "Copy a shareable link to this view"}>
                        <IconButton size="small" onClick={handleShare} aria-label="share link" data-test-id="share-button">
                            <FontAwesomeIcon icon={["fas", copied ? "check" : "share-nodes"]} />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Refresh">
                        <IconButton size="small" onClick={handleRefresh} disabled={isLoading} aria-label="refresh">
                            <FontAwesomeIcon icon={["fas", "rotate"]} />
                        </IconButton>
                    </Tooltip>
                </Toolbar>
            </AppBar>
            <ContextQuickPicker
                anchorEl={contextPickerAnchor}
                onClose={() => setContextPickerAnchor(null)}
            />
            <NamespaceQuickPicker
                anchorEl={namespacePickerAnchor}
                onClose={() => setNamespacePickerAnchor(null)}
            />
            {error !== null && (
                <Alert severity="error" sx={{ borderRadius: 0 }}>
                    {error.message}
                </Alert>
            )}
        </>
    );
}
