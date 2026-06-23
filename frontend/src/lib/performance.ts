// Pure transform and format helpers for the Performance tabs. Most are exercised by the
// Playwright e2e suite (and the smoke endpoint checks for the data they shape); the
// per-pod node-share calculation (buildNodeShares / buildNodeShareTreemap) is also unit-
// tested directly in frontend/src/tests/lib/node-share.test.ts. Keeping them pure (no
// React, no I/O) makes the charts deterministic and the assertions stable.

import type { NodeUsage, PodUsage, ResourceUsage, PerformanceMetric } from "karse-types";

// A node in a Breakdown treemap. Interior nodes carry children; leaf nodes carry a
// numeric value (the usage for the selected metric). Leaves additionally carry the
// pod's namespace/name so a leaf click can navigate to that pod's detail page, and
// (on the cluster treemap, whose leaves are cluster nodes) the leaf's share of the
// cluster total for the selected metric, as a whole-number percentage.
export type TreemapNode = {
    id: string;
    value?: number;
    // Utilisation ratio (usage / limit) for the leaf, used to colour it green→amber→red.
    // Null when no limit is set (so utilisation cannot be computed).
    utilisation?: number | null;
    // Navigation target carried on leaves so a click can open the pod detail page.
    podNamespace?: string;
    podName?: string;
    // The cluster node's name, carried on cluster-treemap leaves so a leaf click can
    // open that node's detail page.
    nodeName?: string;
    // The leaf's share of the cluster total for the selected metric, as a whole-number
    // percentage (0–100). Null when the share cannot be computed (no usage, or a zero
    // cluster total). Used on the cluster treemap's node leaves.
    clusterShare?: number | null;
    children?: TreemapNode[];
    // Note: on the node-share treemap the leaf `value` is itself a whole-number
    // percentage of the node (see buildNodeShareTreemap), so UsageTreemap formats it as a
    // percent (valueKind="percent") rather than as a cpu/memory figure.
};

// Formats a CPU figure (millicores) as a human string: sub-core values keep the
// "m" millicore suffix ("250m"), whole/large values show cores ("1.5"). Null (the
// Metrics API was unavailable) renders as an em-dash placeholder.
export function formatCpu(millicores: number | null): string {
    if (millicores === null) {
        return "—";
    }
    if (millicores < 1000) {
        return `${millicores}m`;
    }
    const cores = millicores / 1000;
    // Trim a trailing ".0" so whole cores read "2", not "2.0".
    return Number.isInteger(cores) ? `${cores}` : `${cores.toFixed(1)}`;
}

// Formats a memory figure (bytes) using binary (Ki/Mi/Gi/Ti) units, picking the
// largest unit that keeps the number ≥ 1. Whole values drop the decimal ("512Mi");
// fractional values keep one place ("1.2Gi"). Null renders as an em-dash.
export function formatMemory(bytes: number | null): string {
    if (bytes === null) {
        return "—";
    }
    if (bytes === 0) {
        return "0";
    }
    const units = ["", "Ki", "Mi", "Gi", "Ti", "Pi"];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
    }
    const text = Number.isInteger(value) ? `${value}` : `${value.toFixed(1)}`;
    return `${text}${units[unit]}`;
}

// Reads the field of a usage reading selected by the metric toggle.
export function metricValue(usage: ResourceUsage, metric: PerformanceMetric): number | null {
    return metric === "cpu" ? usage.cpuMillicores : usage.memoryBytes;
}

// Utilisation ratio (usage ÷ limit) for the selected metric, used to colour a
// treemap leaf or heatmap cell. Returns null when usage is unknown or the limit is
// absent/zero (so the caller can fall back to a neutral colour).
export function utilisation(
    usage: ResourceUsage,
    limit: ResourceUsage,
    metric: PerformanceMetric,
): number | null {
    const used = metricValue(usage, metric);
    const cap = metricValue(limit, metric);
    if (used === null || cap === null || cap === 0) {
        return null;
    }
    return used / cap;
}

// The cluster total usage for one metric: the sum of every node's usage. Nodes whose
// usage is unknown (null, e.g. the Metrics API was unavailable) contribute nothing.
export function clusterMetricTotal(nodes: NodeUsage[], metric: PerformanceMetric): number {
    let total = 0;
    for (const node of nodes) {
        const value = metricValue(node.usage, metric);
        if (value !== null) {
            total += value;
        }
    }
    return total;
}

// The cluster allocatable total for one metric: the sum of every node's allocatable
// capacity. Nodes with unknown allocatable (null) contribute nothing.
export function clusterAllocatableTotal(nodes: NodeUsage[], metric: PerformanceMetric): number {
    let total = 0;
    for (const node of nodes) {
        const value = metricValue(node.allocatable, metric);
        if (value !== null) {
            total += value;
        }
    }
    return total;
}

