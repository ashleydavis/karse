jest.mock("../../command-runner");
jest.mock("../../audit-log");
jest.mock("../../kubectl/cache");

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
    getClusterPerformance,
    getPodPerformance,
    listPods,
    listHorizontalPodAutoscalers,
    listEvents,
    listClusterErrors,
    getPodLogs,
    getResourceYaml,
    isYamlResourceType,
    streamPodLogs,
    getNodePerformance,
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
            instanceType: null,
        });
        expect(result[1]!).toEqual({
            name: "worker-0",
            status: "NotReady",
            roles: [],
            version: "v1.30.0",
            createdAt: "2024-06-01T00:00:00Z",
            labels: {},
            instanceType: null,
        });
    });

    test("reads instanceType from the instance-type label, preferring the GA key", async () => {
        const fixture = {
            items: [
                {
                    metadata: {
                        name: "ga-node",
                        creationTimestamp: "2024-01-01T00:00:00Z",
                        labels: {
                            "node.kubernetes.io/instance-type": "m5.large",
                            "beta.kubernetes.io/instance-type": "m4.large",
                        },
                    },
                    status: {
                        conditions: [{ type: "Ready", status: "True" }],
                        nodeInfo: { kubeletVersion: "v1.30.0" },
                    },
                },
                {
                    metadata: {
                        name: "beta-node",
                        creationTimestamp: "2024-01-01T00:00:00Z",
                        labels: { "beta.kubernetes.io/instance-type": "t2.micro" },
                    },
                    status: {
                        conditions: [{ type: "Ready", status: "True" }],
                        nodeInfo: { kubeletVersion: "v1.30.0" },
                    },
                },
                {
                    metadata: {
                        name: "no-label-node",
                        creationTimestamp: "2024-01-01T00:00:00Z",
                        labels: {},
                    },
                    status: {
                        conditions: [{ type: "Ready", status: "True" }],
                        nodeInfo: { kubeletVersion: "v1.30.0" },
                    },
                },
            ],
        };
        setRunnerHandlers({
            "--context test-ctx get nodes -o json": () => ok(JSON.stringify(fixture)),
        });
        const result = await listNodes("test-ctx");
        expect(result[0]!.instanceType).toBe("m5.large");
        expect(result[1]!.instanceType).toBe("t2.micro");
        expect(result[2]!.instanceType).toBeNull();
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

    test("returns no roles when the node carries no role labels", async () => {
        const fixture = {
            items: [
                {
                    metadata: {
                        name: "plain-0",
                        creationTimestamp: "2024-01-01T00:00:00Z",
                        labels: {
                            "kubernetes.io/hostname": "plain-0",
                            "kubernetes.io/os": "linux",
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
        expect(result[0]!.roles).toEqual([]);
    });

    test("returns no roles when the node has no labels field at all", async () => {
        const fixture = {
            items: [
                {
                    metadata: {
                        name: "bare-0",
                        creationTimestamp: "2024-01-01T00:00:00Z",
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
        expect(result[0]!.roles).toEqual([]);
        expect(result[0]!.labels).toEqual({});
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

describe("listHorizontalPodAutoscalers", () => {
    // A fully-populated autoscaling/v2 HPA item with resource (cpu) metric status.
    const fullHpa = {
        metadata: {
            name: "web",
            namespace: "default",
            creationTimestamp: "2024-06-01T00:00:00Z",
            labels: { app: "web" },
        },
        spec: {
            scaleTargetRef: { kind: "Deployment", name: "web" },
            minReplicas: 2,
            maxReplicas: 10,
            metrics: [
                { type: "Resource", resource: { name: "cpu", target: { averageUtilization: 80 } } },
            ],
        },
        status: {
            currentReplicas: 4,
            desiredReplicas: 6,
            currentMetrics: [
                { type: "Resource", resource: { name: "cpu", current: { averageUtilization: 55 } } },
            ],
        },
    };

    test("parses an HPA with a cpu metric, reference, bounds, and targets", async () => {
        setRunnerHandlers({
            "--context test-ctx get horizontalpodautoscalers -A -o json": () =>
                ok(JSON.stringify({ items: [fullHpa] })),
        });
        const result = await listHorizontalPodAutoscalers("test-ctx");
        expect(result).toEqual([
            {
                name: "web",
                namespace: "default",
                reference: "Deployment/web",
                minReplicas: 2,
                maxReplicas: 10,
                currentReplicas: 4,
                desiredReplicas: 6,
                targets: "cpu: 55%/80%",
                createdAt: "2024-06-01T00:00:00Z",
                labels: { app: "web" },
            },
        ]);
    });

    test("scopes to a namespace when given", async () => {
        setRunnerHandlers({
            "--context test-ctx get horizontalpodautoscalers -n team-a -o json": () =>
                ok(JSON.stringify({ items: [] })),
        });
        const result = await listHorizontalPodAutoscalers("test-ctx", "team-a");
        expect(result).toEqual([]);
    });

    test("reports <none> targets when the HPA has no metrics", async () => {
        setRunnerHandlers({
            "--context test-ctx get horizontalpodautoscalers -A -o json": () =>
                ok(JSON.stringify({
                    items: [{
                        metadata: { name: "bare", namespace: "default", creationTimestamp: "2024-06-01T00:00:00Z" },
                        spec: { scaleTargetRef: { kind: "Deployment", name: "bare" }, minReplicas: 1, maxReplicas: 5 },
                        status: { currentReplicas: 1 },
                    }],
                })),
        });
        const result = await listHorizontalPodAutoscalers("test-ctx");
        expect(result[0]!).toEqual({
            name: "bare",
            namespace: "default",
            reference: "Deployment/bare",
            minReplicas: 1,
            maxReplicas: 5,
            currentReplicas: 1,
            desiredReplicas: 0,
            targets: "<none>",
            createdAt: "2024-06-01T00:00:00Z",
            labels: {},
        });
    });

    test("shows <unknown> for a target metric whose current value has not populated yet", async () => {
        setRunnerHandlers({
            "--context test-ctx get horizontalpodautoscalers -A -o json": () =>
                ok(JSON.stringify({
                    items: [{
                        metadata: { name: "warming", namespace: "default", creationTimestamp: "2024-06-01T00:00:00Z" },
                        spec: {
                            scaleTargetRef: { kind: "Deployment", name: "warming" },
                            minReplicas: 1,
                            maxReplicas: 5,
                            metrics: [{ type: "Resource", resource: { name: "cpu", target: { averageUtilization: 80 } } }],
                        },
                        status: { currentReplicas: 1, currentMetrics: [] },
                    }],
                })),
        });
        const result = await listHorizontalPodAutoscalers("test-ctx");
        expect(result[0]!.targets).toBe("cpu: <unknown>/80%");
    });

    test("throws when kubectl fails", async () => {
        setRunnerHandlers({
            "--context test-ctx get horizontalpodautoscalers -A -o json": () => fail("forbidden"),
        });
        await expect(listHorizontalPodAutoscalers("test-ctx")).rejects.toThrow("forbidden");
    });
});

describe("listEvents", () => {
    // Minimal event item shape with the fields listEvents reads, mirroring
    // the structurally significant fields kubectl returns for core/v1 Events.
    function makeEventItem(overrides: {
        uid?: string;
        type?: string;
        reason?: string;
        message?: string;
        count?: number;
        source?: string;
        firstTimestamp?: string;
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
                uid: overrides.uid ?? "evt-uid-1",
            },
            involvedObject: {
                kind: overrides.objectKind ?? "Pod",
                name: overrides.objectName ?? "nginx-abc",
                namespace: overrides.objectNamespace ?? "default",
            },
            source: {
                component: overrides.source ?? "kubelet",
            },
            reason: overrides.reason ?? "Scheduled",
            message: overrides.message ?? "Successfully assigned default/nginx-abc to node-1",
            type: overrides.type ?? "Normal",
            count: overrides.count ?? 1,
            firstTimestamp: overrides.firstTimestamp,
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
                        uid: "abc-123",
                        type: "Warning",
                        reason: "BackOff",
                        message: "Back-off restarting failed container",
                        count: 7,
                        source: "kubelet",
                        firstTimestamp: "2024-01-15T11:00:00Z",
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
            uid: "abc-123",
            type: "Warning",
            reason: "BackOff",
            message: "Back-off restarting failed container",
            count: 7,
            source: "kubelet",
            firstSeen: "2024-01-15T11:00:00Z",
            lastSeen: "2024-01-15T12:00:00Z",
            namespace: "prod",
            objectKind: "Pod",
            objectName: "api-xyz",
        });
    });

    test("uid is empty and firstSeen falls back to eventTime when both absent", async () => {
        setRunnerHandlers({
            "--context test-ctx get events -A -o json": () => ok(JSON.stringify({
                items: [
                    {
                        metadata: {
                            name: "evt-no-uid",
                            namespace: "default",
                        },
                        involvedObject: {
                            kind: "Pod",
                            name: "nginx-abc",
                        },
                        reason: "Scheduled",
                        message: "msg",
                        type: "Normal",
                        count: 1,
                        eventTime: "2024-03-03T03:03:03Z",
                    },
                ],
            })),
        });
        const result = await listEvents("test-ctx");
        expect(result[0]!.uid).toBe("");
        expect(result[0]!.firstSeen).toBe("2024-03-03T03:03:03Z");
        expect(result[0]!.source).toBe("");
    });

    test("source falls back to reportingComponent when source.component is absent", async () => {
        setRunnerHandlers({
            "--context test-ctx get events -A -o json": () => ok(JSON.stringify({
                items: [
                    {
                        metadata: {
                            name: "evt-reporting",
                            namespace: "default",
                            uid: "u1",
                        },
                        involvedObject: {
                            kind: "Pod",
                            name: "nginx-abc",
                        },
                        reportingComponent: "kubelet",
                        reason: "Scheduled",
                        message: "msg",
                        type: "Normal",
                        count: 1,
                        lastTimestamp: "2024-03-03T03:03:03Z",
                    },
                ],
            })),
        });
        const result = await listEvents("test-ctx");
        expect(result[0]!.source).toBe("kubelet");
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
        firstTimestamp?: string;
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
            firstTimestamp: overrides.firstTimestamp ?? "2024-05-30T00:00:00Z",
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
                        firstTimestamp: "2024-05-29T00:00:00Z",
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
                firstSeen: "2024-05-29T00:00:00Z",
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
                firstSeen: "2024-05-01T00:00:00Z",
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

    test("carries firstSeen from the event firstTimestamp and the pod creationTimestamp", async () => {
        run.mockImplementation((_binary: string, args: readonly string[]) => {
            const key = args.join(" ");
            if (key.includes("get events")) {
                return Promise.resolve(ok(JSON.stringify({
                    items: [warningEventItem({
                        objectName: "evt-pod",
                        firstTimestamp: "2024-06-10T00:00:00Z",
                        lastTimestamp: "2024-06-12T00:00:00Z",
                    })],
                })));
            }
            return Promise.resolve(ok(JSON.stringify({
                items: [waitingPodItem("ImagePullBackOff", { name: "pod-1", startTime: "2024-06-15T00:00:00Z" })],
            })));
        });
        const result = await listClusterErrors("test-ctx");
        const event = result.find((e) => e.objectName === "evt-pod")!;
        const pod = result.find((e) => e.objectName === "pod-1")!;
        expect(event.firstSeen).toBe("2024-06-10T00:00:00Z");
        expect(event.lastSeen).toBe("2024-06-12T00:00:00Z");
        expect(pod.firstSeen).toBe("2024-05-01T00:00:00Z");
        expect(pod.lastSeen).toBe("2024-06-15T00:00:00Z");
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
        // The canned stream includes an "error" and a "warning" line so the
        // viewer's severity highlighting can be exercised without a real cluster.
        expect(logs).toContain("[error]");
        expect(logs).toContain("[warning]");
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
        const handle = streamPodLogs("ctx", "default", "my-pod", undefined, 100, {
            onLine,
            onError: jest.fn(),
            onClose: jest.fn(),
        });
        expect(stream).not.toHaveBeenCalled();
        const emitted = onLine.mock.calls.map((c: any[]) => c[0]).join("\n");
        expect(emitted).toContain("start worker processes");
        expect(emitted).toContain("kube-probe/1.29");
        // Includes an "error" and a "warning" line for the viewer's highlighting.
        expect(emitted).toContain("[error]");
        expect(emitted).toContain("[warning]");
        // The fake stream follows until stopped, so stop it rather than leaking its timer.
        handle.stop();
    });

    test("keeps emitting new fake log lines over time when KARSE_FAKE_LOGS=1", () => {
        process.env.KARSE_FAKE_LOGS = "1";
        jest.useFakeTimers();
        try {
            const onLine = jest.fn();
            const onClose = jest.fn();
            const handle = streamPodLogs("ctx", "default", "my-pod", undefined, 100, {
                onLine,
                onError: jest.fn(),
                onClose,
            });
            // The canned lines land immediately as the stream's backlog.
            const backlog = onLine.mock.calls.length;
            expect(backlog).toBe(12);
            // The stream then follows: a new synthesised line every 100ms, so the viewer
            // keeps overflowing and auto-follow can actually be exercised.
            jest.advanceTimersByTime(500);
            expect(onLine.mock.calls.length).toBe(backlog + 5);
            // Each followed line is freshly synthesised (a rising counter), not a replay
            // of the backlog.
            expect(onLine.mock.calls[backlog]![0]).toContain("line=1");
            expect(onLine.mock.calls[backlog + 4]![0]).toContain("line=5");
            // Like a real `kubectl logs -f`, the stream does not end on its own.
            expect(onClose).not.toHaveBeenCalled();
            handle.stop();
        }
        finally {
            jest.useRealTimers();
        }
    });

    test("stop() ends the continuous fake stream when KARSE_FAKE_LOGS=1", () => {
        process.env.KARSE_FAKE_LOGS = "1";
        jest.useFakeTimers();
        try {
            const onLine = jest.fn();
            const handle = streamPodLogs("ctx", "default", "my-pod", undefined, 100, {
                onLine,
                onError: jest.fn(),
                onClose: jest.fn(),
            });
            jest.advanceTimersByTime(300);
            const emittedBeforeStop = onLine.mock.calls.length;
            expect(emittedBeforeStop).toBe(15);
            handle.stop();
            jest.advanceTimersByTime(1000);
            expect(onLine.mock.calls.length).toBe(emittedBeforeStop);
        }
        finally {
            jest.useRealTimers();
        }
    });
});


describe("getClusterPerformance", () => {
    // Raw Metrics API NodeMetricsList fixture: CPU in nanocores, memory in Ki.
    const nodeMetricsFixture = {
        kind: "NodeMetricsList",
        items: [
            {
                metadata: { name: "node-a" },
                usage: { cpu: "850000000n", memory: "2097152Ki" },
            },
            {
                metadata: { name: "node-b" },
                usage: { cpu: "1600000000n", memory: "4194304Ki" },
            },
        ],
    };

    // Raw Metrics API PodMetricsList fixture: per-container usage for two pods.
    const podMetricsFixture = {
        kind: "PodMetricsList",
        items: [
            {
                metadata: { name: "web", namespace: "default" },
                containers: [
                    { name: "nginx", usage: { cpu: "120000000n", memory: "262144Ki" } },
                    { name: "sidecar", usage: { cpu: "30000000n", memory: "65536Ki" } },
                ],
            },
            {
                metadata: { name: "api", namespace: "default" },
                containers: [
                    { name: "api", usage: { cpu: "300000000n", memory: "524288Ki" } },
                ],
            },
        ],
    };

    // Node spec fixture carrying allocatable capacity from node status.
    const nodesFixture = {
        items: [
            {
                metadata: { name: "node-a" },
                status: { allocatable: { cpu: "4", memory: "8Gi" } },
            },
            {
                metadata: { name: "node-b" },
                status: { allocatable: { cpu: "8", memory: "16Gi" } },
            },
        ],
    };

    // Pod spec fixture carrying container requests/limits and the scheduling node.
    const podsFixture = {
        items: [
            {
                metadata: { name: "web", namespace: "default" },
                spec: {
                    nodeName: "node-a",
                    containers: [
                        {
                            name: "nginx",
                            resources: {
                                requests: { cpu: "100m", memory: "128Mi" },
                                limits: { cpu: "500m", memory: "256Mi" },
                            },
                        },
                        {
                            name: "sidecar",
                            resources: {
                                requests: { cpu: "50m", memory: "64Mi" },
                                limits: { cpu: "100m", memory: "128Mi" },
                            },
                        },
                    ],
                },
            },
            {
                metadata: { name: "api", namespace: "default" },
                spec: {
                    nodeName: "node-b",
                    containers: [
                        {
                            name: "api",
                            resources: {
                                requests: { cpu: "200m", memory: "256Mi" },
                                limits: { cpu: "1", memory: "512Mi" },
                            },
                        },
                    ],
                },
            },
        ],
    };

    test("joins node/pod metrics with allocatable and spec requests/limits", async () => {
        setRunnerHandlers({
            "--context ctx get --raw /apis/metrics.k8s.io/v1beta1/nodes": () => ok(JSON.stringify(nodeMetricsFixture)),
            "--context ctx get --raw /apis/metrics.k8s.io/v1beta1/pods": () => ok(JSON.stringify(podMetricsFixture)),
            "--context ctx get nodes -o json": () => ok(JSON.stringify(nodesFixture)),
            "--context ctx get pods -A -o json": () => ok(JSON.stringify(podsFixture)),
        });

        const result = await getClusterPerformance("ctx");

        expect(result.metricsAvailable).toBe(true);

        // Nodes: usage parsed from metrics (nanocores -> millicores, Ki -> bytes),
        // allocatable parsed from node status (cores -> millicores, Gi -> bytes).
        expect(result.nodes).toEqual([
            {
                name: "node-a",
                usage: { cpuMillicores: 850, memoryBytes: 2097152 * 1024 },
                // node-a's requests = the web pod's summed requests (nginx 100m/128Mi +
                // sidecar 50m/64Mi), the only pod scheduled on it.
                requests: { cpuMillicores: 150, memoryBytes: 192 * 1024 ** 2 },
                allocatable: { cpuMillicores: 4000, memoryBytes: 8 * 1024 ** 3 },
            },
            {
                name: "node-b",
                usage: { cpuMillicores: 1600, memoryBytes: 4194304 * 1024 },
                // node-b's requests = the api pod's requests (200m/256Mi).
                requests: { cpuMillicores: 200, memoryBytes: 256 * 1024 ** 2 },
                allocatable: { cpuMillicores: 8000, memoryBytes: 16 * 1024 ** 3 },
            },
        ]);

        // web pod: usage summed over nginx + sidecar; requests/limits summed too.
        const web = result.pods.find((p) => p.name === "web")!;
        expect(web.namespace).toBe("default");
        expect(web.node).toBe("node-a");
        expect(web.usage).toEqual({
            cpuMillicores: 120 + 30,
            memoryBytes: (262144 + 65536) * 1024,
        });
        expect(web.requests).toEqual({
            cpuMillicores: 100 + 50,
            memoryBytes: 128 * 1024 ** 2 + 64 * 1024 ** 2,
        });
        expect(web.limits).toEqual({
            cpuMillicores: 500 + 100,
            memoryBytes: 256 * 1024 ** 2 + 128 * 1024 ** 2,
        });
        expect(web.containers).toHaveLength(2);
        expect(web.containers[0]).toEqual({
            name: "nginx",
            usage: { cpuMillicores: 120, memoryBytes: 262144 * 1024 },
            requests: { cpuMillicores: 100, memoryBytes: 128 * 1024 ** 2 },
            limits: { cpuMillicores: 500, memoryBytes: 256 * 1024 ** 2 },
        });

        // api pod: single container, scheduled on node-b.
        const api = result.pods.find((p) => p.name === "api")!;
        expect(api.node).toBe("node-b");
        expect(api.usage).toEqual({ cpuMillicores: 300, memoryBytes: 524288 * 1024 });
        expect(api.requests).toEqual({ cpuMillicores: 200, memoryBytes: 256 * 1024 ** 2 });
        expect(api.limits).toEqual({ cpuMillicores: 1000, memoryBytes: 512 * 1024 ** 2 });

        // totals: cluster-wide sums across the two nodes.
        expect(result.totals).toEqual({
            usage: { cpuMillicores: 850 + 1600, memoryBytes: (2097152 + 4194304) * 1024 },
            requests: { cpuMillicores: 150 + 200, memoryBytes: (192 + 256) * 1024 ** 2 },
            allocatable: { cpuMillicores: 4000 + 8000, memoryBytes: (8 + 16) * 1024 ** 3 },
        });
    });

    test("totals arithmetic sums usage, requests, and allocatable across two nodes", async () => {
        setRunnerHandlers({
            "--context ctx get --raw /apis/metrics.k8s.io/v1beta1/nodes": () => ok(JSON.stringify(nodeMetricsFixture)),
            "--context ctx get --raw /apis/metrics.k8s.io/v1beta1/pods": () => ok(JSON.stringify(podMetricsFixture)),
            "--context ctx get nodes -o json": () => ok(JSON.stringify(nodesFixture)),
            "--context ctx get pods -A -o json": () => ok(JSON.stringify(podsFixture)),
        });

        const { totals } = await getClusterPerformance("ctx");

        // node-a usage 850m + node-b 1600m; memory 2097152Ki + 4194304Ki.
        expect(totals.usage).toEqual({ cpuMillicores: 2450, memoryBytes: (2097152 + 4194304) * 1024 });
        // requests: web (150m/192Mi) on node-a + api (200m/256Mi) on node-b.
        expect(totals.requests).toEqual({ cpuMillicores: 350, memoryBytes: (192 + 256) * 1024 ** 2 });
        // allocatable: 4 + 8 cores; 8 + 16 GiB.
        expect(totals.allocatable).toEqual({ cpuMillicores: 12000, memoryBytes: 24 * 1024 ** 3 });
    });

    test("workload grouping merges two pods under one Deployment", async () => {
        // Two pods owned by ReplicaSets of the same Deployment ("web"), plus a bare pod.
        const ownedPods = {
            items: [
                {
                    metadata: {
                        name: "web-abc123-aaaaa",
                        namespace: "default",
                        ownerReferences: [{ kind: "ReplicaSet", name: "web-abc123" }],
                    },
                    spec: {
                        nodeName: "node-a",
                        containers: [
                            { name: "c", resources: { requests: { cpu: "100m", memory: "128Mi" } } },
                        ],
                    },
                },
                {
                    metadata: {
                        name: "web-abc123-bbbbb",
                        namespace: "default",
                        ownerReferences: [{ kind: "ReplicaSet", name: "web-abc123" }],
                    },
                    spec: {
                        nodeName: "node-b",
                        containers: [
                            { name: "c", resources: { requests: { cpu: "100m", memory: "128Mi" } } },
                        ],
                    },
                },
                {
                    metadata: { name: "loner", namespace: "default" },
                    spec: {
                        nodeName: "node-a",
                        containers: [
                            { name: "c", resources: { requests: { cpu: "20m", memory: "16Mi" } } },
                        ],
                    },
                },
            ],
        };
        // Pod metrics for both web pods so the merged usage is checkable.
        const podMetrics = {
            kind: "PodMetricsList",
            items: [
                {
                    metadata: { name: "web-abc123-aaaaa", namespace: "default" },
                    containers: [{ name: "c", usage: { cpu: "50000000n", memory: "100Ki" } }],
                },
                {
                    metadata: { name: "web-abc123-bbbbb", namespace: "default" },
                    containers: [{ name: "c", usage: { cpu: "70000000n", memory: "200Ki" } }],
                },
                {
                    metadata: { name: "loner", namespace: "default" },
                    containers: [{ name: "c", usage: { cpu: "10000000n", memory: "50Ki" } }],
                },
            ],
        };
        setRunnerHandlers({
            "--context ctx get --raw /apis/metrics.k8s.io/v1beta1/nodes": () => ok(JSON.stringify(nodeMetricsFixture)),
            "--context ctx get --raw /apis/metrics.k8s.io/v1beta1/pods": () => ok(JSON.stringify(podMetrics)),
            "--context ctx get nodes -o json": () => ok(JSON.stringify(nodesFixture)),
            "--context ctx get pods -A -o json": () => ok(JSON.stringify(ownedPods)),
        });

        const { workloads } = await getClusterPerformance("ctx");

        // The two ReplicaSet pods collapse into a single "web" Deployment row; the bare
        // pod is its own "Pod" row. Two rows total.
        expect(workloads).toHaveLength(2);
        const web = workloads.find((w) => w.kind === "Deployment" && w.name === "web")!;
        expect(web.namespace).toBe("default");
        // usage merged: 50m + 70m; memory 100Ki + 200Ki.
        expect(web.usage).toEqual({ cpuMillicores: 120, memoryBytes: 300 * 1024 });
        // requests merged: 100m + 100m; 128Mi + 128Mi.
        expect(web.requests).toEqual({ cpuMillicores: 200, memoryBytes: 256 * 1024 ** 2 });
        const loner = workloads.find((w) => w.kind === "Pod")!;
        expect(loner.name).toBe("loner");
        // Sorted by CPU usage descending: the 120m Deployment row before the 10m Pod row.
        expect(workloads[0]!.kind).toBe("Deployment");
    });

    test("health counts oomKillCount and nodePressure from fixture conditions and lastState", async () => {
        const pressuredNodes = {
            items: [
                {
                    metadata: { name: "node-a" },
                    status: {
                        allocatable: { cpu: "4", memory: "8Gi" },
                        conditions: [
                            { type: "MemoryPressure", status: "True" },
                            { type: "DiskPressure", status: "False" },
                            { type: "PIDPressure", status: "True" },
                        ],
                    },
                },
                {
                    metadata: { name: "node-b" },
                    status: {
                        allocatable: { cpu: "8", memory: "16Gi" },
                        conditions: [
                            { type: "MemoryPressure", status: "False" },
                            { type: "DiskPressure", status: "True" },
                        ],
                    },
                },
            ],
        };
        const healthPods = {
            items: [
                {
                    metadata: { name: "pending-pod", namespace: "default" },
                    status: { phase: "Pending" },
                    spec: { nodeName: "", containers: [] },
                },
                {
                    metadata: { name: "oom-pod", namespace: "default" },
                    status: {
                        phase: "Running",
                        containerStatuses: [
                            { name: "c", lastState: { terminated: { reason: "OOMKilled" } } },
                        ],
                    },
                    spec: { nodeName: "node-a", containers: [{ name: "c" }] },
                },
                {
                    metadata: { name: "healthy-pod", namespace: "default" },
                    status: { phase: "Running" },
                    spec: { nodeName: "node-b", containers: [{ name: "c" }] },
                },
            ],
        };
        setRunnerHandlers({
            "--context ctx get --raw /apis/metrics.k8s.io/v1beta1/nodes": () =>
                fail("error: the server could not find the requested resource"),
            "--context ctx get --raw /apis/metrics.k8s.io/v1beta1/pods": () =>
                fail("error: the server could not find the requested resource"),
            "--context ctx get nodes -o json": () => ok(JSON.stringify(pressuredNodes)),
            "--context ctx get pods -A -o json": () => ok(JSON.stringify(healthPods)),
        });

        const { health } = await getClusterPerformance("ctx");

        expect(health.nodeCount).toBe(2);
        expect(health.pendingPods).toBe(1);
        expect(health.oomKillCount).toBe(1);
        // node-a is under MemoryPressure + PIDPressure; node-b under DiskPressure.
        expect(health.nodePressure).toEqual({ memoryPressure: 1, diskPressure: 1, pidPressure: 1 });
        expect(health.cpuThrottlingAvailable).toBe(false);
    });

    test("metrics-API-unavailable -> metricsAvailable false, usage null, requests/limits populated", async () => {
        setRunnerHandlers({
            "--context ctx get --raw /apis/metrics.k8s.io/v1beta1/nodes": () =>
                fail("error: the server could not find the requested resource"),
            "--context ctx get --raw /apis/metrics.k8s.io/v1beta1/pods": () =>
                fail("error: the server could not find the requested resource"),
            "--context ctx get nodes -o json": () => ok(JSON.stringify(nodesFixture)),
            "--context ctx get pods -A -o json": () => ok(JSON.stringify(podsFixture)),
        });

        const result = await getClusterPerformance("ctx");

        expect(result.metricsAvailable).toBe(false);

        // Node usage is null, but allocatable is still read from node status.
        for (const node of result.nodes) {
            expect(node.usage).toEqual({ cpuMillicores: null, memoryBytes: null });
        }
        expect(result.nodes[0]!.allocatable).toEqual({
            cpuMillicores: 4000,
            memoryBytes: 8 * 1024 ** 3,
        });

        // Pod usage is null, but requests/limits are still populated from specs.
        const web = result.pods.find((p) => p.name === "web")!;
        expect(web.usage).toEqual({ cpuMillicores: null, memoryBytes: null });
        expect(web.requests).toEqual({
            cpuMillicores: 150,
            memoryBytes: 192 * 1024 ** 2,
        });
        expect(web.limits).toEqual({
            cpuMillicores: 600,
            memoryBytes: 384 * 1024 ** 2,
        });
        for (const container of web.containers) {
            expect(container.usage).toEqual({ cpuMillicores: null, memoryBytes: null });
        }
        expect(web.containers[0]!.requests).toEqual({
            cpuMillicores: 100,
            memoryBytes: 128 * 1024 ** 2,
        });
    });

    test("throws when the node spec read fails", async () => {
        setRunnerHandlers({
            "--context ctx get --raw /apis/metrics.k8s.io/v1beta1/nodes": () => ok(JSON.stringify(nodeMetricsFixture)),
            "--context ctx get --raw /apis/metrics.k8s.io/v1beta1/pods": () => ok(JSON.stringify(podMetricsFixture)),
            "--context ctx get nodes -o json": () => fail("forbidden"),
            "--context ctx get pods -A -o json": () => ok(JSON.stringify(podsFixture)),
        });
        await expect(getClusterPerformance("ctx")).rejects.toThrow("forbidden");
    });
});

describe("getNodePerformance", () => {
    // Argv keys for the four calls getNodePerformance makes for node-1.
    const NODE_METRICS_KEY = "--context test-ctx get --raw /apis/metrics.k8s.io/v1beta1/nodes";
    const POD_METRICS_KEY = "--context test-ctx get --raw /apis/metrics.k8s.io/v1beta1/pods";
    const NODE_KEY = "--context test-ctx get node node-1 -o json";
    const PODS_KEY = "--context test-ctx get pods -A --field-selector=spec.nodeName=node-1 -o json";

    // The node object as kubectl get node -o json returns it, carrying allocatable.
    function makeNodeItem(): object {
        return {
            metadata: { name: "node-1" },
            status: {
                allocatable: { cpu: "4", memory: "8Gi" },
            },
        };
    }

    // A pod item with two containers and per-container requests/limits in its spec.
    function makeWebPod(): object {
        return {
            metadata: { name: "web", namespace: "default" },
            spec: {
                nodeName: "node-1",
                containers: [
                    {
                        name: "nginx",
                        resources: {
                            requests: { cpu: "100m", memory: "128Mi" },
                            limits: { cpu: "250m", memory: "256Mi" },
                        },
                    },
                    {
                        name: "sidecar",
                        resources: {
                            requests: { cpu: "50m", memory: "64Mi" },
                            limits: { cpu: "100m", memory: "128Mi" },
                        },
                    },
                ],
            },
        };
    }

    // The node-metrics list as the raw endpoint returns it (CPU in nanocores, memory in Ki).
    function nodeMetricsList(): object {
        return {
            kind: "NodeMetricsList",
            items: [
                { metadata: { name: "node-1" }, usage: { cpu: "850000000n", memory: "2097152Ki" } },
                { metadata: { name: "node-2" }, usage: { cpu: "1600000000n", memory: "4194304Ki" } },
            ],
        };
    }

    // The pod-metrics list with per-container usage for the web pod.
    function podMetricsList(): object {
        return {
            kind: "PodMetricsList",
            items: [
                {
                    metadata: { name: "web", namespace: "default" },
                    containers: [
                        { name: "nginx", usage: { cpu: "120000000n", memory: "262144Ki" } },
                        { name: "sidecar", usage: { cpu: "30000000n", memory: "65536Ki" } },
                    ],
                },
            ],
        };
    }

    test("returns only the named node's pods with per-container usage joined to spec", async () => {
        setRunnerHandlers({
            [NODE_METRICS_KEY]: () => ok(JSON.stringify(nodeMetricsList())),
            [POD_METRICS_KEY]: () => ok(JSON.stringify(podMetricsList())),
            [NODE_KEY]: () => ok(JSON.stringify(makeNodeItem())),
            [PODS_KEY]: () => ok(JSON.stringify({ items: [makeWebPod()] })),
        });

        const result = await getNodePerformance("test-ctx", "node-1");

        // The field selector restricts the pods to those scheduled on node-1, so only
        // the web pod is returned (node-2's pods never reach this call).
        expect(result.pods).toHaveLength(1);
        const web = result.pods[0]!;
        expect(web.name).toBe("web");
        expect(web.namespace).toBe("default");
        expect(web.node).toBe("node-1");

        // metricsAvailable is true and the node usage is the named node's sample,
        // parsed from nanocores/Ki: 850000000n -> 850m, 2097152Ki -> 2 GiB.
        expect(result.metricsAvailable).toBe(true);
        expect(result.node).toEqual({
            name: "node-1",
            usage: { cpuMillicores: 850, memoryBytes: 2097152 * 1024 },
            // requests = the web pod's summed requests (nginx 100m/128Mi + sidecar 50m/64Mi),
            // the only pod scheduled on node-1.
            requests: { cpuMillicores: 150, memoryBytes: 192 * 1024 ** 2 },
            allocatable: { cpuMillicores: 4000, memoryBytes: 8 * 1024 ** 3 },
        });

        // Per-container usage is retained and joined with the spec requests/limits.
        expect(web.containers).toEqual([
            {
                name: "nginx",
                usage: { cpuMillicores: 120, memoryBytes: 262144 * 1024 },
                requests: { cpuMillicores: 100, memoryBytes: 128 * 1024 ** 2 },
                limits: { cpuMillicores: 250, memoryBytes: 256 * 1024 ** 2 },
            },
            {
                name: "sidecar",
                usage: { cpuMillicores: 30, memoryBytes: 65536 * 1024 },
                requests: { cpuMillicores: 50, memoryBytes: 64 * 1024 ** 2 },
                limits: { cpuMillicores: 100, memoryBytes: 128 * 1024 ** 2 },
            },
        ]);

        // Pod-level fields are the sum across the two containers.
        expect(web.usage).toEqual({ cpuMillicores: 150, memoryBytes: (262144 + 65536) * 1024 });
        expect(web.requests).toEqual({ cpuMillicores: 150, memoryBytes: (128 + 64) * 1024 ** 2 });
        expect(web.limits).toEqual({ cpuMillicores: 350, memoryBytes: (256 + 128) * 1024 ** 2 });
    });

    test("uses a field selector scoped to the node when fetching pods", async () => {
        setRunnerHandlers({
            [NODE_METRICS_KEY]: () => ok(JSON.stringify(nodeMetricsList())),
            [POD_METRICS_KEY]: () => ok(JSON.stringify(podMetricsList())),
            [NODE_KEY]: () => ok(JSON.stringify(makeNodeItem())),
            [PODS_KEY]: () => ok(JSON.stringify({ items: [] })),
        });
        await getNodePerformance("test-ctx", "node-1");
        // setRunnerHandlers throws on any unmocked argv, so reaching here proves the
        // exact field-selector argv was used.
        expect(run).toHaveBeenCalledWith(
            "kubectl",
            ["--context", "test-ctx", "get", "pods", "-A", "--field-selector=spec.nodeName=node-1", "-o", "json"],
        );
    });

    test("degrades to metricsAvailable false with usage null but requests/limits populated", async () => {
        const unavailable = (): CommandResult => fail("error: the server could not find the requested resource (get nodes.metrics.k8s.io)");
        setRunnerHandlers({
            [NODE_METRICS_KEY]: unavailable,
            [POD_METRICS_KEY]: unavailable,
            [NODE_KEY]: () => ok(JSON.stringify(makeNodeItem())),
            [PODS_KEY]: () => ok(JSON.stringify({ items: [makeWebPod()] })),
        });

        const result = await getNodePerformance("test-ctx", "node-1");

        expect(result.metricsAvailable).toBe(false);
        // Node usage is null; allocatable still comes from node status.
        expect(result.node.usage).toEqual({ cpuMillicores: null, memoryBytes: null });
        expect(result.node.allocatable).toEqual({ cpuMillicores: 4000, memoryBytes: 8 * 1024 ** 3 });

        const web = result.pods[0]!;
        // Per-container and pod-level usage are null without metrics.
        expect(web.usage).toEqual({ cpuMillicores: null, memoryBytes: null });
        expect(web.containers[0]!.usage).toEqual({ cpuMillicores: null, memoryBytes: null });
        // Requests and limits remain populated from the pod spec.
        expect(web.containers[0]!.requests).toEqual({ cpuMillicores: 100, memoryBytes: 128 * 1024 ** 2 });
        expect(web.requests).toEqual({ cpuMillicores: 150, memoryBytes: (128 + 64) * 1024 ** 2 });
        expect(web.limits).toEqual({ cpuMillicores: 350, memoryBytes: (256 + 128) * 1024 ** 2 });
    });

    test("returns the fake-metrics scoped snapshot under KARSE_FAKE_METRICS=1", async () => {
        process.env.KARSE_FAKE_METRICS = "1";
        try {
            // The canned FAKE_METRICS node list keys node usage on "fake-node-1", so query
            // that node. Under fake metrics the two raw reads are not shelled out; only the
            // node object and the field-selected pods get run, so those are the only
            // handlers needed. The "web" pod matches the canned fake pod usage by name.
            const FAKE_NODE_KEY = "--context test-ctx get node fake-node-1 -o json";
            const FAKE_PODS_KEY = "--context test-ctx get pods -A --field-selector=spec.nodeName=fake-node-1 -o json";
            setRunnerHandlers({
                [FAKE_NODE_KEY]: () => ok(JSON.stringify({
                    metadata: { name: "fake-node-1" },
                    status: { allocatable: { cpu: "4", memory: "8Gi" } },
                })),
                [FAKE_PODS_KEY]: () => ok(JSON.stringify({
                    items: [{
                        ...makeWebPod(),
                        spec: { ...(makeWebPod() as any).spec, nodeName: "fake-node-1" },
                    }],
                })),
            });
            const result = await getNodePerformance("test-ctx", "fake-node-1");
            expect(result.metricsAvailable).toBe(true);
            // fake-node-1 is in the canned FAKE_METRICS node list (850m, 2 GiB).
            expect(result.node.usage).toEqual({ cpuMillicores: 850, memoryBytes: 2097152 * 1024 });
            // The web pod's containers match canned fake pod usage by name.
            const web = result.pods[0]!;
            expect(web.containers[0]!.usage).toEqual({ cpuMillicores: 120, memoryBytes: 262144 * 1024 });
        }
        finally {
            delete process.env.KARSE_FAKE_METRICS;
        }
    });

    test("throws when the node read itself fails", async () => {
        setRunnerHandlers({
            [NODE_METRICS_KEY]: () => ok(JSON.stringify(nodeMetricsList())),
            [POD_METRICS_KEY]: () => ok(JSON.stringify(podMetricsList())),
            [NODE_KEY]: () => fail("Error from server (NotFound): nodes \"node-1\" not found"),
            [PODS_KEY]: () => ok(JSON.stringify({ items: [] })),
        });
        await expect(getNodePerformance("test-ctx", "node-1")).rejects.toThrow("not found");
    });
});

describe("getPodPerformance", () => {
    afterEach(() => {
        delete process.env.KARSE_FAKE_METRICS;
    });

    const METRICS_KEY =
        "--context ctx get --raw /apis/metrics.k8s.io/v1beta1/namespaces/default/pods/web";
    const POD_KEY = "--context ctx -n default get pod web -o json";
    // The pod's scheduling node is read for its allocatable (and usage from the node
    // metrics list) so the pod's percentage-of-node can be computed.
    const NODE_KEY = "--context ctx get node node-1 -o json";
    const NODE_METRICS_KEY = "--context ctx get --raw /apis/metrics.k8s.io/v1beta1/nodes";

    // The scheduling node object, carrying a 4-core / 8Gi allocatable in status.
    const NODE_OBJECT = {
        metadata: { name: "node-1" },
        status: { allocatable: { cpu: "4", memory: "8Gi" } },
    };

    // The node metrics list (all nodes), with node-1's live usage.
    const NODE_METRICS = {
        kind: "NodeMetricsList",
        items: [
            {
                metadata: { name: "node-1" },
                usage: { cpu: "1000000000n", memory: "2147483648" },
            },
        ],
    };

    // A pod with two containers, each declaring requests and limits in its spec.
    const POD_SPEC = {
        metadata: {
            name: "web",
            namespace: "default",
        },
        spec: {
            nodeName: "node-1",
            containers: [
                {
                    name: "nginx",
                    resources: {
                        requests: {
                            cpu: "100m",
                            memory: "128Mi",
                        },
                        limits: {
                            cpu: "500m",
                            memory: "256Mi",
                        },
                    },
                },
                {
                    name: "sidecar",
                    resources: {
                        requests: {
                            cpu: "50m",
                            memory: "64Mi",
                        },
                        limits: {
                            cpu: "200m",
                            memory: "128Mi",
                        },
                    },
                },
            ],
        },
    };

    // The single-pod metrics endpoint returns one PodMetrics with a containers[]
    // array of per-container usage (CPU nanocores, memory Ki, as the real API does).
    const POD_METRICS = {
        metadata: {
            name: "web",
            namespace: "default",
        },
        containers: [
            {
                name: "nginx",
                usage: {
                    cpu: "120000000n",
                    memory: "262144Ki",
                },
            },
            {
                name: "sidecar",
                usage: {
                    cpu: "30000000n",
                    memory: "65536Ki",
                },
            },
        ],
    };

    test("joins per-container usage with the container's requests and limits", async () => {
        setRunnerHandlers({
            [METRICS_KEY]: () => ok(JSON.stringify(POD_METRICS)),
            [POD_KEY]: () => ok(JSON.stringify(POD_SPEC)),
            [NODE_KEY]: () => ok(JSON.stringify(NODE_OBJECT)),
            [NODE_METRICS_KEY]: () => ok(JSON.stringify(NODE_METRICS)),
        });

        const result = await getPodPerformance("ctx", "default", "web");

        expect(result.metricsAvailable).toBe(true);
        expect(result.pod.name).toBe("web");
        expect(result.pod.namespace).toBe("default");
        expect(result.pod.node).toBe("node-1");

        // The scheduling node is read for its allocatable (4 cores / 8Gi) and live usage
        // (1 core / 2Gi), so the UI can compute the pod's percentage of the node.
        expect(result.node).toEqual({
            name: "node-1",
            usage: { cpuMillicores: 1000, memoryBytes: 2 * 1024 ** 3 },
            // The scheduling-node helper reads only allocatable and usage, not the node's
            // pods, so its requests stay null (the pod page does not need the node's requests).
            requests: { cpuMillicores: null, memoryBytes: null },
            allocatable: { cpuMillicores: 4000, memoryBytes: 8 * 1024 ** 3 },
        });

        // Per-container join: usage from metrics (120000000n -> 120m, 262144Ki -> 256Mi
        // bytes), requests/limits from spec.
        expect(result.containers).toEqual([
            {
                name: "nginx",
                usage: { cpuMillicores: 120, memoryBytes: 262144 * 1024 },
                requests: { cpuMillicores: 100, memoryBytes: 128 * 1024 ** 2 },
                limits: { cpuMillicores: 500, memoryBytes: 256 * 1024 ** 2 },
            },
            {
                name: "sidecar",
                usage: { cpuMillicores: 30, memoryBytes: 65536 * 1024 },
                requests: { cpuMillicores: 50, memoryBytes: 64 * 1024 ** 2 },
                limits: { cpuMillicores: 200, memoryBytes: 128 * 1024 ** 2 },
            },
        ]);
        // pod.containers carries the same per-container join.
        expect(result.pod.containers).toEqual(result.containers);

        // Pod totals sum the per-container values.
        expect(result.pod.usage).toEqual({
            cpuMillicores: 150,
            memoryBytes: (262144 + 65536) * 1024,
        });
        expect(result.pod.requests).toEqual({
            cpuMillicores: 150,
            memoryBytes: (128 + 64) * 1024 ** 2,
        });
        expect(result.pod.limits).toEqual({
            cpuMillicores: 700,
            memoryBytes: (256 + 128) * 1024 ** 2,
        });
    });

    test("degrades to metricsAvailable:false with null usage but populated requests/limits", async () => {
        setRunnerHandlers({
            // Metrics API absent: kubectl get --raw fails naming metrics.k8s.io.
            [METRICS_KEY]: () =>
                fail('error: the server could not find the requested resource (get pods.metrics.k8s.io web)'),
            [POD_KEY]: () => ok(JSON.stringify(POD_SPEC)),
            [NODE_KEY]: () => ok(JSON.stringify(NODE_OBJECT)),
            [NODE_METRICS_KEY]: () =>
                fail('error: the server could not find the requested resource (get nodes.metrics.k8s.io)'),
        });

        const result = await getPodPerformance("ctx", "default", "web");

        expect(result.metricsAvailable).toBe(false);
        // Usage is null per container and at the pod level, but requests/limits remain.
        for (const c of result.containers) {
            expect(c.usage).toEqual({ cpuMillicores: null, memoryBytes: null });
        }
        expect(result.pod.usage).toEqual({ cpuMillicores: null, memoryBytes: null });
        // The node's allocatable (the percentage denominator) still comes from node
        // status, but its usage is null because the Metrics API is unavailable.
        expect(result.node).toEqual({
            name: "node-1",
            usage: { cpuMillicores: null, memoryBytes: null },
            // The scheduling-node helper reads only allocatable and usage, not the node's
            // pods, so its requests stay null (the pod page does not need the node's requests).
            requests: { cpuMillicores: null, memoryBytes: null },
            allocatable: { cpuMillicores: 4000, memoryBytes: 8 * 1024 ** 3 },
        });
        expect(result.pod.requests).toEqual({
            cpuMillicores: 150,
            memoryBytes: (128 + 64) * 1024 ** 2,
        });
        expect(result.containers[0]!.requests).toEqual({
            cpuMillicores: 100,
            memoryBytes: 128 * 1024 ** 2,
        });
    });

    test("treats a container with no resources block as zero requests/limits", async () => {
        const podNoResources = {
            metadata: { name: "web", namespace: "default" },
            spec: {
                nodeName: "node-1",
                containers: [{ name: "nginx" }],
            },
        };
        setRunnerHandlers({
            [METRICS_KEY]: () =>
                ok(JSON.stringify({
                    metadata: { name: "web", namespace: "default" },
                    containers: [{ name: "nginx", usage: { cpu: "0", memory: "0" } }],
                })),
            [POD_KEY]: () => ok(JSON.stringify(podNoResources)),
            [NODE_KEY]: () => ok(JSON.stringify(NODE_OBJECT)),
            [NODE_METRICS_KEY]: () => ok(JSON.stringify(NODE_METRICS)),
        });

        const result = await getPodPerformance("ctx", "default", "web");

        expect(result.containers).toEqual([
            {
                name: "nginx",
                usage: { cpuMillicores: 0, memoryBytes: 0 },
                requests: { cpuMillicores: 0, memoryBytes: 0 },
                limits: { cpuMillicores: 0, memoryBytes: 0 },
            },
        ]);
    });

    test("uses the canned fake metrics under KARSE_FAKE_METRICS without shelling out for metrics", async () => {
        process.env.KARSE_FAKE_METRICS = "1";
        // Only the pod spec and the scheduling-node object are fetched via kubectl; the
        // metrics fetches (pod and node) are canned by the fake-metrics mode.
        setRunnerHandlers({
            [POD_KEY]: () => ok(JSON.stringify(POD_SPEC)),
            [NODE_KEY]: () => ok(JSON.stringify(NODE_OBJECT)),
        });

        const result = await getPodPerformance("ctx", "default", "web");

        expect(result.metricsAvailable).toBe(true);
        // The fake pod-metrics payload has a "web" pod whose CPU usages are in the
        // microcore ("u") form the Metrics API can return: nginx "120000u" (120m) and
        // sidecar "398u" (0m after flooring 398/1000). The summed pod usage is 120m,
        // which also proves the microcore parse path runs without throwing.
        expect(result.pod.usage.cpuMillicores).toBe(120);
        expect(result.containers.map((c) => c.name)).toEqual(["nginx", "sidecar"]);
    });

    test("throws when the pod spec fetch fails", async () => {
        setRunnerHandlers({
            [METRICS_KEY]: () => ok(JSON.stringify(POD_METRICS)),
            [POD_KEY]: () => fail("Error from server (NotFound): pods \"web\" not found"),
        });
        await expect(getPodPerformance("ctx", "default", "web")).rejects.toThrow("not found");
    });

    test("returns node:null for an unscheduled pod (no spec.nodeName), without reading any node", async () => {
        const unscheduled = {
            metadata: { name: "web", namespace: "default" },
            spec: { containers: [{ name: "nginx" }] },
        };
        // No NODE_KEY / NODE_METRICS_KEY handlers: an unscheduled pod must not trigger a
        // node read at all (an unmocked call would throw).
        setRunnerHandlers({
            [METRICS_KEY]: () =>
                ok(JSON.stringify({
                    metadata: { name: "web", namespace: "default" },
                    containers: [{ name: "nginx", usage: { cpu: "0", memory: "0" } }],
                })),
            [POD_KEY]: () => ok(JSON.stringify(unscheduled)),
        });

        const result = await getPodPerformance("ctx", "default", "web");

        expect(result.pod.node).toBe("");
        expect(result.node).toBeNull();
    });

    test("degrades to node:null when the scheduling node read fails", async () => {
        setRunnerHandlers({
            [METRICS_KEY]: () => ok(JSON.stringify(POD_METRICS)),
            [POD_KEY]: () => ok(JSON.stringify(POD_SPEC)),
            // The node object cannot be read (e.g. deleted or RBAC); the pod-performance
            // request still succeeds, it just has no percentage-of-node denominator.
            [NODE_KEY]: () => fail('Error from server (NotFound): nodes "node-1" not found'),
            [NODE_METRICS_KEY]: () => ok(JSON.stringify(NODE_METRICS)),
        });

        const result = await getPodPerformance("ctx", "default", "web");

        expect(result.metricsAvailable).toBe(true);
        expect(result.node).toBeNull();
    });
});
