jest.mock("../../command-runner");
jest.mock("../../audit-log");
jest.mock("../../kubectl/cache");

import type { CommandResult } from "../../command-runner";
import type { ClusterSummary } from "karse-types";
import {
    getClusterSummary,
    aggregateClusters,
    streamMultiClusterOverview,
} from "../../kubectl/multi-cluster";

// jest.requireMock returns any, so mock methods are accessible without casting.
const { run } = jest.requireMock("../../command-runner");

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

// The `kubectl config view -o json` payload listing the given context names, each with
// a cluster named "<name>-cluster", matching the fields listContexts reads.
function contextsPayload(names: string[]): string {
    return JSON.stringify({
        contexts: names.map((name) => ({
            name,
            context: {
                cluster: `${name}-cluster`,
                user: `${name}-user`,
            },
        })),
    });
}

// A node list with `count` nodes, each allocatable `cpu` and `memory`. These are the
// structurally significant fields getClusterPerformance reads from `get nodes -o json`.
function nodesPayload(count: number, cpu: string, memory: string): string {
    const items = [];
    for (let i = 0; i < count; i += 1) {
        items.push({
            metadata: {
                name: `node-${i}`,
            },
            status: {
                allocatable: {
                    cpu,
                    memory,
                },
                conditions: [
                    {
                        type: "Ready",
                        status: "True",
                    },
                ],
            },
        });
    }
    return JSON.stringify({ items });
}

// A pod list with one pod per node, each requesting `cpu` / `memory` on node-<i>.
function podsPayload(count: number, cpu: string, memory: string): string {
    const items = [];
    for (let i = 0; i < count; i += 1) {
        items.push({
            metadata: {
                name: `pod-${i}`,
                namespace: "default",
            },
            spec: {
                nodeName: `node-${i}`,
                containers: [
                    {
                        name: "app",
                        resources: {
                            requests: {
                                cpu,
                                memory,
                            },
                            limits: {
                                cpu,
                                memory,
                            },
                        },
                    },
                ],
            },
            status: {
                phase: "Running",
            },
        });
    }
    return JSON.stringify({ items });
}

// A NodeMetricsList giving every node-<i> (of `count`) the same usage reading.
function nodeMetricsPayload(count: number, cpu: string, memory: string): string {
    const items = [];
    for (let i = 0; i < count; i += 1) {
        items.push({
            metadata: {
                name: `node-${i}`,
            },
            usage: {
                cpu,
                memory,
            },
        });
    }
    return JSON.stringify({ items });
}

// An empty PodMetricsList. Pod-level usage does not feed the cluster totals (those sum
// the node readings), so the tests keep it empty.
const EMPTY_POD_METRICS = JSON.stringify({ items: [] });

// Routes a fake kubectl argv to the payload it should answer with, per context. The
// adapter issues `config view`, two `get --raw` metrics reads, `get nodes`, and
// `get pods -A`; anything else is an unexpected call and fails the test.
function fakeRun(clusters: Record<string, { nodes: number; cpu: string; memory: string; usageCpu: string; usageMemory: string; requestCpu: string; requestMemory: string } | "unreachable">) {
    return async (_cmd: string, args: readonly string[]): Promise<CommandResult> => {
        if (args[0] === "config" && args[1] === "view") {
            return ok(contextsPayload(Object.keys(clusters)));
        }
        if (args[0] !== "--context") {
            throw new Error(`Unexpected kubectl argv: ${args.join(" ")}`);
        }
        const context = args[1]!;
        const cluster = clusters[context];
        if (cluster === undefined) {
            throw new Error(`Unexpected context: ${context}`);
        }
        if (cluster === "unreachable") {
            return fail("Unable to connect to the server: dial tcp 10.0.0.1:6443: i/o timeout");
        }
        const rest = args.slice(2);
        if (rest[0] === "get" && rest[1] === "--raw" && String(rest[2]).includes("/nodes")) {
            return ok(nodeMetricsPayload(cluster.nodes, cluster.usageCpu, cluster.usageMemory));
        }
        if (rest[0] === "get" && rest[1] === "--raw") {
            return ok(EMPTY_POD_METRICS);
        }
        if (rest[0] === "get" && rest[1] === "nodes") {
            return ok(nodesPayload(cluster.nodes, cluster.cpu, cluster.memory));
        }
        if (rest[0] === "get" && rest[1] === "pods") {
            return ok(podsPayload(cluster.nodes, cluster.requestCpu, cluster.requestMemory));
        }
        throw new Error(`Unexpected kubectl argv: ${args.join(" ")}`);
    };
}

