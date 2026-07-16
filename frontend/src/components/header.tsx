import { useState, useEffect } from "react";
import { AppBar, Toolbar, IconButton, Alert, Tooltip, Box, Menu, MenuItem, ListItemIcon, ListItemText, Chip, Snackbar } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLink, faLayerGroup, faSun, faMoon, faCircleHalfStroke, faCheck, faShareNodes, faRotate, faClockRotateLeft, faCalendarDays } from "@fortawesome/free-solid-svg-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useKubeContext } from "../lib/kube-context";
import { useKubeNamespace } from "../lib/kube-namespace";
import { useConfig } from "../lib/config";
import { nextTimestampMode } from "../lib/timestamps";
import { clearCache } from "../lib/api-client";
import { runRefresh } from "../lib/refresh-feedback";
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
    // button disabled, "Refreshing…" toast), then "done" briefly (a check plus a
    // "Refreshed" toast) so a click is unmistakably acknowledged even when the refetched
    // data is identical. Without this a working refresh that returns the same data is
    // indistinguishable from a dead button. The lifecycle is driven by runRefresh, which
    // deliberately does not gate this feedback on the query invalidation resolving.
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
        // runRefresh empties the on-disk cluster-data cache, then invalidates every query with
        // no key filter so every page currently on screen refetches. Refresh means "re-read
        // everything on this page"; only the unfiltered invalidation honours that, and naming
        // keys was the original defect (the old ["contexts"], ["cluster"], ["namespaces"] list
        // reached 3 of the app's 19 root keys, so Pods, Deployments, Events and the detail pages
        // issued no request at all). A page added tomorrow must be refreshed without touching
        // this file. The one non-cluster key, ["cache-config"], is swept up too; re-reading the
        // staleness threshold is cheap and harmless, and excluding it would mean naming keys
        // again. The visible feedback (spinner/disabled/toast, then a check) is driven by
        // runRefresh on a clock and is NOT gated on the invalidation resolving — that promise
        // awaits background refetches that can hang, which would pin the button in the refreshing
        // state forever (the "refresh looks dead" report on the Cluster page).
        await runRefresh({
            clearCache,
            invalidate: () => qc.invalidateQueries(),
            onRefreshing: setRefreshing,
            onJustRefreshed: setJustRefreshed,
            schedule: (fn, ms) => window.setTimeout(fn, ms),
            now: () => Date.now(),
        });
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
            {/* Prominent, unmissable acknowledgement of a refresh: a small header icon that
                swaps for a fraction of a second is easy to miss, so a bottom toast confirms the
                click even when the refetched data is identical. Open while refreshing or during
                the transient completion window. */}
            <Snackbar
                open={refreshing || justRefreshed}
                message={refreshing ? "Refreshing…" : "Refreshed"}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
                data-test-id="refresh-snackbar"
            />
            {error !== null && (
                <Alert severity="error" sx={{ borderRadius: 0 }}>
                    {error.message}
                </Alert>
            )}
        </>
    );
}
