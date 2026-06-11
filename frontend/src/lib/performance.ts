// Pure transform and format helpers for the Performance tabs. These are frontend
// modules and, per project policy, are not unit-tested directly; they are exercised
// by the Playwright e2e suite (and the smoke endpoint checks for the data they shape).
// Keeping them pure (no React, no I/O) makes the charts deterministic and the e2e
// assertions stable.

import type { NodeUsage, PodUsage, ResourceUsage, PerformanceMetric } from "karse-types";

// A node in the Breakdown treemap. Interior nodes carry children; leaf nodes carry a
// numeric value (the usage for the selected metric). Leaves additionally carry the
// pod's namespace/name so a leaf click can navigate to that pod's detail page.
export type TreemapNode = {
    id: string;
    value?: number;
    // Utilisation ratio (usage / limit) for the leaf, used to colour it green→amber→red.
    // Null when no limit is set (so utilisation cannot be computed).
    utilisation?: number | null;
    // Navigation target carried on leaves so a click can open the pod detail page.
    podNamespace?: string;
    podName?: string;
    children?: TreemapNode[];
};

// A single heatmap row: one node, with a cell per metric column (cpu% / mem%).
export type HeatmapRow = {
    id: string;
    data: { x: string; y: number | null }[];
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

// Builds the cluster Breakdown treemap: node → namespace → pod, where each leaf's
// value is the pod's usage for the selected metric. Pods with no usage (null) or
// zero usage are filtered out, so the treemap only shows pods that actually consume
// the metric (an empty rectangle carries no information and breaks nivo's layout).
export function buildClusterTreemap(pods: PodUsage[], metric: PerformanceMetric): TreemapNode {
    // node name → namespace name → leaf list, preserving first-seen order at each level.
    const byNode = new Map<string, Map<string, TreemapNode[]>>();

    for (const pod of pods) {
        const value = metricValue(pod.usage, metric);
        if (value === null || value <= 0) {
            continue;
        }
        const nodeName = pod.node === "" ? "(unscheduled)" : pod.node;
        let byNamespace = byNode.get(nodeName);
        if (byNamespace === undefined) {
            byNamespace = new Map<string, TreemapNode[]>();
            byNode.set(nodeName, byNamespace);
        }
        let leaves = byNamespace.get(pod.namespace);
        if (leaves === undefined) {
            leaves = [];
            byNamespace.set(pod.namespace, leaves);
        }
        leaves.push({
            id: `${pod.namespace}/${pod.name}`,
            value,
            utilisation: utilisation(pod.usage, pod.limits, metric),
            podNamespace: pod.namespace,
            podName: pod.name,
        });
    }

    const nodes: TreemapNode[] = [];
    for (const [nodeName, byNamespace] of byNode) {
        const namespaces: TreemapNode[] = [];
        for (const [namespace, leaves] of byNamespace) {
            namespaces.push({ id: `${nodeName}/${namespace}`, children: leaves });
        }
        nodes.push({ id: nodeName, children: namespaces });
    }

    return { id: "cluster", children: nodes };
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

// Builds the Hot spots heatmap rows: one row per node, with a cell per metric column
// (cpu% / mem%) holding the node's utilisation (usage ÷ allocatable) as a percentage.
// A cell is null when usage or allocatable is missing, so nivo renders it blank
// rather than as a misleading 0%.
export function buildNodeHeatmap(nodes: NodeUsage[]): HeatmapRow[] {
    return nodes.map((node) => ({
        id: node.name,
        data: [
            { x: "cpu%", y: percentage(node.usage.cpuMillicores, node.allocatable.cpuMillicores) },
            { x: "mem%", y: percentage(node.usage.memoryBytes, node.allocatable.memoryBytes) },
        ],
    }));
}

// Usage as a whole-number percentage of capacity, or null when either input is
// missing or capacity is zero (so the heatmap leaves the cell blank).
function percentage(used: number | null, capacity: number | null): number | null {
    if (used === null || capacity === null || capacity === 0) {
        return null;
    }
    return Math.round((used / capacity) * 100);
}
