// Pure, React-free helpers for the resource-utilization UI (cluster cards, nodes/pods
// table bar columns, node-summary strip, workloads table). Everything here is a pure
// function or type: no React, no I/O, so the values are deterministic and the e2e suite
// can assert on them. Per project policy these frontend pure helpers are covered by the
// resource-utilization e2e (resource-utilization-13) rather than unit tests; the
// classifiers return level + label only (no colours) so the colours plan
// (2-plan-resource-utilization-colors.md) can map levels → palette without touching this
// file. The exact threshold bands below are ported from the prototype index.html /
// nodes.html scripts and documented in each classifier's comment.

import { formatCpu, formatMemory } from "./performance";
import type { NodeUsage } from "karse-types";

// Which figure the shared View-mode toggle selects: live consumption from the Metrics
// API ("usage") or the CPU/memory reserved by pod specs ("requests"). Default is "usage".
export type ViewMode = "usage" | "requests";

// Which figure the shared Value-format toggle selects: a percentage of the scope's base
// ("percent") or a "used / total" absolute figure ("absolute"). Default is "percent".
export type ValueFormat = "percent" | "absolute";

// The severity level a threshold classifier assigns to a value, paired with a short
// human label. Colour-free on purpose: the colours plan maps level → palette later.
// "info" is the neutral level used where a value is informational rather than graded
// (e.g. a value that is neither over nor under a band).
export type ThresholdLevel = "ok" | "warn" | "critical" | "info";

// A classifier's verdict: the colour-free severity level plus a short label to show.
export type ThresholdResult = {
    level: ThresholdLevel;
    label: string;
};

// Middle-truncates text to maxLen characters, keeping the start and end and replacing the
// middle with "...". Returns text unchanged when text.length <= maxLen. The kept halves
// are floor(maxLen/2) start chars and ceil(maxLen/2) end chars (so odd maxLen keeps one
// more end char than start). Used for treemap node-leaf labels, where a long node name
// would overflow a small box. The "..." is added on top of the kept halves, so the result
// may be a few characters longer than maxLen — matching the prototype label behaviour.
export function truncateMiddle(text: string, maxLen: number): string {
    if (text.length <= maxLen) {
        return text;
    }
    const start = Math.floor(maxLen / 2);
    const end = Math.ceil(maxLen / 2);
    return `${text.slice(0, start)}...${text.slice(text.length - end)}`;
}

// A value as a whole-number percentage of a base, rounded, or null when either input is
// null or the base is zero (so the caller renders an em-dash rather than a fabricated 0%).
// Shared by the three scope helpers below — they differ only in which base they pass.
function percentOf(value: number | null, base: number | null): number | null {
    if (value === null || base === null || base === 0) {
        return null;
    }
    return Math.round((value / base) * 100);
}

// A value as a percentage of the cluster total (cluster cards and the workloads table
// use the summed cluster allocatable / total as the base).
export function clusterPercent(value: number | null, clusterTotal: number | null): number | null {
    return percentOf(value, clusterTotal);
}

// A value as a percentage of a node's allocatable capacity (nodes table and node detail).
export function nodePercent(value: number | null, nodeAllocatable: number | null): number | null {
    return percentOf(value, nodeAllocatable);
}

// A pod's usage as a percentage of the pod's own request (pods table / pod detail in
// usage mode: "how close is this pod to its reservation").
export function podRequestPercent(usage: number | null, request: number | null): number | null {
    return percentOf(usage, request);
}

// One gibibyte in bytes (1024^3), the threshold above which formatAbsoluteMemory shows GB.
const ONE_GIB = 1024 * 1024 * 1024;

// Formats a CPU used/total pair as an absolute "used / total vCPU" string for the
// Absolute value-format, reusing formatCpu so the millicore/core rules stay consistent
// (e.g. "21.6 / 80 vCPU"). A null component renders as an em-dash via formatCpu.
export function formatAbsoluteCpu(used: number | null, total: number | null): string {
    return `${formatCpu(used)} / ${formatCpu(total)} vCPU`;
}

// Formats a memory used/total pair as an absolute "used / total GB" string for the
// Absolute value-format. Values ≥ 1 GiB are shown in GB with one decimal (e.g.
// "174.7 / 448 GB"); below 1 GiB the binary-unit formatMemory string is used so small
// figures stay readable. A null component renders as an em-dash.
export function formatAbsoluteMemory(used: number | null, total: number | null): string {
    return `${formatMemoryGb(used)} / ${formatMemoryGb(total)} GB`;
}

// Formats one memory figure (bytes) for the absolute "GB" display: ≥ 1 GiB → GB with one
// decimal, otherwise fall back to formatMemory's binary-unit string, and null → em-dash.
function formatMemoryGb(bytes: number | null): string {
    if (bytes === null) {
        return "—";
    }
    if (bytes >= ONE_GIB) {
        return (bytes / ONE_GIB).toFixed(1);
    }
    return formatMemory(bytes);
}

