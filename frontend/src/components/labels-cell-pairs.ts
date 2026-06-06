// Flattens a Kubernetes labels map into "key=value" strings, sorted by key so
// the order is stable across renders. Shared by the Labels column cell renderer
// (labels-cell.tsx) and the accessor that feeds the table's fuzzy search, so what
// is displayed and what is searched stay identical. Kept in a plain-TS module (no
// MUI import) so it is unit-testable in the node test environment.
export function labelsToPairs(labels: Record<string, string> | undefined | null): string[] {
    if (!labels) return [];
    return Object.keys(labels)
        .sort()
        .map((key) => `${key}=${labels[key]}`);
}
