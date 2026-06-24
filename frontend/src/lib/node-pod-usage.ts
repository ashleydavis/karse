// Pure helpers for the per-node Pods table's resource-consumption bar columns (CPU and
// memory) on the node detail page. Each column shows a pod's consumption as a share of the
// node it runs on (pod usage-or-requests ÷ that node's allocatable), driven by the shared
// View-mode (usage/requests) and Value-format (percent/absolute) toggles, so the bars read
// the same way as the node-detail utilization cards.
//
// The node detail Pod[] carries no usage; per-pod usage and requests come from the node
// Performance snapshot (`GET /api/nodes/:name/performance` -> { node: NodeUsage, pods:
// PodUsage[] }). These helpers key each pod's usage and requests readings by
// namespace/name; the table cell then computes the figure with `nodeMetricFigure` against
// the node's allocatable for the active toggle state.
//
// Scope note: only CPU and memory are shown. The Kubernetes Metrics API reports neither
// disk nor network consumption (a documented exclusion, see
// docs/spec/performance-tabs/detail.md), so there is no figure to show or sort by.

import type { PodUsage, ResourceUsage } from "karse-types";
import { podUsageKey } from "./pod-resource-sort";

// A pod's usage and requests readings, as carried on the node Performance snapshot. The
// table cell divides the active one (usage in usage mode, requests in requests mode) by the
// node's allocatable to get the share of the node.
export type PodResource = {
    usage: ResourceUsage;
    requests: ResourceUsage;
};

// A lookup of per-pod usage/requests readings keyed by `namespace/name`.
export type PodResourceMap = Record<string, PodResource>;

// An all-null reading for a pod with no snapshot entry (no usage sample, or the Metrics
// API was unavailable), so the bars degrade to an em-dash honestly.
const EMPTY_READING: ResourceUsage = { cpuMillicores: null, memoryBytes: null };

// Builds the namespace/name -> usage/requests lookup for one node's pods from the node
// Performance snapshot.
export function buildNodePodResourceMap(pods: PodUsage[]): PodResourceMap {
    const map: PodResourceMap = {};
    for (const pod of pods) {
        map[podUsageKey(pod.namespace, pod.name)] = {
            usage: pod.usage,
            requests: pod.requests,
        };
    }
    return map;
}

// Looks up a pod's usage/requests readings, returning all-null readings when the pod has no
// entry (it had no usage sample, or the Metrics API was unavailable).
export function podResourceFor(map: PodResourceMap, namespace: string, name: string): PodResource {
    return map[podUsageKey(namespace, name)] ?? { usage: EMPTY_READING, requests: EMPTY_READING };
}