// Classifies a cluster card's CPU usage percentage (usage ÷ cluster allocatable).
// Prototype index.html bands: red > 80 (critical, over-committed), amber < 20 (warn,
// idle), green 20–80 (ok). null percent → info (no Metrics API).
export function classifyClusterCpuUsage(percent: number | null): ThresholdResult {
    if (percent === null) {
        return { level: "info", label: "—" };
    }
    if (percent > 80) {
        return { level: "critical", label: "High" };
    }
    if (percent < 20) {
        return { level: "warn", label: "Idle" };
    }
    return { level: "ok", label: "Healthy" };
}

// Classifies a cluster card's CPU requests percentage (cluster requests ÷ cluster
// allocatable). Prototype index.html bands: red > 85 (critical, over-reserved), amber < 40
// (warn, under-reserved), green 40–85 (ok). null → info.
export function classifyClusterCpuRequests(percent: number | null): ThresholdResult {
    if (percent === null) {
        return { level: "info", label: "—" };
    }
    if (percent > 85) {
        return { level: "critical", label: "Over-reserved" };
    }
    if (percent < 40) {
        return { level: "warn", label: "Under-reserved" };
    }
    return { level: "ok", label: "Healthy" };
}

// Classifies a cluster card's memory usage percentage. Memory mirrors the CPU usage bands
// from the prototype (red > 80, amber < 20, green 20–80). null → info.
export function classifyClusterMemoryUsage(percent: number | null): ThresholdResult {
    return classifyClusterCpuUsage(percent);
}

// Classifies a cluster card's memory requests percentage. Mirrors the CPU requests bands
// (red > 85, amber < 40, green 40–85). null → info.
export function classifyClusterMemoryRequests(percent: number | null): ThresholdResult {
    return classifyClusterCpuRequests(percent);
}

// Classifies a node row in the nodes table. Prototype nodes.html bands apply to both
// usage and requests modes via the node's percentage of its allocatable: over ≥ 85
// (critical), under ≤ 35 (warn, room to pack more), else healthy (ok). null → info.
export function classifyNodeRow(percent: number | null): ThresholdResult {
    if (percent === null) {
        return { level: "info", label: "—" };
    }
    if (percent >= 85) {
        return { level: "critical", label: "Over-utilized" };
    }
    if (percent <= 35) {
        return { level: "warn", label: "Under-utilized" };
    }
    return { level: "ok", label: "Healthy" };
}

// Classifies a pod/workload row in usage mode (pods table, node-detail pods table): the
// pod's usage as a percentage of its own request. Prototype: ≥ 90 → under-provisioned
// (critical, close to its reservation), ≤ 35 → over-reserving (warn, reserving far more
// than it uses), else OK. null → info (no request set or no usage).
export function classifyPodUsageRow(percent: number | null): ThresholdResult {
    if (percent === null) {
        return { level: "info", label: "—" };
    }
    if (percent >= 90) {
        return { level: "critical", label: "Under-provisioned" };
    }
    if (percent <= 35) {
        return { level: "warn", label: "Over-reserving" };
    }
    return { level: "ok", label: "OK" };
}

// Classifies a cluster workload row in requests mode: a single pod/workload claiming a
// large share of the cluster. Prototype: requests ≥ 50% of the cluster CPU total → large
// claim (warn), else OK. null → info.
export function classifyWorkloadRequestsRow(percentOfCluster: number | null): ThresholdResult {
    if (percentOfCluster === null) {
        return { level: "info", label: "—" };
    }
    if (percentOfCluster >= 50) {
        return { level: "warn", label: "Large claim" };
    }
    return { level: "ok", label: "OK" };
}

// Classifies a node for the node-summary strip bands, by its CPU requests percentage of
// allocatable. Prototype nodes.html strip: ≥ 85 → over-utilized, < 40 → under-utilized,
// 40–85 → healthy. null percent counts as neither (info) so a node with no readable CPU
// requests/allocatable is left out of the strip counts. Used by
// buildNodeUtilizationSummary below.
export function classifyNodeSummaryBand(percent: number | null): ThresholdResult {
    if (percent === null) {
        return { level: "info", label: "—" };
    }
    if (percent >= 85) {
        return { level: "critical", label: "Over-utilized" };
    }
    if (percent < 40) {
        return { level: "warn", label: "Under-utilized" };
    }
    return { level: "ok", label: "Healthy" };
}

// The node-summary strip counts: how many nodes are over-utilized (CPU requests ≥ 85% of
// allocatable), healthy (40–85%), and under-utilized (< 40%). Nodes whose CPU requests or
// allocatable is unreadable (null base) are excluded from all three counts (classified
// "info"), so the counts only reflect nodes the band could actually be computed for.
export function buildNodeUtilizationSummary(nodes: NodeUsage[]): {
    over: number;
    healthy: number;
    under: number;
} {
    let over = 0;
    let healthy = 0;
    let under = 0;
    for (const node of nodes) {
        const percent = nodePercent(node.requests.cpuMillicores, node.allocatable.cpuMillicores);
        const band = classifyNodeSummaryBand(percent);
        if (band.level === "critical") {
            over += 1;
        }
        else if (band.level === "ok") {
            healthy += 1;
        }
        else if (band.level === "warn") {
            under += 1;
        }
    }
    return { over, healthy, under };
}
