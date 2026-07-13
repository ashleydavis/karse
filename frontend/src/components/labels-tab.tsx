import { LabelsTable } from "./labels-table";

// The Labels sub tab on a resource detail page (pod, node, namespace, workload).
// It shows only that one resource's own labels, never an aggregate across
// resources. The searchable, sortable Key / Value table itself is the shared
// LabelsTable, so the tab and the labels modal opened from a truncated Labels
// cell present labels identically.
export function LabelsTab({ labels }: { labels: Record<string, string> }) {
    return (
        <div data-test-id="labels-tab">
            <LabelsTable labels={labels} />
        </div>
    );
}
