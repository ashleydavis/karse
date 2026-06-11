import { resourcePath } from "../../lib/resource-link";

describe("resourcePath", () => {
    test("builds the pod route from namespace and name", () => {
        expect(resourcePath("Pod", "nginx-abc", "default")).toBe("/pods/default/nginx-abc");
    });

    test("builds the deployment route from namespace and name", () => {
        expect(resourcePath("Deployment", "web", "prod")).toBe("/deployments/prod/web");
    });

    test("builds the stateful set route from namespace and name", () => {
        expect(resourcePath("StatefulSet", "db", "data")).toBe("/statefulsets/data/db");
    });

    test("builds the daemon set route from namespace and name", () => {
        expect(resourcePath("DaemonSet", "agent", "kube-system")).toBe("/daemonsets/kube-system/agent");
    });

    test("builds the cluster-scoped node route from name only", () => {
        expect(resourcePath("Node", "node-worker", "")).toBe("/nodes/node-worker");
    });

    test("ignores any namespace passed for a cluster-scoped node", () => {
        expect(resourcePath("Node", "node-worker", "default")).toBe("/nodes/node-worker");
    });

    test("builds the cluster-scoped namespace route from name only", () => {
        expect(resourcePath("Namespace", "kube-system", "")).toBe("/namespaces/kube-system");
    });

    test("returns null for a namespaced kind with no namespace so it degrades to plain text", () => {
        expect(resourcePath("Pod", "nginx-abc", "")).toBeNull();
        expect(resourcePath("Deployment", "web", "")).toBeNull();
    });

    test("returns null for an empty name", () => {
        expect(resourcePath("Pod", "", "default")).toBeNull();
        expect(resourcePath("Node", "", "")).toBeNull();
    });

    test("returns null for a kind that has no detail page", () => {
        expect(resourcePath("ReplicaSet", "web-7d9", "default")).toBeNull();
        expect(resourcePath("Job", "backup", "default")).toBeNull();
        expect(resourcePath("Service", "web", "default")).toBeNull();
    });
});
