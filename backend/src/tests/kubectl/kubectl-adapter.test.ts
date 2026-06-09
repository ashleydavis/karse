jest.mock("../../command-runner");
jest.mock("../../audit-log");

import type { CommandResult } from "../../command-runner";
import {
    listContexts,
    getCurrentContext,
    setCurrentContext,
    listNamespaces,
    setContextNamespace,
    listNodes,
    getNodeDetail,
    getNamespaceDetail,
    getWorkloadDetail,
    podBelongsToWorkload,
    isWorkloadKind,
    getClusterOverview,
    listPods,
    listEvents,
    listClusterErrors,
    getPodLogs,
    getResourceYaml,
    isYamlResourceType,
    streamPodLogs,
} from "../../kubectl/kubectl-adapter";

// jest.requireMock returns any, so mock methods are accessible without casting.
const { run, stream } = jest.requireMock("../../command-runner");
const { audit } = jest.requireMock("../../audit-log");

// Builds a successful CommandResult with the given stdout.
function ok(stdout: string): CommandResult {
    return {
        stdout,
        stderr: "",
        exitCode: 0,
    };
}

// Builds a failed CommandResult with the given stderr and exit code 1.
function fail(stderr: string): CommandResult {
    return {
        stdout: "",
        stderr,
        exitCode: 1,
    };
}

// Installs a mock implementation for run() that dispatches on args.join(" ").
// Throws a loud error for any argv combination not listed in handlers so a test
// cannot silently pass by querying an unhandled endpoint.
function setRunnerHandlers(
    handlers: Record<string, () => CommandResult | Promise<CommandResult>>
): void {
    run.mockImplementation((_binary: string, args: readonly string[]) => {
        const key = args.join(" ");
        const h = handlers[key];
        if (h === undefined) {
            throw new Error("unmocked kubectl call: " + key);
        }
        return Promise.resolve(h());
    });
}

beforeEach(() => {
    run.mockReset();
    stream.mockReset();
    audit.mockReset().mockResolvedValue(undefined);
});

describe("audit wiring", () => {
    test("listContexts writes the audit entry", async () => {
        setRunnerHandlers({
            "config view -o json": () => ok(JSON.stringify({
                contexts: [],
            })),
        });
        await listContexts();
        expect(audit).toHaveBeenCalledWith("../logs", "kubectl", ["config", "view", "-o", "json"], expect.any(Date));
    });
});

describe("listContexts", () => {
    test("parses two real-shaped contexts", async () => {
        const fixture = {
            contexts: [
                {
                    name: "alpha",
                    context: {
                        cluster: "c1",
                        user: "u1",
                        namespace: "ns1",
                    },
                },
                {
                    name: "beta",
                    context: {
                        cluster: "c2",
                        user: "u2",
                    },
                },
            ],
        };
        setRunnerHandlers({
            "config view -o json": () => ok(JSON.stringify(fixture)),
        });
        const result = await listContexts();
        expect(result.length).toBe(2);
        expect(result[0]!).toEqual({
            name: "alpha",
            cluster: "c1",
            user: "u1",
            namespace: "ns1",
        });
        expect(result[1]!).toEqual({
            name: "beta",
            cluster: "c2",
            user: "u2",
            namespace: null,
        });
    });

    test("treats empty-string namespace as null", async () => {
        const fixture = {
            contexts: [
                {
                    name: "alpha",
                    context: {
                        cluster: "c1",
                        user: "u1",
                        namespace: "",
                    },
                },
            ],
        };
        setRunnerHandlers({
            "config view -o json": () => ok(JSON.stringify(fixture)),
        });
        const result = await listContexts();
        expect(result[0]!.namespace).toBe(null);
    });

    test("returns [] when contexts is null", async () => {
        setRunnerHandlers({
            "config view -o json": () => ok(JSON.stringify({
                contexts: null,
            })),
        });
        const result = await listContexts();
        expect(result.length).toBe(0);
        expect(Array.isArray(result)).toBe(true);
    });

    test("throws on non-zero exit", async () => {
        setRunnerHandlers({
            "config view -o json": () => fail("boom"),
        });
        await expect(listContexts()).rejects.toThrow("boom");
    });
});

describe("getCurrentContext", () => {
    test("returns trimmed name", async () => {
        setRunnerHandlers({
            "config current-context": () => ok("alpha\n"),
        });
        const result = await getCurrentContext();
        expect(result).toBe("alpha");
    });

    test("returns null when not set", async () => {
        setRunnerHandlers({
            "config current-context": () => fail("error: current-context is not set\n"),
        });
        const result = await getCurrentContext();
        expect(result).toBe(null);
    });

    test("throws on other non-zero exit", async () => {
        setRunnerHandlers({
            "config current-context": () => fail("permission denied"),
        });
        await expect(getCurrentContext()).rejects.toThrow("permission denied");
    });
});

describe("setCurrentContext", () => {
    test("invokes runner with exact argv", async () => {
        setRunnerHandlers({
            "config use-context my-ctx": () => ok(""),
        });
        await setCurrentContext("my-ctx");
        expect(run).toHaveBeenCalledTimes(1);
        expect(run).toHaveBeenCalledWith("kubectl", ["config", "use-context", "my-ctx"]);
    });

    test("throws on non-zero exit", async () => {
        setRunnerHandlers({
            "config use-context ghost": () => fail("no such context"),
        });
        await expect(setCurrentContext("ghost")).rejects.toThrow("no such context");
    });
});

describe("listNodes", () => {
    test("parses Ready + NotReady fixture", async () => {
        const fixture = {
            items: [
                {
                    metadata: {
                        name: "ctrl-0",
                        creationTimestamp: "2024-01-01T00:00:00Z",
                        labels: {
                            "node-role.kubernetes.io/control-plane": "",
                        },
                    },
                    status: {
                        conditions: [
                            {
                                type: "MemoryPressure",
                                status: "False",
                            },
                            {
                                type: "Ready",
                                status: "True",
                            },
                        ],
                        nodeInfo: {
                            kubeletVersion: "v1.30.0",
                        },
                    },
                },
                {
                    metadata: {
                        name: "worker-0",
                        creationTimestamp: "2024-06-01T00:00:00Z",
                        labels: {},
                    },
                    status: {
                        conditions: [
                            {
                                type: "Ready",
                                status: "False",
                            },
                        ],
                        nodeInfo: {
                            kubeletVersion: "v1.30.0",
                        },
                    },
                },
            ],
        };
        setRunnerHandlers({
            "--context test-ctx get nodes -o json": () => ok(JSON.stringify(fixture)),
        });
        const result = await listNodes("test-ctx");
        expect(result.length).toBe(2);
        expect(result[0]!).toEqual({
            name: "ctrl-0",
            status: "Ready",
            roles: ["control-plane"],
            version: "v1.30.0",
            createdAt: "2024-01-01T00:00:00Z",
            labels: {
                "node-role.kubernetes.io/control-plane": "",
            },
        });
        expect(result[1]!).toEqual({
            name: "worker-0",
            status: "NotReady",
            roles: [],
            version: "v1.30.0",
            createdAt: "2024-06-01T00:00:00Z",
            labels: {},
        });
    });

    test("derives statuses from realistic kwok-style mixed conditions", async () => {
        // Conditions mirror what a real cluster reports: a full ordered set of
        // kubelet conditions where Ready is not the first entry, plus reason,
        // message and heartbeat fields. Covers Ready, NotReady (Ready=False), a
        // cordoned node (unschedulable but still Ready) and Unknown (Ready
        // condition reporting status Unknown, e.g. a lost-heartbeat node).
        const fixture = {
            items: [
                {
                    metadata: {
                        name: "node-ready",
                        creationTimestamp: "2024-01-01T00:00:00Z",
                        labels: { "node-role.kubernetes.io/worker": "" },
                    },
                    status: {
                        conditions: [
                            { type: "MemoryPressure", status: "False", reason: "KubeletHasSufficientMemory", message: "kubelet has sufficient memory available" },
                            { type: "DiskPressure", status: "False", reason: "KubeletHasNoDiskPressure", message: "kubelet has no disk pressure" },
                            { type: "PIDPressure", status: "False", reason: "KubeletHasSufficientPID", message: "kubelet has sufficient PID available" },
                            { type: "Ready", status: "True", reason: "KubeletReady", message: "kubelet is posting ready status" },
                        ],
                        nodeInfo: { kubeletVersion: "kwok-v0.7.0" },
                    },
                },
                {
                    metadata: {
                        name: "node-notready",
                        creationTimestamp: "2024-02-01T00:00:00Z",
                        labels: {},
                    },
                    status: {
                        conditions: [
                            { type: "MemoryPressure", status: "False", reason: "KubeletHasSufficientMemory", message: "kubelet has sufficient memory available" },
                            {
                                type: "Ready",
                                status: "False",
                                reason: "KubeletNotReady",
                                message: "Simulated NotReady node",
                                lastHeartbeatTime: "2024-01-01T00:00:00Z",
                                lastTransitionTime: "2024-01-01T00:00:00Z",
                            },
                        ],
                        nodeInfo: { kubeletVersion: "fake" },
                    },
                },
                {
                    metadata: {
                        name: "node-cordoned",
                        creationTimestamp: "2024-03-01T00:00:00Z",
                        labels: { "node-role.kubernetes.io/worker": "" },
                    },
                    spec: { unschedulable: true },
                    status: {
                        conditions: [
                            { type: "Ready", status: "True", reason: "KubeletReady", message: "kubelet is posting ready status" },
                        ],
                        nodeInfo: { kubeletVersion: "kwok-v0.7.0" },
                    },
                },
                {
                    metadata: {
                        name: "node-unknown",
                        creationTimestamp: "2024-04-01T00:00:00Z",
                        labels: {},
                    },
                    status: {
                        conditions: [
                            {
                                type: "Ready",
                                status: "Unknown",
                                reason: "NodeStatusUnknown",
                                message: "Kubelet stopped posting node status.",
                            },
                        ],
                        nodeInfo: { kubeletVersion: "v1.30.0" },
                    },
                },
            ],
        };
        setRunnerHandlers({
            "--context test-ctx get nodes -o json": () => ok(JSON.stringify(fixture)),
        });
        const result = await listNodes("test-ctx");
        const byName = new Map(result.map((n) => [n.name, n.status]));
        expect(byName.get("node-ready")).toBe("Ready");
        expect(byName.get("node-notready")).toBe("NotReady");
        expect(byName.get("node-cordoned")).toBe("Ready");
        expect(byName.get("node-unknown")).toBe("Unknown");
    });

    test("handles multiple role labels sorted alphabetically", async () => {
        const fixture = {
            items: [
                {
                    metadata: {
                        name: "ctrl-0",
                        creationTimestamp: "2024-01-01T00:00:00Z",
                        labels: {
                            "node-role.kubernetes.io/control-plane": "",
                            "node-role.kubernetes.io/etcd": "",
                        },
                    },
                    status: {
                        conditions: [
                            {
                                type: "Ready",
                                status: "True",
                            },
                        ],
                        nodeInfo: {
                            kubeletVersion: "v1.30.0",
                        },
                    },
                },
            ],
        };
        setRunnerHandlers({
            "--context test-ctx get nodes -o json": () => ok(JSON.stringify(fixture)),
        });
        const result = await listNodes("test-ctx");
        expect(result[0]!.roles).toEqual(["control-plane", "etcd"]);
    });

    test("derives Unknown when Ready condition missing", async () => {
        const fixture = {
            items: [
                {
                    metadata: {
                        name: "node-0",
                        creationTimestamp: "2024-01-01T00:00:00Z",
                        labels: {},
                    },
                    status: {
                        conditions: [
                            {
                                type: "MemoryPressure",
                                status: "False",
                            },
                        ],
                        nodeInfo: {
                            kubeletVersion: "v1.30.0",
                        },
                    },
                },
            ],
        };
        setRunnerHandlers({
            "--context test-ctx get nodes -o json": () => ok(JSON.stringify(fixture)),
        });
        const result = await listNodes("test-ctx");
        expect(result[0]!.status).toBe("Unknown");
    });

    test("returns [] when items is empty", async () => {
        setRunnerHandlers({
            "--context test-ctx get nodes -o json": () => ok(JSON.stringify({
                items: [],
            })),
        });
        const result = await listNodes("test-ctx");
        expect(result.length).toBe(0);
    });

    test("throws on non-zero exit", async () => {
        setRunnerHandlers({
            "--context test-ctx get nodes -o json": () => fail("denied"),
        });
        await expect(listNodes("test-ctx")).rejects.toThrow("denied");
    });
});

