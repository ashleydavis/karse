// Grouping the multi-cluster overview's per-cluster summaries by the environment each
// context belongs to, with each environment's aggregate figures.
//
// The fold lives in the frontend because the environment labels live only in the browser's
// karse-config local-storage entry (see lib/cluster-environments.ts), so the backend cannot
// see them and cannot group by them. What it groups is exactly the per-context summaries
// the backend already streams, so there is no second, environment-aware fetch path.
//
// Nothing here resolves environments or orders them itself: resolveEnvironment and
// ENVIRONMENT_ORDER are reached through groupByEnvironment, the same call the contexts page
// and both context pickers make. And nothing here totals anything itself: aggregateClusters
// from karse-types is the same fold the backend runs for the grand total, so an
// environment's numbers and the page's total cannot drift apart.

import { aggregateClusters } from "karse-types";
import type { ClusterSummary, MultiClusterTotals } from "karse-types";
import { groupByEnvironment } from "./cluster-environments";
import type { ClusterEnvironment, EnvironmentLabels } from "./cluster-environments";

// One environment's clusters on the overview: the items the caller handed in that resolved
// to this environment, plus the aggregate figures over their summaries. `label` is the
// environment's heading, so a caller renders the group without a second lookup table.
export type ClusterEnvironmentGroup<T> = {
    environment: ClusterEnvironment;
    label: string;
    items: T[];
    totals: MultiClusterTotals;
};

// Groups cluster summaries by their context's resolved environment, in the fixed
// ENVIRONMENT_ORDER (production first, unassigned last), and totals each group.
//
// The items are generic and the summary is read through `summaryOf`, so the overview page
// can group its table rows while a test groups bare summaries: both take the same path.
//
// An environment no context resolved to produces no group (groupByEnvironment drops it), so
// an "Unassigned" group appears only when a context is neither labelled nor inferable. An
// unreachable cluster stays in its environment's items (it is still that environment's
// cluster) but contributes nothing to the totals, and the group's coveredCount/failedCount
// record how many of its clusters the numbers cover.
//
// Every item lands in exactly one group, because resolveEnvironment returns exactly one
// environment per context and ENVIRONMENT_ORDER is walked once. The totals therefore add
// up to the total over all the items, which `totalsAddUp` in the tests asserts directly.
export function groupClustersByEnvironment<T>(
    items: readonly T[],
    summaryOf: (item: T) => ClusterSummary,
    labels: EnvironmentLabels,
): ClusterEnvironmentGroup<T>[] {
    const named = items.map((item) => ({
        name: summaryOf(item).context,
        item,
    }));
    return groupByEnvironment(named, labels).map((group) => ({
        environment: group.environment,
        label: group.label,
        items: group.items.map((entry) => entry.item),
        totals: aggregateClusters(group.items.map((entry) => summaryOf(entry.item))),
    }));
}
