import { run, stream, type CommandResult, type StreamHandle } from "../command-runner";
import { audit, formatLocalISO } from "../audit-log";
import type {
    Context, NodeStatus, Node, ClusterOverview, Namespace, Pod, PodPhase,
    Deployment, StatefulSet, DaemonSet,
    ContainerInfo, ContainerState, KubeEvent, PodDetail,
    NodeCondition, NodeAddress, ResourceAmounts, NodeDetail,
    ClusterEvent, WorkloadKind, WorkloadStat, WorkloadDetail, ClusterError,
    NamespaceDetail, NamespaceResource, NamespaceQuota, NamespaceLimit,
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

// Returns every namespace in the cluster for the given context, each annotated
// with its resource count (number of pods in the namespace). The pod count comes
// from a single "get pods -A" call rather than one call per namespace, so the cost
// does not grow with the number of namespaces. The pod query is fetched in parallel
// and tolerated: if it fails, namespaces are still returned with resourceCount=null
// so the table renders regardless. Throws only when the namespace list itself fails.
export async function listNamespaces(context: string): Promise<Namespace[]> {
    const [nsResult, podsResult] = await Promise.allSettled([
        kubectl(["--context", context, "get", "namespaces", "-o", "json"]),
        kubectl(["--context", context, "get", "pods", "-A", "-o", "json"]),
    ]);

    if (nsResult.status === "rejected") {
        throw nsResult.reason;
    }
    if (nsResult.value.exitCode !== 0) {
        throw new Error(nsResult.value.stderr);
    }
    const nsData = JSON.parse(nsResult.value.stdout);

    // Build a name -> pod count map from the pods query. When the query failed,
    // counts stays null and every namespace reports resourceCount=null.
    let counts: Map<string, number> | null = null;
    if (podsResult.status === "fulfilled" && podsResult.value.exitCode === 0) {
        counts = new Map<string, number>();
        const podItems: any[] = JSON.parse(podsResult.value.stdout).items ?? [];
        for (const pod of podItems) {
            const ns: string = pod.metadata?.namespace ?? "";
            counts.set(ns, (counts.get(ns) ?? 0) + 1);
        }
    }

    return (nsData.items as any[]).map((item) => {
        const name: string = item.metadata.name;
        return {
            name,
            labels: item.metadata.labels ?? {},
            resourceCount: counts === null ? null : (counts.get(name) ?? 0),
        };
    });
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
            labels: item.metadata.labels ?? {},
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
    return (data.items as any[]).map((item) => mapPodListItem(item));
}

// Maps a raw pod item from kubectl JSON list output to a typed Pod summary.
// Shared by listPods and getNodeDetail so the pod-list shape stays consistent.
function mapPodListItem(item: any): Pod {
    const phase: PodPhase = (item.status?.phase as PodPhase) ?? "Unknown";
    const containerStatuses: any[] = item.status?.containerStatuses ?? [];
    const initStatuses: any[] = item.status?.initContainerStatuses ?? [];
    const allStatuses = [...containerStatuses, ...initStatuses];
    const readyCount = containerStatuses.filter((cs) => cs.ready === true).length;
    const totalCount = containerStatuses.length;
    const restarts = allStatuses.reduce((sum, cs) => sum + (cs.restartCount ?? 0), 0);
    const specContainers: any[] = item.spec?.containers ?? [];
    // Prefer the spec container count (authoritative even before statuses populate),
    // falling back to the status count when the spec is unavailable.
    const containerCount = specContainers.length > 0 ? specContainers.length : totalCount;
    return {
        name: item.metadata.name,
        namespace: item.metadata.namespace,
        phase,
        ready: `${readyCount}/${totalCount}`,
        containerCount,
        restarts,
        createdAt: item.metadata.creationTimestamp,
        node: item.spec?.nodeName ?? "",
        labels: item.metadata.labels ?? {},
    };
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
            labels: item.metadata.labels ?? {},
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
            labels: item.metadata.labels ?? {},
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
        labels: item.metadata.labels ?? {},
    }));
}

