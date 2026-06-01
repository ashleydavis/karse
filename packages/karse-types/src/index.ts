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

// A cluster- or namespace-wide Kubernetes event, returned by GET /api/events.
// Richer than KubeEvent: includes the involved object and namespace so events
// from many resources can be displayed together in a single table.
export type ClusterEvent = {
    type: "Normal" | "Warning";
    reason: string;
    message: string;
    count: number;
    lastSeen: string;       // ISO timestamp; UI computes age
    namespace: string;
    objectKind: string;     // involvedObject.kind, e.g. "Pod"
    objectName: string;     // involvedObject.name
};

// Response body for GET /api/events.
export type EventsResponse = {
    events: ClusterEvent[];
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

// A single aggregated log line streamed from the multi-pod live logs endpoint.
// Carried by the "line" Server-Sent Event from GET /api/logs/stream.
export type LogStreamLine = {
    namespace: string;
    pod: string;
    line: string;
};

// The set of pods a live log stream attached to, carried by the "started" event.
export type LogStreamStarted = {
    pods: Array<{ namespace: string; name: string }>;
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
    events: KubeEvent[];
};

// The workload kinds that have a drill-down detail page.
// Matches the URL/UI type tokens used for routing and YAML fetches.
export type WorkloadKind = "deployments" | "statefulsets" | "daemonsets";

// A single named status counter shown on a workload detail page (e.g. "Ready" -> "2/3").
export type WorkloadStat = {
    label: string;
    value: string;
};

// Detailed view of a single deployment, stateful set, or daemon set,
// returned by GET /api/:kind/:namespace/:name (kind one of WorkloadKind).
// Holds the common metadata plus a kind-specific set of status counters and
// the pods selected by the workload, so the detail page can render uniformly.
export type WorkloadDetail = {
    kind: WorkloadKind;
    name: string;
    namespace: string;
    createdAt: string;
    labels: Record<string, string>;
    selector: Record<string, string>;
    stats: WorkloadStat[];
    pods: Pod[];
    events: KubeEvent[];
};

// The resource types whose raw YAML can be viewed in the dashboard.
export type YamlResourceType =
    "nodes" | "pods" | "deployments" | "daemonsets" | "statefulsets" | "namespaces";

// Response body for GET /api/yaml/:type/:name.
export type YamlResponse = {
    yaml: string;
};
