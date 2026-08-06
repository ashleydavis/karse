import { LabelsTable } from "./labels-table";

// The URL query-param key the Labels tab's search box writes to. Deliberately not
// the default `q`: a detail page can render another searchable table on a sibling
// tab (the namespace detail page's Resources tab), and the two boxes must not
// overwrite each other's param.
const LABELS_SEARCH_PARAM = "labelsq";

// The Labels sub tab on a resource detail page (pod, node, namespace, workload).
// It shows only that one resource's own labels, never an aggregate across
// resources. The searchable, sortable Key / Value table itself is the shared
// LabelsTable, so the tab and the labels modal opened from a truncated Labels
// cell present labels identically.
export function LabelsTab({ labels }: { labels: Record<string, string> }) {
    return (
        <div data-test-id="labels-tab">
            <LabelsTable labels={labels} searchParamKey={LABELS_SEARCH_PARAM} />
        </div>
    );
}
