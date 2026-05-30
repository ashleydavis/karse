import { run, type CommandResult } from "../command-runner";
import { audit, formatLocalISO } from "../audit-log";
import type { Context, NodeStatus, Node, ClusterOverview, Namespace, Pod, PodPhase } from "karse-types";

// Base directory for the rolling audit log; overridable via KARSE_LOGS_DIR.
const LOGS_DIR = process.env.KARSE_LOGS_DIR ?? "../logs";

// Writes an audit entry, prints to stdout, then shells out to kubectl.
async function kubectl(args: readonly string[]): Promise<CommandResult> {
    const now = new Date();
    await audit(LOGS_DIR, "kubectl", args, now);
    console.log(formatLocalISO(now) + " kubectl " + args.join(" "));
    return run("kubectl", args);
}

// Returns every context defined in the active kubeconfig.
export async function listContexts(): Promise<Context[]> {
    const result = await kubectl(["config", "view", "-o", "json"]);
    if (result.exitCode !== 0) {
        throw new Error(result.stderr);
    }
    const data = JSON.parse(result.stdout);
    const rawContexts: any[] = data.contexts ?? [];
    return rawContexts.map((item: any) => ({
        name: item.name,
        cluster: item.context.cluster,
        user: item.context.user,
        namespace: item.context.namespace || null,
    }));
}

// Returns the name of the currently active context, or null if none is set.
export async function getCurrentContext(): Promise<string | null> {
    const result = await kubectl(["config", "current-context"]);
    if (result.exitCode !== 0) {
        if (result.stderr.includes("current-context is not set")) {
            return null;
        }
        throw new Error(result.stderr);
    }
    return result.stdout.trim();
}

// Switches the active kubeconfig context to the given name.
// Validation of the name (non-empty, no leading dash) is done at the route layer.
export async function setCurrentContext(name: string): Promise<void> {
    const result = await kubectl(["config", "use-context", name]);
    if (result.exitCode !== 0) {
        throw new Error(result.stderr);
    }
}

// Returns every namespace in the cluster for the given context.
export async function listNamespaces(context: string): Promise<Namespace[]> {
    const result = await kubectl(["--context", context, "get", "namespaces", "-o", "json"]);
    if (result.exitCode !== 0) {
        throw new Error(result.stderr);
    }
    const data = JSON.parse(result.stdout);
    return (data.items as any[]).map((item) => ({
        name: item.metadata.name,
    }));
}

// Sets the default namespace for the given context in the local kubeconfig.
// This mutates only the local kubeconfig file, not the cluster.
export async function setContextNamespace(context: string, namespace: string): Promise<void> {
    const args = namespace.trim() === ""
        ? ["config", "unset", `contexts.${context}.namespace`]
        : ["config", "set-context", context, `--namespace=${namespace}`];
    const result = await kubectl(args);
    if (result.exitCode !== 0) {
        throw new Error(result.stderr);
    }
}

// Returns the list of nodes for the given context.
export async function listNodes(context: string): Promise<Node[]> {
    const ctxArgs = ["--context", context];
    const result = await kubectl([...ctxArgs, "get", "nodes", "-o", "json"]);
    if (result.exitCode !== 0) {
        throw new Error(result.stderr);
    }
    const data = JSON.parse(result.stdout);
    const rolePattern = /^node-role\.kubernetes\.io\/(.+)$/;
    return data.items.map((item: any) => {
        let status: NodeStatus = "Unknown";
        for (const condition of item.status.conditions) {
            if (condition.type === "Ready") {
                if (condition.status === "True") {
                    status = "Ready";
                }
                else if (condition.status === "False") {
                    status = "NotReady";
                }
                break;
            }
        }
        const roles: string[] = [];
        for (const key of Object.keys(item.metadata.labels ?? {})) {
            const match = rolePattern.exec(key);
            if (match !== null) {
                roles.push(match[1]!);
            }
        }
        roles.sort();
        return {
            name: item.metadata.name,
            status,
            roles,
            version: item.status.nodeInfo.kubeletVersion,
            createdAt: item.metadata.creationTimestamp,
        };
    });
}

