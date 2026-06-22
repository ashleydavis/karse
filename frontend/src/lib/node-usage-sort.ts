// Pure helpers for the nodes table's resource-consumption columns (CPU and memory).
// Each column shows a node's consumption as a **percentage of the node itself**
// (node usage ÷ that node's allocatable), not absolute millicores/bytes, so the
// figures are comparable across differently-sized nodes and answer "which node is
// most loaded?".
//
// Per-node usage is not on the Node list response; it comes from the cluster
// Performance snapshot (`GET /api/cluster/performance` -> { nodes: NodeUsage[], ... }),
// where each NodeUsage already carries both the node's usage and its allocatable.
// These helpers turn each node's usage into a percentage of its own allocatable, key
// the percentages by node name, and provide the comparators the table sorts the CPU
// and memory columns with.
//
// Scope note: only CPU and memory are shown. The Kubernetes Metrics API reports
// neither disk nor network consumption (a documented exclusion, see
// docs/spec/performance-tabs/detail.md), so there is no figure to show or sort by.

import type { NodeUsage } from "karse-types";

// A node's CPU and memory consumption as a percentage of its own allocatable. Either
// value is null when the Metrics API is unavailable, the node has no usage sample
// (e.g. a NotReady node), or its allocatable is unknown/zero — so the percentage
// cannot be computed honestly.
export type NodeResourceUsage = {
    cpuPercent: number | null;
    memoryPercent: number | null;
};

// A lookup of per-node consumption percentages keyed by node name.
export type NodeUsageMap = Record<string, NodeResourceUsage>;

// Usage as a whole-number percentage of capacity, or null when either input is
// missing or capacity is zero (so the column shows an em-dash rather than a
// misleading 0% or a divide-by-zero).
export function usagePercent(used: number | null, capacity: number | null): number | null {
    if (used === null || capacity === null || capacity === 0) {
        return null;
    }
    return Math.round((used / capacity) * 100);
}

// Builds the node-name -> consumption-percentage lookup from the cluster Performance
// snapshot. Each node's CPU and memory usage is divided by its own allocatable; a
// node with no usage reading, or no allocatable, gets a null percentage (em-dash,
// sorts below nodes that have a reading).
export function buildNodeUsageMap(nodes: NodeUsage[]): NodeUsageMap {
    const map: NodeUsageMap = {};
    for (const node of nodes) {
        map[node.name] = {
            cpuPercent: usagePercent(node.usage.cpuMillicores, node.allocatable.cpuMillicores),
            memoryPercent: usagePercent(node.usage.memoryBytes, node.allocatable.memoryBytes),
        };
    }
    return map;
}

// Looks up a node's consumption, returning an all-null reading when the node has no
// entry (it had no usage sample, or the Metrics API was unavailable).
export function nodeUsageFor(map: NodeUsageMap, name: string): NodeResourceUsage {
    return map[name] ?? { cpuPercent: null, memoryPercent: null };
}

// Orders two nullable numeric values ascending. A null reading (no usage data) sorts
// below every real value, so the most-consuming nodes land at one end regardless of
// which nodes lack a sample. Returns a negative/zero/positive number in the usual
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

// Comparator for the CPU column: orders two node usages by CPU consumption percentage.
export function compareNodeCpu(a: NodeResourceUsage, b: NodeResourceUsage): number {
    return compareUsageValue(a.cpuPercent, b.cpuPercent);
}

// Comparator for the Memory column: orders two node usages by memory consumption percentage.
export function compareNodeMemory(a: NodeResourceUsage, b: NodeResourceUsage): number {
    return compareUsageValue(a.memoryPercent, b.memoryPercent);
}

// Formats a consumption percentage for display, e.g. `8%`. Null (no usage reading, or
// the node's allocatable is unknown) renders as an em-dash placeholder.
export function formatPercent(percent: number | null): string {
    return percent === null ? "—" : `${percent}%`;
}
