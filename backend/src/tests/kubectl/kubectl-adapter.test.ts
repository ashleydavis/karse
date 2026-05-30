jest.mock("../../command-runner");
jest.mock("../../audit-log");

import type { CommandResult } from "../../command-runner";
import {
    listContexts,
    getCurrentContext,
    setCurrentContext,
    listNodes,
    getClusterOverview,
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
        expect(audit).toHaveBeenCalledWith("../logs", "kubectl", ["config", "view", "-o", "json"]);
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
            "get nodes -o json": () => ok(JSON.stringify(fixture)),
        });
        const result = await listNodes();
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
            "get nodes -o json": () => ok(JSON.stringify(fixture)),
        });
        const result = await listNodes();
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
            "get nodes -o json": () => ok(JSON.stringify(fixture)),
        });
        const result = await listNodes();
        expect(result[0]!.status).toBe("Unknown");
    });

    test("returns [] when items is empty", async () => {
        setRunnerHandlers({
            "get nodes -o json": () => ok(JSON.stringify({
                items: [],
            })),
        });
        const result = await listNodes();
        expect(result.length).toBe(0);
    });

    test("throws on non-zero exit", async () => {
        setRunnerHandlers({
            "get nodes -o json": () => fail("denied"),
        });
        await expect(listNodes()).rejects.toThrow("denied");
    });
});

describe("getClusterOverview", () => {
    const VERSION_KEY = "version -o json";
    const NODES_KEY = "get nodes -o json";
    const NS_KEY = "get namespaces -o json";
    const PODS_KEY = "get pods -A -o json";

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
        const result = await getClusterOverview();
        expect(result).toEqual({
            serverVersion: "v1.30.0",
            nodeCount: 3,
            namespaceCount: 4,
            podCount: 15,
        });
    });

    test("returns serverVersion: null when version call non-zero", async () => {
        setRunnerHandlers({
            ...happyHandlers(),
            [VERSION_KEY]: () => fail("unreachable"),
        });
        const result = await getClusterOverview();
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
        const result = await getClusterOverview();
        expect(result.serverVersion).toBe(null);
        expect(result.nodeCount).toBe(3);
    });

    test("throws when nodes call fails (non-zero exit)", async () => {
        setRunnerHandlers({
            ...happyHandlers(),
            [NODES_KEY]: () => fail("denied"),
        });
        await expect(getClusterOverview()).rejects.toThrow("denied");
    });

    test("throws when namespaces call fails", async () => {
        setRunnerHandlers({
            ...happyHandlers(),
            [NS_KEY]: () => fail("denied"),
        });
        await expect(getClusterOverview()).rejects.toThrow("denied");
    });

    test("throws when pods call fails", async () => {
        setRunnerHandlers({
            ...happyHandlers(),
            [PODS_KEY]: () => fail("denied"),
        });
        await expect(getClusterOverview()).rejects.toThrow("denied");
    });

    test("rejects when a count call rejects (not just non-zero exit)", async () => {
        setRunnerHandlers({
            ...happyHandlers(),
            [NODES_KEY]: () => Promise.reject(new Error("spawn kubectl ENOENT")),
        });
        await expect(getClusterOverview()).rejects.toThrow("spawn kubectl ENOENT");
    });

    test("tolerates the version call rejecting", async () => {
        setRunnerHandlers({
            ...happyHandlers(),
            [VERSION_KEY]: () => Promise.reject(new Error("ENOENT")),
        });
        const result = await getClusterOverview();
        expect(result.serverVersion).toBe(null);
        expect(result.nodeCount).toBe(3);
        expect(result.namespaceCount).toBe(4);
        expect(result.podCount).toBe(15);
    });
});
