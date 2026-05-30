import { useState, useEffect } from "react";
import { Container } from "@mui/material";
import { Outlet } from "react-router-dom";
import { Header } from "./header";
import { QuickPicker } from "./quick-picker";

// Root layout shell rendered for every route.
// Owns the quick picker open/close state and the Ctrl+K keyboard shortcut.
export function AppLayout() {
    const [pickerOpen, setPickerOpen] = useState(false);

    // Open the quick picker on Ctrl+K (or Cmd+K on macOS).
    useEffect(() => {
        function onKey(e: KeyboardEvent): void {
            if ((e.ctrlKey || e.metaKey) && e.key === "k") {
                e.preventDefault();
                setPickerOpen(true);
            }
        }
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("keydown", onKey);
        };
    }, []);

    return (
        <>
            <Header onOpenPicker={() => setPickerOpen(true)} />
            <Container maxWidth="lg" className="py-6">
                <Outlet />
            </Container>
            <QuickPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
        </>
    );
}
