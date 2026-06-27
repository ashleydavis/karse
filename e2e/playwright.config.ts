import { defineConfig } from "@playwright/test";

// Playwright configuration for Karse e2e tests.
// The shell script (scripts/e2e-tests.sh) starts the full stack before invoking Playwright.
// Timeouts are generous because the parallel ladder (scripts/parallel-e2e) runs many full
// stacks at once, so each run's browser, Vite dev server and Node test-runner share the host
// CPU with dozens of siblings. Under that contention correct web-first assertions and mouse
// drags are slow to settle, and the default 5s expect / 10s action windows can expire before
// the (CPU-starved) UI catches up. The longer windows let the same assertions ride out the
// contention instead of flaking; a genuinely broken expectation still fails, just later.
export default defineConfig({
    testDir: "src",
    workers: 1,
    // Per-run output directory. In main mode every parallel run executes from this same repo,
    // so they would otherwise all share e2e/test-results; Playwright clears and recreates that
    // dir (and its .playwright-artifacts-* temp dirs) at startup, so concurrent runs race and
    // one ENOENTs mid-mkdir. scripts/e2e-tests.sh sets KARSE_E2E_OUTPUT_DIR to a unique per-run
    // path so each run owns its artifacts. Defaults to the usual test-results for a lone run.
    outputDir: process.env.KARSE_E2E_OUTPUT_DIR ?? "test-results",
    timeout: 120000,
    expect: {
        timeout: 30000,
    },
    use: {
        baseURL: process.env.KARSE_E2E_URL ?? "http://localhost:5173",
        // 127.0.0.1 is not reliable on all CI environments; localhost is used throughout.
        headless: true,
        actionTimeout: 30000,
        navigationTimeout: 60000,
    },
});
