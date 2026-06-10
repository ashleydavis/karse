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
    labels: Record<string, string>;  // metadata.labels; empty object when none
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
    // Count of currently-active error conditions in the cluster: Warning-type
    // events plus pods in a known problem state, matching the Errors feed's
    // definition. See docs/spec/cluster-overview.
    errorCount: number;
};

// A single Kubernetes namespace in the active cluster.
// resourceCount is the number of pods in the namespace, or null when the count
// could not be determined (the pod query failed) so the table still renders.
export type Namespace = {
    name: string;
    labels: Record<string, string>;  // metadata.labels; empty object when none
    resourceCount: number | null;
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
    labels: Record<string, string>;  // metadata.labels; empty object when none
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
    labels: Record<string, string>;  // metadata.labels; empty object when none
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
    labels: Record<string, string>;  // metadata.labels; empty object when none
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
    labels: Record<string, string>;  // metadata.labels; empty object when none
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
    uid: string;            // metadata.uid; stable identifier for the detail route
    type: "Normal" | "Warning";
    reason: string;
    message: string;
    count: number;
    source: string;         // reporting component, e.g. "kubelet" ("" when unknown)
    firstSeen: string;      // ISO timestamp of the first occurrence ("" when unknown)
    lastSeen: string;       // ISO timestamp; UI computes age
    namespace: string;
    objectKind: string;     // involvedObject.kind, e.g. "Pod"
    objectName: string;     // involvedObject.name
};

// Response body for GET /api/events.
export type EventsResponse = {
    events: ClusterEvent[];
};

// The origin of a cluster error: a Warning-type Kubernetes event, or a pod
// stuck in a failing/non-running state (CrashLoopBackOff, ImagePullBackOff, etc.).
export type ClusterErrorSource = "Event" | "Pod";

// A single error condition occurring in the cluster, returned by GET /api/errors.
// Unifies Warning events and problem pods into one shape so they can be shown
// together in a single table. age is computed by the UI from lastSeen.
export type ClusterError = {
    source: ClusterErrorSource;
    namespace: string;
    objectKind: string;     // e.g. "Pod", "Deployment"
    objectName: string;
    reason: string;         // event reason or pod waiting/terminated reason
    message: string;
    count: number;          // event count, or 1 for a problem pod
    firstSeen: string;      // ISO timestamp the condition was first observed ("" if unknown)
    lastSeen: string;       // ISO timestamp; UI computes age
};

// Response body for GET /api/errors.
export type ErrorsResponse = {
    errors: ClusterError[];
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

// A single output line streamed from the stern endpoint, carried by the "line"
// Server-Sent Event from GET /api/stern/stream. stern renders its own
// "namespace pod message" prefix into the line, so it is displayed verbatim.
export type SternStreamLine = {
    line: string;
};

// The scope a stern stream attached to, carried by the "started" event from
// GET /api/stern/stream.
export type SternStreamStarted = {
    query: string;
    namespace: string | null;
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

// One resource living inside a namespace, shown on the namespace detail page's
// Resources tab. kind is the singular resource kind ("Pod", "Deployment", etc.);
// detailPath, when set, is the in-app route to that resource's own detail page so
// the row can link through. status is a short human-readable summary (phase or
// ready count) shown in the table.
export type NamespaceResource = {
    kind: string;
    name: string;
    status: string;
    detailPath: string | null;
};

// A resource quota declared in the namespace, with its hard limits. Each entry
// pairs a quota resource name (e.g. "cpu", "pods") with its hard value.
export type NamespaceQuota = {
    name: string;
    hard: Record<string, string>;
};

// A LimitRange item declared in the namespace, summarising the default/min/max
// constraints it places on a resource type (e.g. Container cpu defaults).
export type NamespaceLimit = {
    name: string;
    type: string;             // e.g. "Container", "Pod"
    resource: string;         // e.g. "cpu", "memory"
    min: string;
    max: string;
    defaultRequest: string;
    default: string;
};

// Detailed view of a single namespace, returned by GET /api/namespaces/:name.
// Carries the namespace's own metadata (phase, labels, annotations), the
// resources contained in it, and any resource quotas / limit ranges that apply.
export type NamespaceDetail = {
    name: string;
    phase: string;            // status.phase, e.g. "Active" / "Terminating"
    createdAt: string;        // ISO timestamp; UI computes age
    labels: Record<string, string>;
    annotations: Record<string, string>;
    resources: NamespaceResource[];
    quotas: NamespaceQuota[];
    limits: NamespaceLimit[];
};

// The resource types whose raw YAML can be viewed in the dashboard.
export type YamlResourceType =
    "nodes" | "pods" | "deployments" | "daemonsets" | "statefulsets" | "namespaces";

// Response body for GET /api/yaml/:type/:name.
export type YamlResponse = {
    yaml: string;
};
