// The rows the header's context picker renders: the contexts matching its search box,
// grouped under one heading per environment.
//
// This is the picker's whole selection rule, kept out of the component so it can be tested
// directly (the component itself needs a DOM to render). It resolves and orders nothing
// itself: groupByEnvironment applies the user's own environment order, the same call the
// contexts page makes, so the picker cannot drift from the rest of the app.

import type { Context } from "karse-types";
import { groupByEnvironment } from "./cluster-environments";
import type { CompiledEnvironment, EnvironmentGroup, EnvironmentLabels } from "./cluster-environments";

// Matches contexts against the picker's query by name or by cluster (case-insensitive
// substring), sorts the survivors by name, then groups them by environment.
//
// Filtering runs before grouping, so an environment whose every context the query hides
// produces no group at all and its subheading disappears with its rows. An empty query
// matches everything, so the picker opens on the full list.
export function contextPickerGroups(
    contexts: Context[],
    query: string,
    environments: CompiledEnvironment[],
    labels: EnvironmentLabels,
): EnvironmentGroup<Context>[] {
    const q = query.toLowerCase();
    const matching = contexts
        .filter((context) => context.name.toLowerCase().includes(q) || context.cluster.toLowerCase().includes(q))
        .sort((a, b) => a.name.localeCompare(b.name));
    return groupByEnvironment(matching, environments, labels);
}
