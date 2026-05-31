import { type FilterFn, type Row } from "@tanstack/react-table";

// Returns true when every character of `query` appears in `text` in order
// (a subsequence match), allowing typo/gap-tolerant matching such as "ngnx"
// or "ng-x" matching "nginx-deployment". Matching is case-insensitive.
export function fuzzyMatch(text: string, query: string): boolean {
    const haystack = text.toLowerCase();
    const needle = query.toLowerCase();
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

// Builds one searchable string from every visible/leaf column value of a row.
function rowToString<T>(row: Row<T>): string {
    return row.getAllCells()
        .map((cell) => cellToString(cell.getValue()))
        .join(" ");
}

// Tanstack global filter function that fuzzy-matches the query against the
// concatenated cell values of each row. Shared across all searchable tables so
// they behave identically.
export const fuzzyGlobalFilter: FilterFn<any> = (row, _columnId, filterValue) => {
    const query = typeof filterValue === "string" ? filterValue : "";
    if (query.trim().length === 0)
    {
        return true;
    }
    return fuzzyMatch(rowToString(row), query);
};
