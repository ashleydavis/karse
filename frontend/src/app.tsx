import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { AppLayout } from "./components/app-layout";
import { ClusterHomePage } from "./pages/cluster-home-page";
import { ContextsPage } from "./pages/contexts-page";
import { NamespacesPage } from "./pages/namespaces-page";
import { NodesPage } from "./pages/nodes-page";
import { PodsPage } from "./pages/pods-page";
import { DeploymentsPage } from "./pages/deployments-page";
import { StatefulSetsPage } from "./pages/statefulsets-page";
import { DaemonSetsPage } from "./pages/daemonsets-page";
import { PodDetailPage } from "./pages/pod-detail-page";
import { NodeDetailPage } from "./pages/node-detail-page";
import { LiveLogsPage } from "./pages/live-logs-page";

export function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<AppLayout />}>
                    <Route index element={<Navigate to="/cluster" replace />} />
                    <Route path="cluster" element={<ClusterHomePage />} />
                    <Route path="contexts" element={<ContextsPage />} />
                    <Route path="nodes" element={<NodesPage />} />
                    <Route path="nodes/:name" element={<NodeDetailPage />} />
                    <Route path="namespaces" element={<NamespacesPage />} />
                    <Route path="pods" element={<PodsPage />} />
                    <Route path="pods/:namespace/:name" element={<PodDetailPage />} />
                    <Route path="deployments" element={<DeploymentsPage />} />
                    <Route path="statefulsets" element={<StatefulSetsPage />} />
                    <Route path="daemonsets" element={<DaemonSetsPage />} />
                    <Route path="logs" element={<LiveLogsPage />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}
