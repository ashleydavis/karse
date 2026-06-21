// Pure helpers for the main pods table's resource-consumption columns (CPU and
// memory). Per-pod usage is not on the Pod list response; it comes from the
// cluster Performance snapshot (`GET /api/cluster/performance` -> PodUsage[]),
// so these helpers key that usage by namespace/name and provide the comparators
// the table sorts the CPU and memory columns with.
//
// Scope note: only CPU and memory are sortable here. The Kubernetes Metrics API
// reports neither disk nor network consumption (a documented exclusion, see
// docs/spec/performance-tabs/detail.md), so there is no figure to sort by.

import type { PodUsage } from "karse-types";

// A pod's CPU and memory usage as read from the cluster Performance snapshot.
// Either value is null when the Metrics API is unavailable.
export type PodResourceUsage = {
    cpuMillicores: number | null;
    memoryBytes: number | null;
};

// A lookup of per-pod usage keyed by `namespace/name`.
export type PodUsageMap = Record<string, PodResourceUsage>;

// Stable lookup key for a pod's usage. namespace + name uniquely identify a pod
// across the cluster (the pods table can show all namespaces at once).
export function podUsageKey(namespace: string, name: string): string {
    return `${namespace}/${name}`;
}

// Builds the namespace/name -> usage lookup from the cluster Performance pods.
export function buildPodUsageMap(pods: PodUsage[]): PodUsageMap {
    const map: PodUsageMap = {};
    for (const pod of pods) {
        map[podUsageKey(pod.namespace, pod.name)] = {
            cpuMillicores: pod.usage.cpuMillicores,
            memoryBytes: pod.usage.memoryBytes,
        };
    }
    return map;
}

// Looks up a pod's usage, returning an all-null reading when the pod has no entry
// (it had no usage sample, or the Metrics API was unavailable).
export function podUsageFor(map: PodUsageMap, namespace: string, name: string): PodResourceUsage {
    return map[podUsageKey(namespace, name)] ?? { cpuMillicores: null, memoryBytes: null };
}

// Orders two nullable numeric usage values ascending. A null reading (no usage
// data) sorts below every real value, so the most-consuming pods land at one end
// regardless of which pods lack a sample. Returns a negative/zero/positive number
// in the usual comparator contract; TanStack Table flips it for descending sort.
export function compareUsageValue(a: number | null, b: number | null): number {
    if (a === null && b === null) {
        return 0;
    }
    if (a === null) {
        return -1;
    }
    if (b === null) {
        return 1;
    }
    return a - b;
}

// Comparator for the CPU column: orders two pod usages by CPU (millicores).
export function comparePodCpu(a: PodResourceUsage, b: PodResourceUsage): number {
    return compareUsageValue(a.cpuMillicores, b.cpuMillicores);
}

// Comparator for the Memory column: orders two pod usages by memory (bytes).
export function comparePodMemory(a: PodResourceUsage, b: PodResourceUsage): number {
    return compareUsageValue(a.memoryBytes, b.memoryBytes);
}
