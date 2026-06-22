import type { Pod } from "karse-types";

// Filters a list of pods by a typed search query, keeping every pod whose name
// contains the query as a case-insensitive substring. An empty or whitespace-only
// query matches all pods. This backs the searchable pod picker on the Logs page,
// letting the list stay usable when there are many pods. Pod order is preserved.
export function filterPods(pods: Pod[], query: string): Pod[] {
    const trimmed = query.trim().toLowerCase();
    if (trimmed === "") {
        return pods;
    }
    return pods.filter((pod) => pod.name.toLowerCase().includes(trimmed));
}

// Case-insensitive, number-aware comparison of two pod names, so e.g. "pod-2"
// sorts before "pod-10". Used to order each group of the picker.
function comparePodNames(a: Pod, b: Pod): number {
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
}

// Orders pods for the shared picker so the user's current selection is easy to
// see: ticked pods first, then unticked pods, with each group sorted
// alphanumerically (case-insensitive, number-aware). `selected` is the list of
// ticked pod names. Returns a new array; the input is not mutated. This is pure
// so the ordering can be unit-tested and re-applied live as pods are ticked.
export function orderPods(pods: Pod[], selected: string[]): Pod[] {
    const isSelected = (pod: Pod) => selected.includes(pod.name);
    const selectedPods = pods.filter(isSelected).sort(comparePodNames);
    const unselectedPods = pods.filter((pod) => !isSelected(pod)).sort(comparePodNames);
    return [...selectedPods, ...unselectedPods];
}
