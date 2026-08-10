import { aggregateClusters } from "karse-types";
import type { ClusterSummary } from "karse-types";
import { groupClustersByEnvironment } from "../../lib/cluster-environment-groups";
import type { EnvironmentLabels } from "../../lib/cluster-environments";

// No explicit labels: every context falls through to the environment its name implies.
const NO_LABELS: EnvironmentLabels = {};

// A reachable cluster's summary, with the structurally significant fields the overview
// stream really carries. cpu is millicores and memory bytes, matching ClusterResourceTotals.
function reachable(
    context: string,
    nodeCount: number,
    usageCpu: number,
    allocatableCpu: number,
    usageMemory: number,
    allocatableMemory: number,
): ClusterSummary {
    return {
        context,
        cluster: `${context}-cluster`,
        error: null,
        nodeCount,
        metricsAvailable: true,
        totals: {
            usage: {
                cpuMillicores: usageCpu,
                memoryBytes: usageMemory,
            },
            requests: {
                cpuMillicores: usageCpu,
                memoryBytes: usageMemory,
            },
            allocatable: {
                cpuMillicores: allocatableCpu,
                memoryBytes: allocatableMemory,
            },
        },
    };
}

// A cluster that could not be read: the reason in `error`, a null node count and all-null
// totals, exactly as getClusterSummary reports an unreachable context.
function unreachable(context: string, message: string): ClusterSummary {
    return {
        context,
        cluster: `${context}-cluster`,
        error: message,
        nodeCount: null,
        metricsAvailable: false,
        totals: {
            usage: {
                cpuMillicores: null,
                memoryBytes: null,
            },
            requests: {
                cpuMillicores: null,
                memoryBytes: null,
            },
            allocatable: {
                cpuMillicores: null,
                memoryBytes: null,
            },
        },
    };
}

// Groups bare summaries: the tests below group the summaries themselves, where the overview
// table groups its rows, so summaryOf is the identity here.
function group(summaries: ClusterSummary[], labels: EnvironmentLabels) {
    return groupClustersByEnvironment(summaries, (summary) => summary, labels);
}

// Three contexts across three environments by name alone, plus one that matches no token.
const PROD = reachable("prod-eu-1", 4, 1000, 4000, 2_000_000_000, 8_000_000_000);
const PROD_2 = reachable("acme-prod-us", 6, 3000, 12000, 6_000_000_000, 24_000_000_000);
const STAGING = reachable("staging-1", 2, 500, 2000, 1_000_000_000, 4_000_000_000);
const APOLLO = reachable("apollo", 1, 100, 1000, 500_000_000, 2_000_000_000);

