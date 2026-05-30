export type Context = {
    name: string;
    cluster: string;
    user: string;
    namespace: string | null;
};

export type ContextsResponse = {
    contexts: Context[];
    current: string | null;
};

export type NodeStatus = "Ready" | "NotReady" | "Unknown";

export type Node = {
    name: string;
    status: NodeStatus;
    roles: string[];           // empty array means "<none>"
    version: string;           // kubeletVersion
    createdAt: string;         // ISO timestamp; UI computes age
};

export type ClusterOverview = {
    serverVersion: string | null;   // null if cluster unreachable
    clientVersion: string | null;
    nodeCount: number;
    readyNodeCount: number;
    namespaceCount: number;
    podCount: number;
    runningPodCount: number;
    pendingPodCount: number;
    failedPodCount: number;
};

// A single Kubernetes namespace in the active cluster.
export type Namespace = {
    name: string;
};

// Response body for GET /api/namespaces.
export type NamespacesResponse = {
    namespaces: Namespace[];
};

export type PodPhase = "Running" | "Pending" | "Succeeded" | "Failed" | "Unknown";

export type Pod = {
    name: string;
    namespace: string;
    phase: PodPhase;
    ready: string;      // e.g. "2/3"
    restarts: number;
    createdAt: string;  // ISO timestamp
    node: string;
};

// Response body for GET /api/pods.
export type PodsResponse = {
    pods: Pod[];
};
