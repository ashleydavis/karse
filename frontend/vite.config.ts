import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        port: Number(process.env.KARSE_FRONTEND_PORT ?? "5173"),
        open: true,
        proxy: {
            "/api": "http://127.0.0.1:" + (process.env.KARSE_PORT ?? "5172"),
        },
    },
});
