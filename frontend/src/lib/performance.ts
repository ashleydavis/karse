// Pure transform and format helpers for the Performance tabs. These are frontend
// modules and, per project policy, are not unit-tested directly; they are exercised
// by the Playwright e2e suite (and the smoke endpoint checks for the data they shape).
// Keeping them pure (no React, no I/O) makes the charts deterministic and the e2e
// assertions stable.

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

// Builds the node Breakdown treemap: namespace → pod → container, where each leaf's
// value is the container's usage for the selected metric. The node's own name is not a
// level (the view is already scoped to one node), so the top split is by namespace.
// Containers with no usage (null) or zero usage are filtered out, so the treemap only
// shows containers that actually consume the metric (an empty rectangle carries no
// information and breaks nivo's layout). A leaf still navigates to its owning pod's
// detail page on click, reusing the cluster treemap's leaf navigation fields.
export function buildNodeTreemap(pods: PodUsage[], metric: PerformanceMetric): TreemapNode {
    // namespace name → pod name → container leaf list, preserving first-seen order.
    const byNamespace = new Map<string, Map<string, TreemapNode[]>>();

    for (const pod of pods) {
        for (const container of pod.containers) {
            const value = metricValue(container.usage, metric);
            if (value === null || value <= 0) {
                continue;
            }
            let byPod = byNamespace.get(pod.namespace);
            if (byPod === undefined) {
                byPod = new Map<string, TreemapNode[]>();
                byNamespace.set(pod.namespace, byPod);
            }
            let leaves = byPod.get(pod.name);
            if (leaves === undefined) {
                leaves = [];
                byPod.set(pod.name, leaves);
            }
            leaves.push({
                id: `${pod.namespace}/${pod.name}/${container.name}`,
                value,
                utilisation: utilisation(container.usage, container.limits, metric),
                podNamespace: pod.namespace,
                podName: pod.name,
            });
        }
    }

    const namespaces: TreemapNode[] = [];
    for (const [namespace, byPod] of byNamespace) {
        const podNodes: TreemapNode[] = [];
        for (const [podName, leaves] of byPod) {
            podNodes.push({ id: `${namespace}/${podName}`, children: leaves });
        }
        namespaces.push({ id: namespace, children: podNodes });
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
