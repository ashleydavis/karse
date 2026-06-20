import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { findChrome, shouldOpenBrowser } from "./vite-open";

// Vite dev server configuration.
// KARSE_FRONTEND_PORT sets the dev server port; "0" asks the OS for a free port
// (used by the test harness to avoid conflicts). KARSE_PORT is the backend port
// the /api proxy targets; the test harness sets it to the dynamically chosen
// backend port so the proxy follows the backend onto a free port.
// KARSE_NO_WATCH=1 disables the file watcher (set by `start`): no hot reload, and
// it avoids exhausting the system inotify watch limit (ENOSPC). `dev` leaves it on.
// KARSE_NO_OPEN=1 suppresses opening a browser. Every non-interactive launch the
// project drives (the smoke harness, the e2e runner, any screenshot-capture run)
// sets it so no Chrome window appears; a plain interactive launch leaves it unset
// and a window opens. The decision lives in ./vite-open.ts so the smoke harness
// can assert on it without loading Vite.

// Open the app in a brand-new Chrome window each launch (developer's normal
// profile, so logins/extensions/settings are preserved), instead of reusing an
// existing tab/window. Vite's `server.open` honours the BROWSER / BROWSER_ARGS
// env vars: setting BROWSER to the Chrome binary and BROWSER_ARGS=--new-window
// makes it spawn `<chrome> --new-window <url>`. We only set them when not
// already overridden, and only when a Chrome binary is actually present; if
// none is found we fall back to Vite's default (open the OS default browser).
const open = shouldOpenBrowser();
if (open && process.env.BROWSER === undefined) {
    const chrome = findChrome();
    if (chrome !== undefined) {
        process.env.BROWSER = chrome;
        if (process.env.BROWSER_ARGS === undefined) {
            process.env.BROWSER_ARGS = "--new-window";
        }
    }
}

// Karse is a local-only tool: both the dev server and the preview server bind to
// 127.0.0.1 (loopback) only, never 0.0.0.0, so neither is reachable from another
// machine on the LAN. This is set explicitly rather than relying on Vite's default
// host so the local-only guarantee does not depend on a framework default.
const host = "127.0.0.1";

export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        host,
        port: Number(process.env.KARSE_FRONTEND_PORT ?? "5173"),
        open,
        watch: process.env.KARSE_NO_WATCH === "1" ? null : undefined,
        proxy: {
            "/api": "http://127.0.0.1:" + (process.env.KARSE_PORT ?? "5172"),
        },
    },
    preview: {
        host,
        port: Number(process.env.KARSE_FRONTEND_PORT ?? "5173"),
    },
});
