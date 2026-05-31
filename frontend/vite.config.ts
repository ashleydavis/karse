import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Vite dev server configuration.
// KARSE_FRONTEND_PORT sets the dev server port; "0" asks the OS for a free port
// (used by the test harness to avoid conflicts). KARSE_PORT is the backend port
// the /api proxy targets; the test harness sets it to the dynamically chosen
// backend port so the proxy follows the backend onto a free port.
export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        port: Number(process.env.KARSE_FRONTEND_PORT ?? "5173"),
        open: process.env.KARSE_NO_OPEN !== "1",
        proxy: {
            "/api": "http://127.0.0.1:" + (process.env.KARSE_PORT ?? "5172"),
        },
    },
});
