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
