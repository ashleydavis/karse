import { run, stream, type CommandResult, type StreamHandle } from "../command-runner";
import { audit, formatLocalISO } from "../audit-log";
import {
    cacheKey, readCacheEntry, writeCacheEntry, readCacheConfig, isFresh,
} from "./cache";
import { parseCpuToMillicores, parseMemoryToBytes } from "./quantity";
import type {
    Context, NodeStatus, Node, ClusterOverview, Namespace, Pod, PodPhase,
    Deployment, StatefulSet, DaemonSet, HorizontalPodAutoscaler,
    ContainerInfo, ContainerState, KubeEvent, PodDetail,
    NodeCondition, NodeAddress, ResourceAmounts, NodeDetail,
    ClusterEvent, WorkloadKind, WorkloadStat, WorkloadDetail, ClusterError,
    NamespaceDetail, NamespaceResource, NamespaceQuota, NamespaceLimit,
    ClusterPerformance, NodeUsage, PodUsage, ResourceUsage,
    ContainerUsage, NodePerformance, PodPerformance,
    ClusterResourceTotals, ClusterHealthSignals, WorkloadUsage,
} from "karse-types";

// Base directory for the rolling audit log; overridable via KARSE_LOGS_DIR.
const LOGS_DIR = process.env.KARSE_LOGS_DIR ?? "../logs";

// Whether a kubectl argv is a *cluster* read that may be served from / stored in the
// on-disk cache. Only cluster-touching reads are cached (`get …`, `version`, the raw
// Metrics API reads). Every `kubectl config …` command is excluded: the writes
// (use-context / set-context / unset) must run live, and the reads (config view /
// current-context) reflect local kubeconfig state that the user changes from the UI,
// so they must always be read fresh — caching them would make a context/namespace
// switch invisible until the entry expired. Local config reads are cheap anyway, so
// there is nothing to gain by caching them.
function isCacheableRead(args: readonly string[]): boolean {
    return args[0] !== "config";
}

