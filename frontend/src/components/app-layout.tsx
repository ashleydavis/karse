import { useState, useEffect } from "react";
import { Box } from "@mui/material";
import { Outlet } from "react-router-dom";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { QuickPicker } from "./quick-picker";

export function AppLayout() {
    const [pickerOpen, setPickerOpen] = useState(false);

    useEffect(() => {
        function onKey(e: KeyboardEvent): void {
            if ((e.ctrlKey || e.metaKey) && e.key === "k") {
                e.preventDefault();
                setPickerOpen(true);
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    return (
        <Box sx={{ display: "flex", height: "100vh", overflow: "hidden" }}>
            <Sidebar />
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <Header onOpenPicker={() => setPickerOpen(true)} />
                <Box component="main" sx={{ flex: 1, overflow: "auto", p: 3 }}>
                    <Outlet />
                </Box>
            </Box>
            <QuickPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
        </Box>
    );
}
