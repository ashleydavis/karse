import { run, type CommandResult } from "../command-runner";
import { audit, formatLocalISO } from "../audit-log";
import type {
    Context, NodeStatus, Node, ClusterOverview, Namespace, Pod, PodPhase,
    Deployment, StatefulSet, DaemonSet,
    ContainerInfo, ContainerState, KubeEvent, PodDetail,
    NodeCondition, NodeAddress, ResourceAmounts, NodeDetail,
} from "karse-types";

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

// Returns deployments for the given context, optionally scoped to a namespace.
export async function listDeployments(context: string, namespace?: string): Promise<Deployment[]> {
    const nsArgs = namespace ? ["-n", namespace] : ["-A"];
    const result = await kubectl(["--context", context, "get", "deployments", ...nsArgs, "-o", "json"]);
    if (result.exitCode !== 0) {
        throw new Error(result.stderr);
    }
    const data = JSON.parse(result.stdout);
    return (data.items as any[]).map((item) => {
        const desired: number = item.spec?.replicas ?? 0;
        const ready: number = item.status?.readyReplicas ?? 0;
        return {
            name: item.metadata.name,
            namespace: item.metadata.namespace,
            ready: `${ready}/${desired}`,
            upToDate: item.status?.updatedReplicas ?? 0,
            available: item.status?.availableReplicas ?? 0,
            createdAt: item.metadata.creationTimestamp,
        };
    });
}

// Returns stateful sets for the given context, optionally scoped to a namespace.
export async function listStatefulSets(context: string, namespace?: string): Promise<StatefulSet[]> {
    const nsArgs = namespace ? ["-n", namespace] : ["-A"];
    const result = await kubectl(["--context", context, "get", "statefulsets", ...nsArgs, "-o", "json"]);
    if (result.exitCode !== 0) {
        throw new Error(result.stderr);
    }
    const data = JSON.parse(result.stdout);
    return (data.items as any[]).map((item) => {
        const desired: number = item.spec?.replicas ?? 0;
        const ready: number = item.status?.readyReplicas ?? 0;
        return {
            name: item.metadata.name,
            namespace: item.metadata.namespace,
            ready: `${ready}/${desired}`,
            createdAt: item.metadata.creationTimestamp,
        };
    });
}

// Returns daemon sets for the given context, optionally scoped to a namespace.
export async function listDaemonSets(context: string, namespace?: string): Promise<DaemonSet[]> {
    const nsArgs = namespace ? ["-n", namespace] : ["-A"];
    const result = await kubectl(["--context", context, "get", "daemonsets", ...nsArgs, "-o", "json"]);
    if (result.exitCode !== 0) {
        throw new Error(result.stderr);
    }
    const data = JSON.parse(result.stdout);
    return (data.items as any[]).map((item) => ({
        name: item.metadata.name,
        namespace: item.metadata.namespace,
        desired: item.status?.desiredNumberScheduled ?? 0,
        current: item.status?.currentNumberScheduled ?? 0,
        ready: item.status?.numberReady ?? 0,
        upToDate: item.status?.updatedNumberScheduled ?? 0,
        available: item.status?.numberAvailable ?? 0,
        createdAt: item.metadata.creationTimestamp,
    }));
}

// Maps a raw container status object from kubectl JSON output to a typed ContainerInfo.
function parseContainerInfo(cs: any, spec: any): ContainerInfo {
    let state: ContainerState = "Unknown";
    let stateReason = "";
    const st = cs.state ?? {};
    if (st.running) {
        state = "Running";
    }
    else if (st.waiting) {
        state = "Waiting";
        stateReason = st.waiting.reason ?? "";
    }
    else if (st.terminated) {
        state = "Terminated";
        stateReason = st.terminated.reason ?? "";
    }
    const image = spec?.image ?? cs.image ?? "";
    return {
        name: cs.name,
        image,
        ready: cs.ready === true,
        restarts: cs.restartCount ?? 0,
        state,
        stateReason,
    };
}

