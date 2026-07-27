import { type FilterFn, type Row } from "@tanstack/react-table";

// The most characters of the searched text that may be skipped between the first
// and last character a query matches.
//
// Without a bound the subsequence match degenerates as soon as a cell value gets
// long. The Labels column flattens every label to space-joined "key=value" text,
// which is 25 characters on the short labels the test fixtures use but 285-345 on
// a pod carrying the recommended Kubernetes label set plus the controller-added
// ones any real Deployment/StatefulSet/DaemonSet pod has. Across a few hundred
// characters nearly every short query can be found scattered somewhere in order,
// so every row matched every query and the search box appeared to do nothing.
//
// Nine is the widest skip any intended match needs ("rs7d" matching
// "replicaset-7d9f8"); ten leaves a character of headroom while still refusing a
// query whose characters are strewn across a whole label set.
const MAX_SKIPPED_CHARACTERS = 10;

// Returns true when every meaningful character of `query` appears in `text` in
// order and close together (a bounded subsequence match), allowing typo/gap-
// tolerant matching such as "ngnx" or "ng-x" matching "nginx-deployment".
// Separator characters (anything that is not a letter or digit, e.g. "-" or " ")
// are ignored in the query so they act as gaps rather than literal characters to
// match. Matching is case-insensitive. The whole query must fall inside a window
// of at most its own length plus MAX_SKIPPED_CHARACTERS, so characters strewn
// across a long cell value do not count as a match.
export function fuzzyMatch(text: string, query: string): boolean {
    const haystack = text.toLowerCase();
    const needle = query.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (needle.length === 0)
    {
        return true;
    }
    const windowSize = needle.length + MAX_SKIPPED_CHARACTERS;
    // Try every position the query's first character occurs at. Scanning forward
    // greedily from a fixed start consumes each needle character at the earliest
    // position it can, so it reaches the end of the query as early as any match
    // from that start could: if a match fits the window here, this finds it.
    for (let start = 0; start < haystack.length; start++)
    {
        if (haystack[start] !== needle[0])
        {
            continue;
        }
        const end = Math.min(haystack.length, start + windowSize);
        let matched = 0;
        for (let position = start; position < end; position++)
        {
            if (haystack[position] === needle[matched])
            {
                matched++;
                if (matched === needle.length)
                {
                    return true;
                }
            }
        }
    }
    return false;
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