describe("getNodeDetail", () => {
    // Argv key for the single-node fetch.
    const NODE_KEY = "--context test-ctx get node node-1 -o json";
    // Argv key for the field-selector pod fetch scoped to node-1.
    const PODS_KEY = "--context test-ctx get pods -A --field-selector=spec.nodeName=node-1 -o json";
    // Argv key for the field-selector event fetch scoped to node-1.
    const EVENTS_KEY = "--context test-ctx get events -A --field-selector=involvedObject.kind=Node,involvedObject.name=node-1 -o json";

    // A minimal node item shape with the fields getNodeDetail reads.
    function makeNodeItem(): object {
        return {
            metadata: {
                name: "node-1",
                creationTimestamp: "2024-01-01T00:00:00Z",
                labels: {
                    "node-role.kubernetes.io/control-plane": "",
                    "kubernetes.io/hostname": "node-1",
                },
            },
            status: {
                conditions: [
                    {
                        type: "Ready",
                        status: "True",
                        message: "kubelet is posting ready status",
                        lastTransitionTime: "2024-01-02T00:00:00Z",
                    },
                ],
                capacity: { cpu: "4", memory: "8Gi", pods: "110" },
                allocatable: { cpu: "3900m", memory: "7Gi", pods: "110" },
                addresses: [{ type: "InternalIP", address: "192.168.1.1" }],
                nodeInfo: { kubeletVersion: "v1.29.0" },
            },
        };
    }

    // A minimal pod item shape as returned by the field-selector query.
    function makePodItem(name: string, namespace: string, nodeName: string): object {
        return {
            metadata: {
                name,
                namespace,
                creationTimestamp: "2024-06-01T00:00:00Z",
            },
            spec: {
                nodeName,
            },
            status: {
                phase: "Running",
                containerStatuses: [
                    {
                        ready: true,
                        restartCount: 0,
                    },
                ],
                initContainerStatuses: [],
            },
        };
    }

    // A minimal event item shape as returned by the node-scoped event query.
    function makeEventItem(reason: string, type: "Normal" | "Warning"): object {
        return {
            type,
            reason,
            message: `${reason} happened`,
            count: 2,
            lastTimestamp: "2024-06-01T01:00:00Z",
            involvedObject: {
                kind: "Node",
                name: "node-1",
            },
        };
    }

    test("uses a field selector scoped to the node when fetching pods", async () => {
        setRunnerHandlers({
            [NODE_KEY]: () => ok(JSON.stringify(makeNodeItem())),
            [PODS_KEY]: () => ok(JSON.stringify({ items: [] })),
            [EVENTS_KEY]: () => ok(JSON.stringify({ items: [] })),
        });
        await getNodeDetail("test-ctx", "node-1");
        // setRunnerHandlers throws on any unmocked argv, so reaching here proves
        // the exact field-selector argv was used.
        expect(run).toHaveBeenCalledWith(
            "kubectl",
            ["--context", "test-ctx", "get", "pods", "-A", "--field-selector=spec.nodeName=node-1", "-o", "json"],
        );
    });

    test("uses a field selector scoped to the node when fetching events", async () => {
        setRunnerHandlers({
            [NODE_KEY]: () => ok(JSON.stringify(makeNodeItem())),
            [PODS_KEY]: () => ok(JSON.stringify({ items: [] })),
            [EVENTS_KEY]: () => ok(JSON.stringify({ items: [] })),
        });
        await getNodeDetail("test-ctx", "node-1");
        expect(run).toHaveBeenCalledWith(
            "kubectl",
            [
                "--context", "test-ctx", "get", "events", "-A",
                "--field-selector=involvedObject.kind=Node,involvedObject.name=node-1",
                "-o", "json",
            ],
        );
    });

    test("parses node events", async () => {
        setRunnerHandlers({
            [NODE_KEY]: () => ok(JSON.stringify(makeNodeItem())),
            [PODS_KEY]: () => ok(JSON.stringify({ items: [] })),
            [EVENTS_KEY]: () => ok(JSON.stringify({
                items: [
                    makeEventItem("NodeReady", "Normal"),
                    makeEventItem("NodeNotReady", "Warning"),
                ],
            })),
        });
        const result = await getNodeDetail("test-ctx", "node-1");
        expect(result.events).toEqual([
            {
                type: "Normal",
                reason: "NodeReady",
                message: "NodeReady happened",
                count: 2,
                lastSeen: "2024-06-01T01:00:00Z",
            },
            {
                type: "Warning",
                reason: "NodeNotReady",
                message: "NodeNotReady happened",
                count: 2,
                lastSeen: "2024-06-01T01:00:00Z",
            },
        ]);
    });

    test("tolerates the events call failing and still returns node detail", async () => {
        setRunnerHandlers({
            [NODE_KEY]: () => ok(JSON.stringify(makeNodeItem())),
            [PODS_KEY]: () => ok(JSON.stringify({ items: [] })),
            [EVENTS_KEY]: () => fail("forbidden"),
        });
        const result = await getNodeDetail("test-ctx", "node-1");
        expect(result.name).toBe("node-1");
        expect(result.events).toEqual([]);
    });

    test("parses node fields and maps the scheduled pods", async () => {
        setRunnerHandlers({
            [NODE_KEY]: () => ok(JSON.stringify(makeNodeItem())),
            [PODS_KEY]: () => ok(JSON.stringify({
                items: [
                    makePodItem("coredns-abc", "kube-system", "node-1"),
                    makePodItem("web", "default", "node-1"),
                ],
            })),
            [EVENTS_KEY]: () => ok(JSON.stringify({ items: [] })),
        });
        const result = await getNodeDetail("test-ctx", "node-1");
        expect(result.name).toBe("node-1");
        expect(result.events).toEqual([]);
        expect(result.status).toBe("Ready");
        expect(result.roles).toEqual(["control-plane"]);
        expect(result.version).toBe("v1.29.0");
        expect(result.capacity).toEqual({ cpu: "4", memory: "8Gi", pods: "110" });
        expect(result.allocatable).toEqual({ cpu: "3900m", memory: "7Gi", pods: "110" });
        expect(result.conditions).toEqual([
            {
                type: "Ready",
                status: "True",
                message: "kubelet is posting ready status",
                lastTransition: "2024-01-02T00:00:00Z",
            },
        ]);
        expect(result.pods).toEqual([
            {
                name: "coredns-abc",
                namespace: "kube-system",
                phase: "Running",
                ready: "1/1",
                containerCount: 1,
                restarts: 0,
                createdAt: "2024-06-01T00:00:00Z",
                node: "node-1",
                labels: {},
            },
            {
                name: "web",
                namespace: "default",
                phase: "Running",
                ready: "1/1",
                containerCount: 1,
                restarts: 0,
                createdAt: "2024-06-01T00:00:00Z",
                node: "node-1",
                labels: {},
            },
        ]);
    });

    test("returns an empty pods array when no pods are scheduled on the node", async () => {
        setRunnerHandlers({
            [NODE_KEY]: () => ok(JSON.stringify(makeNodeItem())),
            [PODS_KEY]: () => ok(JSON.stringify({ items: [] })),
            [EVENTS_KEY]: () => ok(JSON.stringify({ items: [] })),
        });
        const result = await getNodeDetail("test-ctx", "node-1");
        expect(result.pods).toEqual([]);
    });

    test("tolerates the pods call failing and still returns node detail", async () => {
        setRunnerHandlers({
            [NODE_KEY]: () => ok(JSON.stringify(makeNodeItem())),
            [PODS_KEY]: () => fail("forbidden"),
            [EVENTS_KEY]: () => ok(JSON.stringify({ items: [] })),
        });
        const result = await getNodeDetail("test-ctx", "node-1");
        expect(result.name).toBe("node-1");
        expect(result.pods).toEqual([]);
    });

    test("throws when the node call fails", async () => {
        setRunnerHandlers({
            [NODE_KEY]: () => fail("not found"),
            [PODS_KEY]: () => ok(JSON.stringify({ items: [] })),
            [EVENTS_KEY]: () => ok(JSON.stringify({ items: [] })),
        });
        await expect(getNodeDetail("test-ctx", "node-1")).rejects.toThrow("not found");
    });
});