describe("groupClustersByEnvironment", () => {
    test("gives each environment the cluster count of the contexts assigned to it", () => {
        const groups = group([PROD, PROD_2, STAGING, APOLLO], NO_LABELS);
        expect(groups.map((entry) => [entry.environment, entry.totals.contextCount])).toEqual([
            ["production", 2],
            ["staging", 1],
            ["unassigned", 1],
        ]);
    });

    test("gives each environment the summed node count of its own contexts", () => {
        const groups = group([PROD, PROD_2, STAGING, APOLLO], NO_LABELS);
        expect(groups.map((entry) => [entry.environment, entry.totals.nodeCount])).toEqual([
            ["production", 10],
            ["staging", 2],
            ["unassigned", 1],
        ]);
    });

    test("aggregates an environment's utilisation from absolute sums, not averaged percentages", () => {
        const groups = group([PROD, PROD_2, STAGING, APOLLO], NO_LABELS);
        const production = groups[0]!;
        // 1000 + 3000 millicores used of 4000 + 12000 allocatable: the sums, so the bigger
        // cluster weighs more. Averaging the two clusters' 25% each would also give 25%
        // here, so the memory figures below use deliberately unequal per-cluster ratios.
        expect(production.totals.totals.usage.cpuMillicores).toBe(4000);
        expect(production.totals.totals.allocatable.cpuMillicores).toBe(16000);
        expect(production.totals.totals.usage.memoryBytes).toBe(8_000_000_000);
        expect(production.totals.totals.allocatable.memoryBytes).toBe(32_000_000_000);
    });

    test("weights a big cluster more than a small one, rather than averaging their percentages", () => {
        // 90% of a 100-core cluster and 10% of a 1-core cluster: the summed figures are
        // 90100 of 101000 millicores (89%), not the 50% an average of the two would give.
        const big = reachable("prod-big", 100, 90000, 100000, 1, 1);
        const small = reachable("prod-small", 1, 100, 1000, 1, 1);
        const groups = group([big, small], NO_LABELS);
        expect(groups).toHaveLength(1);
        expect(groups[0]!.totals.totals.usage.cpuMillicores).toBe(90100);
        expect(groups[0]!.totals.totals.allocatable.cpuMillicores).toBe(101000);
    });

    test("orders the environments production first and unassigned last", () => {
        const local = reachable("minikube", 1, 10, 100, 1, 2);
        const development = reachable("my-dev-box", 1, 10, 100, 1, 2);
        const test = reachable("qa-cluster", 1, 10, 100, 1, 2);
        // Handed in deliberately back-to-front, so a passing order cannot be the input order.
        const groups = group([APOLLO, local, test, development, STAGING, PROD], NO_LABELS);
        expect(groups.map((entry) => entry.environment)).toEqual([
            "production",
            "staging",
            "development",
            "test",
            "local",
            "unassigned",
        ]);
    });

    test("labels each group with the environment's heading", () => {
        const groups = group([PROD, APOLLO], NO_LABELS);
        expect(groups.map((entry) => entry.label)).toEqual(["Production", "Unassigned"]);
    });

    test("shows no group for an environment no cluster resolved to", () => {
        const groups = group([PROD, PROD_2], NO_LABELS);
        expect(groups.map((entry) => entry.environment)).toEqual(["production"]);
    });

    test("shows no Unassigned group when every context is labelled or inferred", () => {
        const groups = group([PROD, STAGING], NO_LABELS);
        expect(groups.some((entry) => entry.environment === "unassigned")).toBe(false);
    });

    test("shows an Unassigned group only for contexts that are neither labelled nor inferable", () => {
        const groups = group([PROD, APOLLO], NO_LABELS);
        const unassigned = groups.find((entry) => entry.environment === "unassigned");
        expect(unassigned).toBeDefined();
        expect(unassigned!.items.map((summary) => summary.context)).toEqual(["apollo"]);
    });

    test("an explicit label moves a cluster out of its inferred environment's group", () => {
        const labels: EnvironmentLabels = {
            apollo: "production",
        };
        const groups = group([PROD, APOLLO], labels);
        expect(groups.map((entry) => entry.environment)).toEqual(["production"]);
        expect(groups[0]!.items.map((summary) => summary.context)).toEqual(["prod-eu-1", "apollo"]);
    });

    test("relabelling a cluster moves its node count into the new environment's total", () => {
        const before = group([PROD, APOLLO], NO_LABELS);
        expect(before.map((entry) => [entry.environment, entry.totals.nodeCount])).toEqual([
            ["production", 4],
            ["unassigned", 1],
        ]);
        const after = group([PROD, APOLLO], {
            apollo: "production",
        });
        expect(after.map((entry) => [entry.environment, entry.totals.nodeCount])).toEqual([
            ["production", 5],
        ]);
    });

    test("relabelling counts the moved cluster once, in the new environment only", () => {
        const groups = group([PROD, PROD_2, STAGING, APOLLO], {
            "prod-eu-1": "staging",
        });
        const contexts = groups.flatMap((entry) => entry.items.map((summary) => summary.context));
        expect(contexts.sort()).toEqual(["acme-prod-us", "apollo", "prod-eu-1", "staging-1"]);
        expect(groups.find((entry) => entry.environment === "production")!.items.map((s) => s.context))
            .toEqual(["acme-prod-us"]);
        expect(groups.find((entry) => entry.environment === "staging")!.items.map((s) => s.context))
            .toEqual(["prod-eu-1", "staging-1"]);
    });

    test("puts every context in exactly one group", () => {
        const summaries = [PROD, PROD_2, STAGING, APOLLO];
        const groups = group(summaries, NO_LABELS);
        const contexts = groups.flatMap((entry) => entry.items.map((summary) => summary.context));
        expect(contexts.sort()).toEqual(["acme-prod-us", "apollo", "prod-eu-1", "staging-1"]);
        expect(contexts).toHaveLength(summaries.length);
    });

    test("keeps an unreachable cluster in its environment but out of that environment's totals", () => {
        const dead = unreachable("prod-dead", "Connection refused");
        const groups = group([PROD, dead], NO_LABELS);
        expect(groups).toHaveLength(1);
        const production = groups[0]!;
        expect(production.items.map((summary) => summary.context)).toEqual(["prod-eu-1", "prod-dead"]);
        expect(production.totals.contextCount).toBe(2);
        expect(production.totals.coveredCount).toBe(1);
        expect(production.totals.failedCount).toBe(1);
        // Only the reachable cluster's four nodes and 1000 millicores are counted.
        expect(production.totals.nodeCount).toBe(4);
        expect(production.totals.totals.usage.cpuMillicores).toBe(1000);
    });

    test("marks an environment's metrics unavailable when one of its clusters has none", () => {
        const noMetrics: ClusterSummary = {
            ...reachable("prod-nometrics", 2, 0, 2000, 0, 4_000_000_000),
            metricsAvailable: false,
        };
        const groups = group([PROD, noMetrics], NO_LABELS);
        expect(groups[0]!.totals.metricsAvailable).toBe(false);
    });
});

