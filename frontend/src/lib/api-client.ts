import axios from "axios";
import { LOAD_TIMEOUT_MS, loadErrorMessage } from "./load-error";
import type {
    ContextsResponse, ClusterOverview, Node, NamespacesResponse, PodsResponse,
    DeploymentsResponse, StatefulSetsResponse, DaemonSetsResponse,
    WorkloadKind, WorkloadDetail, NamespaceDetail,
    PodDetail, NodeDetail, YamlResourceType, YamlResponse,
    LogStreamLine, LogStreamStarted, EventsResponse, ErrorsResponse,
    SternStreamLine, SternStreamStarted, ClusterPerformance, NodePerformance,
    PodPerformance,
} from "karse-types";

// Every data request times out after LOAD_TIMEOUT_MS. When the cluster is
// unreachable (VPN/internet down) the request aborts at the timeout and surfaces a
// connectivity error instead of leaving the page spinning forever.
const http = axios.create({
    baseURL: "/api",
    headers: { "Content-Type": "application/json" },
    timeout: LOAD_TIMEOUT_MS,
});

http.interceptors.response.use(
    (response) => response,
    (error) => {
        // A server that replied with an error keeps its own message; a timeout or
        // unreachable cluster becomes a connectivity error carrying the VPN/internet hint.
        const serverMessage = error.response?.data?.error ?? error.response?.statusText;
        throw new Error(serverMessage ?? loadErrorMessage(error));
    }
);

export async function fetchContexts(): Promise<ContextsResponse> {
    const response = await http.get<ContextsResponse>("/contexts");
    return response.data;
}

export async function switchContext(name: string): Promise<ContextsResponse> {
    const response = await http.post<ContextsResponse>("/contexts/current", { name });
    return response.data;
}

export async function fetchClusterOverview(context: string): Promise<ClusterOverview> {
    const response = await http.get<ClusterOverview>("/cluster/overview", { params: { context } });
    return response.data;
}

// Fetches the cluster-scoped performance snapshot (per-node usage versus allocatable
// and per-pod usage versus requests/limits) for the given context. metricsAvailable
// is false when the cluster has no Metrics API; usage fields are then null while
// requests/limits stay populated.
export async function fetchClusterPerformance(context: string): Promise<ClusterPerformance> {
    const response = await http.get<ClusterPerformance>("/cluster/performance", { params: { context } });
    return response.data;
}

export async function fetchNodes(context: string): Promise<{ nodes: Node[] }> {
    const response = await http.get<{ nodes: Node[] }>("/cluster/nodes", { params: { context } });
    return response.data;
}

// Fetches the list of namespaces in the cluster for the given context.
export async function fetchNamespaces(context: string): Promise<NamespacesResponse> {
    const response = await http.get<NamespacesResponse>("/namespaces", { params: { context } });
    return response.data;
}

// Fetches the full detail for a single namespace including its phase, labels,
// annotations, contained resources, quotas, and limit ranges.
export async function fetchNamespaceDetail(context: string, name: string): Promise<NamespaceDetail> {
    const response = await http.get<NamespaceDetail>(`/namespaces/${name}`, { params: { context } });
    return response.data;
}

// Sets the default namespace for the given context in the local kubeconfig.
export async function setGlobalNamespace(context: string, namespace: string | null): Promise<void> {
    await http.post("/namespaces/default", { context, namespace: namespace ?? "" });
}

// Fetches pods for the given context. Pass namespace to scope to one namespace,
// or omit to fetch all pods across all namespaces.
export async function fetchPods(context: string, namespace?: string): Promise<PodsResponse> {
    const params: Record<string, string> = { context };
    if (namespace) {
        params.namespace = namespace;
    }
    const response = await http.get<PodsResponse>("/pods", { params });
    return response.data;
}

// Fetches deployments for the given context, optionally scoped to a namespace.
export async function fetchDeployments(context: string, namespace?: string): Promise<DeploymentsResponse> {
    const params: Record<string, string> = { context };
    if (namespace) {
        params.namespace = namespace;
    }
    const response = await http.get<DeploymentsResponse>("/deployments", { params });
    return response.data;
}

// Fetches stateful sets for the given context, optionally scoped to a namespace.
export async function fetchStatefulSets(context: string, namespace?: string): Promise<StatefulSetsResponse> {
    const params: Record<string, string> = { context };
    if (namespace) {
        params.namespace = namespace;
    }
    const response = await http.get<StatefulSetsResponse>("/statefulsets", { params });
    return response.data;
}

