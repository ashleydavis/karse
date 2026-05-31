import axios from "axios";
import type {
    ContextsResponse, ClusterOverview, Node, NamespacesResponse, PodsResponse,
    DeploymentsResponse, StatefulSetsResponse, DaemonSetsResponse,
    PodDetail, NodeDetail, LogStreamLine, LogStreamStarted,
} from "karse-types";

const http = axios.create({ baseURL: "/api", headers: { "Content-Type": "application/json" } });

http.interceptors.response.use(
    (response) => response,
    (error) => {
        const response = error.response;
        throw new Error(response?.data?.error ?? response?.statusText ?? "Unknown error");
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

export async function fetchNodes(context: string): Promise<{ nodes: Node[] }> {
    const response = await http.get<{ nodes: Node[] }>("/cluster/nodes", { params: { context } });
    return response.data;
}

// Fetches the list of namespaces in the cluster for the given context.
export async function fetchNamespaces(context: string): Promise<NamespacesResponse> {
    const response = await http.get<NamespacesResponse>("/namespaces", { params: { context } });
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

// Fetches the full detail for a single node including conditions, capacity, and scheduled pods.
export async function fetchNodeDetail(context: string, name: string): Promise<NodeDetail> {
    const response = await http.get<NodeDetail>(`/nodes/${name}`, { params: { context } });
    return response.data;
}

// Callbacks for the multi-pod live log stream consumed via Server-Sent Events.
export type LogStreamCallbacks = {
    onStarted: (started: LogStreamStarted) => void;
    onLine: (line: LogStreamLine) => void;
    onError: (message: string) => void;
};

// Opens a Server-Sent Events connection to GET /api/logs/stream and dispatches
// each event to the callbacks. Streams pod-prefixed live logs from every pod in
// the given context that matches the namespace scope and wildcard/substring
// filter. Returns a function that closes the stream (terminating the backend
// kubectl processes via the request-close handler).
export function openLogStream(
    context: string,
    namespace: string | undefined,
    filter: string,
    tail: number,
    callbacks: LogStreamCallbacks,
): () => void {
    const params = new URLSearchParams({ context, filter, tail: String(tail) });
    if (namespace) {
        params.set("namespace", namespace);
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
