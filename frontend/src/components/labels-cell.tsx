import { useState } from "react";
import { Chip, Typography } from "@mui/material";
import { labelsToPairs } from "./labels-cell-pairs";
import { LabelsModal } from "./labels-modal";

// The most key=value chips shown inline in a table row before the rest are
// hidden behind the "..." control. Keeps the row height fixed no matter how many
// labels a resource carries (a real cluster pod can have dozens), instead of
// letting chips wrap and push the row off-screen.
const MAX_INLINE_CHIPS = 3;

// Renders a resource's labels as compact "key=value" chips for a table Labels
// column. Shows a muted dash when the resource carries no labels. To keep the row
// height fixed regardless of label count, only the first few chips are shown
// inline; a "..." control opens the shared LabelsModal listing every label as a
// searchable, sortable table. Used across every resource list (pods, nodes,
// deployments, stateful sets, daemon sets, namespaces, autoscalers,
// all-resources), so that one modal is how labels are read in full everywhere.
// resourceKind/resourceName identify the row's resource so the modal it opens can
// name whose labels are shown.
export function LabelsCell({
    labels,
    resourceKind,
    resourceName,
}: {
    labels: Record<string, string> | undefined | null;
    resourceKind?: string;
    resourceName?: string;
}) {
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
            <LabelsModal
                open={open}
                onClose={() => setOpen(false)}
                labels={labels}
                resourceKind={resourceKind}
                resourceName={resourceName}
            />
        </span>
    );
}
