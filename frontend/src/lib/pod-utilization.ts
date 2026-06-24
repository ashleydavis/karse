// Pure, React-free helpers for the main pods table's resource-utilization bar columns
// (CPU and memory). Unlike the nodes table (percentage of node allocatable), a pod row's
// **percentage base is the pod's own request** (see docs/spec/resource-utilization):
//
// - **Usage mode** — the bar fills to usage ÷ request (`podRequestPercent`), reading as
//   "how close is this pod to its reservation". The status badge grades that ratio via
//   classifyPodUsageRow (over-reserving / under-provisioned / OK).
// - **Requests mode** — the request itself is the figure: the bar shows a full 100% bar
//   when a request is set (it IS the base) and the value is the request, percent-format
//   showing "100%" and absolute-format showing the request quantity (e.g. "250m", "512Mi").
//
// Per-pod usage and requests are not on the Pod list response; they come from the cluster
// Performance snapshot (`GET /api/cluster/performance` -> { pods: PodUsage[] }). These
// helpers read each PodUsage's usage and requests directly (no node join — the base is the
// pod's request, not the node), key the resulting cells by namespace/name, and provide the
// comparators the table sorts CPU and memory by in each mode.
//
// Scope note: only CPU and memory are shown. The Kubernetes Metrics API reports neither
// disk nor network consumption (a documented exclusion, see
// docs/spec/performance-tabs/detail.md), so there is no figure to show or sort by.

import type { PodUsage } from "karse-types";
import {
    podRequestPercent,
    classifyPodUsageRow,
    formatAbsoluteCpu,
    formatAbsoluteMemory,
    type ViewMode,
    type ValueFormat,
    type ThresholdLevel,
} from "./resource-utilization";
import { formatCpu, formatMemory } from "./performance";
import { podUsageKey, compareUsageValue } from "./pod-resource-sort";

// One bar column's render data for a pod, already resolved for the active view mode and
// value format. percent drives the bar fill (null → empty bar / em-dash), displayText is
// the right-aligned value, level picks the status-badge colour, and sortValue is the
// nullable figure the column sorts by (the same percent the bar shows, so the table sorts
// by what the user sees).
export type PodBarCell = {
    percent: number | null;
    displayText: string;
    level: ThresholdLevel;
    // The short status-badge label for the usage ratio (e.g. "Over-reserving",
    // "Under-provisioned", "OK"), from classifyPodUsageRow. "—" in requests mode (ungraded)
    // and when the ratio cannot be computed (null percent).
    statusLabel: string;
    sortValue: number | null;
};

// A pod's raw CPU and memory usage/request figures (millicores / bytes), pulled straight
// from the cluster Performance snapshot. Either component is null when the Metrics API is
// unavailable (usage) or the pod sets no request (request).
export type PodResourceFigures = {
    cpuUsage: number | null;
    cpuRequest: number | null;
    memoryUsage: number | null;
    memoryRequest: number | null;
};

// A lookup of per-pod usage/request figures keyed by `namespace/name`.
export type PodFiguresMap = Record<string, PodResourceFigures>;

// Builds the namespace/name -> usage/request figures lookup from the cluster Performance
// pods. No node join: the pod's request is the base, so only the pod's own usage and
// requests are read. A pod with no entry (no usage sample) yields all-null figures.
export function buildPodFiguresMap(pods: PodUsage[]): PodFiguresMap {
    const map: PodFiguresMap = {};
    for (const pod of pods) {
        map[podUsageKey(pod.namespace, pod.name)] = {
            cpuUsage: pod.usage.cpuMillicores,
            cpuRequest: pod.requests.cpuMillicores,
            memoryUsage: pod.usage.memoryBytes,
            memoryRequest: pod.requests.memoryBytes,
        };
    }
    return map;
}

// Looks up a pod's figures, returning an all-null reading when the pod has no entry (no
// usage sample, or the Metrics API was unavailable).
export function podFiguresFor(map: PodFiguresMap, namespace: string, name: string): PodResourceFigures {
    return map[podUsageKey(namespace, name)] ?? {
        cpuUsage: null,
        cpuRequest: null,
        memoryUsage: null,
        memoryRequest: null,
    };
}

// In requests mode the request IS the base, so the bar is full (100%) when a request is
// set and empty (null → em-dash) when it is not. The percent the bar shows and the value
// the column sorts by are both this figure.
function requestsPercent(request: number | null): number | null {
    return request === null ? null : 100;
}

// Resolves one bar column's render data for a pod, given the raw usage/request figures, the
// active view mode and value format, and the absolute-format formatter for this metric
// (formatCpu/formatMemory for one figure, and the used/total formatter for usage-absolute).
function resolveCell(
    usage: number | null,
    request: number | null,
    mode: ViewMode,
    format: ValueFormat,
    formatOne: (value: number | null) => string,
    formatPair: (used: number | null, total: number | null) => string,
): PodBarCell {
    if (mode === "requests") {
        const percent = requestsPercent(request);
        return {
            percent,
            // Requests mode is ungraded at the pod scope (the request is the base, not a
            // ratio to grade): neutral "info" level, no over/under badge.
            level: "info",
            statusLabel: "—",
            sortValue: percent,
            displayText: format === "percent"
                ? (percent === null ? "—" : "100%")
                : formatOne(request),
        };
    }
    // Usage mode: the bar fills to usage ÷ request and the badge grades that ratio.
    const percent = podRequestPercent(usage, request);
    const classification = classifyPodUsageRow(percent);
    return {
        percent,
        level: classification.level,
        statusLabel: classification.label,
        sortValue: percent,
        displayText: format === "percent"
            ? (percent === null ? "—" : `${percent}%`)
            : formatPair(usage, request),
    };
}

// The CPU bar cell for a pod in the active mode/format.
export function podCpuCell(figures: PodResourceFigures, mode: ViewMode, format: ValueFormat): PodBarCell {
    return resolveCell(figures.cpuUsage, figures.cpuRequest, mode, format, formatCpu, formatAbsoluteCpu);
}

// The memory bar cell for a pod in the active mode/format.
export function podMemoryCell(figures: PodResourceFigures, mode: ViewMode, format: ValueFormat): PodBarCell {
    return resolveCell(figures.memoryUsage, figures.memoryRequest, mode, format, formatMemory, formatAbsoluteMemory);
}

// Comparator for a bar column: orders two cells ascending by their sortValue (the percent
// the bar shows), nulls below every real value, so the heaviest/largest pods land at one
// end in either mode regardless of which pods lack a reading.
export function comparePodCells(a: PodBarCell, b: PodBarCell): number {
    return compareUsageValue(a.sortValue, b.sortValue);
}