// Returns Kubernetes events for the given context, optionally scoped to a namespace.
// Pass namespace=undefined (or omit) to fetch events across all namespaces.
// Events are sorted newest-first by last-seen timestamp.
export async function listEvents(context: string, namespace?: string): Promise<ClusterEvent[]> {
    const nsArgs = namespace ? ["-n", namespace] : ["-A"];
    const result = await kubectl(["--context", context, "get", "events", ...nsArgs, "-o", "json"]);
    if (result.exitCode !== 0) {
        throw new Error(result.stderr);
    }
    const data = JSON.parse(result.stdout);
    const events: ClusterEvent[] = (data.items as any[]).map((ev) => {
        const involved = ev.involvedObject ?? {};
        const lastSeen = ev.lastTimestamp ?? ev.eventTime ?? ev.firstTimestamp ?? "";
        return {
            type: (ev.type as "Normal" | "Warning") ?? "Normal",
            reason: ev.reason ?? "",
            message: ev.message ?? "",
            count: ev.count ?? 1,
            lastSeen,
            namespace: ev.metadata?.namespace ?? involved.namespace ?? "",
            objectKind: involved.kind ?? "",
            objectName: involved.name ?? "",
        };
    });
    events.sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());
    return events;
}

// Pod phases that indicate the pod itself is in an error state.
const FAILED_POD_PHASES = new Set(["Failed", "Unknown"]);

// Container waiting/terminated reasons that indicate a problem worth surfacing
// on the Errors page even when the pod's phase is still Pending or Running.
const PROBLEM_CONTAINER_REASONS = new Set([
    "CrashLoopBackOff",
    "ImagePullBackOff",
    "ErrImagePull",
    "CreateContainerConfigError",
    "CreateContainerError",
    "InvalidImageName",
    "RunContainerError",
    "Error",
    "ContainerCannotRun",
    "OOMKilled",
    "CrashLoopBackoff",
]);

// Extracts the problem reason+message from a pod item if any of its containers
// are in a known error state, or the pod phase itself is Failed/Unknown.
// Returns null when the pod looks healthy enough to omit from the Errors page.
function podProblem(item: any): { reason: string; message: string } | null {
    const containerStatuses: any[] = item.status?.containerStatuses ?? [];
    const initStatuses: any[] = item.status?.initContainerStatuses ?? [];
    for (const cs of [...initStatuses, ...containerStatuses]) {
        const waiting = cs.state?.waiting;
        if (waiting && PROBLEM_CONTAINER_REASONS.has(waiting.reason)) {
            return {
                reason: waiting.reason,
                message: waiting.message ?? `Container ${cs.name} is waiting: ${waiting.reason}`,
            };
        }
        const terminated = cs.state?.terminated;
        if (terminated && terminated.exitCode !== 0 && PROBLEM_CONTAINER_REASONS.has(terminated.reason)) {
            return {
                reason: terminated.reason,
                message: terminated.message ?? `Container ${cs.name} terminated: ${terminated.reason} (exit ${terminated.exitCode})`,
            };
        }
    }
    const phase: string = item.status?.phase ?? "";
    if (FAILED_POD_PHASES.has(phase)) {
        // status.reason (e.g. "Evicted") refines the phase; status.message carries
        // the human-readable detail. Fall back through both to a generic message.
        const reason = item.status?.reason ?? phase;
        return {
            reason,
            message: item.status?.message ?? `Pod is in ${phase} phase`,
        };
    }
    return null;
}

