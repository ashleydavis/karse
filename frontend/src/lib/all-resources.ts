import type {
    Pod, Node, Namespace, Deployment, StatefulSet, DaemonSet,
    HorizontalPodAutoscaler,
} from "karse-types";
import { resourcePath } from "./resource-link";
import {
    podHealth, nodeHealth, deploymentHealth, statefulSetHealth, daemonSetHealth,
    type ResourceHealth,
} from "./resource-stats";

// One resource normalised into the common shape the All resources table renders.
// Every kind Karse lists (pods, nodes, namespaces, deployments, stateful sets,
// daemon sets) collapses onto this so they can share one table. `kind` is the
// singular display kind ("Pod", "Node", ...); `namespace` is "" for cluster-scoped
// kinds (Node, Namespace); `status` is a short human-readable summary (phase or
// ready ratio or "Active") shown in the Status column; `health` is the derived
// Healthy/Error/Other classification reused from the per-kind stats so the health
// filter agrees with every other table; `createdAt` is the ISO timestamp the UI
// turns into an age; `detailPath` is the in-app route to that resource's own detail
// page, or null when the kind has no detail page (so the row degrades to plain
// text); `labels` is the resource's label map for label search/filter.
export type AllResource = {
    kind: string;
    namespace: string;
    name: string;
    status: string;
    health: ResourceHealth;
    createdAt: string;
    detailPath: string | null;
    labels: Record<string, string>;
};

// The kinds the All resources page aggregates, in the order their groups appear.
// Used to seed the Kind filter's options so every known kind is offered even
// before its list has loaded.
export const ALL_RESOURCE_KINDS = [
    "Pod", "Node", "Namespace", "Deployment", "StatefulSet", "DaemonSet",
    "HorizontalPodAutoscaler",
] as const;

// The per-kind lists fed into the aggregator. Each is optional so the page can
// aggregate whatever has loaded so far; a missing/undefined list contributes no
// rows (it is treated as empty).
export type AllResourceInputs = {
    pods?: Pod[];
    nodes?: Node[];
    namespaces?: Namespace[];
    deployments?: Deployment[];
    statefulSets?: StatefulSet[];
    daemonSets?: DaemonSet[];
    horizontalPodAutoscalers?: HorizontalPodAutoscaler[];
};

function podRow(pod: Pod): AllResource {
    return {
        kind: "Pod",
        namespace: pod.namespace,
        name: pod.name,
        status: pod.phase,
        health: podHealth(pod),
        createdAt: pod.createdAt,
        detailPath: resourcePath("Pod", pod.name, pod.namespace),
        labels: pod.labels ?? {},
    };
}

function nodeRow(node: Node): AllResource {
    return {
        kind: "Node",
        namespace: "",
        name: node.name,
        status: node.status,
        health: nodeHealth(node),
        createdAt: node.createdAt,
        detailPath: resourcePath("Node", node.name, ""),
        labels: node.labels ?? {},
    };
}

// Namespaces carry no status/health of their own in Karse's list shape, so the
// status reads "Active" (their normal phase) and they are classified Other (no
// health checkbox), counted toward the total only.
function namespaceRow(namespace: Namespace): AllResource {
    return {
        kind: "Namespace",
        namespace: "",
        name: namespace.name,
        status: "Active",
        health: "Other",
        // The namespaces list does not carry a creation timestamp; age is shown as
        // unknown ("-") for namespace rows.
        createdAt: "",
        detailPath: resourcePath("Namespace", namespace.name, ""),
        labels: namespace.labels ?? {},
    };
}

function deploymentRow(deployment: Deployment): AllResource {
    return {
        kind: "Deployment",
        namespace: deployment.namespace,
        name: deployment.name,
        status: deployment.ready,
        health: deploymentHealth(deployment),
        createdAt: deployment.createdAt,
        detailPath: resourcePath("Deployment", deployment.name, deployment.namespace),
        labels: deployment.labels ?? {},
    };
}

function statefulSetRow(statefulSet: StatefulSet): AllResource {
    return {
        kind: "StatefulSet",
        namespace: statefulSet.namespace,
        name: statefulSet.name,
        status: statefulSet.ready,
        health: statefulSetHealth(statefulSet),
        createdAt: statefulSet.createdAt,
        detailPath: resourcePath("StatefulSet", statefulSet.name, statefulSet.namespace),
        labels: statefulSet.labels ?? {},
    };
}

function daemonSetRow(daemonSet: DaemonSet): AllResource {
    return {
        kind: "DaemonSet",
        namespace: daemonSet.namespace,
        name: daemonSet.name,
        status: `${daemonSet.ready}/${daemonSet.desired}`,
        health: daemonSetHealth(daemonSet),
        createdAt: daemonSet.createdAt,
        detailPath: resourcePath("DaemonSet", daemonSet.name, daemonSet.namespace),
        labels: daemonSet.labels ?? {},
    };
}

// HPAs carry no Healthy/Error notion of their own in Karse's list shape, so they
// are classified Other (no health checkbox) and counted toward the total only.
// The status reads the metric summary (e.g. "cpu: 40%/80%"), and there is no HPA
// detail page so the row has no detail route and degrades to plain text.
function horizontalPodAutoscalerRow(hpa: HorizontalPodAutoscaler): AllResource {
    return {
        kind: "HorizontalPodAutoscaler",
        namespace: hpa.namespace,
        name: hpa.name,
        status: hpa.targets,
        health: "Other",
        createdAt: hpa.createdAt,
        detailPath: resourcePath("HorizontalPodAutoscaler", hpa.name, hpa.namespace),
        labels: hpa.labels ?? {},
    };
}

// Normalises every per-kind list into one combined array of AllResource rows, one
// row per resource, with the shared fields (kind, namespace, name, status, health,
// age, detail route, labels) populated per kind. The order is grouped by kind in
// ALL_RESOURCE_KINDS order; within a kind the input order is preserved. A missing
// list contributes no rows, so the page can aggregate progressively as queries
// resolve.
export function aggregateResources(inputs: AllResourceInputs): AllResource[] {
    const rows: AllResource[] = [];
    for (const pod of inputs.pods ?? []) {
        rows.push(podRow(pod));
    }
    for (const node of inputs.nodes ?? []) {
        rows.push(nodeRow(node));
    }
    for (const namespace of inputs.namespaces ?? []) {
        rows.push(namespaceRow(namespace));
    }
    for (const deployment of inputs.deployments ?? []) {
        rows.push(deploymentRow(deployment));
    }
    for (const statefulSet of inputs.statefulSets ?? []) {
        rows.push(statefulSetRow(statefulSet));
    }
    for (const daemonSet of inputs.daemonSets ?? []) {
        rows.push(daemonSetRow(daemonSet));
    }
    for (const hpa of inputs.horizontalPodAutoscalers ?? []) {
        rows.push(horizontalPodAutoscalerRow(hpa));
    }
    return rows;
}

// The distinct kinds present in a set of aggregated rows, in ALL_RESOURCE_KINDS
// display order. Used to offer the Kind filter only the kinds actually loaded.
export function presentKinds(rows: AllResource[]): string[] {
    const present = new Set(rows.map((row) => row.kind));
    return ALL_RESOURCE_KINDS.filter((kind) => present.has(kind));
}
