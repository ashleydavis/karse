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
    ready: string;          // e.g. "2/3"
    containerCount: number; // number of (non-init) containers in the pod spec
    restarts: number;
    createdAt: string;      // ISO timestamp
    node: string;
};

// Response body for GET /api/pods.
export type PodsResponse = {
    pods: Pod[];
};

// A single Kubernetes deployment in the active cluster.
export type Deployment = {
    name: string;
    namespace: string;
    ready: string;       // e.g. "2/3"
    upToDate: number;
    available: number;
    createdAt: string;
};

// Response body for GET /api/deployments.
export type DeploymentsResponse = {
    deployments: Deployment[];
};

// A single Kubernetes stateful set in the active cluster.
export type StatefulSet = {
    name: string;
    namespace: string;
    ready: string;       // e.g. "2/3"
    createdAt: string;
};

// Response body for GET /api/statefulsets.
export type StatefulSetsResponse = {
    statefulSets: StatefulSet[];
};

// A single Kubernetes daemon set in the active cluster.
export type DaemonSet = {
    name: string;
    namespace: string;
    desired: number;
    current: number;
    ready: number;
    upToDate: number;
    available: number;
    createdAt: string;
};

// Response body for GET /api/daemonsets.
export type DaemonSetsResponse = {
    daemonSets: DaemonSet[];
};

// The lifecycle state of a container within a pod.
export type ContainerState = "Running" | "Waiting" | "Terminated" | "Unknown";

// Status and image information for a single container within a pod.
export type ContainerInfo = {
    name: string;
    image: string;
    ready: boolean;
    restarts: number;
    state: ContainerState;
    stateReason: string;
};

// A single event associated with a Kubernetes resource.
export type KubeEvent = {
    type: "Normal" | "Warning";
    reason: string;
    message: string;
    count: number;
    lastSeen: string;
};

// Detailed view of a single pod, returned by GET /api/pods/:namespace/:name.
export type PodDetail = {
    name: string;
    namespace: string;
    phase: PodPhase;
    node: string;
    podIP: string;
    createdAt: string;
    labels: Record<string, string>;
    containers: ContainerInfo[];
    initContainers: ContainerInfo[];
    events: KubeEvent[];
};

// A single condition reported by a node's status.
export type NodeCondition = {
    type: string;
    status: "True" | "False" | "Unknown";
    message: string;
    lastTransition: string;
};

// An IP or hostname address exposed by a node.
export type NodeAddress = {
    type: string;
    address: string;
};

// CPU, memory, and pod counts for a node's capacity or allocatable resources.
export type ResourceAmounts = {
    cpu: string;
    memory: string;
    pods: string;
};

// Detailed view of a single node, returned by GET /api/nodes/:name.
export type NodeDetail = {
    name: string;
    status: NodeStatus;
    roles: string[];
    version: string;
    createdAt: string;
    conditions: NodeCondition[];
    capacity: ResourceAmounts;
    allocatable: ResourceAmounts;
    addresses: NodeAddress[];
    labels: Record<string, string>;
    pods: Pod[];
};
