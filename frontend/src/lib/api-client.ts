import axios from "axios";
import type { ContextsResponse, ClusterOverview, Node } from "karse-types";

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

export async function fetchClusterOverview(): Promise<ClusterOverview> {
    const response = await http.get<ClusterOverview>("/cluster/overview");
    return response.data;
}

export async function fetchNodes(): Promise<{ nodes: Node[] }> {
    const response = await http.get<{ nodes: Node[] }>("/cluster/nodes");
    return response.data;
}
