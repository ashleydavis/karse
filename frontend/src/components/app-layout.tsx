import { useEffect } from "react";
import { Box } from "@mui/material";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { Breadcrumbs } from "./breadcrumbs";
import { useKubeContext } from "../lib/kube-context";

// Redirects to /contexts whenever no context is selected, so the user
// immediately sees the contexts page and can pick one.
export function AppLayout() {
    const { current, isLoading } = useKubeContext();
    const navigate = useNavigate();
    const { pathname } = useLocation();

    useEffect(() => {
        if (!isLoading && current === null && pathname !== "/contexts") {
            navigate("/contexts", { replace: true });
        }
    }, [current, isLoading, pathname, navigate]);

    return (
        <Box sx={{ display: "flex", height: "100vh", overflow: "hidden" }}>
            <Sidebar />
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <Header />
                <Box component="main" sx={{ flex: 1, overflow: "auto", p: 3 }}>
                    <Box sx={{ mb: 2 }}>
                        <Breadcrumbs />
                    </Box>
                    <Outlet />
                </Box>
            </Box>
        </Box>
    );
}
