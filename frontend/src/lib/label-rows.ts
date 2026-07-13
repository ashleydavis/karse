// A single row in a resource's Labels tab: one key/value pair from that
// resource's own metadata.labels.
export type LabelRow = {
    key: string;
    value: string;
};

// Turns a resource's labels object (metadata.labels) into table rows, one row
// per key/value pair, sorted by key so the table has a stable initial order.
// This is the data shown by the shared labels table: only the labels of that one
// resource, never an aggregate across many resources.
export function buildLabelRows(labels: Record<string, string> | undefined | null): LabelRow[] {
    if (!labels)
    {
        return [];
    }
    return Object.entries(labels)
        .map(([key, value]) => ({ key, value }))
        .sort((a, b) => a.key.localeCompare(b.key));
}

// Builds the labels modal's title so it names whose labels are shown. Given the
// opening resource's kind and name (either may be missing) and the label count,
// it prefixes the count with the resource identity, e.g. "Pod web-1 labels (5)",
// and falls back to a bare "Labels (5)" when no identity was supplied. Kept pure
// and here (beside the rest of the label-table logic) so the title the modal
// renders is exactly the one the unit tests cover.
export function labelsModalTitle(
    resourceKind: string | undefined,
    resourceName: string | undefined,
    count: number,
): string {
    const resource = [resourceKind, resourceName].filter(Boolean).join(" ");
    return resource ? `${resource} labels (${count})` : `Labels (${count})`;
}

// Orders two label rows by the given column ("key" or "value"). This is the
// comparison the shared labels table runs when a column header is clicked, in
// ascending order (the table reverses it for descending). It uses the same
// localeCompare as buildLabelRows so a Key sort restores exactly the table's
// initial order rather than a subtly different one.
export function compareLabelRows(a: LabelRow, b: LabelRow, columnId: string): number {
    if (columnId === "value")
    {
        return a.value.localeCompare(b.value);
    }
    return a.key.localeCompare(b.key);
}