// Returns the set of error conditions occurring in the cluster for the given
// context, optionally scoped to a namespace. Combines two read-only sources:
//   1. Warning-type Kubernetes events (kubectl get events --field-selector type=Warning).
//   2. Pods in a failing state (CrashLoopBackOff, ImagePullBackOff, Failed, etc.).
// Both sources are mapped to the unified ClusterError shape and returned sorted
// newest-first by lastSeen. Pass namespace=undefined (or omit) for all namespaces.
export async function listClusterErrors(context: string, namespace?: string): Promise<ClusterError[]> {
    const nsArgs = namespace ? ["-n", namespace] : ["-A"];
    const [eventsResult, podsResult] = await Promise.all([
        kubectl(["--context", context, "get", "events", ...nsArgs, "--field-selector=type=Warning", "-o", "json"]),
        kubectl(["--context", context, "get", "pods", ...nsArgs, "-o", "json"]),
    ]);
    if (eventsResult.exitCode !== 0) {
        throw new Error(eventsResult.stderr);
    }
    if (podsResult.exitCode !== 0) {
        throw new Error(podsResult.stderr);
    }

    const errors: ClusterError[] = [];

    const eventItems: any[] = JSON.parse(eventsResult.stdout).items ?? [];
    for (const ev of eventItems) {
        const involved = ev.involvedObject ?? {};
        const lastSeen = ev.lastTimestamp ?? ev.eventTime ?? ev.firstTimestamp ?? "";
        const firstSeen = ev.firstTimestamp ?? ev.eventTime ?? lastSeen ?? "";
        errors.push({
            source: "Event",
            namespace: ev.metadata?.namespace ?? involved.namespace ?? "",
            objectKind: involved.kind ?? "",
            objectName: involved.name ?? "",
            reason: ev.reason ?? "",
            message: ev.message ?? "",
            count: ev.count ?? 1,
            firstSeen,
            lastSeen,
        });
    }

    const podItems: any[] = JSON.parse(podsResult.stdout).items ?? [];
    for (const item of podItems) {
        const problem = podProblem(item);
        if (problem === null) {
            continue;
        }
        const lastSeen = item.status?.startTime ?? item.metadata?.creationTimestamp ?? "";
        const firstSeen = item.metadata?.creationTimestamp ?? lastSeen ?? "";
        errors.push({
            source: "Pod",
            namespace: item.metadata?.namespace ?? "",
            objectKind: "Pod",
            objectName: item.metadata?.name ?? "",
            reason: problem.reason,
            message: problem.message,
            count: 1,
            firstSeen,
            lastSeen,
        });
    }

    errors.sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());
    return errors;
}

