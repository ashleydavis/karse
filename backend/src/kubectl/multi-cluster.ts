import { listContexts, getClusterPerformance } from "./kubectl-adapter";
import type { ClusterSummary, MultiClusterTotals, ClusterResourceTotals, ResourceUsage } from "karse-types";

// How many contexts are queried at once during the fan-out. A kubeconfig can hold
// dozens of contexts and each one costs several kubectl invocations, so the fan-out is
// bounded rather than issued all at once: an unbounded fan-out over a large kubeconfig
// would spawn hundreds of processes at the same moment.
export const CLUSTER_FANOUT_CONCURRENCY = 4;

// How long a single context's read is waited on before it is recorded as failed. An
// unreachable API server does not fail fast (kubectl blocks on the connection), so
// without a per-context bound one dead context would hold the whole overview open.
export const CLUSTER_FETCH_TIMEOUT_MS = 20000;

// The CPU/memory totals reported for a context that could not be read. Every field is
// null (unknown), never zero: a cluster whose size is unknown must not read as empty.
const UNKNOWN_TOTALS: ClusterResourceTotals = {
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
};

// Rejects with a timeout error when the wrapped promise has not settled within ms.
// The underlying kubectl call is left to finish on its own (its result is discarded);
// what this bounds is how long a caller waits, which is what keeps one dead context
// from holding the page.
function withTimeout<T>(promise: Promise<T>, ms: number, context: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Timed out after ${ms}ms querying context "${context}"`));
        }, ms);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (err) => {
                clearTimeout(timer);
                reject(err);
            },
        );
    });
}

// Adds one numeric field of two usage readings. A null on either side makes the sum
// null: a total that is missing one cluster's contribution is unknown, not smaller.
function addField(total: number | null, part: number | null): number | null {
    if (total === null || part === null) {
        return null;
    }
    return total + part;
}

// Adds two ResourceUsage readings field by field, propagating null as unknown.
function addUsage(a: ResourceUsage, b: ResourceUsage): ResourceUsage {
    return {
        cpuMillicores: addField(a.cpuMillicores, b.cpuMillicores),
        memoryBytes: addField(a.memoryBytes, b.memoryBytes),
    };
}

// Reads one context's node count and cluster-wide CPU/memory totals, reusing exactly the
// reads the cluster home page makes (GET /api/cluster/performance's adapter call), so the
// fan-out shares the on-disk cluster cache with that page rather than issuing new queries.
//
// Never throws: a context that cannot be reached (unreachable API server, expired
// credentials, a read that timed out) comes back as an entry carrying the reason in
// `error`, with a null node count and unknown totals, so one dead context cannot blank
// the page or the totals.
export async function getClusterSummary(context: string, cluster: string): Promise<ClusterSummary> {
    try {
        const performance = await withTimeout(getClusterPerformance(context), CLUSTER_FETCH_TIMEOUT_MS, context);
        return {
            context,
            cluster,
            error: null,
            nodeCount: performance.nodes.length,
            metricsAvailable: performance.metricsAvailable,
            totals: performance.totals,
        };
    }
    catch (err) {
        const message = (err as Error).message.trim();
        return {
            context,
            cluster,
            error: message === "" ? "Could not read this cluster" : message,
            nodeCount: null,
            metricsAvailable: false,
            totals: UNKNOWN_TOTALS,
        };
    }
}

// Totals the per-cluster summaries into the figures the overview page shows.
//
// Aggregate utilisation is NOT an average of the per-cluster percentages: a 100-node
// cluster and a 1-node cluster do not weigh the same. The absolute usage, requests and
// allocatable capacity are summed across clusters and the percentage is derived from
// those sums, so a cluster's weight is its actual capacity.
//
// Only clusters that were read contribute. coveredCount says how many that is, against
// contextCount (every configured context), so a total computed over 3 of 5 clusters
// cannot be misread as covering all 5.
export function aggregateClusters(summaries: readonly ClusterSummary[]): MultiClusterTotals {
    const covered = summaries.filter((summary) => summary.error === null);
    let usage: ResourceUsage = {
        cpuMillicores: 0,
        memoryBytes: 0,
    };
    let requests: ResourceUsage = {
        cpuMillicores: 0,
        memoryBytes: 0,
    };
    let allocatable: ResourceUsage = {
        cpuMillicores: 0,
        memoryBytes: 0,
    };
    let nodeCount = 0;
    let metricsAvailable = true;
    for (const summary of covered) {
        usage = addUsage(usage, summary.totals.usage);
        requests = addUsage(requests, summary.totals.requests);
        allocatable = addUsage(allocatable, summary.totals.allocatable);
        nodeCount += summary.nodeCount ?? 0;
        if (!summary.metricsAvailable) {
            metricsAvailable = false;
        }
    }
    return {
        contextCount: summaries.length,
        coveredCount: covered.length,
        failedCount: summaries.length - covered.length,
        nodeCount,
        metricsAvailable: covered.length > 0 && metricsAvailable,
        totals: {
            usage,
            requests,
            allocatable,
        },
    };
}

// Queries every configured kubeconfig context and returns the aggregate totals, handing
// each cluster's summary to onCluster the moment it lands so the caller can emit it
// before the slowest context has answered. At most CLUSTER_FANOUT_CONCURRENCY contexts
// are in flight at once and each is bounded by CLUSTER_FETCH_TIMEOUT_MS.
//
// A kubeconfig with no contexts calls onCluster not at all and returns zeroed totals with
// contextCount 0, rather than throwing.
//
// READ-ONLY: the only kubectl commands reached from here are `config view` (listing the
// contexts) and the `get` reads getClusterPerformance issues.
export async function streamMultiClusterOverview(
    onCluster: (summary: ClusterSummary) => void,
): Promise<MultiClusterTotals> {
    const contexts = await listContexts();
    const summaries: ClusterSummary[] = [];
    let nextIndex = 0;

    // One fan-out worker: takes the next unclaimed context, reads it, and reports it,
    // until every context has been claimed. Running several of these concurrently is
    // what bounds the fan-out to CLUSTER_FANOUT_CONCURRENCY in-flight contexts.
    async function worker(): Promise<void> {
        while (nextIndex < contexts.length) {
            const context = contexts[nextIndex]!;
            nextIndex += 1;
            const summary = await getClusterSummary(context.name, context.cluster);
            summaries.push(summary);
            onCluster(summary);
        }
    }

    const workers: Promise<void>[] = [];
    const workerCount = Math.min(CLUSTER_FANOUT_CONCURRENCY, contexts.length);
    for (let i = 0; i < workerCount; i += 1) {
        workers.push(worker());
    }
    await Promise.all(workers);

    return aggregateClusters(summaries);
}
