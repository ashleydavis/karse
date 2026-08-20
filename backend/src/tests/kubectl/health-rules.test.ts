import { podWasOOMKilled, activeNodePressures, PRESSURE_CONDITION_TYPES } from "../../kubectl/health-rules";

// A raw kubectl pod item carrying the given container and init-container statuses.
function podItem(containerStatuses: any[], initContainerStatuses: any[] = []): any {
    return {
        metadata: { name: "web", namespace: "default" },
        spec: { nodeName: "node-worker", containers: [{ name: "web" }] },
        status: { phase: "Running", containerStatuses, initContainerStatuses },
    };
}

// A container status whose previous termination carries the given reason.
function terminatedWith(reason: string): any {
    return {
        name: "web",
        ready: true,
        restartCount: 1,
        lastState: { terminated: { reason, exitCode: 137, finishedAt: "2024-01-01T00:00:00Z" } },
        state: { running: { startedAt: "2024-01-01T00:00:05Z" } },
    };
}

// A raw kubectl node item carrying the given status conditions.
function nodeItem(conditions: any[]): any {
    return {
        metadata: { name: "node-worker", labels: {} },
        status: { conditions, nodeInfo: { kubeletVersion: "v1.30.0" } },
    };
}

// One node condition.
function condition(type: string, status: string): any {
    return { type, status, message: "", lastTransitionTime: "2024-01-01T00:00:00Z" };
}

describe("podWasOOMKilled", () => {
    test("is true when a container's previous termination reason is OOMKilled", () => {
        expect(podWasOOMKilled(podItem([terminatedWith("OOMKilled")]))).toBe(true);
    });

    test("is true when an init container's previous termination reason is OOMKilled", () => {
        expect(podWasOOMKilled(podItem([], [terminatedWith("OOMKilled")]))).toBe(true);
    });

    test("is true when only one of several containers was OOMKilled", () => {
        expect(podWasOOMKilled(podItem([terminatedWith("Error"), terminatedWith("OOMKilled")]))).toBe(true);
    });

    test("is false for another previous termination reason", () => {
        expect(podWasOOMKilled(podItem([terminatedWith("Error")]))).toBe(false);
    });

    test("is false when a container has no previous state at all", () => {
        expect(podWasOOMKilled(podItem([{ name: "web", ready: true, restartCount: 0 }]))).toBe(false);
    });

    test("is false when the pod reports no container statuses", () => {
        expect(podWasOOMKilled({ metadata: { name: "web" }, status: { phase: "Pending" } })).toBe(false);
    });

    test("is false when the pod has no status block", () => {
        expect(podWasOOMKilled({ metadata: { name: "web" } })).toBe(false);
    });
});

describe("activeNodePressures", () => {
    test("lists a single active pressure condition", () => {
        expect(activeNodePressures(nodeItem([
            condition("Ready", "True"),
            condition("MemoryPressure", "True"),
        ]))).toEqual(["MemoryPressure"]);
    });

    test("lists every active pressure condition in MemoryPressure, DiskPressure, PIDPressure order", () => {
        expect(activeNodePressures(nodeItem([
            condition("PIDPressure", "True"),
            condition("DiskPressure", "True"),
            condition("MemoryPressure", "True"),
        ]))).toEqual(["MemoryPressure", "DiskPressure", "PIDPressure"]);
    });

    test("is empty when every pressure condition is False", () => {
        expect(activeNodePressures(nodeItem([
            condition("Ready", "True"),
            condition("MemoryPressure", "False"),
            condition("DiskPressure", "False"),
            condition("PIDPressure", "False"),
        ]))).toEqual([]);
    });

    test("treats an Unknown pressure condition as not active", () => {
        expect(activeNodePressures(nodeItem([condition("DiskPressure", "Unknown")]))).toEqual([]);
    });

    test("ignores non-pressure conditions that are True", () => {
        expect(activeNodePressures(nodeItem([
            condition("Ready", "True"),
            condition("NetworkUnavailable", "True"),
        ]))).toEqual([]);
    });

    test("is empty when the node reports no conditions", () => {
        expect(activeNodePressures({ metadata: { name: "node-worker" }, status: {} })).toEqual([]);
    });

    test("covers exactly the three pressure condition types", () => {
        expect(PRESSURE_CONDITION_TYPES).toEqual(["MemoryPressure", "DiskPressure", "PIDPressure"]);
    });
});
