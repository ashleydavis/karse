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
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useKubeContext } from "../lib/kube-context";

type Props = {
    open: boolean;
    onClose: () => void;
};

export function ContextQuickPicker({ open, onClose }: Props) {
    const { contexts, current, switchTo } = useKubeContext();
    const [query, setQuery] = useState("");

    useEffect(() => {
        if (open) setQuery("");
    }, [open]);

    const q = query.toLowerCase();
    const filtered = contexts
        .filter((c) => c.name.toLowerCase().includes(q) || c.cluster.toLowerCase().includes(q))
        .sort((a, b) => a.name.localeCompare(b.name));

    function handleSelect(name: string): void {
        switchTo(name);
        onClose();
    }

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth data-test-id="context-quick-picker-dialog">
            <DialogContent sx={{ p: 0 }}>
                <Box sx={{ p: 2 }}>
                    <TextField
                        autoFocus
                        fullWidth
                        size="small"
                        placeholder="Search contexts..."
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
                    {filtered.length === 0 && (
                        <Typography sx={{ px: 2, py: 1 }} color="text.secondary" variant="body2">
                            No contexts match.
                        </Typography>
                    )}
                    <List dense disablePadding>
                        {filtered.map((ctx) => (
                            <ListItemButton
                                key={ctx.name}
                                selected={ctx.name === current}
                                onClick={() => handleSelect(ctx.name)}
                                data-test-id="context-quick-picker-row"
                            >
                                <ListItemText primary={ctx.name} secondary={ctx.cluster} />
                                {ctx.name === current && (
                                    <Chip label="active" size="small" color="primary" sx={{ ml: 1 }} />
                                )}
                            </ListItemButton>
                        ))}
                    </List>
                </Box>
            </DialogContent>
        </Dialog>
    );
}