// The cluster consumed-vs-free reading for one metric: the cluster usage total, the
// allocatable total, and the consumed percentage (usage ÷ allocatable, whole number,
// null when allocatable is zero). Drives the Status page resource indicator.
export type ClusterResourceShare = {
    used: number;
    allocatable: number;
    consumedPercent: number | null;
};

export function clusterResourceShare(
    nodes: NodeUsage[],
    metric: PerformanceMetric,
): ClusterResourceShare {
    const used = clusterMetricTotal(nodes, metric);
    const allocatable = clusterAllocatableTotal(nodes, metric);
    return {
        used,
        allocatable,
        consumedPercent: usagePercent(used, allocatable),
    };
}

// A node's share of the cluster total for the selected metric, as a whole-number
// percentage (rounded). Returns null when the node's usage is unknown or the cluster
// total is zero (so there is no meaningful share to show).
export function nodeShareOfCluster(nodeUsed: number | null, clusterTotal: number): number | null {
    if (nodeUsed === null || clusterTotal <= 0) {
        return null;
    }
    return Math.round((nodeUsed / clusterTotal) * 100);
}

// Builds the cluster Breakdown treemap: one leaf per cluster node, sized by that
// node's usage for the selected metric. Each leaf carries the node's share of the
// cluster total (a whole-number percentage) for its label and tooltip, and its node
// name so a click can open that node's detail page. Nodes with no usage (null) or
// zero usage are filtered out, so the treemap only shows nodes that actually consume
// the metric (an empty rectangle carries no information and breaks nivo's layout).
export function buildClusterNodeTreemap(nodes: NodeUsage[], metric: PerformanceMetric): TreemapNode {
    const total = clusterMetricTotal(nodes, metric);
    const leaves: TreemapNode[] = [];
    for (const node of nodes) {
        const value = metricValue(node.usage, metric);
        if (value === null || value <= 0) {
            continue;
        }
        leaves.push({
            id: node.name,
            value,
            utilisation: utilisation(node.usage, node.allocatable, metric),
            nodeName: node.name,
            clusterShare: nodeShareOfCluster(value, total),
        });
    }
    return { id: "cluster", children: leaves };
}

// One pod's share of a node for the selected metric, as a whole-number percentage of the
// node's allocatable capacity. Carries the pod's usage and the resolved percentage (null
// when usage or the node base is unknown), plus the pod's namespace/name for navigation.
export type NodeShareRow = {
    namespace: string;
    pod: string;
    usage: number | null;
    // Percentage (whole number, not capped) of the node's allocatable that the pod
    // consumes for the selected metric. Null when usage is unknown or the node base is
    // missing/zero.
    percentage: number | null;
};

// Each pod's percentage of the node it runs on for the selected metric. The base is the
// node's allocatable for that metric; percentage = round(pod usage ÷ node allocatable ×
// 100). Pods with no usage reading (Metrics API unavailable) keep a null percentage so
// the caller can show them honestly rather than as a misleading 0%. Sorted by percentage
// descending (nulls last) so the heaviest consumers read first. Pure: exercised by unit
// tests (see frontend/src/tests/lib/node-share.test.ts).
export function buildNodeShares(
    pods: PodUsage[],
    nodeAllocatable: ResourceUsage,
    metric: PerformanceMetric,
): NodeShareRow[] {
    const base = metricValue(nodeAllocatable, metric);
    const rows: NodeShareRow[] = pods.map((pod) => {
        const usage = metricValue(pod.usage, metric);
        return {
            namespace: pod.namespace,
            pod: pod.name,
            usage,
            percentage: usagePercent(usage, base),
        };
    });
    return rows.sort((a, b) => (b.percentage ?? -1) - (a.percentage ?? -1));
}

// Builds the node Breakdown treemap sized by each pod's percentage of the node, so the
// box areas read as "share of the node" rather than raw usage. The tree is namespace →
// pod, with each pod leaf valued by its node-percentage for the selected metric. Pods
// with no usage (null) or a zero share are dropped (an empty box carries no information
// and breaks nivo's layout). A leaf still navigates to its owning pod's detail page on
// click. The base is the node's allocatable for the metric; when it is missing or zero
// the percentages are null and the treemap renders empty (its empty-state shows).
export function buildNodeShareTreemap(
    pods: PodUsage[],
    nodeAllocatable: ResourceUsage,
    metric: PerformanceMetric,
): TreemapNode {
    const base = metricValue(nodeAllocatable, metric);
    // namespace name → pod leaf list, preserving first-seen order.
    const byNamespace = new Map<string, TreemapNode[]>();

    for (const pod of pods) {
        const pct = usagePercent(metricValue(pod.usage, metric), base);
        if (pct === null || pct <= 0) {
            continue;
        }
        let leaves = byNamespace.get(pod.namespace);
        if (leaves === undefined) {
            leaves = [];
            byNamespace.set(pod.namespace, leaves);
        }
        leaves.push({
            id: `${pod.namespace}/${pod.name}`,
            value: pct,
            utilisation: utilisation(pod.usage, pod.limits, metric),
            podNamespace: pod.namespace,
            podName: pod.name,
        });
    }

    const namespaces: TreemapNode[] = [];
    for (const [namespace, leaves] of byNamespace) {
        namespaces.push({ id: namespace, children: leaves });
    }

    return { id: "node", children: namespaces };
}