describe("getNamespaceDetail", () => {
    // Argv keys for the seven parallel reads getNamespaceDetail performs.
    const NS_KEY = "--context test-ctx get namespace ns-1 -o json";
    const PODS_KEY = "--context test-ctx -n ns-1 get pods -o json";
    const DEPLOYS_KEY = "--context test-ctx -n ns-1 get deployments -o json";
    const STATEFUL_KEY = "--context test-ctx -n ns-1 get statefulsets -o json";
    const DAEMON_KEY = "--context test-ctx -n ns-1 get daemonsets -o json";
    const QUOTA_KEY = "--context test-ctx -n ns-1 get resourcequotas -o json";
    const LIMIT_KEY = "--context test-ctx -n ns-1 get limitranges -o json";

    // A minimal namespace item shape with the fields getNamespaceDetail reads.
    function makeNsItem(): object {
        return {
            metadata: {
                name: "ns-1",
                creationTimestamp: "2024-01-01T00:00:00Z",
                labels: { "kubernetes.io/metadata.name": "ns-1", team: "backend" },
                annotations: { "owner": "platform" },
            },
            status: { phase: "Active" },
        };
    }

    // A minimal pod item as returned by the namespace-scoped pod query.
    function makePodItem(name: string): object {
        return {
            metadata: { name, namespace: "ns-1", creationTimestamp: "2024-06-01T00:00:00Z" },
            spec: { nodeName: "node-1", containers: [{ name: "c" }] },
            status: { phase: "Running", containerStatuses: [{ ready: true, restartCount: 0 }] },
        };
    }

    // Installs handlers returning empty item lists for every sub-read, so a test
    // only has to override the reads it cares about.
    function emptyHandlers(): Record<string, () => CommandResult> {
        return {
            [NS_KEY]: () => ok(JSON.stringify(makeNsItem())),
            [PODS_KEY]: () => ok(JSON.stringify({ items: [] })),
            [DEPLOYS_KEY]: () => ok(JSON.stringify({ items: [] })),
            [STATEFUL_KEY]: () => ok(JSON.stringify({ items: [] })),
            [DAEMON_KEY]: () => ok(JSON.stringify({ items: [] })),
            [QUOTA_KEY]: () => ok(JSON.stringify({ items: [] })),
            [LIMIT_KEY]: () => ok(JSON.stringify({ items: [] })),
        };
    }

    test("parses namespace metadata: phase, labels, annotations, age", async () => {
        setRunnerHandlers(emptyHandlers());
        const result = await getNamespaceDetail("test-ctx", "ns-1");
        expect(result.name).toBe("ns-1");
        expect(result.phase).toBe("Active");
        expect(result.createdAt).toBe("2024-01-01T00:00:00Z");
        expect(result.labels).toEqual({ "kubernetes.io/metadata.name": "ns-1", team: "backend" });
        expect(result.annotations).toEqual({ owner: "platform" });
        expect(result.resources).toEqual([]);
        expect(result.quotas).toEqual([]);
        expect(result.limits).toEqual([]);
    });

    test("lists contained resources (pods, deployments, stateful sets, daemon sets) with detail paths", async () => {
        setRunnerHandlers({
            ...emptyHandlers(),
            [PODS_KEY]: () => ok(JSON.stringify({ items: [makePodItem("web-abc")] })),
            [DEPLOYS_KEY]: () => ok(JSON.stringify({
                items: [{ metadata: { name: "web" }, spec: { replicas: 3 }, status: { readyReplicas: 2 } }],
            })),
            [STATEFUL_KEY]: () => ok(JSON.stringify({
                items: [{ metadata: { name: "db" }, spec: { replicas: 1 }, status: { readyReplicas: 1 } }],
            })),
            [DAEMON_KEY]: () => ok(JSON.stringify({
                items: [{ metadata: { name: "agent" }, status: { desiredNumberScheduled: 4, numberReady: 4 } }],
            })),
        });
        const result = await getNamespaceDetail("test-ctx", "ns-1");
        expect(result.resources).toEqual([
            { kind: "Pod", name: "web-abc", status: "Running", detailPath: "/pods/ns-1/web-abc" },
            { kind: "Deployment", name: "web", status: "2/3 ready", detailPath: "/deployments/ns-1/web" },
            { kind: "StatefulSet", name: "db", status: "1/1 ready", detailPath: "/statefulsets/ns-1/db" },
            { kind: "DaemonSet", name: "agent", status: "4/4 ready", detailPath: "/daemonsets/ns-1/agent" },
        ]);
    });

    test("parses resource quotas and limit ranges", async () => {
        setRunnerHandlers({
            ...emptyHandlers(),
            [QUOTA_KEY]: () => ok(JSON.stringify({
                items: [{ metadata: { name: "compute" }, spec: { hard: { "requests.cpu": "4", pods: "10" } } }],
            })),
            [LIMIT_KEY]: () => ok(JSON.stringify({
                items: [{
                    metadata: { name: "mem-limit" },
                    spec: {
                        limits: [{
                            type: "Container",
                            min: { memory: "64Mi" },
                            max: { memory: "1Gi" },
                            default: { memory: "256Mi" },
                            defaultRequest: { memory: "128Mi" },
                        }],
                    },
                }],
            })),
        });
        const result = await getNamespaceDetail("test-ctx", "ns-1");
        expect(result.quotas).toEqual([
            { name: "compute", hard: { "requests.cpu": "4", pods: "10" } },
        ]);
        expect(result.limits).toEqual([
            {
                name: "mem-limit",
                type: "Container",
                resource: "memory",
                min: "64Mi",
                max: "1Gi",
                defaultRequest: "128Mi",
                default: "256Mi",
            },
        ]);
    });

    test("tolerates a failing sub-read and still returns namespace detail", async () => {
        setRunnerHandlers({
            ...emptyHandlers(),
            [PODS_KEY]: () => fail("forbidden"),
        });
        const result = await getNamespaceDetail("test-ctx", "ns-1");
        expect(result.name).toBe("ns-1");
        expect(result.resources).toEqual([]);
    });

    test("throws when the namespace call fails", async () => {
        setRunnerHandlers({
            ...emptyHandlers(),
            [NS_KEY]: () => fail("not found"),
        });
        await expect(getNamespaceDetail("test-ctx", "ns-1")).rejects.toThrow("not found");
    });
});

describe("isWorkloadKind", () => {
    test("accepts the three workload kinds", () => {
        expect(isWorkloadKind("deployments")).toBe(true);
        expect(isWorkloadKind("statefulsets")).toBe(true);
        expect(isWorkloadKind("daemonsets")).toBe(true);
    });

    test("rejects anything else", () => {
        expect(isWorkloadKind("pods")).toBe(false);
        expect(isWorkloadKind("")).toBe(false);
    });
});

