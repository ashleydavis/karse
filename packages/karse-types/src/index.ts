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
    // The node's cloud instance type, from label node.kubernetes.io/instance-type
    // (falling back to beta.kubernetes.io/instance-type); null when neither label is set.
    instanceType: string | null;
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

// A single Kubernetes horizontal pod autoscaler (HPA) in the active cluster.
// reference is the scale target it manages, e.g. "Deployment/web". minReplicas,
// maxReplicas, and currentReplicas summarise its scaling bounds and current scale;
// targets is the metric summary kubectl shows (e.g. "cpu: 40%/80%"), or "<none>"
// when no metric status is available yet.
export type HorizontalPodAutoscaler = {
    name: string;
    namespace: string;
    reference: string;
    minReplicas: number;
    maxReplicas: number;
    currentReplicas: number;
    targets: string;
    createdAt: string;
    labels: Record<string, string>;  // metadata.labels; empty object when none
};

// Response body for GET /api/horizontalpodautoscalers.
export type HorizontalPodAutoscalersResponse = {
    horizontalPodAutoscalers: HorizontalPodAutoscaler[];
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

// A point-in-time resource sample for CPU and memory. Each field is null when the
// Metrics API is unavailable (usage cannot be read) so requests/limits, which come
// from pod specs, can still be carried alongside an absent usage reading.
export type ResourceUsage = {
    cpuMillicores: number | null;
    memoryBytes: number | null;
};

// Per-container usage joined with the container's requests and limits from its
// pod spec, used by the pod and node Performance tabs.
export type ContainerUsage = {
    name: string;
    usage: ResourceUsage;
    requests: ResourceUsage;
    limits: ResourceUsage;
};

// A single pod's usage, summed from its container usage, joined with the pod's
// summed requests and limits and its containers. node carries the scheduling node.
export type PodUsage = {
    name: string;
    namespace: string;
    node: string;
    usage: ResourceUsage;
    requests: ResourceUsage;
    limits: ResourceUsage;
    containers: ContainerUsage[];
};

// A single node's usage joined with its allocatable capacity, used to compute the
// node-utilisation heatmap (usage / allocatable). requests is the CPU/memory reserved
// by the pods scheduled on the node, summed from those pods' specs, so requests-mode
// utilisation (requests / allocatable) can be shown even when usage is unavailable.
export type NodeUsage = {
    name: string;
    usage: ResourceUsage;
    requests: ResourceUsage;
    allocatable: ResourceUsage;
};

// Cluster-wide CPU/memory totals, summed across all nodes: live usage, the requests
// reserved by scheduled pods, and the allocatable capacity. The denominators for the
// cluster Overview cards' percentage bases.
export type ClusterResourceTotals = {
    usage: ResourceUsage;
    requests: ResourceUsage;
    allocatable: ResourceUsage;
};

// Cluster-wide health counters shown as health-signal tiles on the cluster Overview tab.
// pendingPods counts pods in the Pending phase; oomKillCount counts pods whose containers
// currently expose lastState.terminated.reason === "OOMKilled" (point-in-time, not a 24h
// history); nodeCount is the number of nodes; nodePressure counts nodes whose matching
// condition is "True". cpuThrottlingAvailable is always false: kubectl cannot expose CPU
// throttling (it needs container_cpu_cfs_throttled_periods_total from Prometheus), so the
// tile is permanently "not available".
export type ClusterHealthSignals = {
    pendingPods: number;
    oomKillCount: number;
    nodeCount: number;
    nodePressure: {
        memoryPressure: number;
        diskPressure: number;
        pidPressure: number;
    };
    cpuThrottlingAvailable: false;
};

// One row of the cluster Overview workloads table: a top-level controller's summed usage
// and requests. One row per top-level controller (Deployment, StatefulSet, DaemonSet, …);
// a bare pod with no controller owner appears as its own row with kind "Pod".
export type WorkloadUsage = {
    name: string;
    namespace: string;
    kind: string;
    usage: ResourceUsage;
    requests: ResourceUsage;
};

// Cluster-scoped performance snapshot, returned by GET /api/cluster/performance.
// metricsAvailable is false when the Metrics API is absent; usage fields are then
// null while requests/limits remain populated from specs. totals carries the
// cluster-wide usage/requests/allocatable sums, health the health-signal counters,
// and workloads the per-controller usage rows for the Overview workloads table.
export type ClusterPerformance = {
    metricsAvailable: boolean;
    nodes: NodeUsage[];
    pods: PodUsage[];
    totals: ClusterResourceTotals;
    health: ClusterHealthSignals;
    workloads: WorkloadUsage[];
};

// Node-scoped performance snapshot, returned by GET /api/nodes/:name/performance.
// Carries the one node's usage plus the pods scheduled on it.
export type NodePerformance = {
    metricsAvailable: boolean;
    node: NodeUsage;
    pods: PodUsage[];
};

// Pod-scoped performance snapshot, returned by GET /api/pods/:namespace/:name/performance.
// Carries the pod's usage plus its per-container usage versus requests and limits, and the
// pod's scheduling node (its usage and allocatable) so the UI can show the pod's
// percentage of the node it runs on. node is null when the pod is unscheduled (no
// spec.nodeName) or the node read failed, so the percentage degrades to "—" honestly.
export type PodPerformance = {
    metricsAvailable: boolean;
    pod: PodUsage;
    containers: ContainerUsage[];
    node: NodeUsage | null;
};

// The shared metric-toggle token selecting which resource a Performance view shows.
// Disk is deliberately excluded: the Metrics API does not report disk usage.
export type PerformanceMetric = "cpu" | "memory";

// The resource types whose raw YAML can be viewed in the dashboard.
export type YamlResourceType =
    "nodes" | "pods" | "deployments" | "daemonsets" | "statefulsets" | "namespaces";

// Response body for GET /api/yaml/:type/:name.
export type YamlResponse = {
    yaml: string;
};

// Cache configuration, returned by GET /api/cache/config and accepted (as a partial)
// by PUT /api/cache/config. stalenessSeconds is how long a cached kubectl result is
// served before Karse re-fetches fresh data from the cluster.
export type CacheConfigResponse = {
    stalenessSeconds: number;
};

// Response body for POST /api/cache/clear: confirms the local cache was emptied.
export type CacheClearResponse = {
    cleared: true;
};
