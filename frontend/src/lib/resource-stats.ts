import type { Pod, Node, Deployment, StatefulSet, DaemonSet } from "karse-types";

// A per-kind summary of a resource list: how many in total, how many are
// healthy, and how many are in an error state. Computed from the already-fetched
// list so it always reflects the current context/namespace scope.
export type ResourceStats = {
    total: number;
    healthy: number;
    error: number;
};

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

// Computes total/healthy/error counts for a list of pods. Healthy means the pod
// reached Running or Succeeded; error means it is Failed or in an Unknown phase.
// Pending pods count toward the total but are neither healthy nor error.
export function computePodStats(pods: Pod[]): ResourceStats {
    let healthy = 0;
    let error = 0;
    for (const pod of pods) {
        if (pod.phase === "Running" || pod.phase === "Succeeded") {
            healthy += 1;
        }
        else if (pod.phase === "Failed" || pod.phase === "Unknown") {
            error += 1;
        }
    }
    return {
        total: pods.length,
        healthy,
        error,
    };
}

// Computes total/healthy/error counts for a list of nodes. Healthy means the
// node's Ready condition is true; error means it is NotReady or Unknown.
export function computeNodeStats(nodes: Node[]): ResourceStats {
    let healthy = 0;
    let error = 0;
    for (const node of nodes) {
        if (node.status === "Ready") {
            healthy += 1;
        }
        else {
            error += 1;
        }
    }
    return {
        total: nodes.length,
        healthy,
        error,
    };
}

// Computes total/healthy/error counts for a list of deployments. Healthy means
// every desired replica is ready (ready ratio x/x with x > 0); error means none
// of the desired replicas are available while at least one is desired.
export function computeDeploymentStats(deployments: Deployment[]): ResourceStats {
    let healthy = 0;
    let error = 0;
    for (const deployment of deployments) {
        const ratio = parseReadyRatio(deployment.ready);
        if (ratio === null) {
            continue;
        }
        if (ratio.total > 0 && ratio.ready === ratio.total) {
            healthy += 1;
        }
        else if (ratio.total > 0 && ratio.ready === 0) {
            error += 1;
        }
    }
    return {
        total: deployments.length,
        healthy,
        error,
    };
}

// Computes total/healthy/error counts for a list of stateful sets. Healthy means
// every desired replica is ready (ready ratio x/x with x > 0); error means none
// of the desired replicas are ready while at least one is desired.
export function computeStatefulSetStats(statefulSets: StatefulSet[]): ResourceStats {
    let healthy = 0;
    let error = 0;
    for (const statefulSet of statefulSets) {
        const ratio = parseReadyRatio(statefulSet.ready);
        if (ratio === null) {
            continue;
        }
        if (ratio.total > 0 && ratio.ready === ratio.total) {
            healthy += 1;
        }
        else if (ratio.total > 0 && ratio.ready === 0) {
            error += 1;
        }
    }
    return {
        total: statefulSets.length,
        healthy,
        error,
    };
}

// Computes total/healthy/error counts for a list of daemon sets. Healthy means
// every desired pod is ready; error means none are ready while at least one is
// desired.
export function computeDaemonSetStats(daemonSets: DaemonSet[]): ResourceStats {
    let healthy = 0;
    let error = 0;
    for (const daemonSet of daemonSets) {
        if (daemonSet.desired > 0 && daemonSet.ready === daemonSet.desired) {
            healthy += 1;
        }
        else if (daemonSet.desired > 0 && daemonSet.ready === 0) {
            error += 1;
        }
    }
    return {
        total: daemonSets.length,
        healthy,
        error,
    };
}