// Usage as a whole-number percentage of capacity, or null when either input is
// missing or capacity is zero. Used by the cluster Status indicator (cluster usage ÷
// cluster allocatable) and the per-node utilisation reading.
export function usagePercent(used: number | null, capacity: number | null): number | null {
    if (used === null || capacity === null || capacity === 0) {
        return null;
    }
    return Math.round((used / capacity) * 100);
}

// One resource the pod-node-share indicator reports: the pod's percentage of the node it
// runs on for that resource, plus the raw usage and the node's allocatable base so the UI
// can show the percentage as the primary value and the usage/capacity as small secondary
// text. percentage is null when usage is unknown (no Metrics API) or the node base is
// missing/zero, so the row degrades to "—" rather than a misleading 0%.
export type PodNodeShareResource = "cpu" | "memory";

export type PodNodeShareRow = {
    resource: PodNodeShareResource;
    percentage: number | null;
    usage: number | null;
    allocatable: number | null;
};

// One resource section of the pod Performance panel (CPU or Memory): the pod's requested,
// limit, and live usage figures for that resource, plus the positions (as whole-number
// percentages of a common scale) of usage, request, and limit on the combined bar so the
// UI can draw all three against one axis. usage/request/limit are the raw values (null when
// unknown — no Metrics API for usage, or unset request/limit in the spec). usagePercent is
// the usage as a percentage of the scale (the bar's filled width); requestMark and limitMark
// are where the request and limit sit on the same scale (vertical markers). All marks are
// null when the value is unknown or the scale is zero.
export type PodResourceRow = {
    resource: PodNodeShareResource;
    usage: number | null;
    request: number | null;
    limit: number | null;
    usagePercent: number | null;
    requestMark: number | null;
    limitMark: number | null;
};

// The scale a pod resource bar is drawn against: the largest of the pod's usage, request,
// and limit for that resource (ignoring nulls). The bar then plots all three as percentages
// of this scale, so the longest of the three reaches 100% and the others read in proportion.
// Returns 0 when none of the three is known (the bar renders empty).
function podResourceScale(usage: number | null, request: number | null, limit: number | null): number {
    return Math.max(0, usage ?? 0, request ?? 0, limit ?? 0);
}

// A value's position on the resource bar as a whole-number percentage of the scale, or null
// when the value is unknown or the scale is zero (so the UI omits the marker rather than
// drawing it at 0).
function markOnScale(value: number | null, scale: number): number | null {
    if (value === null || scale <= 0) {
        return null;
    }
    return Math.round((value / scale) * 100);
}

// Builds the two resource rows (cpu, then memory) for the pod Performance panel from the
// pod's summed usage, requests, and limits. Each row carries the raw figures and their marks
// on a per-resource bar scaled to the largest of the three values. Pure: exercised by the
// resource-utilization e2e (resource-utilization-13).
export function podResourceRows(
    usage: ResourceUsage,
    requests: ResourceUsage,
    limits: ResourceUsage,
): PodResourceRow[] {
    const resources: PodNodeShareResource[] = ["cpu", "memory"];
    return resources.map((resource) => {
        const used = metricValue(usage, resource);
        const request = metricValue(requests, resource);
        const limit = metricValue(limits, resource);
        const scale = podResourceScale(used, request, limit);
        return {
            resource,
            usage: used,
            request,
            limit,
            usagePercent: markOnScale(used, scale),
            requestMark: markOnScale(request, scale),
            limitMark: markOnScale(limit, scale),
        };
    });
}

// The pod's share of its scheduling node, as one row per resource (cpu and memory only —
// the Metrics API reports no pod disk or network usage, so those are not shown at all).
// Each percentage is pod usage ÷ node allocatable for that resource (a whole number).
// nodeAllocatable is null when the pod is unscheduled or the node read failed; the rows
// then carry a null allocatable and percentage so the indicator shows "—" honestly. Pure:
// unit-tested in frontend/src/tests/lib/pod-node-share.test.ts.
export function podNodeShares(
    podUsage: ResourceUsage,
    nodeAllocatable: ResourceUsage | null,
): PodNodeShareRow[] {
    const resources: PodNodeShareResource[] = ["cpu", "memory"];
    return resources.map((resource) => {
        const usage = metricValue(podUsage, resource);
        const allocatable = nodeAllocatable === null ? null : metricValue(nodeAllocatable, resource);
        return {
            resource,
            usage,
            allocatable,
            percentage: usagePercent(usage, allocatable),
        };
    });
}
