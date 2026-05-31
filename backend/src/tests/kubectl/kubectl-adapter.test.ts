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
    getClusterOverview,
    listPods,
    listEvents,
    getPodLogs,
} from "../../kubectl/kubectl-adapter";

// jest.requireMock returns any, so mock methods are accessible without casting.
const { run } = jest.requireMock("../../command-runner");
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
        });
        expect(result[1]!).toEqual({
            name: "worker-0",
            status: "NotReady",
            roles: [],
            version: "v1.30.0",
            createdAt: "2024-06-01T00:00:00Z",
        });
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

describe("getClusterOverview", () => {
    const VERSION_KEY = "--context test-ctx version -o json";
    const NODES_KEY = "--context test-ctx get nodes -o json";
    const NS_KEY = "--context test-ctx get namespaces -o json";
    const PODS_KEY = "--context test-ctx get pods -A -o json";

    // Returns a kubectl JSON response body with n empty item objects.
    function makeItems(n: number): object {
        return {
            items: new Array(n).fill({}),
        };
    }

    // Returns a full set of happy-path handlers for all four overview calls.
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
        });
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
        containerStatuses?: any[];
        initContainerStatuses?: any[];
        nodeName?: string;
        creationTimestamp?: string;
    } = {}): object {
        return {
            metadata: {
                name: overrides.name ?? "my-pod",
                namespace: overrides.namespace ?? "default",
                creationTimestamp: overrides.creationTimestamp ?? "2024-06-01T00:00:00Z",
            },
            spec: {
                nodeName: overrides.nodeName ?? "node-1",
            },
            status: {
                phase: overrides.phase ?? "Running",
                containerStatuses: overrides.containerStatuses ?? [
                    {
                        ready: true,
                        restartCount: 0,
                    },
                ],
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
            restarts: 3,
            node: "node-worker",
            createdAt: "2024-01-15T12:00:00Z",
        });
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
    test("parses a fixture with two namespaces", async () => {
        const fixture = {
            items: [
                {
                    metadata: {
                        name: "default",
                    },
                },
                {
                    metadata: {
                        name: "kube-system",
                    },
                },
            ],
        };
        setRunnerHandlers({
            "--context test-ctx get namespaces -o json": () => ok(JSON.stringify(fixture)),
        });
        const result = await listNamespaces("test-ctx");
        expect(result.length).toBe(2);
        expect(result[0]!).toEqual({
            name: "default",
        });
        expect(result[1]!).toEqual({
            name: "kube-system",
        });
    });

    test("returns [] when items is empty", async () => {
        setRunnerHandlers({
            "--context test-ctx get namespaces -o json": () => ok(JSON.stringify({
                items: [],
            })),
        });
        const result = await listNamespaces("test-ctx");
        expect(result.length).toBe(0);
    });

    test("throws on non-zero exit", async () => {
        setRunnerHandlers({
            "--context test-ctx get namespaces -o json": () => fail("denied"),
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
