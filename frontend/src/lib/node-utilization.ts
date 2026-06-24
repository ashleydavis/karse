// Pure helpers for the nodes table's bar-column + toggle model (resource-utilization-8).
// Each node row shows CPU and memory as a bar whose base is the node's own allocatable,
// in two View modes:
//   - usage mode:    usage    ÷ node allocatable
//   - requests mode: requests ÷ node allocatable
// and two Value formats: a whole-number percent, or a "used / total" absolute pair.
//
// The figures come from the cluster Performance snapshot (`GET /api/cluster/performance`
// -> { nodes: NodeUsage[], ... }), where each NodeUsage carries the node's usage, the
// summed requests of the pods scheduled on it, and its allocatable. This module turns each
// node into a NodeUtilization reading carrying the four percents (cpu/memory × usage/requests)
// and the four absolute pairs, keyed by node name, plus the comparators the CPU and memory
// columns sort with in whichever mode is active.
//
// Pure functions only (no React, no I/O), so the values are deterministic and the
// resource-utilization e2e (resource-utilization-13) can assert on them.

import type { NodeUsage } from "karse-types";
import { nodePercent } from "./resource-utilization";
import { compareUsageValue } from "./node-usage-sort";
import type { ViewMode } from "./resource-utilization";

// A CPU or memory figure expressed against a node's own allocatable, for one View mode:
// the whole-number percent (null when the value or base is unreadable, so the cell shows an
// em-dash) plus the raw used and total used to render the absolute "used / total" pair.
export type UtilizationFigure = {
    percent: number | null;
    used: number | null;
    total: number | null;
};

// A node's CPU and memory utilisation in both View modes, keyed for the table. Each field is
// a UtilizationFigure so the column can render the percent or the absolute pair and sort on
// the active mode's percent.
export type NodeUtilization = {
    cpuUsage: UtilizationFigure;
    cpuRequests: UtilizationFigure;
    memoryUsage: UtilizationFigure;
    memoryRequests: UtilizationFigure;
};

// A lookup of per-node utilisation readings keyed by node name.
export type NodeUtilizationMap = Record<string, NodeUtilization>;

// An all-null reading, returned for a node with no entry (no Performance sample) so the
// columns render em-dashes rather than breaking.
const EMPTY_FIGURE: UtilizationFigure = { percent: null, used: null, total: null };
const EMPTY_UTILIZATION: NodeUtilization = {
    cpuUsage: EMPTY_FIGURE,
    cpuRequests: EMPTY_FIGURE,
    memoryUsage: EMPTY_FIGURE,
    memoryRequests: EMPTY_FIGURE,
};

// Builds one figure: the value as a percent of the base, plus the raw value/base for the
// absolute pair. A null base leaves used/total as given so the absolute formatter can still
// show "— / total" honestly.
function figure(value: number | null, base: number | null): UtilizationFigure {
    return { percent: nodePercent(value, base), used: value, total: base };
}

// Builds the node-name -> utilisation lookup from the cluster Performance snapshot. For each
// node, CPU and memory are divided by that node's allocatable in both usage and requests
// modes. A node whose usage, requests, or allocatable is unreadable gets null percents in the
// affected figures (em-dash, sorts below nodes that have a reading).
export function buildNodeUtilizationMap(nodes: NodeUsage[]): NodeUtilizationMap {
    const map: NodeUtilizationMap = {};
    for (const node of nodes) {
        const allocCpu = node.allocatable.cpuMillicores;
        const allocMemory = node.allocatable.memoryBytes;
        // requests may be absent on older/partial snapshots (e.g. a fixture without the
        // field); treat a missing requests object as all-null so the figure shows an em-dash.
        const requests = node.requests ?? { cpuMillicores: null, memoryBytes: null };
        map[node.name] = {
            cpuUsage: figure(node.usage.cpuMillicores, allocCpu),
            cpuRequests: figure(requests.cpuMillicores, allocCpu),
            memoryUsage: figure(node.usage.memoryBytes, allocMemory),
            memoryRequests: figure(requests.memoryBytes, allocMemory),
        };
    }
    return map;
}

// Looks up a node's utilisation, returning an all-null reading when the node has no entry.
export function nodeUtilizationFor(map: NodeUtilizationMap, name: string): NodeUtilization {
    return map[name] ?? EMPTY_UTILIZATION;
}

// Selects the CPU figure for the active View mode (usage ÷ allocatable, or requests ÷
// allocatable).
export function cpuFigureFor(u: NodeUtilization, mode: ViewMode): UtilizationFigure {
    return mode === "requests" ? u.cpuRequests : u.cpuUsage;
}

// Selects the memory figure for the active View mode.
export function memoryFigureFor(u: NodeUtilization, mode: ViewMode): UtilizationFigure {
    return mode === "requests" ? u.memoryRequests : u.memoryUsage;
}

// Comparator for the CPU column in the active View mode: orders two node utilisations by the
// mode's CPU percent (usage or requests), with a null reading sorting below every real value.
export function compareNodeCpuMode(a: NodeUtilization, b: NodeUtilization, mode: ViewMode): number {
    return compareUsageValue(cpuFigureFor(a, mode).percent, cpuFigureFor(b, mode).percent);
}

// Comparator for the Memory column in the active View mode.
export function compareNodeMemoryMode(a: NodeUtilization, b: NodeUtilization, mode: ViewMode): number {
    return compareUsageValue(memoryFigureFor(a, mode).percent, memoryFigureFor(b, mode).percent);
}
