import { type FilterFn } from "@tanstack/react-table";
import type { ClusterError } from "karse-types";

// Formats a Kubernetes timestamp into the human-readable age string the errors
// table displays (e.g. "4h", "2d", "5m"). Lives here so the search matcher can
// match the same text the Age column actually shows, rather than the raw ISO
// timestamp behind it.
export function formatAge(lastSeen: string): string {
    if (lastSeen === "")
    {
        return "-";
    }
    const ms = Date.now() - new Date(lastSeen).getTime();
    const minutes = Math.floor(ms / 60_000);
    const hours = Math.floor(ms / 3_600_000);
    const days = Math.floor(ms / 86_400_000);
    if (days > 0)
    {
        return `${days}d`;
    }
    if (hours > 0)
    {
        return `${hours}h`;
    }
    return `${minutes}m`;
}

// Returns the searchable text of every column the errors table displays, one
// entry per column, in the same form the user sees on screen: the formatted
// Age, the "Pod"/"Event" source label, the "kind/name" object, the reason,
// the message, the count, and the namespace. TanStack's built-in
// `includesString` only matches a column's raw accessor value, so it would miss
// the displayed Age ("4h" vs the raw timestamp) and the source chip's label.
// Building the strings here keeps the search aligned with what is shown.
export function errorDisplayStrings(error: ClusterError): string[] {
    return [
        formatAge(error.lastSeen),
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
export function errorMatchesQuery(error: ClusterError, query: string): boolean {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0)
    {
        return true;
    }
    return errorDisplayStrings(error).some((value) => value.toLowerCase().includes(needle));
}

// TanStack global filter function for the errors table. Plain case-insensitive
// substring match (matching the events table's behaviour) but run over every
// displayed column rather than only the columns whose raw accessor value equals
// their rendered text, so a term shown in any column narrows the table.
export const errorsGlobalFilter: FilterFn<ClusterError> = (row, _columnId, filterValue) => {
    const query = typeof filterValue === "string" ? filterValue : "";
    return errorMatchesQuery(row.original, query);
};