describe("getWorkloadDetail", () => {
    // Argv keys for the deployment fetch, its scoped events fetch, and its selected pods fetch.
    const DEPLOY_KEY = "--context test-ctx -n default get deployment nginx -o json";
    const EVENTS_KEY = "--context test-ctx -n default get events --field-selector=involvedObject.name=nginx,involvedObject.namespace=default -o json";
    const PODS_KEY = "--context test-ctx -n default get pods -l app=nginx -o json";
    const REPLICASET_KEY = "--context test-ctx -n default get replicasets -l app=nginx -o json";

    // A ReplicaSet owned by the nginx deployment, returned by the replicaset lookup so
    // pods owned by it trace back to the deployment.
    function makeReplicaSetItem(name: string): object {
        return {
            metadata: {
                name,
                namespace: "default",
                ownerReferences: [{ kind: "Deployment", name: "nginx" }],
            },
        };
    }

    // A replicaset list response with a single nginx-owned replicaset.
    function makeReplicaSets(): object {
        return { items: [makeReplicaSetItem("nginx-rs")] };
    }

    // A minimal deployment item shape with the fields getWorkloadDetail reads.
    function makeDeploymentItem(): object {
        return {
            metadata: {
                name: "nginx",
                namespace: "default",
                creationTimestamp: "2024-06-01T00:00:00Z",
                labels: { app: "nginx" },
            },
            spec: {
                replicas: 3,
                selector: { matchLabels: { app: "nginx" } },
            },
            status: {
                readyReplicas: 2,
                updatedReplicas: 3,
                availableReplicas: 2,
            },
        };
    }

    // A minimal pod item shape as returned by the label-selector query.
    function makePodItem(name: string): object {
        return {
            metadata: {
                name,
                namespace: "default",
                creationTimestamp: "2024-06-01T00:00:00Z",
                ownerReferences: [{ kind: "ReplicaSet", name: "nginx-rs" }],
            },
            spec: {
                nodeName: "node-1",
                containers: [{ name: "nginx" }],
            },
            status: {
                phase: "Running",
                containerStatuses: [{ ready: true, restartCount: 0 }],
                initContainerStatuses: [],
            },
        };
    }

    test("fetches pods using the selector match labels", async () => {
        setRunnerHandlers({
            [DEPLOY_KEY]: () => ok(JSON.stringify(makeDeploymentItem())),
            [EVENTS_KEY]: () => ok(JSON.stringify({ items: [] })),
            [REPLICASET_KEY]: () => ok(JSON.stringify(makeReplicaSets())),
            [PODS_KEY]: () => ok(JSON.stringify({ items: [] })),
        });
        await getWorkloadDetail("test-ctx", "deployments", "default", "nginx");
        // setRunnerHandlers throws on any unmocked argv, so reaching here proves
        // the exact label-selector argv was used.
        expect(run).toHaveBeenCalledWith(
            "kubectl",
            ["--context", "test-ctx", "-n", "default", "get", "pods", "-l", "app=nginx", "-o", "json"],
        );
    });

    test("parses deployment status into Ready/Up-to-date/Available stats and maps pods", async () => {
        setRunnerHandlers({
            [DEPLOY_KEY]: () => ok(JSON.stringify(makeDeploymentItem())),
            [EVENTS_KEY]: () => ok(JSON.stringify({
                items: [
                    {
                        type: "Normal",
                        reason: "ScalingReplicaSet",
                        message: "Scaled up replica set nginx-abc to 3",
                        count: 1,
                        lastTimestamp: "2024-06-01T00:01:00Z",
                    },
                ],
            })),
            [REPLICASET_KEY]: () => ok(JSON.stringify(makeReplicaSets())),
            [PODS_KEY]: () => ok(JSON.stringify({ items: [makePodItem("nginx-abc")] })),
        });
        const result = await getWorkloadDetail("test-ctx", "deployments", "default", "nginx");
        expect(result.kind).toBe("deployments");
        expect(result.name).toBe("nginx");
        expect(result.namespace).toBe("default");
        expect(result.labels).toEqual({ app: "nginx" });
        expect(result.selector).toEqual({ app: "nginx" });
        expect(result.stats).toEqual([
            { label: "Ready", value: "2/3" },
            { label: "Up-to-date", value: "3" },
            { label: "Available", value: "2" },
        ]);
        expect(result.pods).toEqual([
            {
                name: "nginx-abc",
                namespace: "default",
                phase: "Running",
                ready: "1/1",
                containerCount: 1,
                restarts: 0,
                createdAt: "2024-06-01T00:00:00Z",
                node: "node-1",
                labels: {},
            },
        ]);
        expect(result.events).toEqual([
            {
                type: "Normal",
                reason: "ScalingReplicaSet",
                message: "Scaled up replica set nginx-abc to 3",
                count: 1,
                lastSeen: "2024-06-01T00:01:00Z",
            },
        ]);
    });

    test("builds daemonset stats from the daemonset status numbers", async () => {
        const dsKey = "--context test-ctx -n kube-system get daemonset fluentd -o json";
        const dsEventsKey = "--context test-ctx -n kube-system get events --field-selector=involvedObject.name=fluentd,involvedObject.namespace=kube-system -o json";
        const dsPodsKey = "--context test-ctx -n kube-system get pods -l app=fluentd -o json";
        setRunnerHandlers({
            [dsKey]: () => ok(JSON.stringify({
                metadata: {
                    name: "fluentd",
                    namespace: "kube-system",
                    creationTimestamp: "2024-06-01T00:00:00Z",
                    labels: {},
                },
                spec: {
                    selector: { matchLabels: { app: "fluentd" } },
                },
                status: {
                    desiredNumberScheduled: 2,
                    currentNumberScheduled: 2,
                    numberReady: 2,
                    updatedNumberScheduled: 2,
                    numberAvailable: 2,
                },
            })),
            [dsEventsKey]: () => ok(JSON.stringify({ items: [] })),
            [dsPodsKey]: () => ok(JSON.stringify({ items: [] })),
        });
        const result = await getWorkloadDetail("test-ctx", "daemonsets", "kube-system", "fluentd");
        expect(result.stats).toEqual([
            { label: "Desired", value: "2" },
            { label: "Current", value: "2" },
            { label: "Ready", value: "2" },
            { label: "Up-to-date", value: "2" },
            { label: "Available", value: "2" },
        ]);
    });

    test("skips the pods query when the workload has no selector", async () => {
        setRunnerHandlers({
            [DEPLOY_KEY]: () => ok(JSON.stringify({
                metadata: {
                    name: "nginx",
                    namespace: "default",
                    creationTimestamp: "2024-06-01T00:00:00Z",
                    labels: {},
                },
                spec: {
                    replicas: 1,
                },
                status: {
                    readyReplicas: 1,
                },
            })),
            [EVENTS_KEY]: () => ok(JSON.stringify({ items: [] })),
        });
        const result = await getWorkloadDetail("test-ctx", "deployments", "default", "nginx");
        expect(result.selector).toEqual({});
        expect(result.pods).toEqual([]);
    });

    test("tolerates the pods call failing and still returns workload detail", async () => {
        setRunnerHandlers({
            [DEPLOY_KEY]: () => ok(JSON.stringify(makeDeploymentItem())),
            [EVENTS_KEY]: () => ok(JSON.stringify({ items: [] })),
            [REPLICASET_KEY]: () => ok(JSON.stringify(makeReplicaSets())),
            [PODS_KEY]: () => fail("forbidden"),
        });
        const result = await getWorkloadDetail("test-ctx", "deployments", "default", "nginx");
        expect(result.name).toBe("nginx");
        expect(result.pods).toEqual([]);
    });

    test("throws when the workload call fails", async () => {
        setRunnerHandlers({
            [DEPLOY_KEY]: () => fail("not found"),
            [EVENTS_KEY]: () => ok(JSON.stringify({ items: [] })),
            [PODS_KEY]: () => ok(JSON.stringify({ items: [] })),
        });
        await expect(getWorkloadDetail("test-ctx", "deployments", "default", "nginx")).rejects.toThrow("not found");
    });

    test("scopes a deployment's pods to those owned via its replicaset, dropping label-only matches", async () => {
        // Two pods share the app=nginx selector. One is owned by the deployment's
        // replicaset; the other is owned by a different deployment's replicaset and must
        // be dropped even though its labels match.
        const ownedPod = {
            metadata: {
                name: "nginx-mine",
                namespace: "default",
                creationTimestamp: "2024-06-01T00:00:00Z",
                ownerReferences: [{ kind: "ReplicaSet", name: "nginx-rs" }],
            },
            spec: { containers: [{ name: "nginx" }] },
            status: { phase: "Running", containerStatuses: [{ ready: true, restartCount: 0 }] },
        };
        const foreignPod = {
            metadata: {
                name: "nginx-other",
                namespace: "default",
                creationTimestamp: "2024-06-01T00:00:00Z",
                ownerReferences: [{ kind: "ReplicaSet", name: "other-rs" }],
            },
            spec: { containers: [{ name: "nginx" }] },
            status: { phase: "Running", containerStatuses: [{ ready: true, restartCount: 0 }] },
        };
        setRunnerHandlers({
            [DEPLOY_KEY]: () => ok(JSON.stringify(makeDeploymentItem())),
            [EVENTS_KEY]: () => ok(JSON.stringify({ items: [] })),
            [REPLICASET_KEY]: () => ok(JSON.stringify(makeReplicaSets())),
            [PODS_KEY]: () => ok(JSON.stringify({ items: [ownedPod, foreignPod] })),
        });
        const result = await getWorkloadDetail("test-ctx", "deployments", "default", "nginx");
        expect(result.pods.map((p) => p.name)).toEqual(["nginx-mine"]);
    });

    test("scopes a stateful set's pods to those it owns directly", async () => {
        const ssKey = "--context test-ctx -n default get statefulset postgres -o json";
        const ssEventsKey = "--context test-ctx -n default get events --field-selector=involvedObject.name=postgres,involvedObject.namespace=default -o json";
        const ssPodsKey = "--context test-ctx -n default get pods -l app=postgres -o json";
        const ownedPod = {
            metadata: {
                name: "postgres-0",
                namespace: "default",
                creationTimestamp: "2024-06-01T00:00:00Z",
                ownerReferences: [{ kind: "StatefulSet", name: "postgres" }],
            },
            spec: { containers: [{ name: "postgres" }] },
            status: { phase: "Running", containerStatuses: [{ ready: true, restartCount: 0 }] },
        };
        const foreignPod = {
            metadata: {
                name: "postgres-other-0",
                namespace: "default",
                creationTimestamp: "2024-06-01T00:00:00Z",
                ownerReferences: [{ kind: "StatefulSet", name: "postgres-other" }],
            },
            spec: { containers: [{ name: "postgres" }] },
            status: { phase: "Running", containerStatuses: [{ ready: true, restartCount: 0 }] },
        };
        setRunnerHandlers({
            [ssKey]: () => ok(JSON.stringify({
                metadata: { name: "postgres", namespace: "default", creationTimestamp: "2024-06-01T00:00:00Z", labels: {} },
                spec: { replicas: 1, selector: { matchLabels: { app: "postgres" } } },
                status: { readyReplicas: 1 },
            })),
            [ssEventsKey]: () => ok(JSON.stringify({ items: [] })),
            [ssPodsKey]: () => ok(JSON.stringify({ items: [ownedPod, foreignPod] })),
        });
        const result = await getWorkloadDetail("test-ctx", "statefulsets", "default", "postgres");
        // No replicaset lookup is made for a stateful set: setRunnerHandlers would throw
        // on the unmocked argv if one were attempted.
        expect(result.pods.map((p) => p.name)).toEqual(["postgres-0"]);
    });
});

describe("podBelongsToWorkload", () => {
    const noReplicaSets = new Set<string>();

    test("matches a stateful set's directly-owned pod", () => {
        const pod = { metadata: { ownerReferences: [{ kind: "StatefulSet", name: "postgres" }] } };
        expect(podBelongsToWorkload(pod, { kind: "statefulsets", name: "postgres", ownedReplicaSetNames: noReplicaSets }, {})).toBe(true);
    });

    test("matches a daemon set's directly-owned pod", () => {
        const pod = { metadata: { ownerReferences: [{ kind: "DaemonSet", name: "fluentd" }] } };
        expect(podBelongsToWorkload(pod, { kind: "daemonsets", name: "fluentd", ownedReplicaSetNames: noReplicaSets }, {})).toBe(true);
    });

    test("matches a deployment pod owned by one of its replicasets", () => {
        const pod = { metadata: { ownerReferences: [{ kind: "ReplicaSet", name: "nginx-rs" }] } };
        const owned = new Set(["nginx-rs"]);
        expect(podBelongsToWorkload(pod, { kind: "deployments", name: "nginx", ownedReplicaSetNames: owned }, {})).toBe(true);
    });

    test("rejects a deployment pod owned by a replicaset the deployment does not own", () => {
        const pod = { metadata: { ownerReferences: [{ kind: "ReplicaSet", name: "other-rs" }], labels: { app: "nginx" } } };
        const owned = new Set(["nginx-rs"]);
        // Has owner references but none match: the label selector is NOT consulted.
        expect(podBelongsToWorkload(pod, { kind: "deployments", name: "nginx", ownedReplicaSetNames: owned }, { app: "nginx" })).toBe(false);
    });

    test("rejects a pod owned by a different stateful set even when labels match", () => {
        const pod = { metadata: { ownerReferences: [{ kind: "StatefulSet", name: "other" }], labels: { app: "postgres" } } };
        expect(podBelongsToWorkload(pod, { kind: "statefulsets", name: "postgres", ownedReplicaSetNames: noReplicaSets }, { app: "postgres" })).toBe(false);
    });

    test("falls back to the selector for a pod with no owner references", () => {
        const pod = { metadata: { labels: { app: "nginx", tier: "web" } } };
        expect(podBelongsToWorkload(pod, { kind: "deployments", name: "nginx", ownedReplicaSetNames: noReplicaSets }, { app: "nginx" })).toBe(true);
    });

    test("selector fallback requires every selector label to match", () => {
        const pod = { metadata: { labels: { app: "nginx" } } };
        expect(podBelongsToWorkload(pod, { kind: "deployments", name: "nginx", ownedReplicaSetNames: noReplicaSets }, { app: "nginx", tier: "web" })).toBe(false);
    });

    test("an ownerless pod with an empty selector matches nothing", () => {
        const pod = { metadata: { labels: { app: "nginx" } } };
        expect(podBelongsToWorkload(pod, { kind: "deployments", name: "nginx", ownedReplicaSetNames: noReplicaSets }, {})).toBe(false);
    });
});

