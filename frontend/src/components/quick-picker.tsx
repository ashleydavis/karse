import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    TextField,
    List,
    ListItemButton,
    ListItemText,
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

// Props for the QuickPicker dialog.
type Props = {
    open: boolean;
    onClose: () => void;
};

// Compact row for a single selectable item in the quick picker.
function PickerRow({
    label,
    sublabel,
    active,
    onClick,
    testId,
}: {
    label: string;
    sublabel?: string;
    active: boolean;
    onClick: () => void;
    testId?: string;
}) {
    return (
        <ListItemButton selected={active} onClick={onClick} data-test-id={testId}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {active && (
                    <FontAwesomeIcon icon={["fas", "circle-check"]} />
                )}
                <ListItemText
                    primary={label}
                    secondary={sublabel}
                />
            </Box>
        </ListItemButton>
    );
}

// Section heading inside the quick picker.
function SectionLabel({ text }: { text: string }) {
    return (
        <Box sx={{ px: 2, py: 0.5 }}>
            <Typography variant="overline" color="text.secondary">
                {text}
            </Typography>
        </Box>
    );
}

// Modal dialog for quickly switching context or tab-local namespace.
// Opened via the header button or the Ctrl+K keyboard shortcut.
// A single search input filters both contexts and namespaces; both are sorted A-Z.
export function QuickPicker({ open, onClose }: Props) {
    const { contexts, current: currentContext, switchTo } = useKubeContext();
    const { namespace: currentNamespace, setNamespace } = useKubeNamespace();
    const [query, setQuery] = useState("");

    // Clear the search input each time the dialog opens.
    useEffect(() => {
        if (open) {
            setQuery("");
        }
    }, [open]);

    const { data: nsData, isLoading: nsLoading } = useQuery({
        queryKey: ["namespaces", currentContext],
        queryFn: () => fetchNamespaces(currentContext!),
        enabled: currentContext !== null && open,
    });

    const q = query.toLowerCase();

    const filteredContexts = contexts
        .filter((c) => c.name.toLowerCase().includes(q))
        .sort((a, b) => a.name.localeCompare(b.name));

    const filteredNamespaces = (nsData?.namespaces ?? [])
        .filter((ns) => ns.name.toLowerCase().includes(q))
        .sort((a, b) => a.name.localeCompare(b.name));

    function handleContextSelect(name: string): void {
        switchTo(name);
        onClose();
    }

    function handleNamespaceSelect(name: string): void {
        setNamespace(name);
        onClose();
    }

    function handleClearNamespace(): void {
        setNamespace(null);
        onClose();
    }

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth data-test-id="quick-picker-dialog">
            <DialogContent sx={{ p: 0 }}>
                <Box sx={{ p: 2 }}>
                    <TextField
                        autoFocus
                        fullWidth
                        size="small"
                        placeholder="Search contexts and namespaces..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        data-test-id="quick-picker-search"
                        slotProps={{
                            input: {
                                startAdornment: (
                                    <FontAwesomeIcon
                                        icon={["fas", "magnifying-glass"]}
                                        style={{ marginRight: 8 }}
                                    />
                                ),
                            },
                        }}
                    />
                </Box>
                <Divider />
                <Box sx={{ maxHeight: 400, overflow: "auto" }}>
                    <SectionLabel text="Contexts" />
                    {filteredContexts.length === 0 && (
                        <Typography sx={{ px: 2, pb: 1 }} color="text.secondary" variant="body2">
                            No contexts match.
                        </Typography>
                    )}
                    {filteredContexts.length > 0 && (
                        <List dense disablePadding>
                            {filteredContexts.map((ctx) => (
                                <PickerRow
                                    key={ctx.name}
                                    label={ctx.name}
                                    sublabel={ctx.cluster}
                                    active={ctx.name === currentContext}
                                    onClick={() => handleContextSelect(ctx.name)}
                                    testId="quick-picker-context-row"
                                />
                            ))}
                        </List>
                    )}
                    <Divider sx={{ my: 1 }} />
                    <SectionLabel text="Namespaces" />
                    {currentContext !== null && currentNamespace !== null && (
                        <List dense disablePadding>
                            <PickerRow
                                label="All namespaces"
                                sublabel="Clear namespace selection"
                                active={false}
                                onClick={handleClearNamespace}
                                testId="quick-picker-clear-namespace"
                            />
                        </List>
                    )}
                    {currentContext === null && (
                        <Typography sx={{ px: 2, pb: 1 }} color="text.secondary" variant="body2">
                            Select a context first.
                        </Typography>
                    )}
                    {currentContext !== null && nsLoading && (
                        <Box sx={{ px: 2, pb: 1 }}>
                            <CircularProgress size={16} />
                        </Box>
                    )}
                    {currentContext !== null && !nsLoading && filteredNamespaces.length === 0 && (
                        <Typography sx={{ px: 2, pb: 1 }} color="text.secondary" variant="body2">
                            No namespaces match.
                        </Typography>
                    )}
                    {currentContext !== null && !nsLoading && filteredNamespaces.length > 0 && (
                        <List dense disablePadding>
                            {filteredNamespaces.map((ns) => (
                                <PickerRow
                                    key={ns.name}
                                    label={ns.name}
                                    active={ns.name === currentNamespace}
                                    onClick={() => handleNamespaceSelect(ns.name)}
                                    testId="quick-picker-namespace-row"
                                />
                            ))}
                        </List>
                    )}
                </Box>
            </DialogContent>
        </Dialog>
    );
}
