import { type FilterFn, type Row } from "@tanstack/react-table";

// Returns true when every meaningful character of `query` appears in `text` in
// order (a subsequence match), allowing typo/gap-tolerant matching such as
// "ngnx" or "ng-x" matching "nginx-deployment". Separator characters (anything
// that is not a letter or digit, e.g. "-" or " ") are ignored in the query so
// they act as gaps rather than literal characters to match. Matching is
// case-insensitive.
export function fuzzyMatch(text: string, query: string): boolean {
    const haystack = text.toLowerCase();
    const needle = query.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (needle.length === 0)
    {
        return true;
    }
    let position = 0;
    for (const char of needle)
    {
        const found = haystack.indexOf(char, position);
        if (found === -1)
        {
            return false;
        }
        position = found + 1;
    }
    return true;
}

// Collapses a single table cell value into a searchable string.
function cellToString(value: any): string {
    if (value === null || value === undefined)
    {
        return "";
    }
    if (typeof value === "object")
    {
        return Object.values(value).map(cellToString).join(" ");
    }
    return String(value);
}

// Returns the searchable string for every searchable column value of a row, one
// entry per cell. Matching per cell (rather than against the whole concatenated
// row) keeps the subsequence match scoped to a single value so a query cannot
// span across unrelated columns. Columns that opt out with `enableGlobalFilter:
// false` (e.g. a hidden health column used only by the health filter) are
// skipped so they never affect search results.
function rowCellStrings<T>(row: Row<T>): string[] {
    return row
        .getAllCells()
        .filter((cell) => cell.column?.columnDef?.enableGlobalFilter !== false)
        .map((cell) => cellToString(cell.getValue()));
}

// Tanstack global filter function that fuzzy-matches the query against each
// cell value of a row, keeping the row when any single cell matches. Shared
// across all searchable tables so they behave identically.
export const fuzzyGlobalFilter: FilterFn<any> = (row, _columnId, filterValue) => {
    const query = typeof filterValue === "string" ? filterValue : "";
    if (query.trim().length === 0)
    {
        return true;
    }
    return rowCellStrings(row).some((cellValue) => fuzzyMatch(cellValue, query));
};
