import { type FilterFn, type Row } from "@tanstack/react-table";

// The most characters of the searched text that may be skipped between the first
// and last character a query matches, when the typo-tolerant fuzzy path runs.
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

// Minimum query length for a contiguous substring hit on a long cell (joined
// Labels text). Two-character queries like "go" are contiguous runs inside
// ordinary label keys (`region`, `cost_category`), so accepting them on long
// cells keeps every row and the search appears to do nothing. Three characters
// is enough for intentional short probes (`go-`, `app`) while still refusing
// those fragments.
const MIN_LONG_CELL_SUBSTRING_LENGTH = 3;

// Minimum alphanumeric query length for typo-tolerant subsequence matching.
// Two-character needles like "go" are subsequences of almost any short name that
// happens to contain a "g" and a later "o" within the skip window
// ("nginx-deployment", "gpu-operator", "phishing-protection"), so fuzzy matching
// them keeps unrelated rows. Contiguous / token-prefix matching still handles
// those short queries; fuzzy starts at three characters so "ng-x" → "nginx"
// still works.
const MIN_FUZZY_NEEDLE_LENGTH = 3;

// Cells at or under this length take the short-cell path (resource names,
// namespaces, nodes, and the small label sets test fixtures use). Joined
// real-world Labels text runs from about 80 characters upward (often 285-700).
// Pod names are capped near 63 characters in practice.
const SHORT_CELL_MAX_LENGTH = 72;

// True when the cell is short enough for name-style matching. Cells that look
// like label text (contain "=") always take the long-cell path: even a single
// `pod-template-hash=…` pair is short enough to fit under SHORT_CELL_MAX_LENGTH
// but still fuzzy-matches short queries like "otel".
function cellIsShortEnoughForFuzzy(haystack: string): boolean {
    if (haystack.includes("="))
    {
        return false;
    }
    return haystack.length <= SHORT_CELL_MAX_LENGTH;
}

// Returns true when every meaningful character of `needle` appears in `haystack`
// in order and close together (a bounded subsequence match).
function boundedFuzzySubsequence(haystack: string, needle: string): boolean {
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

// True when any alphanumeric token in the haystack starts with the needle.
// Used for one- and two-character queries so "go" matches "go-otel" but not
// the "go" sitting inside "cost_category" or "category".
function tokenPrefixMatch(haystack: string, needle: string): boolean {
    return haystack.split(/[^a-z0-9]+/).some((token) => token.startsWith(needle));
}

// Returns true when `query` matches `text`. Matching is case-insensitive.
//
// Short cells (resource names, namespaces, nodes) accept a contiguous substring
// of the raw query, a token-prefix match for one-/two-character needles, then
// typo-tolerant bounded subsequence matching ("ngnx" → "nginx") for longer ones.
//
// Long cells (joined Labels text) accept contiguous substrings only, and only
// when the query is at least MIN_LONG_CELL_SUBSTRING_LENGTH characters, so short
// fragments cannot hide inside label keys like "region" or "cost_category".
export function fuzzyMatch(text: string, query: string): boolean {
    const haystack = text.toLowerCase();
    const raw = query.toLowerCase();
    const needle = raw.replace(/[^a-z0-9]/g, "");
    if (needle.length === 0)
    {
        return true;
    }
    if (cellIsShortEnoughForFuzzy(haystack))
    {
        // A raw query that still carries separators (e.g. "go-") may match as a
        // literal substring. A pure alphanumeric short query must not: "go" is a
        // contiguous run inside "category" / "cost_category".
        if (raw !== needle && haystack.includes(raw))
        {
            return true;
        }
        if (needle.length < MIN_FUZZY_NEEDLE_LENGTH)
        {
            return tokenPrefixMatch(haystack, needle);
        }
        if (haystack.includes(raw) || haystack.includes(needle))
        {
            return true;
        }
        return boundedFuzzySubsequence(haystack, needle);
    }
    if (raw.length >= MIN_LONG_CELL_SUBSTRING_LENGTH && haystack.includes(raw))
    {
        return true;
    }
    // Separator-stripped match on a long cell (so "app nginx" still hits
    // "app=nginx"). Require the needle to be longer than the raw-query floor so
    // stripping "go-" down to "go" cannot reopen the cost_category / region
    // false positives the floor exists to close.
    if (needle.length > MIN_LONG_CELL_SUBSTRING_LENGTH)
    {
        const stripped = haystack.replace(/[^a-z0-9]/g, "");
        if (stripped.includes(needle))
        {
            return true;
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
