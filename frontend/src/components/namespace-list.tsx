import { useState } from "react";
import {
    Box,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    Chip,
    Button,
    Typography,
    CircularProgress,
    Alert,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { Namespace } from "karse-types";

// Sort direction for the namespace list.
type SortDir = "asc" | "desc";

// Props for the NamespaceList component.
type Props = {
    namespaces: Namespace[];
    selected: string | null;
    globalDefault: string | null;
    isLoading: boolean;
    error: Error | null;
    onSelect: (name: string) => void;
    onSetGlobal?: (name: string) => void;
};

// Filterable, sortable list of namespaces with tab-selection and optional terminal-default actions.
// Manages its own filter and sort state internally.
export function NamespaceList({ namespaces, selected, globalDefault, isLoading, error, onSelect, onSetGlobal }: Props) {
    const [filter, setFilter] = useState("");
    const [sortDir, setSortDir] = useState<SortDir>("asc");

    if (isLoading) {
        return <CircularProgress size={24} />;
    }

    if (error) {
        return <Alert severity="error">{error.message}</Alert>;
    }

    const filtered = namespaces
        .filter((ns) => ns.name.toLowerCase().includes(filter.toLowerCase()))
        .sort((a, b) => {
            if (sortDir === "asc") {
                return a.name.localeCompare(b.name);
            }
            return b.name.localeCompare(a.name);
        });

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }} data-test-id="namespaces-list">
            <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                <TextField
                    size="small"
                    placeholder="Filter namespaces..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    data-test-id="namespaces-filter"
                    sx={{ flexGrow: 1 }}
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
                <ToggleButtonGroup
                    value={sortDir}
                    exclusive
                    onChange={(_e, v) => {
                        if (v !== null) {
                            setSortDir(v);
                        }
                    }}
                    size="small"
                >
                    <ToggleButton value="asc">A-Z</ToggleButton>
                    <ToggleButton value="desc">Z-A</ToggleButton>
                </ToggleButtonGroup>
            </Box>
            {filtered.length === 0 && (
                <Typography color="text.secondary" data-test-id="no-namespaces-found">
                    No namespaces found.
                </Typography>
            )}
            {filtered.length > 0 && (
                <List dense disablePadding>
                    {filtered.map((ns) => (
                        <ListItem
                            key={ns.name}
                            disablePadding
                            secondaryAction={
                                onSetGlobal !== undefined ? (
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={() => onSetGlobal(ns.name)}
                                        disabled={globalDefault === ns.name}
                                    >
                                        {globalDefault === ns.name ? "Terminal default" : "Set terminal default"}
                                    </Button>
                                ) : undefined
                            }
                        >
                            <ListItemButton
                                selected={selected === ns.name}
                                onClick={() => onSelect(ns.name)}
                                sx={{ pr: onSetGlobal !== undefined ? 20 : 2 }}
                                data-test-id="namespace-row"
                            >
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
                                    {selected === ns.name && (
                                        <FontAwesomeIcon icon={["fas", "circle-check"]} />
                                    )}
                                    <ListItemText primary={ns.name} />
                                    {globalDefault === ns.name && (
                                        <Chip label="terminal default" size="small" />
                                    )}
                                </Box>
                            </ListItemButton>
                        </ListItem>
                    ))}
                </List>
            )}
        </Box>
    );
}
