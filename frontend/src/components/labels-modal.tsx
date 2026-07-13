import {
    Dialog,
    DialogTitle,
    DialogContent,
    IconButton,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { buildLabelRows, labelsModalTitle } from "../lib/label-rows";
import { LabelsTable } from "./labels-table";

// The reusable modal listing every label on one resource as a searchable,
// sortable Key / Value table. Opened from the "..." control on a truncated
// Labels cell, so the full label set stays reachable from any resource table
// even though the row only shows the first few chips.
//
// It takes a plain labels map plus the opening resource's kind and name, so the
// single instance serves every resource that carries labels (pods, nodes,
// deployments, stateful sets, daemon sets, namespaces, autoscalers, and the
// combined all-resources table) while its title bar still names whose labels are
// shown. MUI's Dialog gives Escape-to-dismiss and focus trapping, so keyboard
// dismissal needs no extra handling.
export function LabelsModal({
    open,
    onClose,
    labels,
    resourceKind,
    resourceName,
}: {
    open: boolean;
    onClose: () => void;
    labels: Record<string, string> | undefined | null;
    // The kind (e.g. "Pod", "Node") and name of the resource whose labels these
    // are, used to title the modal so the viewer knows whose labels they see.
    // Optional so the modal still works when no identity is supplied.
    resourceKind?: string;
    resourceName?: string;
}) {
    const count = buildLabelRows(labels).length;
    const title = labelsModalTitle(resourceKind, resourceName, count);
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
            <DialogTitle sx={{ pr: 6 }} data-test-id="labels-modal-title">
                {title}
                <IconButton
                    aria-label="close labels"
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
                <LabelsTable labels={labels} />
            </DialogContent>
        </Dialog>
    );
}
