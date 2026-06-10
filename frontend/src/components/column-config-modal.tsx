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
    pointerWithin,
    rectIntersection,
    useDroppable,
} from "@dnd-kit/core";
import type { CollisionDetection, DragEndEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/core";
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

    // Collision detection tuned for two side-by-side droppable sections. `closestCenter` alone is
    // unstable here: while the cursor sits near the boundary it can flip the resolved target back
    // and forth between a column in one section and a column in the other, which (because drag-over
    // relocates the dragged column on each flip) makes the lists oscillate and a drop onto the empty
    // section never settle. `pointerWithin`/`rectIntersection` resolve which SECTION the pointer is
    // actually inside first (stable per pointer position); we then defer to `closestCenter` to pick
    // the row within that section so the within-section gap still tracks the cursor.
    const collisionDetection: CollisionDetection = (args) => {
        const within = pointerWithin(args);
        const intersections = within.length > 0 ? within : rectIntersection(args);
        if (intersections.length === 0) {
            return closestCenter(args);
        }
        // Prefer a column collision when the pointer is over one; else fall back to the section.
        const overColumn = intersections.find((c) => !String(c.id).startsWith("section-"));
        return overColumn === undefined ? intersections : [overColumn];
    };

    // The id of the column currently being dragged, or null when nothing is dragging. It drives
    // the DragOverlay, which renders a free-floating copy of the row that follows the cursor.
    // Without the overlay, dnd-kit's sortable transform only animates the dragged row within its
    // own SortableContext, so dragging a column to the OTHER section showed no preview; the
    // overlay lifts the row out so the same preview follows the cursor across both sections.
    const [activeId, setActiveId] = useState<string | null>(null);

    // The in-flight configuration while a drag is in progress, recomputed on every drag-over so
    // the lists re-render with the dragged column already moved to where it would land. This is
    // what produces the drop-target indicator: the sortable strategy shifts the other rows to
    // open a gap at the insertion point, and the dragged row's original slot collapses (it is
    // hidden via opacity while the overlay follows the cursor). It is null when not dragging, in
    // which case the committed `config` drives the lists. Cleared on drag end/cancel.
    const [dragConfig, setDragConfig] = useState<ColumnConfig | null>(null);

    // While dragging, render from the in-flight config so the gap/indicator tracks the cursor;
    // otherwise render from the committed config.
    const viewConfig = dragConfig ?? config;
    const activeColumn = activeId === null ? undefined : columnById(activeId);

    function handleDragStart(event: DragStartEvent): void {
        setActiveId(String(event.active.id));
        setDragConfig(config);
    }

    function handleDragCancel(): void {
        setActiveId(null);
        setDragConfig(null);
    }

    // Look up a configurable column by id.
    function columnById(id: string): ConfigurableColumn | undefined {
        return configurable.find((c) => c.id === id);
    }

    const viewHiddenSet = new Set(viewConfig.hidden);
    const visibleColumns = viewConfig.order
        .filter((id) => !viewHiddenSet.has(id))
        .map(columnById)
        .filter((c): c is ConfigurableColumn => c !== undefined);
    const hiddenColumns = viewConfig.order
        .filter((id) => viewHiddenSet.has(id))
        .map(columnById)
        .filter((c): c is ConfigurableColumn => c !== undefined);

    // Resolves which section a drop target belongs to, against a given config. A target is either
    // a section's droppable id (`section-visible`/`section-hidden`) or another column's id
    // (dropped onto that item).
    function sectionOf(overId: string, against: ColumnConfig): Section | null {
        if (overId === "section-visible") {
            return "visible";
        }
        if (overId === "section-hidden") {
            return "hidden";
        }
        if (against.hidden.includes(overId)) {
            return "hidden";
        }
        if (against.order.includes(overId)) {
            return "visible";
        }
        return null;
    }

    // Which section a column currently sits in, per a given config.
    function sectionOfColumn(id: string, against: ColumnConfig): Section {
        return against.hidden.includes(id) ? "hidden" : "visible";
    }

    // Returns the column ids of `targetSection` within `against`, in display order.
    function idsInSection(against: ColumnConfig, targetSection: Section): string[] {
        const hiddenSet = new Set(against.hidden);
        return against.order.filter((id) =>
            targetSection === "hidden" ? hiddenSet.has(id) : !hiddenSet.has(id),
        );
    }

    // Places `dragId` into `targetSection` at the slot indicated by `overId`, returning a new
    // config. `overId` is either the section's droppable id (drop on the bare area → append to the
    // end of that section) or another column's id (drop onto that item → take its slot).
    //
    // `isReorder` distinguishes the two gestures, because they place differently relative to the over
    // column and must match what the user saw:
    //   - A genuine WITHIN-section reorder (the column started in this section) mirrors dnd-kit's
    //     verticalListSortingStrategy: arrayMove to the over column's index, so a downward move lands
    //     AFTER the over column and an upward move BEFORE it — matching the strategy's animated gap.
    //   - A CROSS-section move inserts BEFORE the over column (the cursor's insertion point), so the
    //     column lands exactly where the gap showed and not at the end. Crucially this is judged from
    //     the column's ORIGINAL section (in the committed config), not its in-flight position: during
    //     a cross move drag-over parks the column in the target section, so judging by the in-flight
    //     position would wrongly treat the drop as a within-section reorder and arrayMove it past the
    //     over column (the reported "lands at the end" bug).
    // The result keeps `order` as the single source of truth for display order and only lists hidden
    // ids in `hidden`. Pure.
    function placeInSection(base: ColumnConfig, dragId: string, targetSection: Section, overId: string, isReorder: boolean): ColumnConfig {
        // Over the dragged column itself: it is already where it should be, so leave `base` as-is
        // rather than re-inserting (which would otherwise append it to the end).
        if (overId === dragId) {
            return base;
        }
        // Section list WITH the dragged column (if already here) so we can mirror arrayMove's
        // index-based move; otherwise the list of the other members to insert into.
        const fullSectionIds = idsInSection(base, targetSection);
        const sectionIds = fullSectionIds.filter((id) => id !== dragId);
        let insertAt: number;
        if (overId === `section-${targetSection}`) {
            insertAt = sectionIds.length;
        }
        else if (isReorder && fullSectionIds.includes(dragId)) {
            // Within-section reorder: mirror arrayMove(items, from, overIndex). The destination
            // index is the over column's index in the list that STILL contains the dragged column,
            // so a downward move lands AFTER the over column and an upward move lands BEFORE it,
            // matching the strategy's center-crossing animation.
            const overIdx = fullSectionIds.indexOf(overId);
            insertAt = overIdx === -1 ? sectionIds.length : sectionIds.indexOf(overId) + (overIdx > fullSectionIds.indexOf(dragId) ? 1 : 0);
        }
        else {
            // Cross-section move: insert before the over column.
            const idx = sectionIds.indexOf(overId);
            insertAt = idx === -1 ? sectionIds.length : idx;
        }
        sectionIds.splice(insertAt, 0, dragId);

        // Rebuild the full order: the other section's ids in their existing relative order,
        // spliced together with the rebuilt target section. We preserve the original interleaving
        // of the two sections by walking the old order and substituting the rebuilt target run.
        const otherSection: Section = targetSection === "hidden" ? "visible" : "hidden";
        const otherIds = idsInSection(base, otherSection).filter((id) => id !== dragId);

        // Visible columns come first, then hidden (the modal shows them as two lists; order within
        // each is what matters and is what we persist).
        const order = targetSection === "visible" ? [...sectionIds, ...otherIds] : [...otherIds, ...sectionIds];
        const hidden = targetSection === "hidden" ? sectionIds : otherIds.filter((id) => base.hidden.includes(id));

        return {
            order,
            hidden: hidden.filter((id) => order.includes(id)),
        };
    }

    // True when two configs describe the same display order and hidden set.
    function sameConfig(a: ColumnConfig, b: ColumnConfig): boolean {
        if (a.order.length !== b.order.length || a.hidden.length !== b.hidden.length) {
            return false;
        }
        return a.order.every((id, i) => id === b.order[i]) && a.hidden.every((id, i) => id === b.hidden[i]);
    }

    // Live placement for a CROSS-section move: keep the dragged column parked in the OTHER section at
    // the cursor's current insertion point so the gap there tracks the cursor and the drop matches
    // it. We treat the gesture as cross-section for the whole drag based on the column's ORIGINAL
    // section in the committed `config` (not its in-flight position, which we keep moving), so:
    //   - Over a ROW in the destination: re-insert the column before that row (the cursor's insertion
    //     point). We do this every time the over row changes so the gap follows the cursor.
    //   - Over the destination's BARE area (an empty section, or below all rows): append to the END.
    //     This is the only way to preview/land at the end of the destination list, so we must honour
    //     it rather than ignore it. The `sameConfig` guard below drops no-op updates, so re-placing
    //     at the end when the column is already at the end is a no-op and an empty section cannot
    //     loop (placing the sole column at index 0 reproduces the same config every time).
    // A genuine WITHIN-section reorder is left entirely to dnd-kit's verticalListSortingStrategy
    // (mutating the array on every move would fight the strategy and oscillate); `handleDragEnd`
    // resolves that final slot.
    function handleDragOver(event: DragOverEvent): void {
        const { active, over } = event;
        if (over === null) {
            return;
        }
        const dragId = String(active.id);
        const overId = String(over.id);
        // Within-section reorder (column started in the section it is now over): leave it to the
        // strategy. Compared against the committed config so a parked cross-move is still "cross".
        const originSection = sectionOfColumn(dragId, config);
        setDragConfig((current) => {
            const base = current ?? config;
            const targetSection = sectionOf(overId, base);
            if (targetSection === null || targetSection === originSection) {
                return base;
            }
            const next = placeInSection(base, dragId, targetSection, overId, false);
            return sameConfig(next, base) ? base : next;
        });
    }

    // Commits the placement when the drag ends, resolving the FINAL slot from `over` so the committed
    // result matches the gap the user saw. The reported bug was that a cross-section drop appended to
    // the END of the destination instead of landing at the cursor's insertion point. The fixes:
    //   - The custom collision detection resolves `over` to the row under the cursor (not the section
    //     droppable) whenever the pointer is over a row, so the drop targets that row's slot.
    //   - `isReorder` is judged from the column's ORIGINAL section in the committed `config` (not its
    //     in-flight position, which drag-over may have parked in the target section): a true reorder
    //     uses arrayMove semantics; a cross-section move inserts BEFORE the over row, landing exactly
    //     where the gap pointed instead of arrayMove-ing it past the row to the end.
    //   - When `over` IS the section droppable (the cursor sits below all rows / in the bare area), we
    //     keep the column where drag-over already previewed it in `base` — for a cross-section move
    //     drag-over has parked it at the END of the destination, so the drop lands at the end, matching
    //     the gap the user saw there.
    function handleDragEnd(event: DragEndEvent): void {
        const { active, over } = event;
        const base = dragConfig ?? config;
        setActiveId(null);
        setDragConfig(null);
        if (over === null) {
            return;
        }
        const dragId = String(active.id);
        const overId = String(over.id);
        const targetSection = sectionOf(overId, base);
        if (targetSection === null) {
            return;
        }
        const isReorder = sectionOfColumn(dragId, config) === targetSection;
        const next = overId === `section-${targetSection}`
            ? base
            : placeInSection(base, dragId, targetSection, overId, isReorder);
        if (!sameConfig(next, config)) {
            onChange(next);
        }
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
                    collisionDetection={collisionDetection}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
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
