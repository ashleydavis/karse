import { Route, Routes, Navigate, useLocation } from "react-router-dom";
import { AppLayout } from "./components/app-layout";
import { ClusterHomePage } from "./pages/cluster-home-page";
import { ContextsPage } from "./pages/contexts-page";
import { NamespacesPage } from "./pages/namespaces-page";
import { NodesPage } from "./pages/nodes-page";
import { PodsPage } from "./pages/pods-page";
import { DeploymentsPage } from "./pages/deployments-page";
import { StatefulSetsPage } from "./pages/statefulsets-page";
import { DaemonSetsPage } from "./pages/daemonsets-page";
import { EventsPage } from "./pages/events-page";
import { ErrorsPage } from "./pages/errors-page";
import { PodDetailPage } from "./pages/pod-detail-page";
import { NodeDetailPage } from "./pages/node-detail-page";
import { WorkloadDetailPage } from "./pages/workload-detail-page";
import { LiveLogsPage } from "./pages/live-logs-page";
import { SternPage } from "./pages/stern-page";

// Redirects the index route to the cluster home while preserving the shareable query string (context, namespace) so a link to the bare root stays shareable.
function IndexRedirect() {
    const { search } = useLocation();
    return <Navigate to={{ pathname: "/cluster", search }} replace />;
}

export function App() {
    return (
        <Routes>
            <Route path="/" element={<AppLayout />}>
                <Route index element={<IndexRedirect />} />
                <Route path="cluster" element={<ClusterHomePage />} />
                <Route path="contexts" element={<ContextsPage />} />
                <Route path="nodes" element={<NodesPage />} />
                <Route path="nodes/:name" element={<NodeDetailPage />} />
                <Route path="namespaces" element={<NamespacesPage />} />
                <Route path="pods" element={<PodsPage />} />
                <Route path="pods/:namespace/:name" element={<PodDetailPage />} />
                <Route path="deployments" element={<DeploymentsPage />} />
                <Route path="deployments/:namespace/:name" element={<WorkloadDetailPage kind="deployments" />} />
                <Route path="statefulsets" element={<StatefulSetsPage />} />
                <Route path="statefulsets/:namespace/:name" element={<WorkloadDetailPage kind="statefulsets" />} />
                <Route path="daemonsets" element={<DaemonSetsPage />} />
                <Route path="daemonsets/:namespace/:name" element={<WorkloadDetailPage kind="daemonsets" />} />
                <Route path="events" element={<EventsPage />} />
                <Route path="logs" element={<LiveLogsPage />} />
                <Route path="errors" element={<ErrorsPage />} />
                <Route path="stern" element={<SternPage />} />
            </Route>
        </Routes>
    );
}