describe("environment totals against the grand total", () => {
    // The check worth having: a context counted in two sections, or dropped from all of
    // them, shows up here as sections that no longer add up to the whole.
    function expectTotalsAddUp(summaries: ClusterSummary[], labels: EnvironmentLabels): void {
        const grand = aggregateClusters(summaries);
        const groups = group(summaries, labels);
        const summed = {
            contextCount: groups.reduce((total, entry) => total + entry.totals.contextCount, 0),
            coveredCount: groups.reduce((total, entry) => total + entry.totals.coveredCount, 0),
            failedCount: groups.reduce((total, entry) => total + entry.totals.failedCount, 0),
            nodeCount: groups.reduce((total, entry) => total + entry.totals.nodeCount, 0),
            cpu: groups.reduce((total, entry) => total + (entry.totals.totals.usage.cpuMillicores ?? 0), 0),
            allocatableCpu: groups.reduce((total, entry) => total + (entry.totals.totals.allocatable.cpuMillicores ?? 0), 0),
            memory: groups.reduce((total, entry) => total + (entry.totals.totals.usage.memoryBytes ?? 0), 0),
        };
        expect(summed.contextCount).toBe(grand.contextCount);
        expect(summed.coveredCount).toBe(grand.coveredCount);
        expect(summed.failedCount).toBe(grand.failedCount);
        expect(summed.nodeCount).toBe(grand.nodeCount);
        expect(summed.cpu).toBe(grand.totals.usage.cpuMillicores ?? 0);
        expect(summed.allocatableCpu).toBe(grand.totals.allocatable.cpuMillicores ?? 0);
        expect(summed.memory).toBe(grand.totals.usage.memoryBytes ?? 0);
    }

    test("the environment totals add up to the grand total", () => {
        expectTotalsAddUp([PROD, PROD_2, STAGING, APOLLO], NO_LABELS);
    });

    test("they still add up when some contexts are unassigned", () => {
        expectTotalsAddUp([PROD, APOLLO, reachable("artemis", 3, 300, 3000, 1, 2)], NO_LABELS);
    });

    test("they still add up when a context is unreachable", () => {
        expectTotalsAddUp(
            [PROD, unreachable("staging-dead", "Timed out"), STAGING, APOLLO],
            NO_LABELS,
        );
    });

    test("they still add up after a context is relabelled", () => {
        expectTotalsAddUp([PROD, PROD_2, STAGING, APOLLO], {
            apollo: "staging",
            "prod-eu-1": "local",
        });
    });

    test("they add up to zeroed totals when there are no contexts at all", () => {
        expectTotalsAddUp([], NO_LABELS);
        expect(group([], NO_LABELS)).toEqual([]);
    });
});