// Writes an audit entry, prints to stdout, then shells out to kubectl.
// Read commands are served from the on-disk cache when a fresh entry exists, and
// their successful results are cached (date-stamped) for the next request. This
// avoids re-running kubectl on every request while keeping the cluster read-only:
// the cache stores read output only, never a write. Stale or absent cache entries,
// and all kubeconfig writes, fall through to a live kubectl invocation. A failed
// read is never cached, and a cache write failure never fails the request.
async function kubectl(args: readonly string[]): Promise<CommandResult> {
    const cacheable = isCacheableRead(args);

    if (cacheable) {
        const { stalenessSeconds } = await readCacheConfig();
        const cached = await readCacheEntry(cacheKey(args));
        if (cached !== null && isFresh(cached.savedAt, stalenessSeconds)) {
            return cached.result;
        }
    }

    const now = new Date();
    await audit(LOGS_DIR, "kubectl", args, now);
    console.log(formatLocalISO(now) + " kubectl " + args.join(" "));
    const result = await run("kubectl", args);

    // Cache only successful reads, stamped with the time they were saved. A failed
    // read (non-zero exit) is left uncached so a transient error is not served back.
    if (cacheable && result.exitCode === 0) {
        try {
            await writeCacheEntry(args, result, undefined, now);
        }
        catch {
            // A cache write failure must not fail the request; serve the live result.
        }
    }

    return result;
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
        const labels: Record<string, string> = item.metadata.labels ?? {};
        const instanceType =
            labels["node.kubernetes.io/instance-type"] ??
            labels["beta.kubernetes.io/instance-type"] ??
            null;
        return {
            name: item.metadata.name,
            status,
            roles,
            version: item.status.nodeInfo.kubeletVersion,
            createdAt: item.metadata.creationTimestamp,
            labels,
            instanceType,
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

// Summarises an HPA's current metric status the way kubectl's TARGETS column
// does, e.g. "cpu: 40%/80%" or "memory: 60%/70%, cpu: 30%/80%". Returns "<none>"
// when no metric status is available yet (a freshly created HPA, or one whose
// metrics API is unreachable), matching kubectl's own placeholder.
function formatHpaTargets(item: any): string {
    const currentMetrics: any[] = item.status?.currentMetrics ?? [];
    const targetMetrics: any[] = item.spec?.metrics ?? [];
    if (targetMetrics.length === 0) {
        return "<none>";
    }
    const parts: string[] = [];
    for (let i = 0; i < targetMetrics.length; i++) {
        const target = targetMetrics[i];
        const current = currentMetrics[i];
        // Resource metrics (cpu/memory) are the common case; report the metric name
        // with current/target utilisation. Anything else falls back to "<unknown>"
        // for the current side so the row still shows the target.
        const name = target?.resource?.name ?? target?.name ?? "?";
        const targetUtil = target?.resource?.target?.averageUtilization;
        const currentUtil = current?.resource?.current?.averageUtilization;
        const targetStr = targetUtil !== undefined ? `${targetUtil}%` : "auto";
        const currentStr = currentUtil !== undefined && currentUtil !== null ? `${currentUtil}%` : "<unknown>";
        parts.push(`${name}: ${currentStr}/${targetStr}`);
    }
    return parts.length > 0 ? parts.join(", ") : "<none>";
}

// Returns horizontal pod autoscalers (HPAs) for the given context, optionally
// scoped to a namespace. Mirrors the other list helpers: all-namespaces by
// default, or a single namespace when given.
export async function listHorizontalPodAutoscalers(context: string, namespace?: string): Promise<HorizontalPodAutoscaler[]> {
    const nsArgs = namespace ? ["-n", namespace] : ["-A"];
    const result = await kubectl(["--context", context, "get", "horizontalpodautoscalers", ...nsArgs, "-o", "json"]);
    if (result.exitCode !== 0) {
        throw new Error(result.stderr);
    }
    const data = JSON.parse(result.stdout);
    return (data.items as any[]).map((item) => {
        const target = item.spec?.scaleTargetRef ?? {};
        const reference = target.kind && target.name ? `${target.kind}/${target.name}` : "";
        return {
            name: item.metadata.name,
            namespace: item.metadata.namespace,
            reference,
            minReplicas: item.spec?.minReplicas ?? 0,
            maxReplicas: item.spec?.maxReplicas ?? 0,
            currentReplicas: item.status?.currentReplicas ?? 0,
            desiredReplicas: item.status?.desiredReplicas ?? 0,
            targets: formatHpaTargets(item),
            createdAt: item.metadata.creationTimestamp,
            labels: item.metadata.labels ?? {},
        };
    });
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
        const firstSeen = ev.firstTimestamp ?? ev.eventTime ?? "";
        const source = ev.source?.component ?? ev.reportingComponent ?? "";
        return {
            uid: ev.metadata?.uid ?? "",
            type: (ev.type as "Normal" | "Warning") ?? "Normal",
            reason: ev.reason ?? "",
            message: ev.message ?? "",
            count: ev.count ?? 1,
            source,
            firstSeen,
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

// Deterministic fake Metrics API payloads returned when KARSE_FAKE_METRICS=1 is set.
// Mirrors the shape of the raw metrics.k8s.io endpoints (a NodeMetricsList for the
// nodes path and a PodMetricsList for the pods path) so the per-scope adapter methods
// can parse the fake data exactly as they parse real metrics. The numbers are large
// enough and varied enough that the treemap and heatmap render with several cells.
// CPU is reported as the Metrics API returns it: a mix of nanocore ("n") and microcore
// ("u") suffixes (1 millicore = 1e6 nanocores = 1000 microcores), and memory in Ki. The
// microcore entries (e.g. "850000u" = 850m, and the "398u" container from the field
// report) keep the cluster Performance views exercising the microcore parse path that
// previously broke the page with "invalid CPU quantity: 398u".
const FAKE_METRICS = {
    // Node usage, keyed for the /apis/metrics.k8s.io/v1beta1/nodes raw endpoint.
    nodes: {
        kind: "NodeMetricsList",
        apiVersion: "metrics.k8s.io/v1beta1",
        // fake-node-1 / fake-node-2 are the names the smoke fixture (scripts/smoke-tests.sh)
        // seeds, so the node/cluster performance smoke checks join usage to them by name.
        // node-cp / node-worker are the names the e2e fixture (scripts/e2e-tests.sh) seeds;
        // they are included so the cluster Performance treemap — whose leaves are the
        // cluster's nodes, joined to this usage by name — renders a box per node in e2e,
        // and so the Status page's cluster resource indicator sums real, non-null usage.
        // Unmatched entries are simply ignored by the by-name join, so listing all four is
        // harmless for either fixture.
        items: [
            {
                metadata: {
                    name: "fake-node-1",
                },
                usage: {
                    // Microcore form (850000u = 850m), as the Metrics API can report.
                    cpu: "850000u",
                    memory: "2097152Ki",
                },
            },
            {
                metadata: {
                    name: "fake-node-2",
                },
                usage: {
                    cpu: "1600000000n",
                    memory: "4194304Ki",
                },
            },
            {
                metadata: {
                    name: "node-cp",
                },
                usage: {
                    cpu: "850000u",
                    memory: "2097152Ki",
                },
            },
            {
                metadata: {
                    name: "node-worker",
                },
                usage: {
                    cpu: "1600000000n",
                    memory: "4194304Ki",
                },
            },
        ],
    },
    // Pod (per-container) usage, keyed for the /apis/metrics.k8s.io/v1beta1/pods endpoint.
    pods: {
        kind: "PodMetricsList",
        apiVersion: "metrics.k8s.io/v1beta1",
        items: [
            {
                metadata: {
                    name: "web",
                    namespace: "default",
                },
                containers: [
                    {
                        name: "nginx",
                        usage: {
                            // Microcore form (120000u = 120m).
                            cpu: "120000u",
                            memory: "262144Ki",
                        },
                    },
                    {
                        name: "sidecar",
                        usage: {
                            // The exact microcore value from the field report ("398u"),
                            // which previously broke the cluster Performance page.
                            cpu: "398u",
                            memory: "65536Ki",
                        },
                    },
                ],
            },
            {
                metadata: {
                    name: "api",
                    namespace: "default",
                },
                containers: [
                    {
                        name: "api",
                        usage: {
                            cpu: "300000000n",
                            memory: "524288Ki",
                        },
                    },
                ],
            },
            {
                metadata: {
                    name: "worker",
                    namespace: "jobs",
                },
                containers: [
                    {
                        name: "worker",
                        usage: {
                            cpu: "450000000n",
                            memory: "393216Ki",
                        },
                    },
                ],
            },
            {
                metadata: {
                    name: "cache",
                    namespace: "infra",
                },
                containers: [
                    {
                        name: "redis",
                        usage: {
                            cpu: "75000000n",
                            memory: "131072Ki",
                        },
                    },
                ],
            },
        ],
    },
};

// Whether the fake-metrics test mode is enabled (KARSE_FAKE_METRICS=1). When on,
// fetchMetrics returns the canned FAKE_METRICS payload instead of shelling out to
// kubectl, so the Performance views can be exercised against clusters with no
// metrics server (e.g. the kwok clusters used in e2e).
export function metricsEnabledFake(): boolean {
    return process.env.KARSE_FAKE_METRICS === "1";
}

// Result of a metrics fetch: data carries the parsed JSON payload; available is
// false when the cluster has no Metrics API rather than the call having errored.
export type MetricsFetchResult = {
    available: boolean;
    data: any;
};

// stderr fragments that signal the Metrics API is simply not installed/available,
// as opposed to a genuine kubectl failure. Matching any of these degrades the fetch
// to available:false so the Provisioning view (requests/limits only) still works.
const METRICS_UNAVAILABLE_MARKERS = [
    "the server could not find the requested resource",
    "metrics.k8s.io",
    "Metrics API not available",
];

// Selects the canned FAKE_METRICS payload that matches a raw metrics path. The nodes
// list is returned for the nodes endpoint; the pods list for any pod metrics path
// (the all-pods list, a namespaced list, or a single pod), which the per-scope methods
// then filter to the scope they need.
function fakeMetricsFor(raw: string): any {
    if (raw.includes("/nodes")) {
        return FAKE_METRICS.nodes;
    }
    return FAKE_METRICS.pods;
}

// Fetches a raw Metrics API resource via "kubectl get --raw <raw>" and returns its
// parsed JSON. A non-zero exit whose stderr names the metrics API being unavailable
// returns { available: false, data: null } rather than throwing, so callers can
// degrade gracefully on clusters without a metrics server. Any other non-zero exit
// throws. Under KARSE_FAKE_METRICS=1 the matching canned payload is returned without
// shelling out. READ-ONLY.
async function fetchMetrics(context: string, raw: string): Promise<MetricsFetchResult> {
    if (metricsEnabledFake()) {
        return {
            available: true,
            data: fakeMetricsFor(raw),
        };
    }
    const result = await kubectl(["--context", context, "get", "--raw", raw]);
    if (result.exitCode !== 0) {
        const unavailable = METRICS_UNAVAILABLE_MARKERS.some((marker) => result.stderr.includes(marker));
        if (unavailable) {
            return {
                available: false,
                data: null,
            };
        }
        throw new Error(result.stderr);
    }
    return {
        available: true,
        data: JSON.parse(result.stdout),
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

// Builds a ResourceUsage from raw CPU and memory quantity strings, parsing CPU to
// millicores and memory to bytes. Either input may be undefined (a spec container
// with no request/limit set, or a metrics entry without one), which yields 0 via
// the quantity parsers' empty-string handling.
function toResourceUsage(cpu: string | undefined, memory: string | undefined): ResourceUsage {
    return {
        cpuMillicores: parseCpuToMillicores(cpu ?? ""),
        memoryBytes: parseMemoryToBytes(memory ?? ""),
    };
}

// A usage reading with both fields null, used when the Metrics API is unavailable.
const NULL_USAGE: ResourceUsage = {
    cpuMillicores: null,
    memoryBytes: null,
};

// Sums a set of ResourceUsage readings field by field. A null field on any input
// is treated as 0 for the sum, but if every input is null for a field the result
// stays null. Used to total per-container requests/limits into a per-pod figure.
function sumUsage(parts: ResourceUsage[]): ResourceUsage {
    let cpu: number | null = null;
    let mem: number | null = null;
    for (const part of parts) {
        if (part.cpuMillicores !== null) {
            cpu = (cpu ?? 0) + part.cpuMillicores;
        }
        if (part.memoryBytes !== null) {
            mem = (mem ?? 0) + part.memoryBytes;
        }
    }
    return {
        cpuMillicores: cpu,
        memoryBytes: mem,
    };
}

// Returns cluster-scoped performance data: per-node usage versus allocatable and
// per-pod usage versus its summed requests and limits. Fetches four sources in
// parallel: node metrics and pod metrics from the raw Metrics API (via fetchMetrics,
// which degrades to available:false on a cluster with no metrics-server), plus node
// and pod specs from kubectl get -o json for allocatable and requests/limits.
//
// metricsAvailable is the AND of the two metrics fetches: when either is unavailable,
// every usage field is null while allocatable, requests, and limits stay populated
// from the specs, so the Provisioning view still renders without a metrics-server.
// READ-ONLY.
export async function getClusterPerformance(context: string): Promise<ClusterPerformance> {
    const ctx = ["--context", context];
    const [nodeMetrics, podMetrics, nodesResult, podsResult] = await Promise.all([
        fetchMetrics(context, "/apis/metrics.k8s.io/v1beta1/nodes"),
        fetchMetrics(context, "/apis/metrics.k8s.io/v1beta1/pods"),
        kubectl([...ctx, "get", "nodes", "-o", "json"]),
        kubectl([...ctx, "get", "pods", "-A", "-o", "json"]),
    ]);
    if (nodesResult.exitCode !== 0) {
        throw new Error(nodesResult.stderr);
    }
    if (podsResult.exitCode !== 0) {
        throw new Error(podsResult.stderr);
    }

    const metricsAvailable = nodeMetrics.available && podMetrics.available;

    // Index node usage by node name from the NodeMetricsList.
    const nodeUsageByName = new Map<string, ResourceUsage>();
    if (metricsAvailable) {
        for (const item of (nodeMetrics.data?.items ?? []) as any[]) {
            const name: string = item.metadata?.name ?? "";
            const usage = item.usage ?? {};
            nodeUsageByName.set(name, toResourceUsage(usage.cpu, usage.memory));
        }
    }

    // Index per-container pod usage by "namespace/name" from the PodMetricsList, so a
    // pod's usage can be summed across its containers and joined to its spec by key.
    const podUsageByKey = new Map<string, Map<string, ResourceUsage>>();
    if (metricsAvailable) {
        for (const item of (podMetrics.data?.items ?? []) as any[]) {
            const ns: string = item.metadata?.namespace ?? "";
            const name: string = item.metadata?.name ?? "";
            const byContainer = new Map<string, ResourceUsage>();
            for (const c of (item.containers ?? []) as any[]) {
                const usage = c.usage ?? {};
                byContainer.set(c.name, toResourceUsage(usage.cpu, usage.memory));
            }
            podUsageByKey.set(`${ns}/${name}`, byContainer);
        }
    }

    // The raw node and pod items, parsed once so they can drive both the typed
    // NodeUsage/PodUsage lists and the health/workload aggregations below.
    const nodeItems: any[] = (nodesResult.stdout ? JSON.parse(nodesResult.stdout).items : []) as any[];
    const podItems: any[] = (podsResult.stdout ? JSON.parse(podsResult.stdout).items : []) as any[];

    // Build per-pod usage joined with requests/limits summed from the spec containers.
    // Built before nodes so each node can sum the requests of the pods scheduled on it.
    const pods: PodUsage[] = podItems.map((item) => {
        const name: string = item.metadata?.name ?? "";
        const namespace: string = item.metadata?.namespace ?? "";
        const node: string = item.spec?.nodeName ?? "";
        const containerUsage = podUsageByKey.get(`${namespace}/${name}`) ?? new Map<string, ResourceUsage>();

        const containers = ((item.spec?.containers ?? []) as any[]).map((c) => {
            const resources = c.resources ?? {};
            const requests = resources.requests ?? {};
            const limits = resources.limits ?? {};
            const usage = metricsAvailable
                ? (containerUsage.get(c.name) ?? NULL_USAGE)
                : NULL_USAGE;
            return {
                name: c.name,
                usage,
                requests: toResourceUsage(requests.cpu, requests.memory),
                limits: toResourceUsage(limits.cpu, limits.memory),
            };
        });

        const podUsage: ResourceUsage = metricsAvailable
            ? sumUsage(containers.map((c) => c.usage))
            : NULL_USAGE;

        return {
            name,
            namespace,
            node,
            usage: podUsage,
            requests: sumUsage(containers.map((c) => c.requests)),
            limits: sumUsage(containers.map((c) => c.limits)),
            containers,
        };
    });

    // Sum each node's reserved requests from the pods scheduled on it (pod.node === name),
    // reusing the per-pod request sums computed above. A node with no scheduled pods sums
    // to zero (empty sumUsage), which is a true figure, not an unknown.
    const requestsByNode = new Map<string, ResourceUsage>();
    for (const pod of pods) {
        if (pod.node === "") {
            continue;
        }
        const existing = requestsByNode.get(pod.node);
        requestsByNode.set(pod.node, existing ? addUsage(existing, pod.requests) : pod.requests);
    }

    // Build per-node usage joined with allocatable from node status and the summed
    // requests of the pods scheduled on it.
    const nodes: NodeUsage[] = nodeItems.map((item) => {
        const name: string = item.metadata?.name ?? "";
        const alloc = item.status?.allocatable ?? {};
        return {
            name,
            usage: metricsAvailable ? (nodeUsageByName.get(name) ?? NULL_USAGE) : NULL_USAGE,
            requests: requestsByNode.get(name) ?? { cpuMillicores: 0, memoryBytes: 0 },
            allocatable: toResourceUsage(alloc.cpu, alloc.memory),
        };
    });

    // Cluster-wide totals: sum node usage, node requests, and node allocatable across
    // every node. Usage stays null when metrics are unavailable (null propagates via
    // sumUsage? — sumUsage treats null as 0, so use addUsage here to keep usage null
    // when any node's usage is null). Requests/allocatable always sum to a number.
    const totals: ClusterResourceTotals = {
        usage: sumNodeField(nodes, "usage", metricsAvailable),
        requests: sumNodeField(nodes, "requests", true),
        allocatable: sumNodeField(nodes, "allocatable", true),
    };

    const workloads = aggregateWorkloads(podItems, pods, metricsAvailable);
    const health = computeHealth(nodeItems, podItems, nodes.length);

    return {
        metricsAvailable,
        nodes,
        pods,
        totals,
        health,
        workloads,
    };
}

// Sums one ResourceUsage field across every node. When populated is false the field is
// returned null (used for usage when the Metrics API is unavailable); otherwise the
// fields are summed with addUsage so a null on any node keeps the total null.
function sumNodeField(
    nodes: NodeUsage[],
    field: "usage" | "requests" | "allocatable",
    populated: boolean,
): ResourceUsage {
    if (!populated) {
        return NULL_USAGE;
    }
    let total: ResourceUsage = { cpuMillicores: 0, memoryBytes: 0 };
    for (const node of nodes) {
        total = addUsage(total, node[field]);
    }
    return total;
}

// Resolves the top-level controller a pod belongs to from its first ownerReference.
// A ReplicaSet owner is rewritten to its parent Deployment by stripping the trailing
// "-<hash>" the ReplicaSet name carries (best-effort, no extra API call). A bare pod
// (no ownerReferences) is its own row with kind "Pod". Returns the grouping key parts.
function resolveWorkloadOwner(podItem: any): { kind: string; name: string; namespace: string } {
    const namespace: string = podItem.metadata?.namespace ?? "";
    const owners: any[] = podItem.metadata?.ownerReferences ?? [];
    const owner = owners[0];
    if (owner === undefined) {
        return { kind: "Pod", name: podItem.metadata?.name ?? "", namespace };
    }
    if (owner.kind === "ReplicaSet") {
        // ReplicaSet names are "<deployment>-<hash>"; drop the last "-<hash>" segment to
        // recover the Deployment name. If there is no hash segment, fall back to the RS.
        const match = /^(.*)-[^-]+$/.exec(owner.name ?? "");
        if (match !== null) {
            return { kind: "Deployment", name: match[1]!, namespace };
        }
    }
    return { kind: owner.kind ?? "", name: owner.name ?? "", namespace };
}

// Groups pods by their top-level controller owner, summing usage and requests per group.
// Rows are sorted by CPU usage descending (nulls last) and capped at 20. podItems and
// the typed pods list are aligned by index (both come from the same kubectl pod list).
function aggregateWorkloads(podItems: any[], pods: PodUsage[], metricsAvailable: boolean): WorkloadUsage[] {
    const groups = new Map<string, WorkloadUsage>();
    for (let i = 0; i < pods.length; i++) {
        const pod = pods[i]!;
        const owner = resolveWorkloadOwner(podItems[i]);
        const key = `${owner.namespace}/${owner.kind}/${owner.name}`;
        const existing = groups.get(key);
        if (existing === undefined) {
            groups.set(key, {
                name: owner.name,
                namespace: owner.namespace,
                kind: owner.kind,
                usage: metricsAvailable ? pod.usage : NULL_USAGE,
                requests: pod.requests,
            });
        }
        else {
            existing.usage = metricsAvailable ? addUsage(existing.usage, pod.usage) : NULL_USAGE;
            existing.requests = addUsage(existing.requests, pod.requests);
        }
    }
    const rows = [...groups.values()];
    rows.sort((a, b) => (b.usage.cpuMillicores ?? -1) - (a.usage.cpuMillicores ?? -1));
    return rows.slice(0, 20);
}

// Computes the cluster health-signal counters from the raw node and pod items.
// pendingPods: pods in the Pending phase. oomKillCount: pods with any container whose
// lastState.terminated.reason is "OOMKilled" (point-in-time). nodePressure: nodes whose
// MemoryPressure/DiskPressure/PIDPressure condition is "True". cpuThrottlingAvailable is
// always false (kubectl cannot expose CPU throttling).
function computeHealth(nodeItems: any[], podItems: any[], nodeCount: number): ClusterHealthSignals {
    let pendingPods = 0;
    let oomKillCount = 0;
    for (const pod of podItems) {
        if (pod.status?.phase === "Pending") {
            pendingPods++;
        }
        const statuses: any[] = [
            ...(pod.status?.containerStatuses ?? []),
            ...(pod.status?.initContainerStatuses ?? []),
        ];
        if (statuses.some((cs) => cs.lastState?.terminated?.reason === "OOMKilled")) {
            oomKillCount++;
        }
    }

    let memoryPressure = 0;
    let diskPressure = 0;
    let pidPressure = 0;
    for (const node of nodeItems) {
        for (const condition of (node.status?.conditions ?? []) as any[]) {
            if (condition.status !== "True") {
                continue;
            }
            if (condition.type === "MemoryPressure") {
                memoryPressure++;
            }
            else if (condition.type === "DiskPressure") {
                diskPressure++;
            }
            else if (condition.type === "PIDPressure") {
                pidPressure++;
            }
        }
    }

    return {
        pendingPods,
        oomKillCount,
        nodeCount,
        nodePressure: { memoryPressure, diskPressure, pidPressure },
        cpuThrottlingAvailable: false,
    };
}

// Parses a {cpu, memory} quantity pair (as the Metrics API and pod specs report it)
// into a ResourceUsage. A missing field parses as the quantity parsers' empty-string
// result (0), keeping requests/limits arithmetic on plain numbers.
function parseUsage(raw: { cpu?: string; memory?: string } | undefined): ResourceUsage {
    return {
        cpuMillicores: parseCpuToMillicores(raw?.cpu ?? ""),
        memoryBytes: parseMemoryToBytes(raw?.memory ?? ""),
    };
}

// Sums two ResourceUsage values field-by-field. Used to roll per-container requests,
// limits, and usage up to the pod level. Treats null as "unknown": if either side is
// null the summed field stays null rather than silently dropping to the other value.
function addUsage(a: ResourceUsage, b: ResourceUsage): ResourceUsage {
    return {
        cpuMillicores: a.cpuMillicores === null || b.cpuMillicores === null
            ? null
            : a.cpuMillicores + b.cpuMillicores,
        memoryBytes: a.memoryBytes === null || b.memoryBytes === null
            ? null
            : a.memoryBytes + b.memoryBytes,
    };
}

// Builds a name -> per-container-usage map from a Metrics API pod list, keyed by
// "<namespace>/<name>". Each container's usage is parsed from nanocore/Ki strings into
// the canonical millicore/byte units. When metrics are unavailable the map is empty,
// so every container falls back to NULL_USAGE.
function indexPodMetrics(metricsData: any): Map<string, Map<string, ResourceUsage>> {
    const byPod = new Map<string, Map<string, ResourceUsage>>();
    for (const item of (metricsData?.items ?? []) as any[]) {
        const ns: string = item.metadata?.namespace ?? "";
        const name: string = item.metadata?.name ?? "";
        const byContainer = new Map<string, ResourceUsage>();
        for (const container of (item.containers ?? []) as any[]) {
            byContainer.set(container.name, parseUsage(container.usage));
        }
        byPod.set(`${ns}/${name}`, byContainer);
    }
    return byPod;
}

// Builds a PodUsage from a raw pod item (kubectl get pods -o json) joined with the
// per-container usage looked up from the Metrics API. Requests and limits come from the
// pod spec and are always populated; per-container usage is NULL_USAGE when metrics are
// unavailable or a container has no metrics entry. The per-container ContainerUsage list
// is retained on the PodUsage (used by the node treemap's pod -> container level), and
// the pod-level usage/requests/limits are the sum across containers.
function buildPodUsage(
    podItem: any,
    metricsAvailable: boolean,
    containerUsageByPod: Map<string, Map<string, ResourceUsage>>,
): PodUsage {
    const namespace: string = podItem.metadata?.namespace ?? "";
    const name: string = podItem.metadata?.name ?? "";
    const node: string = podItem.spec?.nodeName ?? "";
    const usageForContainer = containerUsageByPod.get(`${namespace}/${name}`) ?? new Map();

    const containers: ContainerUsage[] = ((podItem.spec?.containers ?? []) as any[]).map((spec) => {
        const requests = parseUsage(spec.resources?.requests);
        const limits = parseUsage(spec.resources?.limits);
        const usage = metricsAvailable
            ? (usageForContainer.get(spec.name) ?? NULL_USAGE)
            : NULL_USAGE;
        return {
            name: spec.name,
            usage,
            requests,
            limits,
        };
    });

    // Roll the per-container values up to the pod. Usage starts from a zeroed pair when
    // metrics are available (so containers sum cleanly) and from NULL_USAGE when they are
    // not (so the pod-level usage stays null rather than a false zero).
    let usage: ResourceUsage = metricsAvailable ? { cpuMillicores: 0, memoryBytes: 0 } : NULL_USAGE;
    let requests: ResourceUsage = { cpuMillicores: 0, memoryBytes: 0 };
    let limits: ResourceUsage = { cpuMillicores: 0, memoryBytes: 0 };
    for (const container of containers) {
        usage = addUsage(usage, container.usage);
        requests = addUsage(requests, container.requests);
        limits = addUsage(limits, container.limits);
    }

    return {
        name,
        namespace,
        node,
        usage,
        requests,
        limits,
        containers,
    };
}

// Returns a node-scoped point-in-time performance snapshot: the one node's usage joined
// with its allocatable capacity, plus the pods scheduled on it with per-container usage.
// Fetches in parallel the node metrics (all-nodes raw endpoint, filtered to this node),
// the node object (for allocatable), the pod metrics (all-pods raw endpoint), and the
// pods scheduled on the node (field-selector get). When the Metrics API is unavailable
// (a cluster with no metrics-server, e.g. kwok), metricsAvailable is false, usage fields
// are null, and requests/limits are still populated from the pod specs so the
// provisioning view keeps working. READ-ONLY.
export async function getNodePerformance(context: string, name: string): Promise<NodePerformance> {
    const ctx = ["--context", context];
    const [nodeMetrics, nodeResult, podMetrics, podsResult] = await Promise.all([
        fetchMetrics(context, "/apis/metrics.k8s.io/v1beta1/nodes"),
        kubectl([...ctx, "get", "node", name, "-o", "json"]),
        fetchMetrics(context, "/apis/metrics.k8s.io/v1beta1/pods"),
        kubectl([...ctx, "get", "pods", "-A", `--field-selector=spec.nodeName=${name}`, "-o", "json"]),
    ]);
    if (nodeResult.exitCode !== 0) {
        throw new Error(nodeResult.stderr);
    }
    if (podsResult.exitCode !== 0) {
        throw new Error(podsResult.stderr);
    }

    // The Metrics API is available only when both metrics reads succeeded; either being
    // unavailable degrades the whole snapshot to usage-null + requests/limits-only.
    const metricsAvailable = nodeMetrics.available && podMetrics.available;

    // Node usage from the node metrics list, scoped to the named node. Absent (or
    // unavailable) metrics leave usage null; allocatable always comes from node status.
    const nodeItem = JSON.parse(nodeResult.stdout);
    const alloc = nodeItem.status?.allocatable ?? {};
    const allocatable: ResourceUsage = {
        cpuMillicores: parseCpuToMillicores(alloc.cpu ?? ""),
        memoryBytes: parseMemoryToBytes(alloc.memory ?? ""),
    };
    let nodeUsage: ResourceUsage = NULL_USAGE;
    if (metricsAvailable) {
        const metricsItem = ((nodeMetrics.data?.items ?? []) as any[]).find(
            (item) => item.metadata?.name === name,
        );
        nodeUsage = metricsItem ? parseUsage(metricsItem.usage) : NULL_USAGE;
    }
    const node: NodeUsage = {
        name,
        usage: nodeUsage,
        // Pod-request sum for the node is computed by resource-utilization-2; null until then.
        requests: NULL_USAGE,
        allocatable,
    };

    const containerUsageByPod = metricsAvailable
        ? indexPodMetrics(podMetrics.data)
        : new Map<string, Map<string, ResourceUsage>>();
    const pods: PodUsage[] = ((JSON.parse(podsResult.stdout).items ?? []) as any[]).map((item) =>
        buildPodUsage(item, metricsAvailable, containerUsageByPod),
    );

    // The node's reserved requests are the sum of the requests of the pods scheduled on
    // it (the field selector already scoped the pods to this node). A node with no pods
    // sums to zero, a true figure rather than an unknown.
    node.requests = sumUsage(pods.map((p) => p.requests));

    return {
        metricsAvailable,
        node,
        pods,
    };
}

// Returns the pod-scoped (leaf) performance snapshot for a single pod: the pod's
// per-container usage joined with each container's requests/limits from its spec.
// Fetches the pod's own metrics (the namespaced single-pod metrics endpoint) and the
// pod spec in parallel. metricsAvailable is false when the cluster has no Metrics API
// (the metrics fetch degrades rather than throwing); usage fields are then null while
// requests/limits remain populated from the spec, so the Provisioning view still works.
// READ-ONLY.
export async function getPodPerformance(
    context: string,
    namespace: string,
    name: string,
): Promise<PodPerformance> {
    const [metricsResult, podResult] = await Promise.all([
        fetchMetrics(context, `/apis/metrics.k8s.io/v1beta1/namespaces/${namespace}/pods/${name}`),
        kubectl(["--context", context, "-n", namespace, "get", "pod", name, "-o", "json"]),
    ]);
    if (podResult.exitCode !== 0) {
        throw new Error(podResult.stderr);
    }
    const pod = JSON.parse(podResult.stdout);
    const node: string = pod.spec?.nodeName ?? "";
    const specContainers: any[] = pod.spec?.containers ?? [];
    const metricsAvailable = metricsResult.available;

    // Index per-container usage by container name. The real single-pod metrics endpoint
    // returns one PodMetrics object with a containers[] array. The fake-metrics payload
    // is the shared PodMetricsList, so when items[] is present (no top-level containers)
    // pick the matching pod from the list by name. Either way, map names to usage so each
    // spec container can be joined to its reading (absent when metrics are off).
    const usageByContainer = new Map<string, any>();
    if (metricsAvailable && metricsResult.data !== null) {
        let metricContainers: any[] = metricsResult.data.containers ?? [];
        if (metricContainers.length === 0 && Array.isArray(metricsResult.data.items)) {
            const match = metricsResult.data.items.find((p: any) => p.metadata?.name === name);
            metricContainers = match?.containers ?? [];
        }
        for (const mc of metricContainers) {
            usageByContainer.set(mc.name, mc.usage);
        }
    }

    // One ContainerUsage per spec container: its usage reading joined with the
    // requests/limits declared in the spec. Spec order is preserved. Usage is null
    // when metrics are unavailable or this container has no reading; requests/limits
    // come from the spec (absent blocks yield zeroes via the quantity parsers).
    const containers: ContainerUsage[] = specContainers.map((c) => {
        const usage = usageByContainer.get(c.name);
        const requests = c.resources?.requests ?? {};
        const limits = c.resources?.limits ?? {};
        return {
            name: c.name,
            usage: metricsAvailable && usage
                ? toResourceUsage(usage.cpu, usage.memory)
                : NULL_USAGE,
            requests: toResourceUsage(requests.cpu, requests.memory),
            limits: toResourceUsage(limits.cpu, limits.memory),
        };
    });

    // Pod totals: sum the per-container usage, requests, and limits.
    const podUsage: PodUsage = {
        name: pod.metadata.name,
        namespace: pod.metadata.namespace,
        node,
        usage: metricsAvailable ? sumUsage(containers.map((c) => c.usage)) : NULL_USAGE,
        requests: sumUsage(containers.map((c) => c.requests)),
        limits: sumUsage(containers.map((c) => c.limits)),
        containers,
    };

    // The pod's scheduling node, so the UI can show the pod's percentage of the node it
    // runs on (pod usage ÷ node allocatable). allocatable comes from node status; node
    // usage from the node metrics list (null when metrics are unavailable). An unscheduled
    // pod (no spec.nodeName) or a failed node read yields null, so the percentage degrades
    // to "—" rather than fabricating a denominator. READ-ONLY.
    const nodeUsage = node !== "" ? await fetchPodSchedulingNode(context, node, metricsAvailable) : null;

    return {
        metricsAvailable,
        pod: podUsage,
        containers,
        node: nodeUsage,
    };
}

// Reads the pod's scheduling node as a NodeUsage: its allocatable from node status and its
// usage from the node metrics list (null usage when metrics are unavailable). Returns null
// when the node object cannot be read, so a failed read degrades the pod's percentage-of-
// node to "—" rather than throwing the whole pod-performance request. READ-ONLY.
async function fetchPodSchedulingNode(
    context: string,
    name: string,
    metricsAvailable: boolean,
): Promise<NodeUsage | null> {
    const ctx = ["--context", context];
    const [nodeResult, nodeMetrics] = await Promise.all([
        kubectl([...ctx, "get", "node", name, "-o", "json"]),
        fetchMetrics(context, "/apis/metrics.k8s.io/v1beta1/nodes"),
    ]);
    if (nodeResult.exitCode !== 0) {
        return null;
    }
    const nodeItem = JSON.parse(nodeResult.stdout);
    const alloc = nodeItem.status?.allocatable ?? {};
    const allocatable: ResourceUsage = {
        cpuMillicores: parseCpuToMillicores(alloc.cpu ?? ""),
        memoryBytes: parseMemoryToBytes(alloc.memory ?? ""),
    };
    let usage: ResourceUsage = NULL_USAGE;
    if (metricsAvailable && nodeMetrics.available) {
        const metricsItem = ((nodeMetrics.data?.items ?? []) as any[]).find(
            (item) => item.metadata?.name === name,
        );
        usage = metricsItem ? parseUsage(metricsItem.usage) : NULL_USAGE;
    }
    return { name, usage, requests: NULL_USAGE, allocatable };
}
