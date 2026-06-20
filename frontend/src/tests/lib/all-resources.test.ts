import type { Pod, Node, Namespace, Deployment, StatefulSet, DaemonSet, HorizontalPodAutoscaler } from "karse-types";
import { aggregateResources, presentKinds, ALL_RESOURCE_KINDS } from "../../lib/all-resources";

function makePod(name: string, phase: Pod["phase"], namespace = "default"): Pod {
    return {
        name,
        namespace,
        phase,
        ready: "1/1",
        containerCount: 1,
        restarts: 0,
        createdAt: "2024-01-01T00:00:00Z",
        node: "node-1",
        labels: { app: name },
    };
}

function makeNode(name: string, status: Node["status"]): Node {
    return {
        name,
        status,
        roles: [],
        version: "v1.29.0",
        createdAt: "2024-02-01T00:00:00Z",
        labels: { "kubernetes.io/hostname": name },
    };
}

function makeNamespace(name: string): Namespace {
    return {
        name,
        labels: {},
        resourceCount: 0,
    };
}

function makeDeployment(name: string, ready: string): Deployment {
    return {
        name,
        namespace: "default",
        ready,
        upToDate: 1,
        available: 1,
        createdAt: "2024-03-01T00:00:00Z",
        labels: {},
    };
}

function makeStatefulSet(name: string, ready: string): StatefulSet {
    return {
        name,
        namespace: "default",
        ready,
        createdAt: "2024-04-01T00:00:00Z",
        labels: {},
    };
}

function makeDaemonSet(name: string, ready: number, desired: number): DaemonSet {
    return {
        name,
        namespace: "kube-system",
        desired,
        current: ready,
        ready,
        upToDate: ready,
        available: ready,
        createdAt: "2024-05-01T00:00:00Z",
        labels: {},
    };
}

function makeHpa(name: string, targets = "cpu: 40%/80%"): HorizontalPodAutoscaler {
    return {
        name,
        namespace: "default",
        reference: "Deployment/web",
        minReplicas: 1,
        maxReplicas: 10,
        currentReplicas: 3,
        targets,
        createdAt: "2024-06-01T00:00:00Z",
        labels: { app: name },
    };
}

