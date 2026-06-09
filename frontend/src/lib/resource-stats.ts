import type { Pod, Node, Deployment, StatefulSet, DaemonSet } from "karse-types";

// A per-kind summary of a resource list: how many in total, how many are
// healthy, and how many are in an error state. Computed from the already-fetched
// list so it always reflects the current context/namespace scope.
export type ResourceStats = {
    total: number;
    healthy: number;
    error: number;
};

// The derived health of a single resource. "Healthy" and "Error" mirror the
// stats-header definitions per kind; "Other" is everything that is neither (e.g.
// a Pending pod or a partially-ready workload), counted toward the total only.
export type ResourceHealth = "Healthy" | "Error" | "Other";

// The two health states the health filter offers as checkboxes, in display
// order. "Other" resources have no checkbox: they show only under the default
// (all) view, and are hidden as soon as any health box is selected.
export const HEALTH_FILTER_OPTIONS: ResourceHealth[] = ["Healthy", "Error"];

// Parses a Kubernetes "ready" ratio string such as "2/3" into its ready and
// total parts. Returns null when the string is not a well-formed ratio.
function parseReadyRatio(ready: string): { ready: number; total: number } | null {
    const parts = ready.split("/");
    if (parts.length !== 2) {
        return null;
    }
    const readyCount = Number(parts[0]);
    const totalCount = Number(parts[1]);
    if (Number.isNaN(readyCount) || Number.isNaN(totalCount)) {
        return null;
    }
    return {
        ready: readyCount,
        total: totalCount,
    };
}

// Tallies a list into total/healthy/error counts using a per-resource health
// classifier. Shared by every computeXStats helper so the stats header and the
// health filter always agree on what "healthy" and "error" mean for a kind.
function tallyHealth<T>(items: T[], classify: (item: T) => ResourceHealth): ResourceStats {
    let healthy = 0;
    let error = 0;
    for (const item of items) {
        const health = classify(item);
        if (health === "Healthy") {
            healthy += 1;
        }
        else if (health === "Error") {
            error += 1;
        }
    }
    return {
        total: items.length,
        healthy,
        error,
    };
}

// Classifies a single resource from its ready ratio string (e.g. "2/3"). Healthy
// means every desired replica is ready (x/x with x > 0); error means none are
// ready while at least one is desired (0/x with x > 0); everything else (a
// malformed ratio or 0/0) is Other. Shared by deployments and stateful sets.
function readyRatioHealth(ready: string): ResourceHealth {
    const ratio = parseReadyRatio(ready);
    if (ratio === null) {
        return "Other";
    }
    if (ratio.total > 0 && ratio.ready === ratio.total) {
        return "Healthy";
    }
    if (ratio.total > 0 && ratio.ready === 0) {
        return "Error";
    }
    return "Other";
}

// Classifies a single pod. Healthy means it reached Running or Succeeded; error
// means it is Failed or in an Unknown phase; Pending is Other.
export function podHealth(pod: Pod): ResourceHealth {
    if (pod.phase === "Running" || pod.phase === "Succeeded") {
        return "Healthy";
    }
    if (pod.phase === "Failed" || pod.phase === "Unknown") {
        return "Error";
    }
    return "Other";
}

// Classifies a single node. Healthy means its Ready condition is true; anything
// else (NotReady or Unknown) is error.
export function nodeHealth(node: Node): ResourceHealth {
    if (node.status === "Ready") {
        return "Healthy";
    }
    return "Error";
}

// Classifies a single deployment by its ready ratio (see readyRatioHealth).
export function deploymentHealth(deployment: Deployment): ResourceHealth {
    return readyRatioHealth(deployment.ready);
}

// Classifies a single stateful set by its ready ratio (see readyRatioHealth).
export function statefulSetHealth(statefulSet: StatefulSet): ResourceHealth {
    return readyRatioHealth(statefulSet.ready);
}

// Classifies a single daemon set. Healthy means every desired pod is ready;
// error means none are ready while at least one is desired; 0 desired is Other.
export function daemonSetHealth(daemonSet: DaemonSet): ResourceHealth {
    if (daemonSet.desired > 0 && daemonSet.ready === daemonSet.desired) {
        return "Healthy";
    }
    if (daemonSet.desired > 0 && daemonSet.ready === 0) {
        return "Error";
    }
    return "Other";
}

// Computes total/healthy/error counts for a list of pods (see podHealth).
export function computePodStats(pods: Pod[]): ResourceStats {
    return tallyHealth(pods, podHealth);
}

// Computes total/healthy/error counts for a list of nodes (see nodeHealth).
export function computeNodeStats(nodes: Node[]): ResourceStats {
    return tallyHealth(nodes, nodeHealth);
}

// Computes total/healthy/error counts for a list of deployments (see deploymentHealth).
export function computeDeploymentStats(deployments: Deployment[]): ResourceStats {
    return tallyHealth(deployments, deploymentHealth);
}

// Computes total/healthy/error counts for a list of stateful sets (see statefulSetHealth).
export function computeStatefulSetStats(statefulSets: StatefulSet[]): ResourceStats {
    return tallyHealth(statefulSets, statefulSetHealth);
}

// Computes total/healthy/error counts for a list of daemon sets (see daemonSetHealth).
export function computeDaemonSetStats(daemonSets: DaemonSet[]): ResourceStats {
    return tallyHealth(daemonSets, daemonSetHealth);
}
