import { resourceKindLabel, resourceNameSegments, resourcePath } from "../../lib/resource-link";

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

    test("falls back to the generic route for a namespaced kind with no page of its own", () => {
        expect(resourcePath("ReplicaSet", "web-7d9", "default")).toBe("/resources/replicasets/default/web-7d9");
        expect(resourcePath("Job", "backup", "default")).toBe("/resources/jobs/default/backup");
        expect(resourcePath("Service", "web", "default")).toBe("/resources/services/default/web");
        expect(resourcePath("HorizontalPodAutoscaler", "web-hpa", "default"))
            .toBe("/resources/horizontalpodautoscalers/default/web-hpa");
    });

    test("falls back to the generic route with no namespace segment for a cluster-scoped kind", () => {
        expect(resourcePath("PersistentVolume", "pv-1", "")).toBe("/resources/persistentvolumes/pv-1");
        expect(resourcePath("StorageClass", "standard", "")).toBe("/resources/storageclasses/standard");
        expect(resourcePath("ClusterRole", "view", "")).toBe("/resources/clusterroles/view");
    });

    test("ignores any namespace passed for a cluster-scoped generic kind", () => {
        expect(resourcePath("StorageClass", "standard", "default")).toBe("/resources/storageclasses/standard");
    });

    test("a kind with its own detail page never resolves to the generic route", () => {
        // The precedence rule: the six purpose-built pages always win. Asserted here so it
        // is a checked property rather than a consequence of the order two branches are
        // written in.
        const withOwnPage: [string, string, string][] = [
            ["Pod", "nginx-abc", "default"],
            ["Node", "node-worker", ""],
            ["Namespace", "kube-system", ""],
            ["Deployment", "web", "prod"],
            ["StatefulSet", "db", "data"],
            ["DaemonSet", "agent", "kube-system"],
        ];
        for (const [kind, name, namespace] of withOwnPage) {
            const path = resourcePath(kind, name, namespace);
            expect(path).not.toBeNull();
            expect(path).not.toContain("/resources/");
        }
    });

    test("returns null for a generic namespaced kind with no namespace", () => {
        expect(resourcePath("ReplicaSet", "web-7d9", "")).toBeNull();
        expect(resourcePath("HorizontalPodAutoscaler", "web-hpa", "")).toBeNull();
    });

    test("returns null for a generic kind with an empty name", () => {
        expect(resourcePath("ReplicaSet", "", "default")).toBeNull();
        expect(resourcePath("StorageClass", "", "")).toBeNull();
    });

    test("links a kind Karse has never heard of to the generic route", () => {
        // A kind absent from the shared table still gets a detail page: its token is the
        // kind's own lowercase name, and its scope comes from the reference itself.
        expect(resourcePath("Lease", "node-1", "kube-node-lease")).toBe("/resources/lease/kube-node-lease/node-1");
        expect(resourcePath("EndpointSlice", "web-abc", "default")).toBe("/resources/endpointslice/default/web-abc");
        expect(resourcePath("CustomWidget", "thing", "")).toBe("/resources/customwidget/thing");
    });

    test("returns null for a kind Karse refuses to read", () => {
        expect(resourcePath("Secret", "db-password", "default")).toBeNull();
    });

    test("returns null for a kind name that could not be a kubectl resource name", () => {
        expect(resourcePath("", "thing", "default")).toBeNull();
        expect(resourcePath("-o", "thing", "default")).toBeNull();
        expect(resourcePath("two words", "thing", "default")).toBeNull();
    });
});

describe("resourceNameSegments", () => {
    test("gives namespace and name for a namespaced kind", () => {
        expect(resourceNameSegments("Pod", "nginx-abc", "default")).toEqual(["default", "nginx-abc"]);
        expect(resourceNameSegments("HorizontalPodAutoscaler", "web-hpa", "default")).toEqual(["default", "web-hpa"]);
    });

    test("gives the name alone for a cluster-scoped kind, whatever namespace is passed", () => {
        expect(resourceNameSegments("Node", "node-worker", "")).toEqual(["node-worker"]);
        expect(resourceNameSegments("StorageClass", "standard", "default")).toEqual(["standard"]);
    });

    test("gives the name alone when a namespaced reference arrived without a namespace", () => {
        expect(resourceNameSegments("Pod", "nginx-abc", "")).toEqual(["nginx-abc"]);
        expect(resourceNameSegments("ReplicaSet", "web-7d9", "")).toEqual(["web-7d9"]);
    });
});

describe("resourceKindLabel", () => {
    test("names a kind Karse knows by its display kind", () => {
        expect(resourceKindLabel("horizontalpodautoscalers")).toBe("HorizontalPodAutoscaler");
        expect(resourceKindLabel("persistentvolumes")).toBe("PersistentVolume");
    });

    test("names any other kind by its own token", () => {
        expect(resourceKindLabel("leases")).toBe("leases");
        expect(resourceKindLabel("widgets.example.com")).toBe("widgets.example.com");
    });

    test("does not mistake an inherited property name for a kind", () => {
        expect(resourceKindLabel("__proto__")).toBe("__proto__");
        expect(resourceKindLabel("constructor")).toBe("constructor");
    });
});
