import { useState } from "react";
import {
    Box,
    Button,
    TextField,
    Typography,
    Checkbox,
    FormControlLabel,
    Popover,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { filterPods } from "../lib/filter-pods";
import type { Pod } from "karse-types";

// Props for the shared Pod filter. `pods` are the pods to choose from; `search`
// is the current search-box text and `onSearchChange` updates it (the box filters
// the checkbox list, and a consumer may also use it as a substring filter on its
// own rows); `selectedPods` are the pod names ticked in the list and
// `onTogglePod` flips one in or out; `onClear` empties the selection;
// `testIdPrefix` namespaces the data-test-id attributes so each use site is
// addressable. While a pod is ticked the search box is disabled so the full list
// stays visible, matching the Logs page behaviour this component was lifted from.
type PodFilterProps = {
    pods: Pod[];
    search: string;
    onSearchChange: (value: string) => void;
    selectedPods: string[];
    onTogglePod: (name: string) => void;
    onClear: () => void;
    testIdPrefix: string;
};

// The shared, searchable pod picker used by the Logs page and the node
// Provisioning subtab. Clicking the trigger drops a search box and a filterable
// checkbox list of pods below it as an overlay; ticking pods narrows whatever the
// consumer scopes by them, and the search box filters the list (and, with nothing
// ticked, doubles as a free-text pod-name filter the consumer can read). This is
// the single component both call sites use, so the picker behaves identically in
// both places.
export function PodFilter({
    pods,
    search,
    onSearchChange,
    selectedPods,
    onTogglePod,
    onClear,
    testIdPrefix,
}: PodFilterProps) {
    // The dropdown's anchor element. Non-null while the dropdown is open, so the
    // search box and checkbox list drop down below the trigger as an overlay.
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);
    const open = anchor !== null;

    // The list is narrowed to pods matching the search box. When pods are
    // explicitly ticked the search box is disabled, so the full list shows.
    const visiblePods = selectedPods.length > 0 ? pods : filterPods(pods, search);

    return (
        <Box data-test-id={`${testIdPrefix}-pod-picker`}>
            <Button
                variant="outlined"
                onClick={(e) => setAnchor(e.currentTarget)}
                data-test-id={`${testIdPrefix}-picker-trigger`}
                startIcon={<FontAwesomeIcon icon={faMagnifyingGlass} />}
                endIcon={<FontAwesomeIcon icon={faChevronDown} />}
                sx={{ minWidth: 220, justifyContent: "space-between", textTransform: "none" }}
            >
                {selectedPods.length > 0
                    ? `${selectedPods.length} pod(s) selected`
                    : search.trim() !== ""
                      ? `Search: ${search}`
                      : "Search pods..."}
            </Button>

            <Popover
                open={open}
                anchorEl={anchor}
                onClose={() => setAnchor(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                transformOrigin={{ vertical: "top", horizontal: "left" }}
                data-test-id={`${testIdPrefix}-pod-dropdown`}
                slotProps={{ paper: { sx: { width: 320, p: 1, display: "flex", flexDirection: "column", gap: 1 } } }}
            >
                <TextField
                    size="small"
                    placeholder="Search pods..."
                    value={search}
                    autoFocus
                    onChange={(e) => onSearchChange(e.target.value)}
                    disabled={selectedPods.length > 0}
                    data-test-id={`${testIdPrefix}-search`}
                    fullWidth
                    slotProps={{
                        input: {
                            startAdornment: (
                                <FontAwesomeIcon icon={faMagnifyingGlass} style={{ marginRight: 8 }} />
                            ),
                        },
                    }}
                />

                <Box
                    data-test-id={`${testIdPrefix}-pod-list`}
                    sx={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column" }}
                >
                    {visiblePods.length === 0 ? (
                        <Typography variant="caption" color="text.secondary" sx={{ p: 0.5 }}>
                            No pods match.
                        </Typography>
                    ) : (
                        visiblePods.map((pod) => (
                            <FormControlLabel
                                key={`${pod.namespace}/${pod.name}`}
                                data-test-id={`${testIdPrefix}-pod-option`}
                                control={
                                    <Checkbox
                                        size="small"
                                        checked={selectedPods.includes(pod.name)}
                                        onChange={() => onTogglePod(pod.name)}
                                        data-test-id={`${testIdPrefix}-pod-checkbox`}
                                    />
                                }
                                label={<Typography variant="body2">{pod.name}</Typography>}
                            />
                        ))
                    )}
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Typography variant="caption" color="text.secondary" data-test-id={`${testIdPrefix}-selected-count`}>
                        {selectedPods.length} selected
                    </Typography>
                    <Button
                        size="small"
                        onClick={onClear}
                        disabled={selectedPods.length === 0}
                        data-test-id={`${testIdPrefix}-clear`}
                    >
                        Clear
                    </Button>
                </Box>
            </Popover>
        </Box>
    );
}
