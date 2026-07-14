import { type FilterFn } from "@tanstack/react-table";
import type { ClusterError } from "karse-types";
import { formatTimestamp, type TimestampMode } from "./timestamps";

// Returns the searchable text of every column the errors table displays, one
// entry per column, in the same form the user sees on screen: the formatted
// timestamp, the "Pod"/"Event" source label, the "kind/name" object, the reason,
// the message, the count, and the namespace. TanStack's built-in
// `includesString` only matches a column's raw accessor value, so it would miss
// the displayed timestamp ("4h" vs the raw ISO string) and the source chip's
// label. Building the strings here keeps the search aligned with what is shown,
// which is why it takes the timestamp mode: in local-time mode the first column
// reads "14 Jul 2026, 09:23:45", and searching that text must match it.
export function errorDisplayStrings(error: ClusterError, mode: TimestampMode = "age"): string[] {
    return [
        formatTimestamp(error.lastSeen, mode),
        error.source,
        `${error.objectKind}/${error.objectName}`,
        error.reason,
        error.message,
        String(error.count),
        error.namespace,
    ];
}

// Returns true when the query appears as a plain, case-insensitive substring of
// any displayed errors-table column. An empty/whitespace query keeps every row.
export function errorMatchesQuery(error: ClusterError, query: string, mode: TimestampMode = "age"): boolean {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0)
    {
        return true;
    }
    return errorDisplayStrings(error, mode).some((value) => value.toLowerCase().includes(needle));
}

// Builds the TanStack global filter function for the errors table, bound to the
// timestamp mode the table is currently rendering in. Plain case-insensitive
// substring match (matching the events table's behaviour) but run over every
// displayed column rather than only the columns whose raw accessor value equals
// their rendered text, so a term shown in any column narrows the table. It is a
// factory rather than a constant because a filter function cannot read React
// context: the table re-binds it whenever the mode changes.
export function makeErrorsGlobalFilter(mode: TimestampMode): FilterFn<ClusterError> {
    return (row, _columnId, filterValue) => {
        const query = typeof filterValue === "string" ? filterValue : "";
        return errorMatchesQuery(row.original, query, mode);
    };
}
