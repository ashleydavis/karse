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
    nodeCount: number;
    namespaceCount: number;
    podCount: number;
};