// Two healthy clusters of different sizes, so the aggregation is exercised over
// unequal weights rather than a symmetric pair.
const TWO_CLUSTERS = {
    "ctx-big": {
        nodes: 3,
        cpu: "4",
        memory: "8Gi",
        usageCpu: "1",
        usageMemory: "2Gi",
        requestCpu: "500m",
        requestMemory: "1Gi",
    },
    "ctx-small": {
        nodes: 1,
        cpu: "2",
        memory: "4Gi",
        usageCpu: "200m",
        usageMemory: "512Mi",
        requestCpu: "100m",
        requestMemory: "256Mi",
    },
};

beforeEach(() => {
    run.mockReset();
});

describe("streamMultiClusterOverview", () => {
    test("sums node counts and utilisation across every context", async () => {
        run.mockImplementation(fakeRun(TWO_CLUSTERS));

        const seen: ClusterSummary[] = [];
        const totals = await streamMultiClusterOverview((summary) => seen.push(summary));

        const big = seen.find((s) => s.context === "ctx-big")!;
        const small = seen.find((s) => s.context === "ctx-small")!;

        // Each context reports its own figures: 3 nodes of 4 cores / 8Gi, and 1 of 2 / 4Gi.
        expect(big.nodeCount).toBe(3);
        expect(big.cluster).toBe("ctx-big-cluster");
        expect(big.totals.allocatable.cpuMillicores).toBe(12000);
        expect(big.totals.allocatable.memoryBytes).toBe(3 * 8 * 1024 * 1024 * 1024);
        expect(big.totals.usage.cpuMillicores).toBe(3000);
        expect(big.totals.requests.cpuMillicores).toBe(1500);
        expect(small.nodeCount).toBe(1);
        expect(small.totals.allocatable.cpuMillicores).toBe(2000);
        expect(small.totals.usage.cpuMillicores).toBe(200);
        expect(small.totals.requests.cpuMillicores).toBe(100);

        // The totals are exactly the sum of the per-context values fed in.
        expect(totals.contextCount).toBe(2);
        expect(totals.coveredCount).toBe(2);
        expect(totals.failedCount).toBe(0);
        expect(totals.nodeCount).toBe(4);
        expect(totals.metricsAvailable).toBe(true);
        expect(totals.totals.allocatable.cpuMillicores).toBe(14000);
        expect(totals.totals.allocatable.memoryBytes).toBe(
            big.totals.allocatable.memoryBytes! + small.totals.allocatable.memoryBytes!,
        );
        expect(totals.totals.usage.cpuMillicores).toBe(3200);
        expect(totals.totals.usage.memoryBytes).toBe(
            big.totals.usage.memoryBytes! + small.totals.usage.memoryBytes!,
        );
        expect(totals.totals.requests.cpuMillicores).toBe(1600);
    });

    test("returns a failing context as an error entry while the others still report", async () => {
        run.mockImplementation(fakeRun({
            "ctx-big": TWO_CLUSTERS["ctx-big"],
            "ctx-dead": "unreachable",
        }));

        const seen: ClusterSummary[] = [];
        const totals = await streamMultiClusterOverview((summary) => seen.push(summary));

        const dead = seen.find((s) => s.context === "ctx-dead")!;
        expect(dead.error).toContain("Unable to connect to the server");
        expect(dead.nodeCount).toBeNull();
        expect(dead.totals.allocatable.cpuMillicores).toBeNull();

        const big = seen.find((s) => s.context === "ctx-big")!;
        expect(big.error).toBeNull();
        expect(big.nodeCount).toBe(3);

        // Coverage reflects that only one of the two contexts is in the totals.
        expect(totals.contextCount).toBe(2);
        expect(totals.coveredCount).toBe(1);
        expect(totals.failedCount).toBe(1);
        expect(totals.nodeCount).toBe(3);
        expect(totals.totals.allocatable.cpuMillicores).toBe(12000);
    });

    test("issues only read-only kubectl subcommands", async () => {
        run.mockImplementation(fakeRun(TWO_CLUSTERS));

        await streamMultiClusterOverview(() => undefined);

        const argvs: string[][] = run.mock.calls.map((call: any[]) => call[1] as string[]);
        expect(argvs.length).toBeGreaterThan(0);
        for (const args of argvs) {
            const subcommand = args[0] === "--context" ? args[2] : args[0];
            expect(["get", "config"]).toContain(subcommand);
            if (subcommand === "config") {
                expect(args[1]).toBe("view");
            }
        }
        expect(run.mock.calls.every((call: any[]) => call[0] === "kubectl")).toBe(true);
    });

    test("a kubeconfig with no contexts returns an empty result rather than throwing", async () => {
        run.mockImplementation(async (_cmd: string, args: readonly string[]) => {
            if (args[0] === "config" && args[1] === "view") {
                return ok(JSON.stringify({ contexts: [] }));
            }
            throw new Error(`Unexpected kubectl argv: ${args.join(" ")}`);
        });

        const seen: ClusterSummary[] = [];
        const totals = await streamMultiClusterOverview((summary) => seen.push(summary));

        expect(seen).toEqual([]);
        expect(totals.contextCount).toBe(0);
        expect(totals.coveredCount).toBe(0);
        expect(totals.nodeCount).toBe(0);
        expect(totals.metricsAvailable).toBe(false);
        expect(totals.totals.allocatable.cpuMillicores).toBe(0);
    });
});

