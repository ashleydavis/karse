import type { Node, NodeUsage, Pod } from "karse-types";
import type { FilterSelection } from "./table-filter-state";
import { nodeSummaryBandFor } from "./resource-utilization";

// The pure pieces that let a count on the Cluster Overview link to the list that produced
// it: the derived values the new filter-only columns hold, and the seeding of a table's
// initial filter selection from the query param the link carries.
//
// They live here rather than in the table components so both halves of each link can be
// tested against each other: the value a row reports and the value the link's query param
// seeds are the same strings, so a link can never open a list filtered to something no row
// can match.

// The value the pods table's OOMKilled filter column holds for one pod. The pod's
// `oomKilled` flag is computed in the backend by the same rule as the cluster OOMKills
// health counter, so filtering to "Yes" leaves exactly the pods that tile counted.
export function podOomKilledValue(pod: Pod): string {
    return pod.oomKilled ? "Yes" : "No";
}

// The value the nodes table's Pressure filter column holds for one node: "Active" when the
// node reports at least one MemoryPressure / DiskPressure / PIDPressure condition, "None"
// otherwise. The node's `pressure` list is computed in the backend by the same rule as the
// cluster Node pressure health counters.
export function nodePressureValue(node: Node): string {
    return node.pressure.length > 0 ? "Active" : "None";
}

// The band-label shown for a node with no readable CPU requests or allocatable. Such a
// node is in no band, so no band filter matches it, exactly as the node-summary strip
// leaves it out of all three counts.
export const NO_BAND = "—";

// Builds the node-name → band-label map the nodes table's Utilization filter narrows on,
// from the cluster Performance snapshot. Uses nodeSummaryBandFor, the same rule the
// node-summary strip counts with, so a strip card's number and the rows its link opens are
// the same nodes. Nodes in no band are omitted.
export function buildNodeBandMap(nodes: NodeUsage[]): Map<string, string> {
    const bands = new Map<string, string>();
    for (const node of nodes) {
        const band = nodeSummaryBandFor(node);
        if (band.level !== "info") {
            bands.set(node.name, band.label);
        }
    }
    return bands;
}

// The band label to show for one node. A node absent from the map (the Performance
// snapshot has not arrived, or carries no reading for it) has no band.
export function bandLabelFor(bands: Map<string, string>, name: string): string {
    return bands.get(name) ?? NO_BAND;
}

// Turns one query param into a table's initial filter selection for one column, so a link
// can open a list already narrowed to the set a count counted. The seeded selection is an
// ordinary one: the filter button shows it as applied and the user can clear it like any
// other. An absent param, or a value that is not one of the column's options, seeds
// nothing and leaves the filter off, so a stale or hand-edited URL shows the whole list
// rather than an empty one.
export function seedSelection(columnId: string, value: string | null, options: readonly string[]): FilterSelection {
    if (value === null) {
        return {};
    }
    const match = options.find((candidate) => candidate === value);
    if (match === undefined) {
        return {};
    }
    return { [columnId]: [match] };
}
