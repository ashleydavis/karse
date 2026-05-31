import { useState, useEffect } from "react";
import { Box } from "@mui/material";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { Breadcrumbs } from "./breadcrumbs";
import { ContextQuickPicker } from "./context-quick-picker";
import { NamespaceQuickPicker } from "./namespace-quick-picker";
import { useKubeContext } from "../lib/kube-context";

// Redirects to /contexts whenever no context is selected, so the user
// immediately sees the contexts page and can pick one.
export function AppLayout() {
    const [contextPickerOpen, setContextPickerOpen] = useState(false);
    const [namespacePickerOpen, setNamespacePickerOpen] = useState(false);
    const { current, isLoading } = useKubeContext();
    const navigate = useNavigate();
    const { pathname } = useLocation();

    useEffect(() => {
        if (!isLoading && current === null && pathname !== "/contexts") {
            navigate("/contexts", { replace: true });
        }
    }, [current, isLoading, pathname, navigate]);

    useEffect(() => {
        function onKey(e: KeyboardEvent): void {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "K") {
                e.preventDefault();
                setNamespacePickerOpen(true);
            } else if ((e.ctrlKey || e.metaKey) && e.key === "k") {
                e.preventDefault();
                setContextPickerOpen(true);
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    return (
        <Box sx={{ display: "flex", height: "100vh", overflow: "hidden" }}>
            <Sidebar />
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <Header
                    onOpenContextPicker={() => setContextPickerOpen(true)}
                    onOpenNamespacePicker={() => setNamespacePickerOpen(true)}
                />
                <Box component="main" sx={{ flex: 1, overflow: "auto", p: 3 }}>
                    <Box sx={{ mb: 2 }}>
                        <Breadcrumbs />
                    </Box>
                    <Outlet />
                </Box>
            </Box>
            <ContextQuickPicker open={contextPickerOpen} onClose={() => setContextPickerOpen(false)} />
            <NamespaceQuickPicker open={namespacePickerOpen} onClose={() => setNamespacePickerOpen(false)} />
        </Box>
    );
}
