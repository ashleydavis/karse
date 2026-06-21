// Pure helpers for the main pods table's resource-consumption columns (CPU and
// memory). Each column shows a pod's consumption as a **percentage of the node it
// runs on** (pod usage ÷ that node's allocatable), not absolute millicores/bytes, so
// the figures are comparable across pods on differently-sized nodes.
//
// Per-pod usage is not on the Pod list response; it comes from the cluster
// Performance snapshot (`GET /api/cluster/performance` -> { nodes: NodeUsage[],
// pods: PodUsage[] }). These helpers join each pod's usage to the allocatable of the
// node it is scheduled on, key the resulting percentages by namespace/name, and
// provide the comparators the table sorts the CPU and memory columns with.
//
// Scope note: only CPU and memory are shown. The Kubernetes Metrics API reports
// neither disk nor network consumption (a documented exclusion, see
// docs/spec/performance-tabs/detail.md), so there is no figure to show or sort by.

import type { NodeUsage, PodUsage } from "karse-types";

// A pod's CPU and memory consumption as a percentage of its node's allocatable.
// Either value is null when the Metrics API is unavailable, the pod has no usage
// sample, or the pod's node (or its allocatable) is unknown — so the percentage
// cannot be computed honestly.
export type PodResourceUsage = {
    cpuPercent: number | null;
    memoryPercent: number | null;
};

// A lookup of per-pod node-share percentages keyed by `namespace/name`.
export type PodUsageMap = Record<string, PodResourceUsage>;

// allocatable per node, keyed by node name, used to turn a pod's absolute usage into
// a percentage of the node it runs on.
type NodeAllocatableMap = Record<string, NodeUsage["allocatable"]>;

// Stable lookup key for a pod's usage. namespace + name uniquely identify a pod
// across the cluster (the pods table can show all namespaces at once).
export function podUsageKey(namespace: string, name: string): string {
    return `${namespace}/${name}`;
}

// Usage as a whole-number percentage of capacity, or null when either input is
// missing or capacity is zero (so the column shows an em-dash rather than a
// misleading 0% or a divide-by-zero).
export function usagePercent(used: number | null, capacity: number | null): number | null {
    if (used === null || capacity === null || capacity === 0) {
        return null;
    }
    return Math.round((used / capacity) * 100);
}

// Builds a node-name -> allocatable lookup from the cluster Performance nodes.
function buildNodeAllocatableMap(nodes: NodeUsage[]): NodeAllocatableMap {
    const map: NodeAllocatableMap = {};
    for (const node of nodes) {
        map[node.name] = node.allocatable;
    }
    return map;
}

// Builds the namespace/name -> node-share lookup from the cluster Performance
// snapshot. Each pod's CPU and memory usage is divided by the allocatable of the
// node it is scheduled on (`pod.node`); a pod whose node is unknown, or whose node
// has no allocatable reading, gets a null percentage (em-dash, sorts below pods that
// have a reading).
export function buildPodUsageMap(pods: PodUsage[], nodes: NodeUsage[]): PodUsageMap {
    const allocatableByNode = buildNodeAllocatableMap(nodes);
    const map: PodUsageMap = {};
    for (const pod of pods) {
        const allocatable = allocatableByNode[pod.node];
        map[podUsageKey(pod.namespace, pod.name)] = {
            cpuPercent: usagePercent(pod.usage.cpuMillicores, allocatable?.cpuMillicores ?? null),
            memoryPercent: usagePercent(pod.usage.memoryBytes, allocatable?.memoryBytes ?? null),
        };
    }
    return map;
}

// Looks up a pod's node-share, returning an all-null reading when the pod has no
// entry (it had no usage sample, or the Metrics API was unavailable).
export function podUsageFor(map: PodUsageMap, namespace: string, name: string): PodResourceUsage {
    return map[podUsageKey(namespace, name)] ?? { cpuPercent: null, memoryPercent: null };
}

// Orders two nullable numeric values ascending. A null reading (no usage data) sorts
// below every real value, so the most-consuming pods land at one end regardless of
// which pods lack a sample. Returns a negative/zero/positive number in the usual
// comparator contract; TanStack Table flips it for descending sort.
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

// Comparator for the CPU column: orders two pod usages by CPU node-share percentage.
export function comparePodCpu(a: PodResourceUsage, b: PodResourceUsage): number {
    return compareUsageValue(a.cpuPercent, b.cpuPercent);
}

// Comparator for the Memory column: orders two pod usages by memory node-share percentage.
export function comparePodMemory(a: PodResourceUsage, b: PodResourceUsage): number {
    return compareUsageValue(a.memoryPercent, b.memoryPercent);
}

// Formats a node-share percentage for display, e.g. `12%`. Null (no usage reading,
// or the pod's node/allocatable is unknown) renders as an em-dash placeholder.
export function formatPercent(percent: number | null): string {
    return percent === null ? "—" : `${percent}%`;
}
