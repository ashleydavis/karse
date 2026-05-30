import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/app-layout";
import { ClusterHomePage } from "./pages/cluster-home-page";

export function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<AppLayout />}>
                    <Route index element={<ClusterHomePage />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}