describe("getClusterOverview", () => {
    const VERSION_KEY = "--context test-ctx version -o json";
    const NODES_KEY = "--context test-ctx get nodes -o json";
    const NS_KEY = "--context test-ctx get namespaces -o json";
    const PODS_KEY = "--context test-ctx get pods -A -o json";
    const EVENTS_KEY = "--context test-ctx get events -A --field-selector=type=Warning -o json";

    // Returns a kubectl JSON response body with n empty item objects.
    function makeItems(n: number): object {
        return {
            items: new Array(n).fill({}),
        };
    }

    // Returns a full set of happy-path handlers for all five overview calls.
    function happyHandlers(
        nodeCount = 3,
        nsCount = 4,
        podCount = 15
    ): Record<string, () => CommandResult | Promise<CommandResult>> {
        return {
            [VERSION_KEY]: () => ok(JSON.stringify({
                serverVersion: {
                    gitVersion: "v1.30.0",
                },
            })),
            [NODES_KEY]: () => ok(JSON.stringify(makeItems(nodeCount))),
            [NS_KEY]: () => ok(JSON.stringify(makeItems(nsCount))),
            [PODS_KEY]: () => ok(JSON.stringify(makeItems(podCount))),
            [EVENTS_KEY]: () => ok(JSON.stringify({ items: [] })),
        };
    }

    test("happy path", async () => {
        setRunnerHandlers(happyHandlers());
        const result = await getClusterOverview("test-ctx");
        expect(result).toEqual({
            serverVersion: "v1.30.0",
            clientVersion: null,
            nodeCount: 3,
            readyNodeCount: 0,
            namespaceCount: 4,
            podCount: 15,
            runningPodCount: 0,
            pendingPodCount: 0,
            failedPodCount: 0,
            errorCount: 0,
        });
    });

    test("errorCount sums Warning events and problem pods", async () => {
        setRunnerHandlers({
            ...happyHandlers(),
            // Two Warning events.
            [EVENTS_KEY]: () => ok(JSON.stringify({
                items: [
                    { reason: "FailedScheduling", message: "0/3 nodes" },
                    { reason: "BackOff", message: "back-off restarting" },
                ],
            })),
            // Three pods: one CrashLoopBackOff, one Failed phase, one healthy.
            [PODS_KEY]: () => ok(JSON.stringify({
                items: [
                    { status: { containerStatuses: [{ name: "c", state: { waiting: { reason: "CrashLoopBackOff" } } }] } },
                    { status: { phase: "Failed" } },
                    { status: { phase: "Running", containerStatuses: [{ name: "c", state: { running: {} } }] } },
                ],
            })),
        });
        const result = await getClusterOverview("test-ctx");
        // 2 warning events + 2 problem pods (crash-loop + Failed phase) = 4.
        expect(result.errorCount).toBe(4);
        expect(result.podCount).toBe(3);
        expect(result.failedPodCount).toBe(1);
    });

    test("tolerates the events call failing (errorCount counts only problem pods)", async () => {
        setRunnerHandlers({
            ...happyHandlers(),
            [EVENTS_KEY]: () => fail("events forbidden"),
            [PODS_KEY]: () => ok(JSON.stringify({
                items: [
                    { status: { phase: "Failed" } },
                ],
            })),
        });
        const result = await getClusterOverview("test-ctx");
        expect(result.errorCount).toBe(1);
    });

    test("tolerates the events call rejecting", async () => {
        setRunnerHandlers({
            ...happyHandlers(),
            [EVENTS_KEY]: () => Promise.reject(new Error("ENOENT")),
        });
        const result = await getClusterOverview("test-ctx");
        expect(result.errorCount).toBe(0);
        expect(result.nodeCount).toBe(3);
    });

    test("returns serverVersion: null when version call non-zero", async () => {
        setRunnerHandlers({
            ...happyHandlers(),
            [VERSION_KEY]: () => fail("unreachable"),
        });
        const result = await getClusterOverview("test-ctx");
        expect(result.serverVersion).toBe(null);
        expect(result.nodeCount).toBe(3);
    });

    test("returns serverVersion: null when version handler throws", async () => {
        setRunnerHandlers({
            ...happyHandlers(),
            [VERSION_KEY]: (): CommandResult => {
                throw new Error("version error");
            },
        });
        const result = await getClusterOverview("test-ctx");
        expect(result.serverVersion).toBe(null);
        expect(result.nodeCount).toBe(3);
    });

    test("throws when nodes call fails (non-zero exit)", async () => {
        setRunnerHandlers({
            ...happyHandlers(),
            [NODES_KEY]: () => fail("denied"),
        });
        await expect(getClusterOverview("test-ctx")).rejects.toThrow("denied");
    });

    test("throws when namespaces call fails", async () => {
        setRunnerHandlers({
            ...happyHandlers(),
            [NS_KEY]: () => fail("denied"),
        });
        await expect(getClusterOverview("test-ctx")).rejects.toThrow("denied");
    });

    test("throws when pods call fails", async () => {
        setRunnerHandlers({
            ...happyHandlers(),
            [PODS_KEY]: () => fail("denied"),
        });
        await expect(getClusterOverview("test-ctx")).rejects.toThrow("denied");
    });

    test("rejects when a count call rejects (not just non-zero exit)", async () => {
        setRunnerHandlers({
            ...happyHandlers(),
            [NODES_KEY]: () => Promise.reject(new Error("spawn kubectl ENOENT")),
        });
        await expect(getClusterOverview("test-ctx")).rejects.toThrow("spawn kubectl ENOENT");
    });

    test("tolerates the version call rejecting", async () => {
        setRunnerHandlers({
            ...happyHandlers(),
            [VERSION_KEY]: () => Promise.reject(new Error("ENOENT")),
        });
        const result = await getClusterOverview("test-ctx");
        expect(result.serverVersion).toBe(null);
        expect(result.nodeCount).toBe(3);
        expect(result.namespaceCount).toBe(4);
        expect(result.podCount).toBe(15);
    });
});

