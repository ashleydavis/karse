import { useState, useEffect } from "react";
import { AppBar, Toolbar, IconButton, Alert, Tooltip, Box, Menu, MenuItem, ListItemIcon, ListItemText, Chip } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLink, faLayerGroup, faSun, faMoon, faCircleHalfStroke, faCheck, faShareNodes, faRotate, faClockRotateLeft, faCalendarDays } from "@fortawesome/free-solid-svg-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useKubeContext } from "../lib/kube-context";
import { useKubeNamespace } from "../lib/kube-namespace";
import { useConfig } from "../lib/config";
import { nextTimestampMode } from "../lib/timestamps";
import { clearCache } from "../lib/api-client";
import { ContextPicker } from "./context-picker";
import { ContextQuickPicker } from "./context-quick-picker";
import { NamespaceQuickPicker } from "./namespace-quick-picker";
import { Breadcrumbs } from "./breadcrumbs";
import { PageHelp } from "./page-help";
import { TOP_BAR_HEIGHT } from "../lib/layout";

export function Header() {
    const { contexts, current, isLoading, error, switchTo } = useKubeContext();
    const { namespace } = useKubeNamespace();
    const { config: { colorMode, timestampMode }, setColorMode, setTimestampMode } = useConfig();
    const qc = useQueryClient();
    const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
    const [copied, setCopied] = useState(false);
    const [contextPickerOpen, setContextPickerOpen] = useState(false);
    const [namespacePickerOpen, setNamespacePickerOpen] = useState(false);
    // Refresh feedback: "refreshing" while the refetch is in flight (spinning icon,
    // button disabled), then "done" briefly (a check) so a click is unmistakably
    // acknowledged even when the refetched data is identical. Without this a working
    // refresh that returns the same data is indistinguishable from a dead button.
    const [refreshing, setRefreshing] = useState(false);
    const [justRefreshed, setJustRefreshed] = useState(false);

    // Keyboard shortcuts to open the pickers, anchored to their header buttons.
    useEffect(() => {
        function onKey(e: KeyboardEvent): void {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "K") {
                e.preventDefault();
                setNamespacePickerOpen(true);
            }
            else if ((e.ctrlKey || e.metaKey) && e.key === "k") {
                e.preventDefault();
                setContextPickerOpen(true);
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    const colorModeIcon = colorMode === "dark" ? faSun : colorMode === "light" ? faMoon : faCircleHalfStroke;

    // The timestamp toggle shows the mode it is currently in, and its tooltip names
    // the mode a click would switch to, so one button covers both directions.
    const timestampIcon = timestampMode === "age" ? faClockRotateLeft : faCalendarDays;
    const timestampTitle = timestampMode === "age"
        ? "Timestamps: age. Click to show local time"
        : "Timestamps: local time. Click to show age";

    async function handleRefresh(): Promise<void> {
        // Guard against re-entry; the button is disabled while refreshing, but a rapid
        // second trigger (e.g. keyboard) must not stack refreshes.
        if (refreshing) return;
        setRefreshing(true);
        try {
            // Empty the on-disk cluster-data cache first so the invalidated queries below
            // re-fetch fresh kubectl data rather than re-reading a still-fresh cache entry.
            await clearCache();
            // Invalidate every query, with no key filter. Refresh means "re-read everything on
            // this page", and only the unfiltered call can honour that: a filtered invalidation
            // has to name the keys it reaches, and any such list silently misses every page whose
            // key is not on it (the previous ["contexts"], ["cluster"], ["namespaces"] list reached
            // 3 of the app's 19 root keys, so Pods, Deployments, Events and the detail pages issued
            // no request at all). Naming keys here is the defect, so do not reintroduce a list: a
            // page added tomorrow must be refreshed without touching this file. The one non-cluster
            // key, ["cache-config"], is swept up too; re-reading the staleness threshold the server
            // already holds is cheap and harmless, and excluding it would mean naming keys again.
            // invalidateQueries resolves once the active page's queries have refetched, so the
            // spinner below stays up for the real duration of the refresh.
            await qc.invalidateQueries();
        } finally {
            setRefreshing(false);
            // Briefly show a completed state so a click is acknowledged even when the data
            // came back identical. Mirrors the share button's transient check.
            setJustRefreshed(true);
            window.setTimeout(() => setJustRefreshed(false), 1500);
        }
    }

    const refreshIcon = refreshing ? faRotate : justRefreshed ? faCheck : faRotate;
    const refreshState = refreshing ? "refreshing" : justRefreshed ? "done" : "idle";
    const refreshTitle = refreshing ? "Refreshing…" : justRefreshed ? "Refreshed" : "Refresh";

    // Copy the current page URL (page, resource, context, and namespace) to the clipboard so it can be shared.
    async function handleShare(): Promise<void> {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
    }

    return (
        <>
            <AppBar position="static" color="default" elevation={0}>
                <Toolbar variant="dense" sx={{ gap: 1, minHeight: TOP_BAR_HEIGHT }}>
                    <Breadcrumbs />
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
                    <ContextQuickPicker
                        open={contextPickerOpen}
                        onClose={() => setContextPickerOpen(false)}
                    >
                        <IconButton
                            size="small"
                            onClick={() => setContextPickerOpen(true)}
                            aria-label="context picker"
                            title="Context picker (Ctrl+K)"
                        >
                            <FontAwesomeIcon icon={faLink} />
                        </IconButton>
                    </ContextQuickPicker>
                    <NamespaceQuickPicker
                        open={namespacePickerOpen}
                        onClose={() => setNamespacePickerOpen(false)}
                    >
                        <IconButton
                            size="small"
                            onClick={() => setNamespacePickerOpen(true)}
                            aria-label="namespace picker"
                            title="Namespace picker (Ctrl+Shift+K)"
                        >
                            <FontAwesomeIcon icon={faLayerGroup} />
                        </IconButton>
                    </NamespaceQuickPicker>
                    <PageHelp />
                    <Tooltip title={timestampTitle}>
                        <IconButton
                            size="small"
                            onClick={() => setTimestampMode(nextTimestampMode(timestampMode))}
                            aria-label="timestamp format"
                            data-test-id="timestamp-format-toggle"
                            data-timestamp-mode={timestampMode}
                        >
                            <FontAwesomeIcon icon={timestampIcon} />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Color mode">
                        <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)} aria-label="color mode">
                            <FontAwesomeIcon icon={colorModeIcon} />
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
                                    <FontAwesomeIcon icon={m === "dark" ? faMoon : m === "light" ? faSun : faCircleHalfStroke} />
                                </ListItemIcon>
                                <ListItemText>{m.charAt(0).toUpperCase() + m.slice(1)}</ListItemText>
                            </MenuItem>
                        ))}
                    </Menu>
                    <Tooltip title={copied ? "Link copied" : "Copy a shareable link to this view"}>
                        <IconButton size="small" onClick={handleShare} aria-label="share link" data-test-id="share-button">
                            <FontAwesomeIcon icon={copied ? faCheck : faShareNodes} />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={refreshTitle}>
                        <span>
                            <IconButton
                                size="small"
                                onClick={handleRefresh}
                                disabled={isLoading || refreshing}
                                aria-label="refresh"
                                data-test-id="refresh-button"
                                data-refresh-state={refreshState}
                            >
                                <FontAwesomeIcon icon={refreshIcon} spin={refreshing} />
                            </IconButton>
                        </span>
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
