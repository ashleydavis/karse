import { defineConfig } from "@playwright/test";

// Playwright configuration for Karse e2e tests.
// The shell script (scripts/e2e-tests.sh) starts the full stack before invoking Playwright.
export default defineConfig({
    testDir: "src",
    workers: 1,
    timeout: 30000,
    use: {
        baseURL: process.env.KARSE_E2E_URL ?? "http://localhost:5173",
        headless: true,
        actionTimeout: 10000,
        navigationTimeout: 20000,
    },
});
