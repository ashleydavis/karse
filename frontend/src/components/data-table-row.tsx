import { memo, useState } from "react";
import { TableRow, TableCell, Button, Typography } from "@mui/material";
import { flexRender, type Column, type Row } from "@tanstack/react-table";
import { tableRowSx } from "../lib/table-row-style";
import { ACTIONS_COLUMN_ID, stickyActionsCellSx } from "../lib/sticky-actions";
import { dataTableRowPropsEqual, type DataTableRowProps } from "../lib/data-table-row-memo";

// One data row of a table: the shared row markup every Karse table renders (the hover/cursor
// style, the row test id, the optional click-through to a detail page, and one MUI cell per
// visible column).
function DataTableRowInner<TData>({ row, cells, testId, clickable, onOpen, cellSx }: DataTableRowProps<TData>) {
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

// The memoised row: typing changes the search text and the set of matching rows, but not the
// rows themselves, so every row that survives the filter skips its render (and MUI skips
// re-styling its cells) instead of being rebuilt from scratch.
//
// This saves real work, but it is not what makes typing responsive: measurement showed the
// per-keystroke cost tracked the number of rows in the DOM and nothing else, and stayed just as
// high with the search box disconnected from the table entirely. `ROW_RENDER_LIMIT` below is
// what fixed that.
//
// `memo` erases the component's generic parameter, so its result is cast back to the generic
// signature; there is no other way to keep a memoised component generic.
export const DataTableRow = memo(DataTableRowInner, dataTableRowPropsEqual) as typeof DataTableRowInner;

// How many rows a table puts in the DOM at once, and how many more each press of its "Show
// more" control adds.
//
// The cost of a keystroke in a search box is proportional to the number of rows rendered, and
// to nothing else: the browser's style and layout work over the table's subtree is what blocks
// the main thread, so a table that renders its whole row model gets slower the longer the list
// is. Bounding the rendered set is what keeps typing responsive; the filtering itself was never
// the expensive part.
export const ROW_RENDER_LIMIT = 100;

// The data rows of a table: the first `ROW_RENDER_LIMIT` rows of the current row model, as
// memoised rows, followed by a "Show more" row while any row is still held back.
//
// `clickable` says whether the rows navigate on click; a table whose rows are conditionally
// clickable (some resources have no detail page) passes `isClickable` instead, which must be a
// stable function — a fresh closure per render would defeat the memo below.
interface DataTableRowsProps<TData> {
    rows: Row<TData>[];
    // The columns the rows render (`table.getVisibleLeafColumns()`). The rows' cells are derived
    // from them, and TanStack's row model does not change when they do, so this is what tells the
    // memo below that a re-render is needed: a changed view-mode toggle, a fresh usage snapshot, a
    // reordered or hidden column. Without it the rows would keep showing the old columns' values.
    visibleColumns: Column<TData, any>[];
    testId: string;
    clickable?: boolean;
    isClickable?: (original: TData) => boolean;
    onOpen?: (original: TData) => void;
    cellSx?: any;
}

function DataTableRowsInner<TData>({ rows, visibleColumns, testId, clickable, isClickable, onOpen, cellSx }: DataTableRowsProps<TData>) {
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

// The memoised row list.
//
// A keystroke re-renders the table component, because the text in the search box is its state.
// TanStack hands back the very same row model until the *deferred* search value catches up, so
// this component's props are unchanged on that render and React skips the entire body: the row
// list is not even walked. The rows are re-rendered only when the filter itself settles, and
// then each surviving row skips its own render in turn (DataTableRow above).
export const DataTableRows = memo(DataTableRowsInner) as typeof DataTableRowsInner;
