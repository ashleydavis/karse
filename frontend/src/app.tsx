import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/app-layout";
import { ClusterHomePage } from "./pages/cluster-home-page";
import { NamespacesPage } from "./pages/namespaces-page";
import { NodesPage } from "./pages/nodes-page";
import { PodsPage } from "./pages/pods-page";

export function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<AppLayout />}>
                    <Route index element={<ClusterHomePage />} />
                    <Route path="nodes" element={<NodesPage />} />
                    <Route path="namespaces" element={<NamespacesPage />} />
                    <Route path="pods" element={<PodsPage />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}
