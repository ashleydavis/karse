import { useState } from "react";
import {
    Chip,
    Typography,
    Dialog,
    DialogTitle,
    DialogContent,
    IconButton,
    TextField,
    Box,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faXmark } from "@fortawesome/free-solid-svg-icons";
import { labelsToPairs } from "./labels-cell-pairs";

// The most key=value chips shown inline in a table row before the rest are
// hidden behind the "..." control. Keeps the row height fixed no matter how many
// labels a resource carries (a real cluster pod can have dozens), instead of
// letting chips wrap and push the row off-screen.
const MAX_INLINE_CHIPS = 3;

// A searchable modal listing every label on a resource as key=value chips. Opened
// from the LabelsCell "..." control so the full set is reachable even when the row
// only shows the first few. The search box filters by substring on the rendered
// key=value text, matching what the table's own fuzzy search indexes.
function LabelsModal({
    open,
    onClose,
    pairs,
}: {
    open: boolean;
    onClose: () => void;
    pairs: string[];
}) {
    const [query, setQuery] = useState("");
    const q = query.toLowerCase();
    const filtered = pairs.filter((pair) => pair.toLowerCase().includes(q));
    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            // Stop clicks inside the modal (which renders in a portal) from being
            // treated as a click on the underlying table row.
            onClick={(e) => e.stopPropagation()}
            data-test-id="labels-modal"
        >
            <DialogTitle sx={{ pr: 6 }}>
                Labels ({pairs.length})
                <IconButton
                    aria-label="close"
                    onClick={onClose}
                    sx={{
                        position: "absolute",
                        right: 8,
                        top: 8,
                    }}
                    data-test-id="labels-modal-close"
                >
                    <FontAwesomeIcon icon={faXmark} />
                </IconButton>
            </DialogTitle>
            <DialogContent>
                <TextField
                    autoFocus
                    fullWidth
                    size="small"
                    placeholder="Search labels..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    data-test-id="labels-modal-search"
                    slotProps={{
                        input: {
                            startAdornment: (
                                <FontAwesomeIcon icon={faMagnifyingGlass} style={{ marginRight: 8 }} />
                            ),
                        },
                    }}
                />
                <Box
                    sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 0.5,
                        mt: 2,
                    }}
                    data-test-id="labels-modal-list"
                >
                    {filtered.length === 0 && (
                        <Typography color="text.secondary" variant="body2">
                            No labels match.
                        </Typography>
                    )}
                    {filtered.map((pair) => (
                        <Chip key={pair} label={pair} size="small" variant="outlined" data-test-id="labels-modal-chip" />
                    ))}
                </Box>
            </DialogContent>
        </Dialog>
    );
}

// Renders a resource's labels as compact "key=value" chips for a table Labels
// column. Shows a muted dash when the resource carries no labels. To keep the row
// height fixed regardless of label count, only the first few chips are shown
// inline; a "..." control opens a searchable modal listing every label. Used
// across every resource list (pods, nodes, deployments, statefulsets, daemonsets,
// namespaces) so the Labels column behaves the same everywhere.
export function LabelsCell({ labels }: { labels: Record<string, string> | undefined | null }) {
    const [open, setOpen] = useState(false);
    const pairs = labelsToPairs(labels);
    if (pairs.length === 0) {
        return <Typography component="span" color="text.secondary">-</Typography>;
    }
    const visible = pairs.slice(0, MAX_INLINE_CHIPS);
    const hiddenCount = pairs.length - visible.length;
    return (
        <span
            style={{
                display: "inline-flex",
                flexWrap: "nowrap",
                alignItems: "center",
                gap: 4,
                maxWidth: "100%",
                overflow: "hidden",
            }}
            data-test-id="labels-cell"
        >
            {visible.map((pair) => (
                <Chip key={pair} label={pair} size="small" variant="outlined" />
            ))}
            {hiddenCount > 0 && (
                <Chip
                    label={`+${hiddenCount} ...`}
                    size="small"
                    variant="outlined"
                    clickable
                    onClick={(e) => {
                        // Don't let the click bubble to the (clickable) table row.
                        e.stopPropagation();
                        setOpen(true);
                    }}
                    data-test-id="labels-cell-more"
                />
            )}
            <LabelsModal open={open} onClose={() => setOpen(false)} pairs={pairs} />
        </span>
    );
}
