// Pure helpers for the per-node Pods table's resource-consumption columns (CPU and
// memory) on the node detail page. Each column shows a pod's consumption as a
// **percentage of the node it runs on** (pod usage ÷ that node's allocatable), not
// absolute millicores/bytes, so the share each pod takes of the node is directly
// comparable.
//
// The node detail Pod[] carries no usage; per-pod usage comes from the node
// Performance snapshot (`GET /api/nodes/:name/performance` -> { node: NodeUsage,
// pods: PodUsage[] }). These helpers join each pod's usage to the one node's
// allocatable (every pod here is scheduled on that node), key the resulting
// percentages by namespace/name, and reuse the comparators/formatting the main pods
// table uses so the two views agree.
//
// Scope note: only CPU and memory are shown. The Kubernetes Metrics API reports
// neither disk nor network consumption (a documented exclusion, see
// docs/spec/performance-tabs/detail.md), so there is no figure to show or sort by.

import type { NodeUsage, PodUsage } from "karse-types";
import { type PodUsageMap, podUsageKey, usagePercent } from "./pod-resource-sort";

// Re-export the shared lookup/comparator/format helpers so the node detail page can
// import everything it needs for the resource columns from one module, and so the
// node table and the main pods table provably share the same calculation, sort
// order, and rendering.
export {
    type PodResourceUsage,
    type PodUsageMap,
    podUsageKey,
    podUsageFor,
    usagePercent,
    compareUsageValue,
    comparePodCpu,
    comparePodMemory,
    formatPercent,
} from "./pod-resource-sort";

// Builds the namespace/name -> node-share lookup for one node's pods. Each pod's CPU
// and memory usage (from the node Performance snapshot) is divided by the node's
// allocatable to give its share of the node; a missing usage sample or a missing
// node allocatable yields a null percentage (rendered as an em-dash, and sorted
// below pods that have a reading). `allocatable` is the node's allocatable from the
// snapshot (`NodePerformance.node.allocatable`).
export function buildNodePodUsageMap(
    pods: PodUsage[],
    allocatable: NodeUsage["allocatable"] | null,
): PodUsageMap {
    const map: PodUsageMap = {};
    for (const pod of pods) {
        map[podUsageKey(pod.namespace, pod.name)] = {
            cpuPercent: usagePercent(pod.usage.cpuMillicores, allocatable?.cpuMillicores ?? null),
            memoryPercent: usagePercent(pod.usage.memoryBytes, allocatable?.memoryBytes ?? null),
        };
    }
    return map;
}