// Returns detailed information for a single pod, including events.
export async function getPodDetail(context: string, namespace: string, name: string): Promise<PodDetail> {
    const [podResult, eventsResult] = await Promise.all([
        kubectl(["--context", context, "-n", namespace, "get", "pod", name, "-o", "json"]),
        kubectl([
            "--context", context, "-n", namespace, "get", "events",
            `--field-selector=involvedObject.name=${name},involvedObject.namespace=${namespace}`,
            "-o", "json",
        ]),
    ]);
    if (podResult.exitCode !== 0) {
        throw new Error(podResult.stderr);
    }
    const pod = JSON.parse(podResult.stdout);
    const containerStatuses: any[] = pod.status?.containerStatuses ?? [];
    const initStatuses: any[] = pod.status?.initContainerStatuses ?? [];
    const containerSpecs: any[] = pod.spec?.containers ?? [];
    const initSpecs: any[] = pod.spec?.initContainers ?? [];

    const specByName = (specs: any[], name: string) => specs.find((s) => s.name === name);

    const containers: ContainerInfo[] = containerStatuses.map((cs) =>
        parseContainerInfo(cs, specByName(containerSpecs, cs.name))
    );
    const initContainers: ContainerInfo[] = initStatuses.map((cs) =>
        parseContainerInfo(cs, specByName(initSpecs, cs.name))
    );

    let events: KubeEvent[] = [];
    if (eventsResult.exitCode === 0) {
        const evData = JSON.parse(eventsResult.stdout);
        events = (evData.items as any[]).map((ev) => ({
            type: ev.type as "Normal" | "Warning",
            reason: ev.reason ?? "",
            message: ev.message ?? "",
            count: ev.count ?? 1,
            lastSeen: ev.lastTimestamp ?? ev.eventTime ?? "",
        }));
    }

    return {
        name: pod.metadata.name,
        namespace: pod.metadata.namespace,
        phase: (pod.status?.phase as PodPhase) ?? "Unknown",
        node: pod.spec?.nodeName ?? "",
        podIP: pod.status?.podIP ?? "",
        createdAt: pod.metadata.creationTimestamp,
        labels: pod.metadata.labels ?? {},
        containers,
        initContainers,
        events,
    };
}

// Returns detailed information for a single node, including pods scheduled on it.
export async function getNodeDetail(context: string, name: string): Promise<NodeDetail> {
    const [nodeResult, podsResult] = await Promise.all([
        kubectl(["--context", context, "get", "node", name, "-o", "json"]),
        kubectl(["--context", context, "get", "pods", "-A", `--field-selector=spec.nodeName=${name}`, "-o", "json"]),
    ]);
    if (nodeResult.exitCode !== 0) {
        throw new Error(nodeResult.stderr);
    }
    const item = JSON.parse(nodeResult.stdout);

    const rolePattern = /^node-role\.kubernetes\.io\/(.+)$/;
    let status: NodeStatus = "Unknown";
    const conditions: NodeCondition[] = [];
    for (const condition of item.status?.conditions ?? []) {
        conditions.push({
            type: condition.type,
            status: condition.status as "True" | "False" | "Unknown",
            message: condition.message ?? "",
            lastTransition: condition.lastTransitionTime ?? "",
        });
        if (condition.type === "Ready") {
            if (condition.status === "True") {
                status = "Ready";
            }
            else if (condition.status === "False") {
                status = "NotReady";
            }
        }
    }
    const roles: string[] = [];
    for (const key of Object.keys(item.metadata?.labels ?? {})) {
        const match = rolePattern.exec(key);
        if (match !== null) {
            roles.push(match[1]!);
        }
    }
    roles.sort();

    const cap = item.status?.capacity ?? {};
    const alloc = item.status?.allocatable ?? {};
    const capacity: ResourceAmounts = {
        cpu: cap.cpu ?? "",
        memory: cap.memory ?? "",
        pods: cap.pods ?? "",
    };
    const allocatable: ResourceAmounts = {
        cpu: alloc.cpu ?? "",
        memory: alloc.memory ?? "",
        pods: alloc.pods ?? "",
    };

    const addresses: NodeAddress[] = (item.status?.addresses ?? []).map((a: any) => ({
        type: a.type,
        address: a.address,
    }));

    let pods: Pod[] = [];
    if (podsResult.exitCode === 0) {
        const podsData = JSON.parse(podsResult.stdout);
        pods = (podsData.items as any[]).map((p) => {
            const phase: PodPhase = (p.status?.phase as PodPhase) ?? "Unknown";
            const containerStatuses: any[] = p.status?.containerStatuses ?? [];
            const initStatuses: any[] = p.status?.initContainerStatuses ?? [];
            const allStatuses = [...containerStatuses, ...initStatuses];
            const readyCount = containerStatuses.filter((cs) => cs.ready === true).length;
            const totalCount = containerStatuses.length;
            const restarts = allStatuses.reduce((sum, cs) => sum + (cs.restartCount ?? 0), 0);
            return {
                name: p.metadata.name,
                namespace: p.metadata.namespace,
                phase,
                ready: `${readyCount}/${totalCount}`,
                restarts,
                createdAt: p.metadata.creationTimestamp,
                node: p.spec?.nodeName ?? "",
            };
        });
    }

    return {
        name: item.metadata.name,
        status,
        roles,
        version: item.status?.nodeInfo?.kubeletVersion ?? "",
        createdAt: item.metadata.creationTimestamp,
        conditions,
        capacity,
        allocatable,
        addresses,
        labels: item.metadata?.labels ?? {},
        pods,
    };
}

