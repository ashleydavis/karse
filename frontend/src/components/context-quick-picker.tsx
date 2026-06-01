import { useState, useEffect } from "react";
import {
    Popover,
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
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import { useKubeContext } from "../lib/kube-context";

// Dropdown picker for switching kube contexts, anchored to the header button.
type Props = {
    anchorEl: HTMLElement | null;
    onClose: () => void;
};

// Renders the context picker as a nav-bar dropdown anchored to its trigger button.
export function ContextQuickPicker({ anchorEl, onClose }: Props) {
    const { contexts, current, switchTo } = useKubeContext();
    const [query, setQuery] = useState("");
    const open = anchorEl !== null;

    useEffect(() => {
        if (open) {
            setQuery("");
        }
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
        <Popover
            open={open}
            anchorEl={anchorEl}
            onClose={onClose}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            slotProps={{ paper: { sx: { width: 360 } } }}
        >
            <Box data-test-id="context-quick-picker-dropdown">
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
                                    <FontAwesomeIcon icon={faMagnifyingGlass} style={{ marginRight: 8 }} />
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
            </Box>
        </Popover>
    );
}
