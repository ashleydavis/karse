import type { PodUsage, PerformanceMetric, Pod } from "karse-types";
import { metricValue } from "./performance";

// One provisioning row: a container's usage, request, and limit for the selected
// metric. namespace/pod identify the owning pod so a row reads in full and the pod
// filter and free-text search can match on them. Backs the node Provisioning
// subtab table.
export type ProvisioningRow = {
    namespace: string;
    pod: string;
    container: string;
    usage: number | null;
    request: number | null;
    limit: number | null;
};

// Flattens a node's pods into one provisioning row per container for the selected
// metric. Every container is kept (including those with no usage reading) so a row
// still shows its provisioned request/limit even when live usage is unavailable.
// Pod and container order is preserved.
export function buildProvisioningRows(pods: PodUsage[], metric: PerformanceMetric): ProvisioningRow[] {
    const rows: ProvisioningRow[] = [];
    for (const pod of pods) {
        for (const container of pod.containers) {
            rows.push({
                namespace: pod.namespace,
                pod: pod.name,
                container: container.name,
                usage: metricValue(container.usage, metric),
                request: metricValue(container.requests, metric),
                limit: metricValue(container.limits, metric),
            });
        }
    }
    return rows;
}

// The distinct pods present in the rows, in first-seen order, shaped as the `Pod`
// list the shared PodFilter expects (it reads only name/namespace). Used to
// populate the pod picker's checkbox list from the pods scheduled on the node.
export function distinctProvisioningPods(rows: ProvisioningRow[]): Pod[] {
    const seen = new Set<string>();
    const pods: Pod[] = [];
    for (const row of rows) {
        const key = `${row.namespace}/${row.pod}`;
        if (!seen.has(key)) {
            seen.add(key);
            pods.push({ name: row.pod, namespace: row.namespace } as Pod);
        }
    }
    return pods;
}

// Narrows provisioning rows by the pod picker. An explicit selection (`selectedPods`
// non-empty) keeps only rows whose pod is ticked, ignoring the search box. With no
// pod ticked, a non-empty `podSearch` is a case-insensitive substring filter over
// the pod name; an empty/whitespace search keeps every row. Row order is preserved.
export function filterRowsByPods(
    rows: ProvisioningRow[],
    selectedPods: string[],
    podSearch: string,
): ProvisioningRow[] {
    if (selectedPods.length > 0) {
        return rows.filter((row) => selectedPods.includes(row.pod));
    }
    const trimmed = podSearch.trim().toLowerCase();
    if (trimmed === "") {
        return rows;
    }
    return rows.filter((row) => row.pod.toLowerCase().includes(trimmed));
}