describe("listPods", () => {
    // Minimal pod item shape with the fields listPods reads.
    function makePodItem(overrides: {
        name?: string;
        namespace?: string;
        phase?: string;
        containers?: any[];
        containerStatuses?: any[];
        initContainerStatuses?: any[];
        nodeName?: string;
        creationTimestamp?: string;
        labels?: Record<string, string>;
    } = {}): object {
        const containerStatuses = overrides.containerStatuses ?? [
            {
                ready: true,
                restartCount: 0,
            },
        ];
        // Default the spec containers to one entry per status so containerCount
        // matches the status count unless the test overrides it explicitly.
        const containers = overrides.containers ?? containerStatuses.map((_, i) => ({ name: `c${i}` }));
        return {
            metadata: {
                name: overrides.name ?? "my-pod",
                namespace: overrides.namespace ?? "default",
                creationTimestamp: overrides.creationTimestamp ?? "2024-06-01T00:00:00Z",
                labels: overrides.labels ?? {},
            },
            spec: {
                nodeName: overrides.nodeName ?? "node-1",
                containers,
            },
            status: {
                phase: overrides.phase ?? "Running",
                containerStatuses,
                initContainerStatuses: overrides.initContainerStatuses ?? [],
            },
        };
    }

    test("uses -A flag when no namespace is given", async () => {
        setRunnerHandlers({
            "--context test-ctx get pods -A -o json": () => ok(JSON.stringify({
                items: [makePodItem()],
            })),
        });
        const result = await listPods("test-ctx");
        expect(result).toHaveLength(1);
    });

    test("uses -n flag when namespace is given", async () => {
        setRunnerHandlers({
            "--context test-ctx get pods -n my-ns -o json": () => ok(JSON.stringify({
                items: [makePodItem({ namespace: "my-ns" })],
            })),
        });
        const result = await listPods("test-ctx", "my-ns");
        expect(result).toHaveLength(1);
    });

    test("maps all fields from a Running pod correctly", async () => {
        setRunnerHandlers({
            "--context test-ctx get pods -A -o json": () => ok(JSON.stringify({
                items: [
                    makePodItem({
                        name: "nginx",
                        namespace: "default",
                        phase: "Running",
                        containerStatuses: [
                            {
                                ready: true,
                                restartCount: 2,
                            },
                            {
                                ready: false,
                                restartCount: 1,
                            },
                        ],
                        nodeName: "node-worker",
                        creationTimestamp: "2024-01-15T12:00:00Z",
                        labels: { app: "nginx", tier: "frontend" },
                    }),
                ],
            })),
        });
        const result = await listPods("test-ctx");
        expect(result[0]).toEqual({
            name: "nginx",
            namespace: "default",
            phase: "Running",
            ready: "1/2",
            containerCount: 2,
            restarts: 3,
            node: "node-worker",
            createdAt: "2024-01-15T12:00:00Z",
            labels: { app: "nginx", tier: "frontend" },
        });
    });

    test("defaults labels to an empty object when metadata.labels is absent", async () => {
        const item = makePodItem();
        (item as any).metadata.labels = undefined;
        setRunnerHandlers({
            "--context test-ctx get pods -A -o json": () => ok(JSON.stringify({
                items: [item],
            })),
        });
        const result = await listPods("test-ctx");
        expect(result[0]!.labels).toEqual({});
    });

    test("reports container count from spec.containers for a multi-container pod", async () => {
        setRunnerHandlers({
            "--context test-ctx get pods -A -o json": () => ok(JSON.stringify({
                items: [
                    makePodItem({
                        name: "sidecar-pod",
                        containers: [
                            { name: "app" },
                            { name: "envoy" },
                            { name: "log-shipper" },
                        ],
                        containerStatuses: [
                            { ready: true, restartCount: 0 },
                            { ready: true, restartCount: 0 },
                            { ready: false, restartCount: 4 },
                        ],
                    }),
                ],
            })),
        });
        const result = await listPods("test-ctx");
        expect(result[0]!.containerCount).toBe(3);
        expect(result[0]!.ready).toBe("2/3");
    });

    test("falls back to status count for container count when spec.containers is absent", async () => {
        const item = makePodItem({
            containerStatuses: [
                { ready: true, restartCount: 0 },
                { ready: true, restartCount: 0 },
            ],
        });
        (item as any).spec.containers = undefined;
        setRunnerHandlers({
            "--context test-ctx get pods -A -o json": () => ok(JSON.stringify({
                items: [item],
            })),
        });
        const result = await listPods("test-ctx");
        expect(result[0]!.containerCount).toBe(2);
    });

    test("counts init container restarts in total restarts", async () => {
        setRunnerHandlers({
            "--context test-ctx get pods -A -o json": () => ok(JSON.stringify({
                items: [
                    makePodItem({
                        containerStatuses: [
                            {
                                ready: true,
                                restartCount: 1,
                            },
                        ],
                        initContainerStatuses: [
                            {
                                ready: false,
                                restartCount: 5,
                            },
                        ],
                    }),
                ],
            })),
        });
        const result = await listPods("test-ctx");
        expect(result[0]!.restarts).toBe(6);
    });

    test("handles pod with no containerStatuses gracefully", async () => {
        const item = makePodItem();
        (item as any).status.containerStatuses = undefined;
        setRunnerHandlers({
            "--context test-ctx get pods -A -o json": () => ok(JSON.stringify({
                items: [item],
            })),
        });
        const result = await listPods("test-ctx");
        expect(result[0]!.ready).toBe("0/0");
        expect(result[0]!.restarts).toBe(0);
    });

    test("returns empty array when items is empty", async () => {
        setRunnerHandlers({
            "--context test-ctx get pods -A -o json": () => ok(JSON.stringify({
                items: [],
            })),
        });
        const result = await listPods("test-ctx");
        expect(result.length).toBe(0);
    });

    test("throws on non-zero exit code", async () => {
        setRunnerHandlers({
            "--context test-ctx get pods -A -o json": () => fail("access denied"),
        });
        await expect(listPods("test-ctx")).rejects.toThrow("access denied");
    });
});

describe("listNamespaces", () => {
    // Builds a minimal namespace list fixture from the given names. Pass an
    // object instead of a bare name to attach labels for the label-parsing test.
    function nsFixture(...names: Array<string | { name: string; labels: Record<string, string> }>): string {
        return JSON.stringify({
            items: names.map((entry) => {
                const name = typeof entry === "string" ? entry : entry.name;
                const labels = typeof entry === "string" ? undefined : entry.labels;
                return {
                    metadata: labels === undefined ? { name } : { name, labels },
                };
            }),
        });
    }

    // Builds a minimal pod list fixture; each entry is one pod in the given namespace.
    function podsFixture(...namespaces: string[]): string {
        return JSON.stringify({
            items: namespaces.map((namespace, i) => ({
                metadata: {
                    name: `pod-${i}`,
                    namespace,
                },
            })),
        });
    }

    test("parses two namespaces, parses labels, and counts pods per namespace", async () => {
        setRunnerHandlers({
            "--context test-ctx get namespaces -o json": () => ok(nsFixture(
                { name: "default", labels: { "kubernetes.io/metadata.name": "default" } },
                "kube-system",
            )),
            "--context test-ctx get pods -A -o json": () =>
                ok(podsFixture("default", "default", "kube-system")),
        });
        const result = await listNamespaces("test-ctx");
        expect(result.length).toBe(2);
        expect(result[0]!).toEqual({
            name: "default",
            labels: { "kubernetes.io/metadata.name": "default" },
            resourceCount: 2,
        });
        // Namespace with no labels in metadata falls back to an empty object.
        expect(result[1]!).toEqual({
            name: "kube-system",
            labels: {},
            resourceCount: 1,
        });
    });

    test("reports resourceCount 0 for a namespace with no pods", async () => {
        setRunnerHandlers({
            "--context test-ctx get namespaces -o json": () => ok(nsFixture("default", "empty-ns")),
            "--context test-ctx get pods -A -o json": () => ok(podsFixture("default")),
        });
        const result = await listNamespaces("test-ctx");
        expect(result[1]!).toEqual({
            name: "empty-ns",
            labels: {},
            resourceCount: 0,
        });
    });

    test("returns [] when items is empty", async () => {
        setRunnerHandlers({
            "--context test-ctx get namespaces -o json": () => ok(nsFixture()),
            "--context test-ctx get pods -A -o json": () => ok(podsFixture()),
        });
        const result = await listNamespaces("test-ctx");
        expect(result.length).toBe(0);
    });

    test("a failed pod count does not break the table (resourceCount null)", async () => {
        setRunnerHandlers({
            "--context test-ctx get namespaces -o json": () => ok(nsFixture("default", "kube-system")),
            "--context test-ctx get pods -A -o json": () => fail("forbidden"),
        });
        const result = await listNamespaces("test-ctx");
        expect(result.length).toBe(2);
        expect(result[0]!).toEqual({
            name: "default",
            labels: {},
            resourceCount: null,
        });
        expect(result[1]!).toEqual({
            name: "kube-system",
            labels: {},
            resourceCount: null,
        });
    });

    test("throws on non-zero exit of the namespace query", async () => {
        setRunnerHandlers({
            "--context test-ctx get namespaces -o json": () => fail("denied"),
            "--context test-ctx get pods -A -o json": () => ok(podsFixture()),
        });
        await expect(listNamespaces("test-ctx")).rejects.toThrow("denied");
    });
});

describe("listEvents", () => {
    // Minimal event item shape with the fields listEvents reads, mirroring
    // the structurally significant fields kubectl returns for core/v1 Events.
    function makeEventItem(overrides: {
        type?: string;
        reason?: string;
        message?: string;
        count?: number;
        lastTimestamp?: string;
        eventTime?: string;
        namespace?: string;
        objectKind?: string;
        objectName?: string;
        objectNamespace?: string;
    } = {}): object {
        return {
            metadata: {
                name: "evt-1.abc",
                namespace: overrides.namespace ?? "default",
            },
            involvedObject: {
                kind: overrides.objectKind ?? "Pod",
                name: overrides.objectName ?? "nginx-abc",
                namespace: overrides.objectNamespace ?? "default",
            },
            reason: overrides.reason ?? "Scheduled",
            message: overrides.message ?? "Successfully assigned default/nginx-abc to node-1",
            type: overrides.type ?? "Normal",
            count: overrides.count ?? 1,
            lastTimestamp: overrides.lastTimestamp,
            eventTime: overrides.eventTime,
        };
    }

    test("uses -A flag when no namespace is given", async () => {
        setRunnerHandlers({
            "--context test-ctx get events -A -o json": () => ok(JSON.stringify({
                items: [makeEventItem({ lastTimestamp: "2024-06-01T00:00:00Z" })],
            })),
        });
        const result = await listEvents("test-ctx");
        expect(result).toHaveLength(1);
    });

    test("uses -n flag when namespace is given", async () => {
        setRunnerHandlers({
            "--context test-ctx get events -n my-ns -o json": () => ok(JSON.stringify({
                items: [makeEventItem({ namespace: "my-ns", lastTimestamp: "2024-06-01T00:00:00Z" })],
            })),
        });
        const result = await listEvents("test-ctx", "my-ns");
        expect(result).toHaveLength(1);
    });

    test("maps all fields from a Warning event correctly", async () => {
        setRunnerHandlers({
            "--context test-ctx get events -A -o json": () => ok(JSON.stringify({
                items: [
                    makeEventItem({
                        type: "Warning",
                        reason: "BackOff",
                        message: "Back-off restarting failed container",
                        count: 7,
                        lastTimestamp: "2024-01-15T12:00:00Z",
                        namespace: "prod",
                        objectKind: "Pod",
                        objectName: "api-xyz",
                    }),
                ],
            })),
        });
        const result = await listEvents("test-ctx");
        expect(result[0]).toEqual({
            type: "Warning",
            reason: "BackOff",
            message: "Back-off restarting failed container",
            count: 7,
            lastSeen: "2024-01-15T12:00:00Z",
            namespace: "prod",
            objectKind: "Pod",
            objectName: "api-xyz",
        });
    });

    test("falls back to eventTime when lastTimestamp is absent", async () => {
        setRunnerHandlers({
            "--context test-ctx get events -A -o json": () => ok(JSON.stringify({
                items: [makeEventItem({ lastTimestamp: undefined, eventTime: "2024-03-03T03:03:03Z" })],
            })),
        });
        const result = await listEvents("test-ctx");
        expect(result[0]!.lastSeen).toBe("2024-03-03T03:03:03Z");
    });

    test("sorts events newest-first by lastSeen", async () => {
        setRunnerHandlers({
            "--context test-ctx get events -A -o json": () => ok(JSON.stringify({
                items: [
                    makeEventItem({ objectName: "older", lastTimestamp: "2024-01-01T00:00:00Z" }),
                    makeEventItem({ objectName: "newer", lastTimestamp: "2024-06-01T00:00:00Z" }),
                ],
            })),
        });
        const result = await listEvents("test-ctx");
        expect(result[0]!.objectName).toBe("newer");
        expect(result[1]!.objectName).toBe("older");
    });

    test("returns [] when items is empty", async () => {
        setRunnerHandlers({
            "--context test-ctx get events -A -o json": () => ok(JSON.stringify({
                items: [],
            })),
        });
        const result = await listEvents("test-ctx");
        expect(result.length).toBe(0);
    });

    test("throws on non-zero exit", async () => {
        setRunnerHandlers({
            "--context test-ctx get events -A -o json": () => fail("forbidden"),
        });
        await expect(listEvents("test-ctx")).rejects.toThrow("forbidden");
    });
});

