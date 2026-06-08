import type { Pod, Node, Deployment, StatefulSet, DaemonSet } from "karse-types";
import {
    computePodStats,
    computeNodeStats,
    computeDeploymentStats,
    computeStatefulSetStats,
    computeDaemonSetStats,
} from "../../lib/resource-stats";

// Builds a Pod fixture with the given name and phase; other fields are realistic
// but irrelevant to the stat computation.
function makePod(name: string, phase: Pod["phase"]): Pod {
    return {
        name,
        namespace: "default",
        phase,
        ready: "1/1",
        containerCount: 1,
        restarts: 0,
        createdAt: "2024-01-01T00:00:00Z",
        node: "node-1",
        labels: {},
    };
}

// Builds a Node fixture with the given name and status.
function makeNode(name: string, status: Node["status"]): Node {
    return {
        name,
        status,
        roles: [],
        version: "v1.29.0",
        createdAt: "2024-01-01T00:00:00Z",
        labels: {},
    };
}

// Builds a Deployment fixture with the given ready ratio string.
function makeDeployment(name: string, ready: string): Deployment {
    return {
        name,
        namespace: "default",
        ready,
        upToDate: 0,
        available: 0,
        createdAt: "2024-01-01T00:00:00Z",
        labels: {},
    };
}

// Builds a StatefulSet fixture with the given ready ratio string.
function makeStatefulSet(name: string, ready: string): StatefulSet {
    return {
        name,
        namespace: "default",
        ready,
        createdAt: "2024-01-01T00:00:00Z",
        labels: {},
    };
}

// Builds a DaemonSet fixture with the given desired and ready pod counts.
function makeDaemonSet(name: string, desired: number, ready: number): DaemonSet {
    return {
        name,
        namespace: "default",
        desired,
        current: desired,
        ready,
        upToDate: desired,
        available: ready,
        createdAt: "2024-01-01T00:00:00Z",
        labels: {},
    };
}

describe("computePodStats", () => {
    test("counts Running and Succeeded as healthy, Failed and Unknown as error", () => {
        const pods = [
            makePod("a", "Running"),
            makePod("b", "Succeeded"),
            makePod("c", "Failed"),
            makePod("d", "Unknown"),
            makePod("e", "Pending"),
        ];
        expect(computePodStats(pods)).toEqual({
            total: 5,
            healthy: 2,
            error: 2,
        });
    });

    test("Pending counts toward total only", () => {
        expect(computePodStats([makePod("a", "Pending")])).toEqual({
            total: 1,
            healthy: 0,
            error: 0,
        });
    });

    test("an empty list is all zeros", () => {
        expect(computePodStats([])).toEqual({
            total: 0,
            healthy: 0,
            error: 0,
        });
    });
});

describe("computeNodeStats", () => {
    test("Ready is healthy; NotReady and Unknown are error", () => {
        const nodes = [
            makeNode("a", "Ready"),
            makeNode("b", "Ready"),
            makeNode("c", "NotReady"),
            makeNode("d", "Unknown"),
        ];
        expect(computeNodeStats(nodes)).toEqual({
            total: 4,
            healthy: 2,
            error: 2,
        });
    });
});

describe("computeDeploymentStats", () => {
    test("x/x is healthy, 0/x is error, partial is neither", () => {
        const deployments = [
            makeDeployment("a", "3/3"),
            makeDeployment("b", "0/2"),
            makeDeployment("c", "1/2"),
        ];
        expect(computeDeploymentStats(deployments)).toEqual({
            total: 3,
            healthy: 1,
            error: 1,
        });
    });

    test("0/0 (no desired replicas) counts toward total only", () => {
        expect(computeDeploymentStats([makeDeployment("a", "0/0")])).toEqual({
            total: 1,
            healthy: 0,
            error: 0,
        });
    });
});

describe("computeStatefulSetStats", () => {
    test("x/x is healthy, 0/x is error, partial is neither", () => {
        const statefulSets = [
            makeStatefulSet("a", "2/2"),
            makeStatefulSet("b", "0/1"),
            makeStatefulSet("c", "1/3"),
        ];
        expect(computeStatefulSetStats(statefulSets)).toEqual({
            total: 3,
            healthy: 1,
            error: 1,
        });
    });
});

describe("computeDaemonSetStats", () => {
    test("ready === desired is healthy, ready 0 is error, partial is neither", () => {
        const daemonSets = [
            makeDaemonSet("a", 3, 3),
            makeDaemonSet("b", 2, 0),
            makeDaemonSet("c", 4, 2),
        ];
        expect(computeDaemonSetStats(daemonSets)).toEqual({
            total: 3,
            healthy: 1,
            error: 1,
        });
    });

    test("desired 0 counts toward total only", () => {
        expect(computeDaemonSetStats([makeDaemonSet("a", 0, 0)])).toEqual({
            total: 1,
            healthy: 0,
            error: 0,
        });
    });
});
