import { Route, Routes, Navigate, useLocation } from "react-router-dom";
import { AppLayout } from "./components/app-layout";
import { ClusterHomePage } from "./pages/cluster-home";
import { ContextsPage } from "./pages/contexts";
import { NamespacesPage } from "./pages/namespaces";
import { NamespaceDetailPage } from "./pages/namespace-detail";
import { NodesPage } from "./pages/nodes";
import { PodsPage } from "./pages/pods";
import { DeploymentsPage } from "./pages/deployments";
import { StatefulSetsPage } from "./pages/statefulsets";
import { DaemonSetsPage } from "./pages/daemonsets";
import { EventsPage } from "./pages/events";
import { EventDetailPage } from "./pages/event-detail";
import { ErrorsPage } from "./pages/errors";
import { ErrorDetailPage } from "./pages/error-detail";
import { PodDetailPage } from "./pages/pod-detail";
import { ContainerDetailPage } from "./pages/container-detail";
import { NodeDetailPage } from "./pages/node-detail";
import { WorkloadDetailPage } from "./pages/workload-detail";
import { LiveLogsPage } from "./pages/live-logs";
import { AllResourcesPage } from "./pages/all-resources";
import { AboutPage } from "./pages/about";
import { ConfigPage } from "./pages/config";

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
                <Route path="all-resources" element={<AllResourcesPage />} />
                <Route path="contexts" element={<ContextsPage />} />
                <Route path="nodes" element={<NodesPage />} />
                <Route path="nodes/:name" element={<NodeDetailPage />} />
                <Route path="namespaces" element={<NamespacesPage />} />
                <Route path="namespaces/:name" element={<NamespaceDetailPage />} />
                <Route path="pods" element={<PodsPage />} />
                <Route path="pods/:namespace/:name" element={<PodDetailPage />} />
                <Route path="pods/:namespace/:name/containers/:container" element={<ContainerDetailPage />} />
                <Route path="deployments" element={<DeploymentsPage />} />
                <Route path="deployments/:namespace/:name" element={<WorkloadDetailPage kind="deployments" />} />
                <Route path="statefulsets" element={<StatefulSetsPage />} />
                <Route path="statefulsets/:namespace/:name" element={<WorkloadDetailPage kind="statefulsets" />} />
                <Route path="daemonsets" element={<DaemonSetsPage />} />
                <Route path="daemonsets/:namespace/:name" element={<WorkloadDetailPage kind="daemonsets" />} />
                <Route path="events" element={<EventsPage />} />
                <Route path="events/:uid" element={<EventDetailPage />} />
                <Route path="logs" element={<LiveLogsPage />} />
                <Route path="errors" element={<ErrorsPage />} />
                <Route path="errors/:index" element={<ErrorDetailPage />} />
                <Route path="about" element={<AboutPage />} />
                <Route path="config" element={<ConfigPage />} />
            </Route>
        </Routes>
    );
}