describe("listClusterErrors", () => {
    // A Warning event item, mirroring the structurally significant fields kubectl
    // returns for core/v1 Events when filtered by type=Warning.
    function warningEventItem(overrides: {
        reason?: string;
        message?: string;
        count?: number;
        lastTimestamp?: string;
        namespace?: string;
        objectName?: string;
    } = {}): object {
        return {
            metadata: {
                name: "evt-1.abc",
                namespace: overrides.namespace ?? "default",
            },
            involvedObject: {
                kind: "Pod",
                name: overrides.objectName ?? "nginx-abc",
                namespace: overrides.namespace ?? "default",
            },
            reason: overrides.reason ?? "BackOff",
            message: overrides.message ?? "Back-off restarting failed container",
            type: "Warning",
            count: overrides.count ?? 3,
            lastTimestamp: overrides.lastTimestamp ?? "2024-06-01T00:00:00Z",
        };
    }

    // A pod item whose single container is waiting in the given problem state.
    function waitingPodItem(reason: string, overrides: {
        name?: string;
        namespace?: string;
        message?: string;
        startTime?: string;
    } = {}): object {
        return {
            metadata: {
                name: overrides.name ?? "broken-pod",
                namespace: overrides.namespace ?? "default",
                creationTimestamp: "2024-05-01T00:00:00Z",
            },
            status: {
                phase: "Pending",
                startTime: overrides.startTime ?? "2024-05-02T00:00:00Z",
                containerStatuses: [
                    {
                        name: "app",
                        state: {
                            waiting: {
                                reason,
                                message: overrides.message,
                            },
                        },
                    },
                ],
            },
        };
    }

    // A healthy running pod that must never appear in the errors list.
    function healthyPodItem(): object {
        return {
            metadata: {
                name: "healthy-pod",
                namespace: "default",
                creationTimestamp: "2024-05-01T00:00:00Z",
            },
            status: {
                phase: "Running",
                containerStatuses: [
                    {
                        name: "app",
                        state: {
                            running: {
                                startedAt: "2024-05-01T00:01:00Z",
                            },
                        },
                    },
                ],
            },
        };
    }

    test("requests Warning events and all pods with -A when no namespace given", async () => {
        let eventsArgs: readonly string[] | null = null;
        let podsArgs: readonly string[] | null = null;
        run.mockImplementation((_binary: string, args: readonly string[]) => {
            const key = args.join(" ");
            if (key.includes("get events")) {
                eventsArgs = args;
                return Promise.resolve(ok(JSON.stringify({ items: [] })));
            }
            if (key.includes("get pods")) {
                podsArgs = args;
                return Promise.resolve(ok(JSON.stringify({ items: [] })));
            }
            throw new Error("unmocked kubectl call: " + key);
        });
        await listClusterErrors("test-ctx");
        expect(eventsArgs).toEqual([
            "--context", "test-ctx", "get", "events", "-A", "--field-selector=type=Warning", "-o", "json",
        ]);
        expect(podsArgs).toEqual([
            "--context", "test-ctx", "get", "pods", "-A", "-o", "json",
        ]);
    });

    test("scopes both queries with -n when a namespace is given", async () => {
        let eventsArgs: readonly string[] | null = null;
        let podsArgs: readonly string[] | null = null;
        run.mockImplementation((_binary: string, args: readonly string[]) => {
            const key = args.join(" ");
            if (key.includes("get events")) {
                eventsArgs = args;
                return Promise.resolve(ok(JSON.stringify({ items: [] })));
            }
            if (key.includes("get pods")) {
                podsArgs = args;
                return Promise.resolve(ok(JSON.stringify({ items: [] })));
            }
            throw new Error("unmocked kubectl call: " + key);
        });
        await listClusterErrors("test-ctx", "my-ns");
        expect(eventsArgs).toContain("-n");
        expect(eventsArgs).toContain("my-ns");
        expect(podsArgs).toContain("-n");
        expect(podsArgs).toContain("my-ns");
    });

    test("maps a Warning event to a ClusterError with source Event", async () => {
        run.mockImplementation((_binary: string, args: readonly string[]) => {
            const key = args.join(" ");
            if (key.includes("get events")) {
                return Promise.resolve(ok(JSON.stringify({
                    items: [warningEventItem({
                        reason: "FailedScheduling",
                        message: "0/3 nodes are available",
                        count: 4,
                        namespace: "prod",
                        objectName: "api-xyz",
                        lastTimestamp: "2024-06-02T00:00:00Z",
                    })],
                })));
            }
            return Promise.resolve(ok(JSON.stringify({ items: [] })));
        });
        const result = await listClusterErrors("test-ctx");
        expect(result).toEqual([
            {
                source: "Event",
                namespace: "prod",
                objectKind: "Pod",
                objectName: "api-xyz",
                reason: "FailedScheduling",
                message: "0/3 nodes are available",
                count: 4,
                lastSeen: "2024-06-02T00:00:00Z",
            },
        ]);
    });

    test("maps a CrashLoopBackOff pod to a ClusterError with source Pod", async () => {
        run.mockImplementation((_binary: string, args: readonly string[]) => {
            const key = args.join(" ");
            if (key.includes("get pods")) {
                return Promise.resolve(ok(JSON.stringify({
                    items: [waitingPodItem("CrashLoopBackOff", {
                        name: "crasher",
                        namespace: "default",
                        message: "back-off 5m0s restarting failed container",
                        startTime: "2024-06-03T00:00:00Z",
                    })],
                })));
            }
            return Promise.resolve(ok(JSON.stringify({ items: [] })));
        });
        const result = await listClusterErrors("test-ctx");
        expect(result).toEqual([
            {
                source: "Pod",
                namespace: "default",
                objectKind: "Pod",
                objectName: "crasher",
                reason: "CrashLoopBackOff",
                message: "back-off 5m0s restarting failed container",
                count: 1,
                lastSeen: "2024-06-03T00:00:00Z",
            },
        ]);
    });

    test("excludes healthy running pods", async () => {
        run.mockImplementation((_binary: string, args: readonly string[]) => {
            const key = args.join(" ");
            if (key.includes("get pods")) {
                return Promise.resolve(ok(JSON.stringify({ items: [healthyPodItem()] })));
            }
            return Promise.resolve(ok(JSON.stringify({ items: [] })));
        });
        const result = await listClusterErrors("test-ctx");
        expect(result).toEqual([]);
    });

    test("includes pods in the Failed phase", async () => {
        run.mockImplementation((_binary: string, args: readonly string[]) => {
            const key = args.join(" ");
            if (key.includes("get pods")) {
                return Promise.resolve(ok(JSON.stringify({
                    items: [
                        {
                            metadata: {
                                name: "evicted-pod",
                                namespace: "default",
                                creationTimestamp: "2024-05-01T00:00:00Z",
                            },
                            status: {
                                phase: "Failed",
                                reason: "Evicted",
                                message: "Pod was evicted due to memory pressure",
                                startTime: "2024-06-04T00:00:00Z",
                            },
                        },
                    ],
                })));
            }
            return Promise.resolve(ok(JSON.stringify({ items: [] })));
        });
        const result = await listClusterErrors("test-ctx");
        expect(result).toHaveLength(1);
        expect(result[0]!.source).toBe("Pod");
        expect(result[0]!.reason).toBe("Evicted");
        expect(result[0]!.message).toBe("Pod was evicted due to memory pressure");
    });

    test("uses the phase as reason for a Failed pod without a status reason", async () => {
        run.mockImplementation((_binary: string, args: readonly string[]) => {
            const key = args.join(" ");
            if (key.includes("get pods")) {
                return Promise.resolve(ok(JSON.stringify({
                    items: [
                        {
                            metadata: {
                                name: "dead-pod",
                                namespace: "default",
                                creationTimestamp: "2024-05-01T00:00:00Z",
                            },
                            status: {
                                phase: "Failed",
                                startTime: "2024-06-04T00:00:00Z",
                            },
                        },
                    ],
                })));
            }
            return Promise.resolve(ok(JSON.stringify({ items: [] })));
        });
        const result = await listClusterErrors("test-ctx");
        expect(result).toHaveLength(1);
        expect(result[0]!.reason).toBe("Failed");
        expect(result[0]!.message).toBe("Pod is in Failed phase");
    });

    test("combines events and problem pods sorted newest-first", async () => {
        run.mockImplementation((_binary: string, args: readonly string[]) => {
            const key = args.join(" ");
            if (key.includes("get events")) {
                return Promise.resolve(ok(JSON.stringify({
                    items: [warningEventItem({ objectName: "old-event", lastTimestamp: "2024-01-01T00:00:00Z" })],
                })));
            }
            return Promise.resolve(ok(JSON.stringify({
                items: [waitingPodItem("ImagePullBackOff", { name: "new-pod", startTime: "2024-09-01T00:00:00Z" })],
            })));
        });
        const result = await listClusterErrors("test-ctx");
        expect(result).toHaveLength(2);
        expect(result[0]!.objectName).toBe("new-pod");
        expect(result[1]!.objectName).toBe("old-event");
    });

    test("throws when the events query fails", async () => {
        run.mockImplementation((_binary: string, args: readonly string[]) => {
            const key = args.join(" ");
            if (key.includes("get events")) {
                return Promise.resolve(fail("forbidden"));
            }
            return Promise.resolve(ok(JSON.stringify({ items: [] })));
        });
        await expect(listClusterErrors("test-ctx")).rejects.toThrow("forbidden");
    });

    test("throws when the pods query fails", async () => {
        run.mockImplementation((_binary: string, args: readonly string[]) => {
            const key = args.join(" ");
            if (key.includes("get pods")) {
                return Promise.resolve(fail("pods unreachable"));
            }
            return Promise.resolve(ok(JSON.stringify({ items: [] })));
        });
        await expect(listClusterErrors("test-ctx")).rejects.toThrow("pods unreachable");
    });
});

