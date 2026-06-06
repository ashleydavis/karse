import { useState, useEffect, type ReactElement } from "react";
import {
    Tooltip,
    ClickAwayListener,
    TextField,
    List,
    ListItemButton,
    ListItemText,
    Chip,
    Typography,
    Box,
    Divider,
    CircularProgress,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import { useQuery } from "@tanstack/react-query";
import { useKubeContext } from "../lib/kube-context";
import { useKubeNamespace } from "../lib/kube-namespace";
import { fetchNamespaces } from "../lib/api-client";

// Dropdown picker for selecting a namespace, anchored to the header button.
type Props = {
    open: boolean;
    onClose: () => void;
    children: ReactElement;
};

// Renders the namespace picker as a nav-bar dropdown anchored to its trigger button,
// using a MUI Tooltip so the dropdown gets a built-in arrow pointing at the button.
export function NamespaceQuickPicker({ open, onClose, children }: Props) {
    const { current: context } = useKubeContext();
    const { namespace: currentNamespace, setNamespace } = useKubeNamespace();
    const [query, setQuery] = useState("");

    useEffect(() => {
        if (open) {
            setQuery("");
        }
    }, [open]);

    const { data, isLoading } = useQuery({
        queryKey: ["namespaces", context],
        queryFn: () => fetchNamespaces(context!),
        enabled: context !== null && open,
    });

    const q = query.toLowerCase();
    const filtered = (data?.namespaces ?? [])
        .filter((ns) => ns.name.toLowerCase().includes(q))
        .sort((a, b) => a.name.localeCompare(b.name));

    function handleSelect(name: string | null): void {
        setNamespace(name);
        onClose();
    }

    // The picker content rendered inside the Tooltip surface.
    const content = (
        <ClickAwayListener onClickAway={onClose}>
            <Box data-test-id="namespace-quick-picker-dropdown" sx={{ width: 360 }}>
                <Box sx={{ p: 2 }}>
                    <TextField
                        autoFocus
                        fullWidth
                        size="small"
                        placeholder="Search namespaces..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        slotProps={{
                            input: {
                                startAdornment: (
                                    <FontAwesomeIcon icon={faMagnifyingGlass} style={{ marginRight: 8 }} />
                                ),
                            },
                        }}
                    />
                </Box>
                <Divider />
                <Box sx={{ maxHeight: 400, overflow: "auto" }}>
                    {context === null && (
                        <Typography sx={{ px: 2, py: 1 }} color="text.secondary" variant="body2">
                            Select a context first.
                        </Typography>
                    )}
                    {context !== null && isLoading && (
                        <Box sx={{ px: 2, py: 1 }}>
                            <CircularProgress size={16} />
                        </Box>
                    )}
                    {context !== null && !isLoading && (
                        <List dense disablePadding>
                            <ListItemButton
                                selected={currentNamespace === null}
                                onClick={() => handleSelect(null)}
                                data-test-id="namespace-quick-picker-all"
                            >
                                <ListItemText primary="All namespaces" />
                                {currentNamespace === null && (
                                    <Chip label="active" size="small" color="primary" sx={{ ml: 1 }} />
                                )}
                            </ListItemButton>
                            <Divider />
                            {filtered.length === 0 && (
                                <Typography sx={{ px: 2, py: 1 }} color="text.secondary" variant="body2">
                                    No namespaces match.
                                </Typography>
                            )}
                            {filtered.map((ns) => (
                                <ListItemButton
                                    key={ns.name}
                                    selected={ns.name === currentNamespace}
                                    onClick={() => handleSelect(ns.name)}
                                    data-test-id="namespace-quick-picker-row"
                                >
                                    <ListItemText primary={ns.name} />
                                    {ns.name === currentNamespace && (
                                        <Chip label="active" size="small" color="primary" sx={{ ml: 1 }} />
                                    )}
                                </ListItemButton>
                            ))}
                        </List>
                    )}
                </Box>
            </Box>
        </ClickAwayListener>
    );

    return (
        <Tooltip
            open={open}
            onClose={onClose}
            title={content}
            arrow
            placement="bottom-end"
            disableFocusListener
            disableHoverListener
            disableTouchListener
            slotProps={{
                // No enter/exit animation so the dropdown is positioned and stable
                // immediately (matching the previous Popover and keeping clicks reliable).
                transition: { timeout: 0 },
                tooltip: {
                    sx: (theme) => ({
                        bgcolor: "background.paper",
                        color: "text.primary",
                        p: 0,
                        maxWidth: "none",
                        boxShadow: 3,
                        borderRadius: 1,
                        // A divider-coloured border so the panel edges stay visible in dark
                        // mode, where the panel shares the nav bar's background colour.
                        border: `1px solid ${theme.palette.divider}`,
                    }),
                },
                arrow: {
                    sx: (theme) => ({
                        color: "background.paper",
                        // A soft drop shadow on the arrow so its edges read against the
                        // page, plus a divider-coloured border on its two outer edges so the
                        // arrow stays visible in dark mode (matching the panel border).
                        "&::before": {
                            boxShadow: 1,
                            border: `1px solid ${theme.palette.divider}`,
                        },
                    }),
                },
            }}
        >
            {children}
        </Tooltip>
    );
}