// Counts pods in the given kubectl pod items that are in a known problem state,
// reusing the same podProblem logic that drives the Errors feed. Used by the
// cluster overview to compute its active-error count.
function countProblemPods(items: any[]): number {
    let count = 0;
    for (const item of items) {
        if (podProblem(item) !== null) {
            count++;
        }
    }
    return count;
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
    const [nodeResult, podsResult, eventsResult] = await Promise.all([
        kubectl(["--context", context, "get", "node", name, "-o", "json"]),
        kubectl(["--context", context, "get", "pods", "-A", `--field-selector=spec.nodeName=${name}`, "-o", "json"]),
        kubectl([
            "--context", context, "get", "events", "-A",
            `--field-selector=involvedObject.kind=Node,involvedObject.name=${name}`,
            "-o", "json",
        ]),
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
        pods = (podsData.items as any[]).map((p) => mapPodListItem(p));
    }

    let events: KubeEvent[] = [];
    if (eventsResult.exitCode === 0) {
        const evData = JSON.parse(eventsResult.stdout);
        events = (evData.items as any[]).map((ev) => ({
            type: (ev.type as "Normal" | "Warning") ?? "Normal",
            reason: ev.reason ?? "",
            message: ev.message ?? "",
            count: ev.count ?? 1,
            lastSeen: ev.lastTimestamp ?? ev.eventTime ?? "",
        }));
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
        events,
    };
}

// Maps a WorkloadKind token to the kubectl resource kind passed to "get".
const WORKLOAD_KINDS: Record<WorkloadKind, string> = {
    deployments: "deployment",
    statefulsets: "statefulset",
    daemonsets: "daemonset",
};

// Whether the given type token names a workload kind that has a detail page.
export function isWorkloadKind(type: string): type is WorkloadKind {
    return Object.prototype.hasOwnProperty.call(WORKLOAD_KINDS, type);
}

// Builds the kind-specific list of status counters shown on a workload detail page.
// Each kind reports slightly different numbers in its status, so they are normalized
// here into a uniform list of labelled values the UI can render without branching.
function workloadStats(kind: WorkloadKind, item: any): WorkloadStat[] {
    const status = item.status ?? {};
    if (kind === "deployments") {
        const desired: number = item.spec?.replicas ?? 0;
        const ready: number = status.readyReplicas ?? 0;
        return [
            {
                label: "Ready",
                value: `${ready}/${desired}`,
            },
            {
                label: "Up-to-date",
                value: `${status.updatedReplicas ?? 0}`,
            },
            {
                label: "Available",
                value: `${status.availableReplicas ?? 0}`,
            },
        ];
    }
    if (kind === "statefulsets") {
        const desired: number = item.spec?.replicas ?? 0;
        const ready: number = status.readyReplicas ?? 0;
        return [
            {
                label: "Ready",
                value: `${ready}/${desired}`,
            },
            {
                label: "Current",
                value: `${status.currentReplicas ?? 0}`,
            },
            {
                label: "Updated",
                value: `${status.updatedReplicas ?? 0}`,
            },
        ];
    }
    return [
        {
            label: "Desired",
            value: `${status.desiredNumberScheduled ?? 0}`,
        },
        {
            label: "Current",
            value: `${status.currentNumberScheduled ?? 0}`,
        },
        {
            label: "Ready",
            value: `${status.numberReady ?? 0}`,
        },
        {
            label: "Up-to-date",
            value: `${status.updatedNumberScheduled ?? 0}`,
        },
        {
            label: "Available",
            value: `${status.numberAvailable ?? 0}`,
        },
    ];
}

// The Kubernetes owner kind (kind field of an ownerReference) for each workload kind.
// Deployments are absent here on purpose: a deployment never directly owns its pods,
// it owns ReplicaSets which in turn own the pods, so pod ownership is matched via the
// owning ReplicaSet names instead (see ownedReplicaSetNames / podBelongsToWorkload).
const WORKLOAD_OWNER_KIND: Partial<Record<WorkloadKind, string>> = {
    statefulsets: "StatefulSet",
    daemonsets: "DaemonSet",
};

// Decides whether a single raw pod item belongs to the named workload, used to scope
// a workload's Pods list to just that workload's pods rather than everything its label
// selector happens to match.
//
// Ownership is preferred: a pod belongs to the workload when one of its ownerReferences
// names the workload directly (stateful sets and daemon sets own their pods), or, for a
// deployment, names a ReplicaSet that the deployment owns (a deployment owns ReplicaSets
// which own the pods). When a pod carries no ownerReferences at all (e.g. a hand-rolled
// pod, or a cluster that does not populate them), the workload's label selector is used
// as a fallback so the list is not silently empty. A pod that has owner references but
// none matching this workload is excluded even if its labels match, which is what keeps
// two workloads that share a selector from showing each other's pods.
export function podBelongsToWorkload(
    podItem: any,
    workload: { kind: WorkloadKind; name: string; ownedReplicaSetNames: Set<string> },
    selector: Record<string, string>,
): boolean {
    const owners: any[] = podItem?.metadata?.ownerReferences ?? [];
    if (owners.length > 0) {
        const directKind = WORKLOAD_OWNER_KIND[workload.kind];
        return owners.some((owner) => {
            if (directKind !== undefined && owner?.kind === directKind && owner?.name === workload.name) {
                return true;
            }
            if (workload.kind === "deployments" && owner?.kind === "ReplicaSet") {
                return workload.ownedReplicaSetNames.has(owner?.name);
            }
            return false;
        });
    }
    // No owner references: fall back to the label selector. An empty selector matches
    // nothing rather than every pod.
    const selectorEntries = Object.entries(selector);
    if (selectorEntries.length === 0) {
        return false;
    }
    const labels: Record<string, string> = podItem?.metadata?.labels ?? {};
    return selectorEntries.every(([key, value]) => labels[key] === value);
}

// Returns detailed information for a single deployment, stateful set, or daemon set:
// its metadata, kind-specific status counters, the pods it selects, and its events.
// kind must be one of WORKLOAD_KINDS; passing anything else throws. READ-ONLY.
export async function getWorkloadDetail(
    context: string,
    kind: WorkloadKind,
    namespace: string,
    name: string,
): Promise<WorkloadDetail> {
    const resourceKind = WORKLOAD_KINDS[kind];
    if (resourceKind === undefined) {
        throw new Error(`unsupported workload kind: ${kind}`);
    }
    const [workloadResult, eventsResult] = await Promise.all([
        kubectl(["--context", context, "-n", namespace, "get", resourceKind, name, "-o", "json"]),
        kubectl([
            "--context", context, "-n", namespace, "get", "events",
            `--field-selector=involvedObject.name=${name},involvedObject.namespace=${namespace}`,
            "-o", "json",
        ]),
    ]);
    if (workloadResult.exitCode !== 0) {
        throw new Error(workloadResult.stderr);
    }
    const item = JSON.parse(workloadResult.stdout);
    const selector: Record<string, string> = item.spec?.selector?.matchLabels ?? {};

    // Fetch the pods that belong to the workload so the detail page can list them. The
    // label selector pre-filters the query (and is the fallback when owner references are
    // absent), but the result is then scoped down to the pods this workload actually owns
    // so a shared selector does not pull in another workload's pods. When the workload has
    // no match labels we skip the query rather than fetch every pod.
    let pods: Pod[] = [];
    const selectorParts = Object.entries(selector).map(([key, value]) => `${key}=${value}`);
    if (selectorParts.length > 0) {
        // For deployments, pods are owned by ReplicaSets, which are owned by the
        // deployment. Look up the ReplicaSets this deployment owns so pod ownership can be
        // traced through them. Stateful sets and daemon sets own their pods directly, so
        // they need no such lookup.
        const ownedReplicaSetNames = new Set<string>();
        if (kind === "deployments") {
            const rsResult = await kubectl([
                "--context", context, "-n", namespace, "get", "replicasets",
                "-l", selectorParts.join(","), "-o", "json",
            ]);
            if (rsResult.exitCode === 0) {
                for (const rs of (JSON.parse(rsResult.stdout).items as any[])) {
                    const ownedByThis = (rs.metadata?.ownerReferences ?? []).some(
                        (o: any) => o?.kind === "Deployment" && o?.name === name,
                    );
                    if (ownedByThis) {
                        ownedReplicaSetNames.add(rs.metadata?.name);
                    }
                }
            }
        }

        const podsResult = await kubectl([
            "--context", context, "-n", namespace, "get", "pods",
            "-l", selectorParts.join(","), "-o", "json",
        ]);
        if (podsResult.exitCode === 0) {
            const podsData = JSON.parse(podsResult.stdout);
            pods = (podsData.items as any[])
                .filter((p) => podBelongsToWorkload(p, { kind, name, ownedReplicaSetNames }, selector))
                .map((p) => mapPodListItem(p));
        }
    }

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
        kind,
        name: item.metadata.name,
        namespace: item.metadata.namespace,
        createdAt: item.metadata.creationTimestamp,
        labels: item.metadata.labels ?? {},
        selector,
        stats: workloadStats(kind, item),
        pods,
        events,
    };
}