describe("aggregateResources", () => {
    test("returns no rows for empty inputs", () => {
        expect(aggregateResources({})).toEqual([]);
    });

    test("produces one normalised row per resource across kinds", () => {
        const rows = aggregateResources({
            pods: [makePod("p1", "Running")],
            nodes: [makeNode("n1", "Ready")],
            namespaces: [makeNamespace("default")],
            deployments: [makeDeployment("d1", "1/1")],
            statefulSets: [makeStatefulSet("s1", "2/2")],
            daemonSets: [makeDaemonSet("ds1", 3, 3)],
            horizontalPodAutoscalers: [makeHpa("hpa1")],
        });
        // One row per input resource, seven in total.
        expect(rows).toHaveLength(7);
    });

    test("normalises a pod row with the shared fields", () => {
        const [row] = aggregateResources({ pods: [makePod("nginx", "Running", "web")] });
        expect(row).toEqual({
            kind: "Pod",
            namespace: "web",
            name: "nginx",
            status: "Running",
            health: "Healthy",
            createdAt: "2024-01-01T00:00:00Z",
            detailPath: "/pods/web/nginx",
            labels: { app: "nginx" },
        });
    });

    test("leaves the namespace blank and resolves a detail path for cluster-scoped nodes", () => {
        const [row] = aggregateResources({ nodes: [makeNode("node-cp", "Ready")] });
        expect(row.namespace).toBe("");
        expect(row.kind).toBe("Node");
        expect(row.status).toBe("Ready");
        expect(row.health).toBe("Healthy");
        expect(row.detailPath).toBe("/nodes/node-cp");
    });

    test("classifies an unhealthy node as Error", () => {
        const [row] = aggregateResources({ nodes: [makeNode("bad", "NotReady")] });
        expect(row.health).toBe("Error");
    });

    test("shows namespaces as Active/Other with no age and a detail path", () => {
        const [row] = aggregateResources({ namespaces: [makeNamespace("team-a")] });
        expect(row).toEqual({
            kind: "Namespace",
            namespace: "",
            name: "team-a",
            status: "Active",
            health: "Other",
            createdAt: "",
            detailPath: "/namespaces/team-a",
            labels: {},
        });
    });

    test("carries the ready ratio as status and derives health for deployments", () => {
        const healthy = aggregateResources({ deployments: [makeDeployment("ok", "3/3")] })[0];
        expect(healthy.status).toBe("3/3");
        expect(healthy.health).toBe("Healthy");
        expect(healthy.detailPath).toBe("/deployments/default/ok");

        const broken = aggregateResources({ deployments: [makeDeployment("down", "0/3")] })[0];
        expect(broken.health).toBe("Error");
    });

    test("carries the ready ratio for stateful sets", () => {
        const [row] = aggregateResources({ statefulSets: [makeStatefulSet("db", "2/2")] });
        expect(row.kind).toBe("StatefulSet");
        expect(row.status).toBe("2/2");
        expect(row.health).toBe("Healthy");
        expect(row.detailPath).toBe("/statefulsets/default/db");
    });

    test("renders daemon set status as ready/desired and derives health", () => {
        const healthy = aggregateResources({ daemonSets: [makeDaemonSet("agent", 3, 3)] })[0];
        expect(healthy.kind).toBe("DaemonSet");
        expect(healthy.status).toBe("3/3");
        expect(healthy.health).toBe("Healthy");
        expect(healthy.detailPath).toBe("/daemonsets/kube-system/agent");

        const broken = aggregateResources({ daemonSets: [makeDaemonSet("agent", 0, 3)] })[0];
        expect(broken.health).toBe("Error");
    });

    test("shows an HPA's metric summary as status, Other health, and no detail path", () => {
        const [row] = aggregateResources({ horizontalPodAutoscalers: [makeHpa("web-hpa", "cpu: 55%/80%")] });
        expect(row).toEqual({
            kind: "HorizontalPodAutoscaler",
            namespace: "default",
            name: "web-hpa",
            status: "cpu: 55%/80%",
            health: "Other",
            createdAt: "2024-06-01T00:00:00Z",
            // HPAs have no detail page, so the row degrades to plain text.
            detailPath: null,
            labels: { app: "web-hpa" },
        });
    });

    test("groups rows by kind in display order, preserving input order within a kind", () => {
        const rows = aggregateResources({
            deployments: [makeDeployment("d2", "1/1"), makeDeployment("d1", "1/1")],
            pods: [makePod("p1", "Running")],
            nodes: [makeNode("n1", "Ready")],
        });
        expect(rows.map((r) => r.kind)).toEqual(["Pod", "Node", "Deployment", "Deployment"]);
        // Input order within the Deployment group is preserved.
        expect(rows.filter((r) => r.kind === "Deployment").map((r) => r.name)).toEqual(["d2", "d1"]);
    });

    test("treats a missing list as contributing no rows", () => {
        const rows = aggregateResources({ pods: [makePod("only", "Running")] });
        expect(rows).toHaveLength(1);
        expect(rows[0].kind).toBe("Pod");
    });
});

describe("presentKinds", () => {
    test("returns the distinct kinds present, in display order", () => {
        const rows = aggregateResources({
            daemonSets: [makeDaemonSet("ds", 1, 1)],
            pods: [makePod("p", "Running")],
            namespaces: [makeNamespace("ns")],
            horizontalPodAutoscalers: [makeHpa("hpa")],
        });
        expect(presentKinds(rows)).toEqual(["Pod", "Namespace", "DaemonSet", "HorizontalPodAutoscaler"]);
    });

    test("returns an empty list when there are no rows", () => {
        expect(presentKinds([])).toEqual([]);
    });

    test("never returns a kind outside the known set", () => {
        const rows = aggregateResources({ pods: [makePod("p", "Running")] });
        for (const kind of presentKinds(rows)) {
            expect(ALL_RESOURCE_KINDS).toContain(kind);
        }
    });
});
