import { useState, useRef } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    Box,
    Button,
    IconButton,
    Tooltip,
    Typography,
    Paper,
    List,
    ListItem,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTableColumns, faXmark, faGripVertical } from "@fortawesome/free-solid-svg-icons";
import type { ColumnConfig, ConfigurableColumn } from "../lib/column-config";

// Which section of the modal a draggable item currently lives in.
type Section = "visible" | "hidden";

// A single draggable column row in the modal. Carries its id so the drop handler can
// reorder/move it. Uses native HTML5 drag and drop (no extra dependency).
function ColumnItem({
    column,
    section,
    onDragStart,
    onDragOver,
    onDrop,
}: {
    column: ConfigurableColumn;
    section: Section;
    onDragStart: (id: string) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (targetId: string | null) => void;
}) {
    return (
        <ListItem
            draggable
            onDragStart={() => onDragStart(column.id)}
            onDragOver={onDragOver}
            onDrop={(e) => {
                e.stopPropagation();
                onDrop(column.id);
            }}
            data-test-id={`column-config-item-${column.id}`}
            data-section={section}
            sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                mb: 0.5,
                cursor: "grab",
                bgcolor: "background.paper",
                gap: 1,
            }}
        >
            <FontAwesomeIcon icon={faGripVertical} style={{ opacity: 0.5 }} />
            <Typography variant="body2">{column.label}</Typography>
        </ListItem>
    );
}

// A drop-target section (Visible or Hidden) holding an ordered list of column items.
// Dropping on the section's empty area appends the dragged column to the end.
function ColumnSection({
    title,
    section,
    columns,
    onDragStart,
    onDropOnItem,
    onDropOnSection,
}: {
    title: string;
    section: Section;
    columns: ConfigurableColumn[];
    onDragStart: (id: string) => void;
    onDropOnItem: (section: Section, targetId: string) => void;
    onDropOnSection: (section: Section) => void;
}) {
    function handleDragOver(e: React.DragEvent): void {
        e.preventDefault();
    }

    return (
        <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {title}
            </Typography>
            <Paper
                variant="outlined"
                onDragOver={handleDragOver}
                onDrop={() => onDropOnSection(section)}
                data-test-id={`column-config-section-${section}`}
                sx={{
                    p: 1,
                    minHeight: 200,
                    bgcolor: "action.hover",
                }}
            >
                <List dense disablePadding>
                    {columns.length === 0 && (
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ p: 1 }}
                            data-test-id={`column-config-empty-${section}`}
                        >
                            (none)
                        </Typography>
                    )}
                    {columns.map((column) => (
                        <ColumnItem
                            key={column.id}
                            column={column}
                            section={section}
                            onDragStart={onDragStart}
                            onDragOver={handleDragOver}
                            onDrop={(targetId) => {
                                if (targetId !== null) {
                                    onDropOnItem(section, targetId);
                                }
                            }}
                        />
                    ))}
                </List>
            </Paper>
        </Box>
    );
}

// Modal that lets the user configure a table's columns: a Visible section (ordered,
// drag-to-reorder) and a Hidden section. Columns drag between the two sections. Changes
// are applied immediately via onChange so the table updates live; the config is persisted
// by the caller's hook.
export function ColumnConfigModal({
    open,
    onClose,
    configurable,
    config,
    onChange,
}: {
    open: boolean;
    onClose: () => void;
    configurable: ConfigurableColumn[];
    config: ColumnConfig;
    onChange: (next: ColumnConfig) => void;
}) {
    // The id of the column currently being dragged, or null when no drag is in progress.
    // Held in a ref (not state) so the drop handler can read it synchronously within the
    // same render, even when dragstart and drop fire in the same tick.
    const dragIdRef = useRef<string | null>(null);

    // Records which column the user has begun dragging.
    function startDrag(id: string): void {
        dragIdRef.current = id;
    }

    // Look up a configurable column by id.
    function columnById(id: string): ConfigurableColumn | undefined {
        return configurable.find((c) => c.id === id);
    }

    const hiddenSet = new Set(config.hidden);
    const visibleColumns = config.order
        .filter((id) => !hiddenSet.has(id))
        .map(columnById)
        .filter((c): c is ConfigurableColumn => c !== undefined);
    const hiddenColumns = config.order
        .filter((id) => hiddenSet.has(id))
        .map(columnById)
        .filter((c): c is ConfigurableColumn => c !== undefined);

    // Rebuilds the config so the dragged column sits in `targetSection`, ordered
    // immediately before `beforeId` (or at the end when beforeId is null).
    function moveColumn(targetSection: Section, beforeId: string | null): void {
        const dragId = dragIdRef.current;
        if (dragId === null) {
            return;
        }
        // Build the new order: remove the dragged id, then reinsert it relative to beforeId.
        const order = config.order.filter((id) => id !== dragId);
        if (beforeId === null || beforeId === dragId) {
            order.push(dragId);
        }
        else {
            const idx = order.indexOf(beforeId);
            if (idx === -1) {
                order.push(dragId);
            }
            else {
                order.splice(idx, 0, dragId);
            }
        }
        // Update the hidden set to match the target section.
        const hidden = config.hidden.filter((id) => id !== dragId);
        if (targetSection === "hidden") {
            hidden.push(dragId);
        }
        onChange({
            order,
            hidden,
        });
        dragIdRef.current = null;
    }

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth data-test-id="column-config-modal">
            <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <FontAwesomeIcon icon={faTableColumns} />
                    <Typography component="span" sx={{ fontWeight: 600 }}>
                        Configure columns
                    </Typography>
                </Box>
                <Tooltip title="Close">
                    <IconButton size="small" onClick={onClose} aria-label="close column config" data-test-id="column-config-close">
                        <FontAwesomeIcon icon={faXmark} />
                    </IconButton>
                </Tooltip>
            </DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Drag columns to reorder them, or between sections to show or hide them.
                </Typography>
                <Box sx={{ display: "flex", gap: 2 }}>
                    <ColumnSection
                        title="Visible"
                        section="visible"
                        columns={visibleColumns}
                        onDragStart={startDrag}
                        onDropOnItem={(section, targetId) => moveColumn(section, targetId)}
                        onDropOnSection={(section) => moveColumn(section, null)}
                    />
                    <ColumnSection
                        title="Hidden"
                        section="hidden"
                        columns={hiddenColumns}
                        onDragStart={startDrag}
                        onDropOnItem={(section, targetId) => moveColumn(section, targetId)}
                        onDropOnSection={(section) => moveColumn(section, null)}
                    />
                </Box>
            </DialogContent>
        </Dialog>
    );
}

// A "Columns" button that opens the column-configuration modal for a table. Reusable across
// every resource table. The caller passes the configurable columns and the current config
// (from useColumnConfig) plus the change handler.
export function ColumnConfigButton({
    configurable,
    config,
    onChange,
}: {
    configurable: ConfigurableColumn[];
    config: ColumnConfig;
    onChange: (next: ColumnConfig) => void;
}) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <Button
                size="small"
                variant="outlined"
                startIcon={<FontAwesomeIcon icon={faTableColumns} />}
                onClick={() => setOpen(true)}
                data-test-id="column-config-button"
            >
                Columns
            </Button>
            {open && (
                <ColumnConfigModal
                    open={open}
                    onClose={() => setOpen(false)}
                    configurable={configurable}
                    config={config}
                    onChange={onChange}
                />
            )}
        </>
    );
}
