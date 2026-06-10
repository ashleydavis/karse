// A single row in a resource's Labels tab: one key/value pair from that
// resource's own metadata.labels.
export type LabelRow = {
    key: string;
    value: string;
};

// Turns a resource's labels object (metadata.labels) into table rows, one row
// per key/value pair, sorted by key so the table has a stable initial order.
// This is the data shown by the per-detail-page Labels tab: only the labels of
// that one resource, never an aggregate across many resources.
export function buildLabelRows(labels: Record<string, string>): LabelRow[] {
    return Object.entries(labels)
        .map(([key, value]) => ({ key, value }))
        .sort((a, b) => a.key.localeCompare(b.key));
}
