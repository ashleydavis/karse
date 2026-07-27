import { useState } from "react";
import { TableRow, TableCell, Button, Typography } from "@mui/material";
import { flexRender, type Cell, type Column, type Row } from "@tanstack/react-table";
import { tableRowSx } from "../lib/table-row-style";
import { ACTIONS_COLUMN_ID, stickyActionsCellSx } from "../lib/sticky-actions";

// The props of the shared table row.
//
// `cells` is the row's visible cells, snapshotted by the parent at render time, rather than
// something the row reads from `row` itself, so the parent decides which cells a row shows.
//
// `cellSx` is the optional MUI sx applied to every cell of the row.
export interface DataTableRowProps<TData> {
    row: Row<TData>;
    cells: Cell<TData, any>[];
    testId: string;
    clickable: boolean;
    onOpen?: (original: TData) => void;
    cellSx?: any;
}

// One data row of a table: the shared row markup every Karse table renders (the hover/cursor
// style, the row test id, the optional click-through to a detail page, and one MUI cell per
// visible column).
export function DataTableRow<TData>({ row, cells, testId, clickable, onOpen, cellSx }: DataTableRowProps<TData>) {
    return (
        <TableRow
            data-test-id={testId}
            onClick={clickable && onOpen !== undefined ? () => onOpen(row.original) : undefined}
            sx={tableRowSx(clickable)}
        >
            {cells.map((cell) => (
                // The actions column, where a table has one, is pinned to the right edge; every
                // other column gets an empty sticky sx, so this composites cleanly with the row's
                // own optional cellSx and leaves non-pinning tables unchanged.
                <TableCell key={cell.id} sx={[stickyActionsCellSx(cell.column.id === ACTIONS_COLUMN_ID), cellSx]}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
            ))}
        </TableRow>
    );
}

// How many rows a table puts in the DOM at once, and how many more each press of its "Show
// more" control adds.
//
// The cost of a keystroke in a search box is proportional to the number of rows rendered, and
// to nothing else: the browser's style and layout work over the table's subtree is what blocks
// the main thread, so a table that renders its whole row model gets slower the longer the list
// is. Bounding the rendered set is what keeps typing responsive; the filtering itself was never
// the expensive part.
export const ROW_RENDER_LIMIT = 100;

// The data rows of a table: the first `ROW_RENDER_LIMIT` rows of the current row model,
// followed by a "Show more" row while any row is still held back.
//
// `clickable` says whether the rows navigate on click; a table whose rows are conditionally
// clickable (some resources have no detail page) passes `isClickable` instead.
interface DataTableRowsProps<TData> {
    rows: Row<TData>[];
    // The columns the rows render (`table.getVisibleLeafColumns()`), used to size the trailing
    // "Show more" row's cell.
    visibleColumns: Column<TData, any>[];
    testId: string;
    clickable?: boolean;
    isClickable?: (original: TData) => boolean;
    onOpen?: (original: TData) => void;
    cellSx?: any;
}

export function DataTableRows<TData>({ rows, visibleColumns, testId, clickable, isClickable, onOpen, cellSx }: DataTableRowsProps<TData>) {
    // How many of the current rows are allowed into the DOM. Raised a page at a time by the
    // "Show more" control below, so no matching row is ever out of reach: sorting, searching and
    // filtering all still run over every row, and the held-back rows are only unrendered.
    const [renderLimit, setRenderLimit] = useState(ROW_RENDER_LIMIT);
    const rendered = rows.slice(0, renderLimit);
    return (
        <>
            {rendered.map((row) => (
                <DataTableRow
                    key={row.id}
                    row={row}
                    cells={row.getVisibleCells()}
                    testId={testId}
                    clickable={isClickable !== undefined ? isClickable(row.original) : clickable === true}
                    onOpen={onOpen}
                    cellSx={cellSx}
                />
            ))}
            {rendered.length < rows.length && (
                <TableRow data-test-id={`${testId}-more`}>
                    <TableCell colSpan={visibleColumns.length}>
                        <div className="flex flex-row gap-3 items-center">
                            <Button
                                size="small"
                                onClick={() => setRenderLimit((limit) => limit + ROW_RENDER_LIMIT)}
                                data-test-id={`${testId}-show-more`}
                            >
                                Show more
                            </Button>
                            <Typography variant="body2" color="text.secondary" data-test-id={`${testId}-more-count`}>
                                Showing {rendered.length} of {rows.length}
                            </Typography>
                        </div>
                    </TableCell>
                </TableRow>
            )}
        </>
    );
}
