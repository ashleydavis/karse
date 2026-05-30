import { run, type CommandResult } from "../command-runner";
import { audit } from "../audit-log";
import type { Context, NodeStatus, Node, ClusterOverview } from "karse-types";

// Base directory for the rolling audit log; overridable via KARSE_LOGS_DIR.
const LOGS_DIR = process.env.KARSE_LOGS_DIR ?? "../logs";

// Writes an audit entry then shells out to kubectl. The only call site for run("kubectl", ...).
async function kubectl(args: readonly string[]): Promise<CommandResult> {
    await audit(LOGS_DIR, "kubectl", args);
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

// Returns the list of nodes in the current context with display-ready fields.
export async function listNodes(): Promise<Node[]> {
    const result = await kubectl(["get", "nodes", "-o", "json"]);
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

// Returns aggregate cluster statistics (version + node/namespace/pod counts).
// Runs four kubectl calls in parallel. The version branch tolerates failures
// (returns null); the three count branches re-throw on any failure.
export async function getClusterOverview(): Promise<ClusterOverview> {
    const results = await Promise.allSettled([
        kubectl(["version", "-o", "json"]),
        kubectl(["get", "nodes", "-o", "json"]),
        kubectl(["get", "namespaces", "-o", "json"]),
        kubectl(["get", "pods", "-A", "-o", "json"]),
    ]);
    const versionResult = results[0]!;
    const nodesResult = results[1]!;
    const nsResult = results[2]!;
    const podsResult = results[3]!;

    let serverVersion: string | null = null;
    if (versionResult.status === "fulfilled" && versionResult.value.exitCode === 0) {
        const data = JSON.parse(versionResult.value.stdout);
        serverVersion = data.serverVersion?.gitVersion ?? null;
    }

    if (nodesResult.status === "rejected") {
        throw nodesResult.reason;
    }
    if (nodesResult.value.exitCode !== 0) {
        throw new Error(nodesResult.value.stderr);
    }
    const nodeCount: number = JSON.parse(nodesResult.value.stdout).items.length;

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
    const podCount: number = JSON.parse(podsResult.value.stdout).items.length;

    return {
        serverVersion,
        nodeCount,
        namespaceCount,
        podCount,
    };
}