// Fetches daemon sets for the given context, optionally scoped to a namespace.
export async function fetchDaemonSets(context: string, namespace?: string): Promise<DaemonSetsResponse> {
    const params: Record<string, string> = { context };
    if (namespace) {
        params.namespace = namespace;
    }
    const response = await http.get<DaemonSetsResponse>("/daemonsets", { params });
    return response.data;
}

// Fetches Kubernetes events for the given context. Pass namespace to scope to one
// namespace, or omit to fetch events across all namespaces.
export async function fetchEvents(context: string, namespace?: string): Promise<EventsResponse> {
    const params: Record<string, string> = { context };
    if (namespace) {
        params.namespace = namespace;
    }
    const response = await http.get<EventsResponse>("/events", { params });
    return response.data;
}

// Fetches the cluster error conditions (Warning events and problem pods) for the
// given context. Pass namespace to scope to one namespace, or omit for all namespaces.
export async function fetchErrors(context: string, namespace?: string): Promise<ErrorsResponse> {
    const params: Record<string, string> = { context };
    if (namespace) {
        params.namespace = namespace;
    }
    const response = await http.get<ErrorsResponse>("/errors", { params });
    return response.data;
}

// Fetches the full detail for a single pod including containers and events.
export async function fetchPodDetail(context: string, namespace: string, name: string): Promise<PodDetail> {
    const response = await http.get<PodDetail>(`/pods/${namespace}/${name}`, { params: { context } });
    return response.data;
}

// Fetches the tail of a pod container's logs. Defaults to the last 100 lines.
export async function fetchPodLogs(
    context: string,
    namespace: string,
    name: string,
    container?: string,
    tail: number = 100,
): Promise<{ logs: string }> {
    const params: Record<string, string | number> = { context, tail };
    if (container) params.container = container;
    const response = await http.get<{ logs: string }>(`/pods/${namespace}/${name}/logs`, { params });
    return response.data;
}

// Handle for an open live log stream; call close() to stop streaming.
export type LogStreamHandle = { close: () => void };

// Callbacks delivering incremental output from a live log stream. onEnd fires once
// when the backend signals the stream has finished (its `kubectl logs -f` exited),
// so the caller can fall back from live mode to a static snapshot.
export type LogStreamHandlers = {
    onLine: (line: string) => void;
    onError: (message: string) => void;
    onEnd?: () => void;
};

// Opens a live (follow) log stream for a pod container via Server-Sent Events.
// Each incoming log line is delivered through onLine as it arrives; onError fires on
// transport or kubectl failures. Returns a handle whose close() ends the stream and
// closes the underlying connection (which the backend uses to stop `kubectl logs -f`).
export function streamPodLogs(
    context: string,
    namespace: string,
    name: string,
    container: string | undefined,
    tail: number,
    handlers: LogStreamHandlers,
): LogStreamHandle {
    const params = new URLSearchParams({ context, tail: String(tail) });
    if (container)
    {
        params.set("container", container);
    }
    const url = `/api/pods/${namespace}/${name}/logs/stream?${params.toString()}`;
    const source = new EventSource(url);

    source.onmessage = (event) => {
        handlers.onLine(event.data);
    };
    source.addEventListener("error", (event) => {
        const data = (event as MessageEvent).data;
        if (typeof data === "string" && data !== "")
        {
            handlers.onError(data);
        }
        else if (source.readyState === EventSource.CLOSED)
        {
            handlers.onError("Log stream disconnected");
        }
        source.close();
    });
    source.addEventListener("end", () => {
        source.close();
        handlers.onEnd?.();
    });

    return {
        close: () => {
            source.close();
        },
    };
}

// Fetches the full detail for a single node including conditions, capacity, and scheduled pods.
export async function fetchNodeDetail(context: string, name: string): Promise<NodeDetail> {
    const response = await http.get<NodeDetail>(`/nodes/${name}`, { params: { context } });
    return response.data;
}

// Fetches the node-scoped performance snapshot (the node's usage versus allocatable
// plus the pods scheduled on it, each with its usage versus requests/limits and its
// containers) for the given context. metricsAvailable is false when the cluster has no
// Metrics API; usage fields are then null while requests/limits stay populated.
export async function fetchNodePerformance(context: string, name: string): Promise<NodePerformance> {
    const response = await http.get<NodePerformance>(`/nodes/${name}/performance`, { params: { context } });
    return response.data;
}

