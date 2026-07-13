import { type Cell, type Row } from "@tanstack/react-table";

// The props of the shared memoised table row (components/data-table-row.tsx).
//
// `cells` is the row's visible cells, snapshotted by the parent at render time. It is a prop
// rather than something the row reads from `row` itself so that the memo comparison below can
// see when the cells have genuinely changed (new columns, a changed column definition, a
// changed column order or visibility) and re-render only then.
//
// `cellSx` is the optional MUI sx applied to every cell of the row. It is typed loosely here so
// this module stays free of UI imports; the component types it as MUI's SxProps.
export interface DataTableRowProps<TData> {
    row: Row<TData>;
    cells: Cell<TData, any>[];
    testId: string;
    clickable: boolean;
    onOpen?: (original: TData) => void;
    cellSx?: any;
}

// True when two consecutive renders of a row would produce identical output, so React can skip
// re-rendering it.
//
// A TanStack row object survives a change of global filter (the core row model is memoised on
// the data alone, and filtering hands back the very same row objects), and so do its cell
// objects (memoised on the table's leaf columns). The array holding those cells, though, is
// rebuilt whenever a table passes a fresh column-visibility object, so the cells are compared
// element by element rather than by array identity: identical cells mean identical output.
export function dataTableRowPropsEqual<TData>(previous: DataTableRowProps<TData>, next: DataTableRowProps<TData>): boolean {
    if (previous.row !== next.row
        || previous.testId !== next.testId
        || previous.clickable !== next.clickable
        || previous.onOpen !== next.onOpen
        || previous.cellSx !== next.cellSx)
    {
        return false;
    }
    if (previous.cells.length !== next.cells.length)
    {
        return false;
    }
    for (let index = 0; index < previous.cells.length; index++)
    {
        if (previous.cells[index] !== next.cells[index])
        {
            return false;
        }
    }
    return true;
}