describe("setContextNamespace", () => {
    test("invokes runner with exact argv", async () => {
        setRunnerHandlers({
            "config set-context my-ctx --namespace=my-ns": () => ok(""),
        });
        await setContextNamespace("my-ctx", "my-ns");
        expect(run).toHaveBeenCalledTimes(1);
        expect(run).toHaveBeenCalledWith("kubectl", ["config", "set-context", "my-ctx", "--namespace=my-ns"]);
    });

    test("throws on non-zero exit", async () => {
        setRunnerHandlers({
            "config set-context ghost --namespace=ns1": () => fail("no such context"),
        });
        await expect(setContextNamespace("ghost", "ns1")).rejects.toThrow("no such context");
    });

    test("empty namespace runs config unset instead of set-context", async () => {
        setRunnerHandlers({
            "config unset contexts.my-ctx.namespace": () => ok(""),
        });
        await setContextNamespace("my-ctx", "");
        expect(run).toHaveBeenCalledTimes(1);
        expect(run).toHaveBeenCalledWith("kubectl", ["config", "unset", "contexts.my-ctx.namespace"]);
    });
});

describe("getPodLogs", () => {
    afterEach(() => {
        delete process.env.KARSE_FAKE_LOGS;
    });

    test("returns fake log lines when KARSE_FAKE_LOGS=1 without calling kubectl", async () => {
        process.env.KARSE_FAKE_LOGS = "1";
        const logs = await getPodLogs("ctx", "default", "my-pod");
        expect(logs).toContain("start worker processes");
        expect(logs).toContain("kube-probe/1.29");
        expect(run).not.toHaveBeenCalled();
    });

    test("returns stdout on success", async () => {
        setRunnerHandlers({
            "--context ctx -n default logs my-pod --tail=100": () => ok("line1\nline2\n"),
        });
        const logs = await getPodLogs("ctx", "default", "my-pod");
        expect(logs).toBe("line1\nline2\n");
    });

    test("passes container flag when container is specified", async () => {
        setRunnerHandlers({
            "--context ctx -n default logs my-pod -c nginx --tail=50": () => ok("nginx log\n"),
        });
        const logs = await getPodLogs("ctx", "default", "my-pod", "nginx", 50);
        expect(logs).toBe("nginx log\n");
    });

    test("returns empty string when kubectl reports no logs found", async () => {
        setRunnerHandlers({
            "--context ctx -n default logs my-pod --tail=100": () =>
                fail('no logs found for container "my-pod" in pod "default/my-pod"'),
        });
        const logs = await getPodLogs("ctx", "default", "my-pod");
        expect(logs).toBe("");
    });

    test("throws on other kubectl errors", async () => {
        setRunnerHandlers({
            "--context ctx -n default logs my-pod --tail=100": () => fail("connection refused"),
        });
        await expect(getPodLogs("ctx", "default", "my-pod")).rejects.toThrow("connection refused");
    });
});

describe("isYamlResourceType", () => {
    test("accepts every viewable resource type", () => {
        for (const type of ["nodes", "pods", "deployments", "daemonsets", "statefulsets", "namespaces"]) {
            expect(isYamlResourceType(type)).toBe(true);
        }
    });

    test("rejects types outside the whitelist", () => {
        for (const type of ["secrets", "configmaps", "", "Pod", "__proto__"]) {
            expect(isYamlResourceType(type)).toBe(false);
        }
    });
});

describe("getResourceYaml", () => {
    test("issues get with -o yaml and a namespace for namespaced resources", async () => {
        setRunnerHandlers({
            "--context ctx -n default get pod nginx -o yaml": () => ok("apiVersion: v1\nkind: Pod\n"),
        });
        const yaml = await getResourceYaml("ctx", "pods", "nginx", "default");
        expect(yaml).toBe("apiVersion: v1\nkind: Pod\n");
    });

    test("omits the namespace flag for cluster-scoped resources", async () => {
        setRunnerHandlers({
            "--context ctx get node node-1 -o yaml": () => ok("apiVersion: v1\nkind: Node\n"),
        });
        const yaml = await getResourceYaml("ctx", "nodes", "node-1");
        expect(yaml).toBe("apiVersion: v1\nkind: Node\n");
    });

    test("maps the type token to the singular kubectl kind", async () => {
        setRunnerHandlers({
            "--context ctx -n default get statefulset postgres -o yaml": () => ok("kind: StatefulSet\n"),
        });
        const yaml = await getResourceYaml("ctx", "statefulsets", "postgres", "default");
        expect(yaml).toBe("kind: StatefulSet\n");
    });

    test("throws for an unsupported type without invoking kubectl", async () => {
        await expect(getResourceYaml("ctx", "secrets", "my-secret", "default"))
            .rejects.toThrow("unsupported resource type: secrets");
        expect(run).not.toHaveBeenCalled();
    });

    test("throws on non-zero exit", async () => {
        setRunnerHandlers({
            "--context ctx -n default get pod ghost -o yaml": () => fail("NotFound"),
        });
        await expect(getResourceYaml("ctx", "pods", "ghost", "default")).rejects.toThrow("NotFound");
    });
});

describe("streamPodLogs", () => {
    afterEach(() => {
        delete process.env.KARSE_FAKE_LOGS;
    });

    // Captures the StreamHandlers passed to the mocked command-runner stream() so
    // tests can drive stdout/close callbacks as a real spawned process would.
    function captureStream(): { handlers: any; kill: jest.Mock } {
        const kill = jest.fn();
        let captured: any = null;
        stream.mockImplementation((_binary: string, _args: readonly string[], handlers: any) => {
            captured = handlers;
            return { kill };
        });
        return {
            get handlers() {
                return captured;
            },
            kill,
        };
    }

    test("invokes kubectl logs -f with follow flag and tail", () => {
        captureStream();
        streamPodLogs("ctx", "default", "my-pod", undefined, 50, {
            onLine: jest.fn(),
            onError: jest.fn(),
            onClose: jest.fn(),
        });
        expect(stream).toHaveBeenCalledWith(
            "kubectl",
            ["--context", "ctx", "-n", "default", "logs", "-f", "my-pod", "--tail=50"],
            expect.any(Object)
        );
    });

    test("passes container flag when a container is specified", () => {
        captureStream();
        streamPodLogs("ctx", "default", "my-pod", "nginx", 100, {
            onLine: jest.fn(),
            onError: jest.fn(),
            onClose: jest.fn(),
        });
        expect(stream).toHaveBeenCalledWith(
            "kubectl",
            ["--context", "ctx", "-n", "default", "logs", "-f", "my-pod", "-c", "nginx", "--tail=100"],
            expect.any(Object)
        );
    });

    test("splits streamed chunks into complete lines", () => {
        const cap = captureStream();
        const onLine = jest.fn();
        streamPodLogs("ctx", "default", "my-pod", undefined, 100, {
            onLine,
            onError: jest.fn(),
            onClose: jest.fn(),
        });
        cap.handlers.onStdout("line one\nline two\npart");
        expect(onLine).toHaveBeenCalledTimes(2);
        expect(onLine).toHaveBeenNthCalledWith(1, "line one");
        expect(onLine).toHaveBeenNthCalledWith(2, "line two");
    });

    test("flushes a trailing partial line on close", () => {
        const cap = captureStream();
        const onLine = jest.fn();
        const onClose = jest.fn();
        streamPodLogs("ctx", "default", "my-pod", undefined, 100, {
            onLine,
            onError: jest.fn(),
            onClose,
        });
        cap.handlers.onStdout("complete\ntrailing");
        cap.handlers.onClose(0);
        expect(onLine).toHaveBeenCalledWith("trailing");
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    test("forwards stream errors", () => {
        const cap = captureStream();
        const onError = jest.fn();
        streamPodLogs("ctx", "default", "my-pod", undefined, 100, {
            onLine: jest.fn(),
            onError,
            onClose: jest.fn(),
        });
        cap.handlers.onError(new Error("spawn failed"));
        expect(onError).toHaveBeenCalledWith(new Error("spawn failed"));
    });

    test("stop() kills the underlying process", () => {
        const cap = captureStream();
        const handle = streamPodLogs("ctx", "default", "my-pod", undefined, 100, {
            onLine: jest.fn(),
            onError: jest.fn(),
            onClose: jest.fn(),
        });
        handle.stop();
        expect(cap.kill).toHaveBeenCalled();
    });

    test("emits fake log lines without spawning when KARSE_FAKE_LOGS=1", () => {
        process.env.KARSE_FAKE_LOGS = "1";
        const onLine = jest.fn();
        streamPodLogs("ctx", "default", "my-pod", undefined, 100, {
            onLine,
            onError: jest.fn(),
            onClose: jest.fn(),
        });
        expect(stream).not.toHaveBeenCalled();
        const emitted = onLine.mock.calls.map((c: any[]) => c[0]).join("\n");
        expect(emitted).toContain("start worker processes");
        expect(emitted).toContain("kube-probe/1.29");
    });

    test("calls onClose after emitting fake log lines when KARSE_FAKE_LOGS=1", async () => {
        process.env.KARSE_FAKE_LOGS = "1";
        const onClose = jest.fn();
        streamPodLogs("ctx", "default", "my-pod", undefined, 100, {
            onLine: jest.fn(),
            onError: jest.fn(),
            onClose,
        });
        // The fake stream defers onClose so callers can attach listeners first.
        expect(onClose).not.toHaveBeenCalled();
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    test("stop() suppresses the deferred onClose for fake streams", async () => {
        process.env.KARSE_FAKE_LOGS = "1";
        const onClose = jest.fn();
        const handle = streamPodLogs("ctx", "default", "my-pod", undefined, 100, {
            onLine: jest.fn(),
            onError: jest.fn(),
            onClose,
        });
        handle.stop();
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(onClose).not.toHaveBeenCalled();
    });
});