describe("getClusterSummary", () => {
    test("names the reason a context could not be read", async () => {
        run.mockImplementation(fakeRun({ "ctx-dead": "unreachable" }));

        const summary = await getClusterSummary("ctx-dead", "dead-cluster");

        expect(summary.context).toBe("ctx-dead");
        expect(summary.cluster).toBe("dead-cluster");
        expect(summary.error).toContain("i/o timeout");
        expect(summary.metricsAvailable).toBe(false);
        expect(summary.totals.usage.memoryBytes).toBeNull();
    });
});

describe("aggregateClusters", () => {
    // A healthy summary with the given node count and absolute figures.
    function summary(context: string, nodeCount: number, cpu: number, allocCpu: number): ClusterSummary {
        return {
            context,
            cluster: `${context}-cluster`,
            error: null,
            nodeCount,
            metricsAvailable: true,
            totals: {
                usage: {
                    cpuMillicores: cpu,
                    memoryBytes: cpu * 1000,
                },
                requests: {
                    cpuMillicores: cpu,
                    memoryBytes: cpu * 1000,
                },
                allocatable: {
                    cpuMillicores: allocCpu,
                    memoryBytes: allocCpu * 1000,
                },
            },
        };
    }

    test("derives the aggregate from summed absolutes, not an average of percentages", () => {
        // 90% of a 100-core cluster plus 10% of a 1-core cluster. The average of the two
        // percentages is 50%; the capacity-weighted figure is 90100/101000 ≈ 89.2%.
        const totals = aggregateClusters([
            summary("ctx-big", 100, 90000, 100000),
            summary("ctx-tiny", 1, 100, 1000),
        ]);

        expect(totals.totals.usage.cpuMillicores).toBe(90100);
        expect(totals.totals.allocatable.cpuMillicores).toBe(101000);
        expect(totals.nodeCount).toBe(101);
    });

    test("an unknown usage reading makes the aggregate usage unknown, not smaller", () => {
        const withMetrics = summary("ctx-a", 1, 500, 1000);
        const withoutMetrics: ClusterSummary = {
            ...summary("ctx-b", 1, 0, 1000),
            metricsAvailable: false,
            totals: {
                usage: {
                    cpuMillicores: null,
                    memoryBytes: null,
                },
                requests: {
                    cpuMillicores: 100,
                    memoryBytes: 100,
                },
                allocatable: {
                    cpuMillicores: 1000,
                    memoryBytes: 1000,
                },
            },
        };

        const totals = aggregateClusters([withMetrics, withoutMetrics]);

        expect(totals.totals.usage.cpuMillicores).toBeNull();
        expect(totals.totals.requests.cpuMillicores).toBe(600);
        expect(totals.totals.allocatable.cpuMillicores).toBe(2000);
        expect(totals.metricsAvailable).toBe(false);
    });
});
