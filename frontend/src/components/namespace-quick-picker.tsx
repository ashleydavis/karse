import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
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
import { useQuery } from "@tanstack/react-query";
import { useKubeContext } from "../lib/kube-context";
import { useKubeNamespace } from "../lib/kube-namespace";
import { fetchNamespaces } from "../lib/api-client";

type Props = {
    open: boolean;
    onClose: () => void;
};

export function NamespaceQuickPicker({ open, onClose }: Props) {
    const { current: context } = useKubeContext();
    const { namespace: currentNamespace, setNamespace } = useKubeNamespace();
    const [query, setQuery] = useState("");

    useEffect(() => {
        if (open) setQuery("");
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

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth data-test-id="namespace-quick-picker-dialog">
            <DialogContent sx={{ p: 0 }}>
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
                                    <FontAwesomeIcon icon={["fas", "magnifying-glass"]} style={{ marginRight: 8 }} />
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
            </DialogContent>
        </Dialog>
    );
}