// Returns pods for the given context, optionally scoped to a namespace.
// Pass namespace=undefined (or omit) to fetch all pods across all namespaces.
export async function listPods(context: string, namespace?: string): Promise<Pod[]> {
    const nsArgs = namespace ? ["-n", namespace] : ["-A"];
    const result = await kubectl(["--context", context, "get", "pods", ...nsArgs, "-o", "json"]);
    if (result.exitCode !== 0) {
        throw new Error(result.stderr);
    }
    const data = JSON.parse(result.stdout);
    return (data.items as any[]).map((item) => {
        const phase: PodPhase = (item.status?.phase as PodPhase) ?? "Unknown";
        const containerStatuses: any[] = item.status?.containerStatuses ?? [];
        const initStatuses: any[] = item.status?.initContainerStatuses ?? [];
        const allStatuses = [...containerStatuses, ...initStatuses];
        const readyCount = containerStatuses.filter((cs) => cs.ready === true).length;
        const totalCount = containerStatuses.length;
        const restarts = allStatuses.reduce((sum, cs) => sum + (cs.restartCount ?? 0), 0);
        return {
            name: item.metadata.name,
            namespace: item.metadata.namespace,
            phase,
            ready: `${readyCount}/${totalCount}`,
            restarts,
            createdAt: item.metadata.creationTimestamp,
            node: item.spec?.nodeName ?? "",
        };
    });
}

// Returns aggregate cluster statistics (version + node/namespace/pod counts).
// Runs four kubectl calls in parallel. The version branch tolerates failures
// (returns null); the three count branches re-throw on any failure.
export async function getClusterOverview(context: string): Promise<ClusterOverview> {
    const ctxArgs = ["--context", context];
    const results = await Promise.allSettled([
        kubectl([...ctxArgs, "version", "-o", "json"]),
        kubectl([...ctxArgs, "get", "nodes", "-o", "json"]),
        kubectl([...ctxArgs, "get", "namespaces", "-o", "json"]),
        kubectl([...ctxArgs, "get", "pods", "-A", "-o", "json"]),
    ]);
    const versionResult = results[0]!;
    const nodesResult = results[1]!;
    const nsResult = results[2]!;
    const podsResult = results[3]!;

    let serverVersion: string | null = null;
    let clientVersion: string | null = null;
    if (versionResult.status === "fulfilled" && versionResult.value.exitCode === 0) {
        const data = JSON.parse(versionResult.value.stdout);
        serverVersion = data.serverVersion?.gitVersion ?? null;
        clientVersion = data.clientVersion?.gitVersion ?? null;
    }

    if (nodesResult.status === "rejected") {
        throw nodesResult.reason;
    }
    if (nodesResult.value.exitCode !== 0) {
        throw new Error(nodesResult.value.stderr);
    }
    const nodeItems: any[] = JSON.parse(nodesResult.value.stdout).items;
    const nodeCount = nodeItems.length;
    const readyNodeCount = nodeItems.filter((item: any) =>
        item.status?.conditions?.some((c: any) => c.type === "Ready" && c.status === "True")
    ).length;

    if (nsResult.status === "rejected") {
        throw nsResult.reason;
    }
    if (nsResult.value.exitCode !== 0) {
        throw new Error(nsResult.value.stderr);
    }
    const namespaceCount: number = JSON.parse(nsResult.value.stdout).items.length;

    if (podsResult.status === "rejected") {
        throw podsResult.reason;
    }
    if (podsResult.value.exitCode !== 0) {
        throw new Error(podsResult.value.stderr);
    }
    const podItems: any[] = JSON.parse(podsResult.value.stdout).items;
    const podCount = podItems.length;
    const runningPodCount = podItems.filter((p: any) => p.status?.phase === "Running").length;
    const pendingPodCount = podItems.filter((p: any) => p.status?.phase === "Pending").length;
    const failedPodCount  = podItems.filter((p: any) => p.status?.phase === "Failed").length;

    return {
        serverVersion,
        clientVersion,
        nodeCount,
        readyNodeCount,
        namespaceCount,
        podCount,
        runningPodCount,
        pendingPodCount,
        failedPodCount,
    };
}