// Fetches the pod-scoped (leaf) performance snapshot (the pod's per-container usage
// joined with each container's requests and limits from the pod spec) for the given
// context. metricsAvailable is false when the cluster has no Metrics API; usage fields
// are then null while requests/limits stay populated from the spec.
export async function fetchPodPerformance(context: string, namespace: string, name: string): Promise<PodPerformance> {
    const response = await http.get<PodPerformance>(`/pods/${namespace}/${name}/performance`, { params: { context } });
    return response.data;
}

// Fetches the full detail for a single deployment, stateful set, or daemon set,
// including its status counters, selected pods, and events.
export async function fetchWorkloadDetail(context: string, kind: WorkloadKind, namespace: string, name: string): Promise<WorkloadDetail> {
    const response = await http.get<WorkloadDetail>(`/${kind}/${namespace}/${name}`, { params: { context } });
    return response.data;
}

// Fetches the raw YAML for a single resource. namespace is omitted for cluster-scoped
// resources (nodes, namespaces) and supplied for namespaced ones.
export async function fetchResourceYaml(
    context: string,
    type: YamlResourceType,
    name: string,
    namespace?: string,
): Promise<YamlResponse> {
    const params: Record<string, string> = { context };
    if (namespace) {
        params.namespace = namespace;
    }
    const response = await http.get<YamlResponse>(`/yaml/${type}/${name}`, { params });
    return response.data;
}

// Callbacks for the multi-pod live log stream consumed via Server-Sent Events.
export type LogStreamCallbacks = {
    onStarted: (started: LogStreamStarted) => void;
    onLine: (line: LogStreamLine) => void;
    onError: (message: string) => void;
};

// Opens a Server-Sent Events connection to GET /api/logs/stream and dispatches
// each event to the callbacks. When `pods` lists one or more pod names, exactly
// those pods are streamed (the picker's explicit checkbox selection); otherwise
// the wildcard/substring `filter` chooses which of the namespace's pods to stream
// from. Returns a function that closes the stream (terminating the backend
// kubectl processes via the request-close handler).
export function openLogStream(
    context: string,
    namespace: string | undefined,
    pods: string[],
    filter: string,
    tail: number,
    callbacks: LogStreamCallbacks,
): () => void {
    const params = new URLSearchParams({ context, filter, tail: String(tail) });
    if (namespace) {
        params.set("namespace", namespace);
    }
    for (const pod of pods) {
        params.append("pods", pod);
    }
    const source = new EventSource(`/api/logs/stream?${params.toString()}`);

    source.addEventListener("started", (e: MessageEvent) => {
        callbacks.onStarted(JSON.parse(e.data));
    });
    source.addEventListener("line", (e: MessageEvent) => {
        callbacks.onLine(JSON.parse(e.data));
    });
    source.addEventListener("error", (e: MessageEvent) => {
        const data = e.data;
        if (typeof data === "string" && data !== "") {
            const parsed = JSON.parse(data);
            callbacks.onError(parsed.message ?? "stream error");
        }
    });

    return () => {
        source.close();
    };
}

// Callbacks for the stern live log stream consumed via Server-Sent Events.
// onUnavailable fires when the backend reports that `stern` is not installed, so
// the page can show install instructions instead of treating it as an error.
export type SternStreamCallbacks = {
    onStarted: (started: SternStreamStarted) => void;
    onLine: (line: SternStreamLine) => void;
    onUnavailable: () => void;
    onError: (message: string) => void;
};

// Opens a Server-Sent Events connection to GET /api/stern/stream and dispatches
// each event to the callbacks. Streams live logs from every pod matching the
// query (substring/wildcard/regex) in the given context and namespace scope,
// using the backend's real `stern` process. Returns a function that closes the
// stream (terminating the backend stern process via the request-close handler).
export function openSternStream(
    context: string,
    namespace: string | undefined,
    query: string,
    tail: number,
    callbacks: SternStreamCallbacks,
): () => void {
    const params = new URLSearchParams({ context, query, tail: String(tail) });
    if (namespace) {
        params.set("namespace", namespace);
    }
    const source = new EventSource(`/api/stern/stream?${params.toString()}`);

    source.addEventListener("unavailable", () => {
        callbacks.onUnavailable();
        source.close();
    });
    source.addEventListener("started", (e: MessageEvent) => {
        callbacks.onStarted(JSON.parse(e.data));
    });
    source.addEventListener("line", (e: MessageEvent) => {
        callbacks.onLine(JSON.parse(e.data));
    });
    source.addEventListener("error", (e: MessageEvent) => {
        const data = e.data;
        if (typeof data === "string" && data !== "") {
            const parsed = JSON.parse(data);
            callbacks.onError(parsed.message ?? "stream error");
        }
    });

    return () => {
        source.close();
    };
}