// Realistic fake log lines returned when KARSE_FAKE_LOGS=1 is set.
// Covers common Kubernetes workload log formats so the log viewer can be exercised
// without a cluster that supports real container log streaming.
const FAKE_LOG_LINES = [
    "2024-01-01T00:00:00.000000000Z stdout F 2024/01/01 00:00:00 [notice] 1#1: using the \"epoll\" event method",
    "2024-01-01T00:00:00.001000000Z stdout F 2024/01/01 00:00:00 [notice] 1#1: nginx/1.25.3",
    "2024-01-01T00:00:00.002000000Z stdout F 2024/01/01 00:00:00 [notice] 1#1: built by gcc 12.2.0 (Debian 12.2.0-14)",
    "2024-01-01T00:00:00.003000000Z stdout F 2024/01/01 00:00:00 [notice] 1#1: start worker processes",
    "2024-01-01T00:00:00.004000000Z stdout F 2024/01/01 00:00:00 [notice] 1#1: start worker process 30",
    "2024-01-01T00:00:01.000000000Z stdout F 10.244.0.1 - - [01/Jan/2024:00:00:01 +0000] \"GET / HTTP/1.1\" 200 615 \"-\" \"kube-probe/1.29\"",
    "2024-01-01T00:00:06.000000000Z stdout F 10.244.0.1 - - [01/Jan/2024:00:00:06 +0000] \"GET /healthz HTTP/1.1\" 200 2 \"-\" \"kube-probe/1.29\"",
    "2024-01-01T00:00:11.000000000Z stdout F 10.244.0.1 - - [01/Jan/2024:00:00:11 +0000] \"GET /readyz HTTP/1.1\" 200 2 \"-\" \"kube-probe/1.29\"",
    "2024-01-01T00:00:20.000000000Z stdout F 10.244.0.2 - - [01/Jan/2024:00:00:20 +0000] \"GET / HTTP/1.1\" 200 615 \"-\" \"Mozilla/5.0 (X11; Linux x86_64)\"",
    "2024-01-01T00:00:21.000000000Z stdout F 10.244.0.2 - - [01/Jan/2024:00:00:21 +0000] \"GET /static/main.css HTTP/1.1\" 200 1234 \"/\" \"Mozilla/5.0 (X11; Linux x86_64)\"",
].join("\n") + "\n";

// Returns the logs for a pod container. Defaults to the last 100 lines.
// When KARSE_FAKE_LOGS=1 is set, returns pre-defined realistic fake log lines instead
// of calling kubectl, so the log viewer can be exercised against clusters without
// real container runtimes (e.g. kwok).
// When the container has not yet produced any logs (kubectl returns "no logs found"),
// an empty string is returned rather than throwing, since this is a valid initial state.
export async function getPodLogs(
    context: string,
    namespace: string,
    name: string,
    container?: string,
    tail: number = 100,
): Promise<string> {
    if (process.env.KARSE_FAKE_LOGS === "1") {
        return FAKE_LOG_LINES;
    }
    const containerArgs = container ? ["-c", container] : [];
    const result = await kubectl([
        "--context", context, "-n", namespace, "logs", name,
        ...containerArgs, `--tail=${tail}`,
    ]);
    if (result.exitCode !== 0) {
        if (result.stderr.includes("no logs found for container")) {
            return "";
        }
        throw new Error(result.stderr);
    }
    return result.stdout;
}

// The set of resource types whose raw YAML the dashboard is allowed to fetch.
// Maps the URL/UI type token to the kubectl resource kind passed to "get".
// Only types the dashboard can already view are permitted, so callers cannot
// coerce the read-only adapter into reading arbitrary cluster resources.
const YAML_RESOURCE_KINDS: Record<string, string> = {
    nodes: "node",
    pods: "pod",
    deployments: "deployment",
    daemonsets: "daemonset",
    statefulsets: "statefulset",
    namespaces: "namespace",
};

// Whether the given resource type token is one we permit raw-YAML fetches for.
export function isYamlResourceType(type: string): boolean {
    return Object.prototype.hasOwnProperty.call(YAML_RESOURCE_KINDS, type);
}

// Returns the raw YAML for a single resource via "kubectl get <kind> <name> -o yaml".
// type must be one of the permitted YAML_RESOURCE_KINDS keys; passing anything else throws.
// namespace is required for namespaced resources and ignored for cluster-scoped ones
// (nodes, namespaces); the route layer decides which to pass.
export async function getResourceYaml(
    context: string,
    type: string,
    name: string,
    namespace?: string,
): Promise<string> {
    const kind = YAML_RESOURCE_KINDS[type];
    if (kind === undefined) {
        throw new Error(`unsupported resource type: ${type}`);
    }
    const nsArgs = namespace ? ["-n", namespace] : [];
    const result = await kubectl(["--context", context, ...nsArgs, "get", kind, name, "-o", "yaml"]);
    if (result.exitCode !== 0) {
        throw new Error(result.stderr);
    }
    return result.stdout;
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
