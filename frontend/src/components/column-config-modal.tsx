import { useState } from "react";
import type React from "react";
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
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
    closestCenter,
    useDroppable,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTableColumns, faXmark, faGripVertical } from "@fortawesome/free-solid-svg-icons";
import type { ColumnConfig, ConfigurableColumn } from "../lib/column-config";

// Which section of the modal a draggable item currently lives in.
type Section = "visible" | "hidden";

// The visual presentation of a column row, shared by the in-list sortable item and the drag
// overlay so the preview that follows the cursor looks identical to the row being dragged. The
// optional `ref`, drag props, and style let the sortable wrapper hook it up to dnd-kit; the
// overlay renders it plain (no ref/listeners) since the overlay itself follows the cursor.
function ColumnRow({
    column,
    section,
    setNodeRef,
    style,
    dragProps,
    overlay = false,
}: {
    column: ConfigurableColumn;
    section?: Section;
    setNodeRef?: (node: HTMLElement | null) => void;
    style?: React.CSSProperties;
    dragProps?: React.HTMLAttributes<HTMLElement>;
    overlay?: boolean;
}) {
    return (
        <ListItem
            ref={setNodeRef}
            style={style}
            {...dragProps}
            data-test-id={`column-config-item-${column.id}`}
            data-section={section}
            sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                mb: 0.5,
                cursor: overlay ? "grabbing" : "grab",
                bgcolor: "background.paper",
                gap: 1,
                touchAction: "none",
                // The overlay copy floats above the modal; give it a shadow so the preview
                // reads as "lifted" while it crosses between sections.
                boxShadow: overlay ? 4 : "none",
            }}
        >
            <FontAwesomeIcon icon={faGripVertical} style={{ opacity: 0.5 }} />
            <Typography variant="body2">{column.label}</Typography>
        </ListItem>
    );
}

// A single sortable column row in the modal. Wired to dnd-kit's useSortable so it can be
// dragged to reorder within its section or moved to the other section. Carries its id as the
// sortable id so the drag-end handler can resolve what was dragged and where it landed.
function ColumnItem({
    column,
    section,
}: {
    column: ConfigurableColumn;
    section: Section;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: column.id,
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        // While dragging, the original row is hidden because the DragOverlay renders the
        // moving preview; this avoids showing two copies of the row at once.
        opacity: isDragging ? 0 : 1,
    };

    return (
        <ColumnRow
            column={column}
            section={section}
            setNodeRef={setNodeRef}
            style={style}
            dragProps={{ ...attributes, ...listeners }}
        />
    );
}

// A drop-target section (Visible or Hidden) holding a sortable list of column items. Registered
// as a dnd-kit droppable so a column can be dropped onto the section's empty area (appending it),
// and wraps its items in a SortableContext so they can be reordered among themselves.
function ColumnSection({
    title,
    section,
    columns,
}: {
    title: string;
    section: Section;
    columns: ConfigurableColumn[];
}) {
    const { setNodeRef } = useDroppable({
        id: `section-${section}`,
    });

    return (
        <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {title}
            </Typography>
            <SortableContext items={columns.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                <Paper
                    ref={setNodeRef}
                    variant="outlined"
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
                            <ColumnItem key={column.id} column={column} section={section} />
                        ))}
                    </List>
                </Paper>
            </SortableContext>
        </Box>
    );
}

// Modal that lets the user configure a table's columns: a Visible section (ordered,
// drag-to-reorder) and a Hidden section. Columns drag between the two sections via dnd-kit.
// Changes are applied immediately via onChange so the table updates live; the config is
// persisted by the caller's hook.
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
    // dnd-kit sensors: pointer for mouse/touch, keyboard for accessible drag-and-drop.
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    // The id of the column currently being dragged, or null when nothing is dragging. It drives
    // the DragOverlay, which renders a free-floating copy of the row that follows the cursor.
    // Without the overlay, dnd-kit's sortable transform only animates the dragged row within its
    // own SortableContext, so dragging a column to the OTHER section showed no preview; the
    // overlay lifts the row out so the same preview follows the cursor across both sections.
    const [activeId, setActiveId] = useState<string | null>(null);
    const activeColumn = activeId === null ? undefined : columnById(activeId);

    function handleDragStart(event: DragStartEvent): void {
        setActiveId(String(event.active.id));
    }

    function handleDragCancel(): void {
        setActiveId(null);
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

    // Resolves which section a drop target belongs to. A target is either a section's droppable
    // id (`section-visible`/`section-hidden`) or another column's id (dropped onto that item).
    function sectionOf(overId: string): Section | null {
        if (overId === "section-visible") {
            return "visible";
        }
        if (overId === "section-hidden") {
            return "hidden";
        }
        if (hiddenSet.has(overId)) {
            return "hidden";
        }
        if (config.order.includes(overId)) {
            return "visible";
        }
        return null;
    }

    // Rebuilds the config when a drag ends, placing the dragged column into the section it was
    // dropped on, ordered immediately before the column it was dropped onto (or at the end when
    // dropped on a section's empty area).
    function handleDragEnd(event: DragEndEvent): void {
        setActiveId(null);
        const { active, over } = event;
        if (over === null) {
            return;
        }
        const dragId = String(active.id);
        const overId = String(over.id);
        const targetSection = sectionOf(overId);
        if (targetSection === null) {
            return;
        }
        // A column dropped onto another column lands immediately before it; one dropped onto a
        // section's empty area is appended to the end of the order.
        const beforeId = overId === `section-${targetSection}` ? null : overId;

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
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragCancel={handleDragCancel}
                >
                    <Box sx={{ display: "flex", gap: 2 }}>
                        <ColumnSection title="Visible" section="visible" columns={visibleColumns} />
                        <ColumnSection title="Hidden" section="hidden" columns={hiddenColumns} />
                    </Box>
                    {/* The floating preview that follows the cursor during a drag. Rendering it
                        here (outside both SortableContexts) is what makes the preview appear for
                        cross-section drags, not just within-section reorders. */}
                    <DragOverlay>
                        {activeColumn === undefined
                            ? null
                            : <ColumnRow column={activeColumn} overlay />}
                    </DragOverlay>
                </DndContext>
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