// Returns detailed information for a single namespace: its own metadata (phase,
// labels, annotations) plus the resources contained in it (pods, deployments,
// stateful sets, daemon sets) and any resource quotas / limit ranges that apply.
// READ-ONLY. The namespace read is authoritative and re-throws on failure; the
// contained-resource and quota/limit sub-reads are tolerant and degrade to empty
// lists so a single failing kind does not fail the whole page.
export async function getNamespaceDetail(context: string, name: string): Promise<NamespaceDetail> {
    const ctx = ["--context", context];
    const [
        nsResult, podsResult, deploysResult, statefulResult, daemonResult, quotaResult, limitResult,
    ] = await Promise.all([
        kubectl([...ctx, "get", "namespace", name, "-o", "json"]),
        kubectl([...ctx, "-n", name, "get", "pods", "-o", "json"]),
        kubectl([...ctx, "-n", name, "get", "deployments", "-o", "json"]),
        kubectl([...ctx, "-n", name, "get", "statefulsets", "-o", "json"]),
        kubectl([...ctx, "-n", name, "get", "daemonsets", "-o", "json"]),
        kubectl([...ctx, "-n", name, "get", "resourcequotas", "-o", "json"]),
        kubectl([...ctx, "-n", name, "get", "limitranges", "-o", "json"]),
    ]);
    if (nsResult.exitCode !== 0) {
        throw new Error(nsResult.stderr);
    }
    const ns = JSON.parse(nsResult.stdout);

    const resources: NamespaceResource[] = [];

    // Pods in the namespace, summarised by phase, linking to the pod detail page.
    if (podsResult.exitCode === 0) {
        for (const item of (JSON.parse(podsResult.stdout).items as any[])) {
            const pod = mapPodListItem(item);
            resources.push({
                kind: "Pod",
                name: pod.name,
                status: pod.phase,
                detailPath: `/pods/${pod.namespace}/${pod.name}`,
            });
        }
    }
    // Deployments, summarised by ready count, linking to the workload detail page.
    if (deploysResult.exitCode === 0) {
        for (const item of (JSON.parse(deploysResult.stdout).items as any[])) {
            const desired: number = item.spec?.replicas ?? 0;
            const ready: number = item.status?.readyReplicas ?? 0;
            resources.push({
                kind: "Deployment",
                name: item.metadata.name,
                status: `${ready}/${desired} ready`,
                detailPath: `/deployments/${name}/${item.metadata.name}`,
            });
        }
    }
    // Stateful sets, summarised by ready count.
    if (statefulResult.exitCode === 0) {
        for (const item of (JSON.parse(statefulResult.stdout).items as any[])) {
            const desired: number = item.spec?.replicas ?? 0;
            const ready: number = item.status?.readyReplicas ?? 0;
            resources.push({
                kind: "StatefulSet",
                name: item.metadata.name,
                status: `${ready}/${desired} ready`,
                detailPath: `/statefulsets/${name}/${item.metadata.name}`,
            });
        }
    }
    // Daemon sets, summarised by ready/desired scheduled count.
    if (daemonResult.exitCode === 0) {
        for (const item of (JSON.parse(daemonResult.stdout).items as any[])) {
            const desired: number = item.status?.desiredNumberScheduled ?? 0;
            const ready: number = item.status?.numberReady ?? 0;
            resources.push({
                kind: "DaemonSet",
                name: item.metadata.name,
                status: `${ready}/${desired} ready`,
                detailPath: `/daemonsets/${name}/${item.metadata.name}`,
            });
        }
    }

    // Resource quotas declared in the namespace, with their hard limits.
    const quotas: NamespaceQuota[] = [];
    if (quotaResult.exitCode === 0) {
        for (const item of (JSON.parse(quotaResult.stdout).items as any[])) {
            quotas.push({
                name: item.metadata.name,
                hard: (item.spec?.hard ?? item.status?.hard ?? {}) as Record<string, string>,
            });
        }
    }

    // Limit ranges declared in the namespace, flattened to one row per limit.
    const limits: NamespaceLimit[] = [];
    if (limitResult.exitCode === 0) {
        for (const item of (JSON.parse(limitResult.stdout).items as any[])) {
            for (const lim of (item.spec?.limits ?? []) as any[]) {
                const resourceNames = new Set<string>([
                    ...Object.keys(lim.min ?? {}),
                    ...Object.keys(lim.max ?? {}),
                    ...Object.keys(lim.default ?? {}),
                    ...Object.keys(lim.defaultRequest ?? {}),
                ]);
                for (const resource of resourceNames) {
                    limits.push({
                        name: item.metadata.name,
                        type: lim.type ?? "",
                        resource,
                        min: lim.min?.[resource] ?? "-",
                        max: lim.max?.[resource] ?? "-",
                        defaultRequest: lim.defaultRequest?.[resource] ?? "-",
                        default: lim.default?.[resource] ?? "-",
                    });
                }
            }
        }
    }

    return {
        name: ns.metadata.name,
        phase: ns.status?.phase ?? "Unknown",
        createdAt: ns.metadata.creationTimestamp,
        labels: ns.metadata.labels ?? {},
        annotations: ns.metadata.annotations ?? {},
        resources,
        quotas,
        limits,
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

// Callbacks for a live (follow-mode) log stream from a single pod container.
// onLine receives one complete log line at a time (newlines stripped); onError
// receives a spawn/runtime failure; onClose fires once when the stream ends.
export type LogStreamHandlers = {
    onLine: (line: string) => void;
    onError: (err: Error) => void;
    onClose: () => void;
};

// A handle to a live log stream, exposing only a stop operation.
export type LogStreamHandle = { stop: () => void };

// Splits an incoming text chunk into complete lines, retaining any trailing
// partial line in `carry` for the next chunk. Returns the new carry value.
function emitLines(buffer: string, carry: string, onLine: (line: string) => void): string {
    const combined = carry + buffer;
    const parts = combined.split("\n");
    const remainder = parts.pop() ?? "";
    for (const part of parts) {
        onLine(part);
    }
    return remainder;
}

// Streams live logs (`kubectl logs -f`) from a single pod, emitting each line via
// the handlers as it arrives. This is a READ-ONLY follow operation. The optional
// container scopes the stream to one container; tail bounds the initial backlog.
// When KARSE_FAKE_LOGS=1 is set, emits the canned FAKE_LOG_LINES (one per line)
// then closes, so the live log viewer can be exercised without a real cluster.
// Returns a handle the caller uses to terminate the underlying kubectl process.
export function streamPodLogs(
    context: string,
    namespace: string,
    name: string,
    container: string | undefined,
    tail: number,
    handlers: LogStreamHandlers,
): LogStreamHandle {
    if (process.env.KARSE_FAKE_LOGS === "1") {
        let cancelled = false;
        for (const line of FAKE_LOG_LINES.split("\n")) {
            if (line !== "") {
                handlers.onLine(line);
            }
        }
        // Defer the close so callers can wire up listeners synchronously first.
        setTimeout(() => {
            if (!cancelled) {
                handlers.onClose();
            }
        }, 0);
        return {
            stop: () => {
                cancelled = true;
            },
        };
    }

    const containerArgs = container ? ["-c", container] : [];
    const args = [
        "--context", context, "-n", namespace, "logs", "-f", name,
        ...containerArgs, `--tail=${tail}`,
    ];
    const now = new Date();
    // Audit-log the streamed command exactly like the buffered kubectl() helper.
    void audit(LOGS_DIR, "kubectl", args, now);
    console.log(formatLocalISO(now) + " kubectl " + args.join(" "));

    let carry = "";
    const handle: StreamHandle = stream("kubectl", args, {
        onStdout: (chunk) => {
            carry = emitLines(chunk, carry, handlers.onLine);
        },
        onError: (err) => {
            handlers.onError(err);
        },
        onClose: () => {
            if (carry !== "") {
                handlers.onLine(carry);
                carry = "";
            }
            handlers.onClose();
        },
    });

    return {
        stop: () => {
            handle.kill();
        },
    };
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
        kubectl([...ctxArgs, "get", "events", "-A", "--field-selector=type=Warning", "-o", "json"]),
    ]);
    const versionResult = results[0]!;
    const nodesResult = results[1]!;
    const nsResult = results[2]!;
    const podsResult = results[3]!;
    const eventsResult = results[4]!;

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

    // Active-error count = Warning-type events + pods in a known problem state,
    // the same two sources the Errors feed unifies. The events call is tolerant:
    // a context can be valid while events are momentarily unavailable, and the
    // landing page should still render its other tiles, so on failure that source
    // contributes zero (it does not throw, unlike the node/namespace/pod calls).
    let warningEventCount = 0;
    if (eventsResult.status === "fulfilled" && eventsResult.value.exitCode === 0) {
        warningEventCount = (JSON.parse(eventsResult.value.stdout).items ?? []).length;
    }
    const errorCount = warningEventCount + countProblemPods(podItems);

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
        errorCount,
    };
}
