import { test, expect, type Page } from "@playwright/test";
import { execSync } from "node:child_process";

// Cluster context names injected by scripts/e2e-tests.sh
const CLUSTER_1 = process.env.KWOK_CLUSTER_1 ?? "kwok-karse-e2e-1";
const CLUSTER_2 = process.env.KWOK_CLUSTER_2 ?? "kwok-karse-e2e-2";

// Switch the active kubeconfig context so the backend reads the right cluster on the next request.
function setContext(name: string): void {
    execSync(`kubectl config use-context ${name}`, { stdio: "ignore" });
}

// Remove the current-context entry so the backend returns current: null.
function unsetContext(): void {
    execSync("kubectl config unset current-context", { stdio: "ignore" });
}

// All tests share one page and run in declaration order.
test.describe("karse e2e", () => {
    test.describe.configure({ mode: "serial" });

    // Shared browser page for the entire test run.
    let page: Page;

    test.beforeAll(async ({ browser }) => {
        page = await browser.newPage();
        await page.setViewportSize({ width: 1280, height: 800 });
    });

    test.afterAll(async () => {
        setContext(CLUSTER_1);
        await page.close();
    });

    // Navigate and wait for the initial network activity to settle.
    async function navigateTo(): Promise<void> {
        await page.goto("/cluster", { waitUntil: "networkidle" });
    }

    // Navigate to the nodes page and wait for at least one row to appear.
    async function navigateToNodes(): Promise<void> {
        await page.goto("/nodes", { waitUntil: "networkidle" });
        await waitForNodeRows();
    }

    // Block until the stat tiles area is populated with data.
    async function waitForStatTiles(): Promise<void> {
        await expect(page.locator("[data-test-id='stat-server-version']")).toBeVisible();
    }

    // Block until at least one node row appears in the table.
    async function waitForNodeRows(): Promise<void> {
        await expect(page.locator("[data-test-id='node-row']").first()).toBeVisible();
    }

    // Return the text content of every node name cell currently rendered.
    async function getNodeNames(): Promise<string[]> {
        return page.locator("[data-test-id='node-row'] td:first-child").allTextContents();
    }

    // ── Header ────────────────────────────────────────────────────────────────

    test.describe("header", () => {
        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await navigateTo();
        });

        test("shows Karse title", async () => {
            await expect(page.locator("[data-test-id='karse-title']")).toHaveText("Karse");
        });

        test("shows page title for cluster home", async () => {
            await expect(page.locator("[data-test-id='breadcrumb-item']").first()).toHaveText("Cluster");
        });

        test("updates page title when navigating to nodes", async () => {
            await page.goto("/nodes", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='breadcrumb-item']").first()).toHaveText("Nodes");
        });

        test("updates page title when navigating to pods", async () => {
            await page.goto("/pods", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='breadcrumb-item']").first()).toHaveText("Pods");
        });

        test("updates page title when navigating to namespaces", async () => {
            await page.goto("/namespaces", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='breadcrumb-item']").first()).toHaveText("Namespaces");
        });

        test("updates page title when navigating to contexts", async () => {
            await page.goto("/contexts", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='breadcrumb-item']").first()).toHaveText("Contexts");
        });

        test("shows context picker dropdown when two clusters are configured", async () => {
            await navigateTo();
            await expect(page.locator("[aria-haspopup='listbox']")).toBeVisible();
        });

        test("shows refresh button", async () => {
            await expect(page.locator("[aria-label='refresh']")).toBeVisible();
        });
    });

    // ── Stat tiles ────────────────────────────────────────────────────────────

    test.describe("stat tiles", () => {
        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await navigateTo();
            await waitForStatTiles();
        });

        test("renders five tiles inside the stat-tiles container", async () => {
            await expect(page.locator("[data-test-id='stat-tiles'] > div")).toHaveCount(5);
        });

        test("server version tile shows 'Server version' label", async () => {
            await expect(page.locator("[data-test-id='stat-server-version'] p")).toHaveText("Server version");
        });

        test("nodes tile shows a count of 3", async () => {
            await expect(page.locator("[data-test-id='stat-nodes'] h5")).toHaveText("3");
        });

        test("namespaces tile shows 'Namespaces' label", async () => {
            await expect(page.locator("[data-test-id='stat-namespaces'] p")).toHaveText("Namespaces");
        });

        test("pods tile shows 'Pods' label", async () => {
            await expect(page.locator("[data-test-id='stat-pods'] p")).toHaveText("Pods");
        });

        test("errors tile shows 'Errors' label and a count of 0 for the clean cluster", async () => {
            await expect(page.locator("[data-test-id='stat-errors'] p")).toHaveText("Errors");
            await expect(page.locator("[data-test-id='stat-errors'] h5")).toHaveText("0");
        });
    });

    // ── Nodes table ───────────────────────────────────────────────────────────

    test.describe("nodes table", () => {
        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            // Start from a clean configuration so the default-hidden Roles column applies.
            await page.goto("/nodes");
            await page.evaluate(() => localStorage.removeItem("karse-columns-nodes"));
            await navigateToNodes();
        });

        test("shows the default column headers with Roles hidden by default", async () => {
            const table = page.locator("[data-test-id='nodes-table']");
            // Roles is hidden by default (usually "<none>" on real clusters), so it is not shown.
            for (const name of ["Name", "Status", "Version", "Age"]) {
                await expect(table.getByRole("columnheader", { name, exact: true })).toBeVisible();
            }
            await expect(table.getByRole("columnheader", { name: "Roles", exact: true })).toHaveCount(0);

            // Reveal Roles for the remaining content tests below, which assert the Roles cell
            // (3rd column once shown). Persist a config with Roles visible, then reload.
            await page.evaluate(() => {
                localStorage.setItem(
                    "karse-columns-nodes",
                    JSON.stringify({ order: ["name", "status", "roles", "version", "age", "labels"], hidden: [] }),
                );
            });
            await page.reload({ waitUntil: "networkidle" });
            await waitForNodeRows();
            await expect(table.getByRole("columnheader", { name: "Roles", exact: true })).toBeVisible();
        });

        test("shows all three nodes", async () => {
            const names = await getNodeNames();
            expect(names).toContain("node-cp");
            expect(names).toContain("node-worker");
            expect(names).toContain("node-notready");
        });

        // The Status chip lives in the second column (td:nth-child(2)); scope to it
        // so the Labels column's own key=value chips don't match these assertions.
        test("shows Ready chip for node-cp", async () => {
            const row = page.locator("[data-test-id='node-row']").filter({ hasText: "node-cp" });
            await expect(row.locator("td:nth-child(2) .MuiChip-label")).toHaveText("Ready");
        });

        // node-notready is created without the kwok annotation, so kwok leaves its
        // patched Ready=False status alone and it renders as genuinely NotReady.
        test("shows NotReady chip for node-notready", async () => {
            const row = page.locator("[data-test-id='node-row']").filter({ hasText: "node-notready" });
            await expect(row.locator("td:nth-child(2) .MuiChip-label")).toHaveText("NotReady");
        });

        test("shows Ready chip for node-worker", async () => {
            const row = page.locator("[data-test-id='node-row']").filter({ hasText: "node-worker" });
            await expect(row.locator("td:nth-child(2) .MuiChip-label")).toHaveText("Ready");
        });

        test("shows control-plane role for node-cp", async () => {
            const row = page.locator("[data-test-id='node-row']").filter({ hasText: "node-cp" });
            await expect(row.locator("td").nth(2)).toHaveText("control-plane");
        });

        test("shows worker role for node-worker", async () => {
            const row = page.locator("[data-test-id='node-row']").filter({ hasText: "node-worker" });
            await expect(row.locator("td").nth(2)).toHaveText("worker");
        });

        test("shows <none> for node-notready which has no roles", async () => {
            const row = page.locator("[data-test-id='node-row']").filter({ hasText: "node-notready" });
            await expect(row.locator("td").nth(2)).toHaveText("<none>");
        });

        test("shows a non-empty Age value for each node", async () => {
            const ages = await page.locator("[data-test-id='node-row'] td:nth-child(5)").allTextContents();
            for (const age of ages) {
                expect(age.trim().length).toBeGreaterThan(0);
            }
        });

        test("stats header shows total/healthy/error counts (3 nodes, 2 Ready, 1 NotReady)", async () => {
            await expect(page.locator("[data-test-id='nodes-stats-total']")).toHaveText("Total: 3");
            await expect(page.locator("[data-test-id='nodes-stats-healthy']")).toHaveText("Healthy: 2");
            await expect(page.locator("[data-test-id='nodes-stats-error']")).toHaveText("Error: 1");
        });
    });

    // ── Sort ──────────────────────────────────────────────────────────────────

    test.describe("sort", () => {
        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await navigateToNodes();
        });

        test("clicking Name header once sorts rows ascending", async () => {
            await page.locator("[data-test-id='nodes-table'] thead th").filter({ hasText: "Name" }).click();
            const names = await getNodeNames();
            expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
        });

        test("clicking Name header again sorts rows descending", async () => {
            await page.locator("[data-test-id='nodes-table'] thead th").filter({ hasText: "Name" }).click();
            const names = await getNodeNames();
            expect(names).toEqual([...names].sort((a, b) => b.localeCompare(a)));
        });

        // node-notready is genuinely NotReady, so sorting by status should place the
        // Ready rows ahead of the NotReady row.
        test("clicking Status header sorts Ready rows before NotReady", async () => {
            await page.locator("[data-test-id='nodes-table'] thead th").filter({ hasText: "Status" }).click();

            const statuses = await page.locator("[data-test-id='node-row'] td:nth-child(2) .MuiChip-label").allTextContents();
            const readyIdx = statuses.indexOf("Ready");
            const notReadyIdx = statuses.indexOf("NotReady");
            expect(readyIdx).toBeGreaterThanOrEqual(0);
            expect(notReadyIdx).toBeGreaterThanOrEqual(0);
            expect(readyIdx).toBeLessThan(notReadyIdx);
        });
    });

    // ── Search / filter ───────────────────────────────────────────────────────

    test.describe("search / filter", () => {
        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await navigateToNodes();
        });

        test("filters rows to those matching the search query", async () => {
            await page.locator("[data-test-id='nodes-search'] input").fill("cp");
            await expect(page.locator("[data-test-id='node-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='node-row'] td:first-child")).toHaveText("node-cp");
        });

        test("shows 'No nodes match' message when query has no results", async () => {
            await page.locator("[data-test-id='nodes-search'] input").fill("zzznotfound");
            await expect(page.locator("[data-test-id='no-nodes-match']")).toBeVisible();
        });

        test("restores all rows when search is cleared", async () => {
            await page.locator("[data-test-id='nodes-search'] input").fill("");
            await expect(page.locator("[data-test-id='node-row']")).toHaveCount(3);
        });
    });

    // ── Fuzzy search ───────────────────────────────────────────────────────────

    test.describe("fuzzy search", () => {
        // Deterministic pod list so fuzzy-match assertions are stable.
        const FAKE_PODS = {
            pods: [
                { name: "nginx-deployment-abc", namespace: "default", phase: "Running", ready: "1/1", restarts: 0, node: "node-worker", createdAt: new Date().toISOString() },
                { name: "redis-cache-xyz", namespace: "default", phase: "Running", ready: "1/1", restarts: 0, node: "node-worker", createdAt: new Date().toISOString() },
            ],
        };

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await page.route("**/api/pods*", async (route) => {
                await route.fulfill({ json: FAKE_PODS });
            });
            await page.goto("/pods", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='pod-row']").first()).toBeVisible();
        });

        test.afterAll(async () => {
            await page.unroute("**/api/pods*");
        });

        test("a typo query (ngnx) still matches nginx-deployment-abc", async () => {
            await page.locator("[data-test-id='pods-search'] input").fill("ngnx");
            await expect(page.locator("[data-test-id='pod-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='pod-row'] td:first-child")).toHaveText("nginx-deployment-abc");
        });

        test("a non-contiguous query (ng-x) still matches nginx-deployment-abc", async () => {
            await page.locator("[data-test-id='pods-search'] input").fill("ng-x");
            await expect(page.locator("[data-test-id='pod-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='pod-row'] td:first-child")).toHaveText("nginx-deployment-abc");
        });

        test("a clearly non-matching query filters out all rows", async () => {
            await page.locator("[data-test-id='pods-search'] input").fill("zzzqqq");
            await expect(page.locator("[data-test-id='pod-row']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='no-pods-match']")).toBeVisible();
        });

        test("clearing the query restores all pod rows", async () => {
            await page.locator("[data-test-id='pods-search'] input").fill("");
            await expect(page.locator("[data-test-id='pod-row']")).toHaveCount(2);
        });
    });

    // ── Expanded search criteria (labels, node, namespace) ─────────────────────

    test.describe("expanded search criteria (labels, node, namespace)", () => {
        // Two pods that differ by label, node, and namespace so each criterion
        // narrows the table to exactly one row. Routed so the assertions are stable.
        const FAKE_PODS = {
            pods: [
                {
                    name: "nginx-deployment-abc",
                    namespace: "default",
                    phase: "Running",
                    ready: "1/1",
                    containerCount: 1,
                    restarts: 0,
                    node: "node-worker",
                    createdAt: new Date().toISOString(),
                    labels: { app: "nginx", tier: "frontend" },
                },
                {
                    name: "redis-cache-xyz",
                    namespace: "cache-system",
                    phase: "Running",
                    ready: "1/1",
                    containerCount: 1,
                    restarts: 0,
                    node: "node-control",
                    createdAt: new Date().toISOString(),
                    labels: { app: "redis", tier: "backend" },
                },
            ],
        };

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await page.route("**/api/pods*", async (route) => {
                await route.fulfill({ json: FAKE_PODS });
            });
            await page.goto("/pods", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='pod-row']")).toHaveCount(2);
        });

        test.afterAll(async () => {
            await page.locator("[data-test-id='pods-search'] input").fill("");
            await page.unroute("**/api/pods*");
        });

        test("a label key=value pair narrows to the pod carrying that label", async () => {
            await page.locator("[data-test-id='pods-search'] input").fill("app=nginx");
            await expect(page.locator("[data-test-id='pod-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='pod-row'] td:first-child")).toHaveText("nginx-deployment-abc");
        });

        test("a label value alone narrows to the matching pod", async () => {
            await page.locator("[data-test-id='pods-search'] input").fill("backend");
            await expect(page.locator("[data-test-id='pod-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='pod-row'] td:first-child")).toHaveText("redis-cache-xyz");
        });

        test("a node name narrows to pods on that node", async () => {
            await page.locator("[data-test-id='pods-search'] input").fill("node-worker");
            await expect(page.locator("[data-test-id='pod-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='pod-row'] td:first-child")).toHaveText("nginx-deployment-abc");
        });

        test("a namespace narrows to pods in that namespace", async () => {
            await page.locator("[data-test-id='pods-search'] input").fill("cache-system");
            await expect(page.locator("[data-test-id='pod-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='pod-row'] td:first-child")).toHaveText("redis-cache-xyz");
        });
    });

    // ── Fuzzy search on the nodes table ────────────────────────────────────────

    test.describe("fuzzy search (nodes table)", () => {
        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await navigateToNodes();
        });

        test.afterAll(async () => {
            await page.locator("[data-test-id='nodes-search'] input").fill("");
        });

        test("a non-contiguous query (nwk) fuzzy-matches node-worker", async () => {
            await page.locator("[data-test-id='nodes-search'] input").fill("nwk");
            await expect(page.locator("[data-test-id='node-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='node-row'] td:first-child")).toHaveText("node-worker");
        });

        test("a clearly non-matching query filters out all node rows", async () => {
            await page.locator("[data-test-id='nodes-search'] input").fill("zzzqqq");
            await expect(page.locator("[data-test-id='no-nodes-match']")).toBeVisible();
        });
    });

    // ── Refresh ───────────────────────────────────────────────────────────────

    test.describe("refresh button", () => {
        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await navigateTo();
            await waitForStatTiles();
        });

        test("clicking refresh triggers a new fetch of cluster overview", async () => {
            const responsePromise = page.waitForResponse(res => res.url().includes("/api/cluster/overview"));
            await page.locator("[aria-label='refresh']").click();
            await responsePromise;
        });

        test("clicking refresh triggers a new fetch of nodes", async () => {
            await navigateToNodes();
            const responsePromise = page.waitForResponse(res => res.url().includes("/api/cluster/nodes"));
            await page.locator("[aria-label='refresh']").click();
            await responsePromise;
        });
    });

    // ── Context switch ────────────────────────────────────────────────────────

    test.describe("context switch", () => {
        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await navigateToNodes();
        });

        test.afterAll(() => {
            setContext(CLUSTER_1);
        });

        test("switching to cluster 2 shows its nodes and hides cluster 1 nodes", async () => {
            await page.locator("[aria-haspopup='listbox']").click();
            await page.locator(`[data-value="${CLUSTER_2}"]`).click();
            await expect(page.locator("[data-test-id='node-row']").filter({ hasText: "node-alpha" })).toBeVisible();
            const names = await getNodeNames();
            expect(names).toContain("node-alpha");
            expect(names).toContain("node-beta");
            expect(names).not.toContain("node-cp");
        });

        test("stat tiles update to reflect cluster 2 node count of 2", async () => {
            await page.locator("[data-test-id='karse-title']").click();
            await waitForStatTiles();
            await expect(page.locator("[data-test-id='stat-nodes'] h5")).toHaveText("2");
        });

        test("switching back to cluster 1 restores its nodes", async () => {
            await page.locator("nav a[href^='/nodes']").click();
            await page.locator("[aria-haspopup='listbox']").click();
            await page.locator(`[data-value="${CLUSTER_1}"]`).click();
            await expect(page.locator("[data-test-id='node-row']").filter({ hasText: "node-cp" })).toBeVisible();
            const names = await getNodeNames();
            expect(names).toContain("node-cp");
            expect(names).not.toContain("node-alpha");
        });
    });

    // ── No context state ──────────────────────────────────────────────────────

    test.describe("no context state", () => {
        test.beforeAll(async () => {
            unsetContext();
            await navigateTo();
        });

        test.afterAll(() => {
            setContext(CLUSTER_1);
        });

        test("redirects to /contexts when no context is selected", async () => {
            await expect(page).toHaveURL(/\/contexts/);
        });

        test("contexts page shows no active context chip", async () => {
            const activeChips = page.locator(".MuiChip-root", { hasText: "active" });
            await expect(activeChips).toHaveCount(0);
        });
    });

    // ── Header navigation ─────────────────────────────────────────────────────

    test.describe("header navigation", () => {
        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await navigateTo();
        });

        test("shows namespaces nav button", async () => {
            await expect(page.locator("[aria-label='namespaces']")).toBeVisible();
        });

        test("shows context picker button", async () => {
            await expect(page.locator("[aria-label='context picker']")).toBeVisible();
        });

        test("shows namespace picker button", async () => {
            await expect(page.locator("[aria-label='namespace picker']")).toBeVisible();
        });

        test("clicking namespaces nav button navigates to /namespaces", async () => {
            await page.locator("[aria-label='namespaces']").click();
            await expect(page).toHaveURL(/\/namespaces/);
        });

        test("karse title link navigates back to home", async () => {
            await page.locator("[data-test-id='karse-title']").click();
            await expect(page).toHaveURL(/\/cluster/);
            await expect(page.locator("[data-test-id='stat-tiles']")).toBeVisible();
        });

        test("shows pods nav button", async () => {
            await expect(page.locator("[aria-label='pods']")).toBeVisible();
        });

        test("clicking pods nav button navigates to /pods", async () => {
            await page.locator("[aria-label='pods']").click();
            await expect(page).toHaveURL(/\/pods/);
            await page.locator("[data-test-id='karse-title']").click();
            await expect(page).toHaveURL(/\/cluster/);
        });
    });

    // ── Contexts page ─────────────────────────────────────────────────────────

    test.describe("contexts page", () => {
        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await page.goto("/contexts", { waitUntil: "networkidle" });
        });

        test("shows a row for each configured context", async () => {
            const rows = page.locator("[data-test-id='context-row']");
            await expect(rows.filter({ hasText: CLUSTER_1 })).toBeVisible();
            await expect(rows.filter({ hasText: CLUSTER_2 })).toBeVisible();
        });

        test("shows active chip on the current context", async () => {
            const activeRow = page.locator("[data-test-id='context-row']").filter({ hasText: CLUSTER_1 });
            await expect(activeRow.locator(".MuiChip-root", { hasText: "active" })).toBeVisible();
        });

        test("shows default chip on the terminal default context", async () => {
            const defaultRow = page.locator("[data-test-id='context-row']").filter({ hasText: CLUSTER_1 });
            await expect(defaultRow.locator(".MuiChip-root", { hasText: "default" })).toBeVisible();
        });

        test("Set as active button is disabled for the active context", async () => {
            const activeRow = page.locator("[data-test-id='context-row']").filter({ hasText: CLUSTER_1 });
            await expect(activeRow.locator("button", { hasText: "Set as active" })).toBeDisabled();
        });

        test("Set as active switches the active context", async () => {
            const cluster2Row = page.locator("[data-test-id='context-row']").filter({ hasText: CLUSTER_2 });
            await cluster2Row.locator("button", { hasText: "Set as active" }).click();
            await expect(cluster2Row.locator(".MuiChip-root", { hasText: "active" })).toBeVisible();
            // Switch back for subsequent tests.
            const cluster1Row = page.locator("[data-test-id='context-row']").filter({ hasText: CLUSTER_1 });
            await cluster1Row.locator("button", { hasText: "Set as active" }).click();
        });

        test("search filters context rows", async () => {
            await page.locator("[data-test-id='contexts-search'] input").fill(CLUSTER_1);
            await expect(page.locator("[data-test-id='context-row']").filter({ hasText: CLUSTER_1 })).toBeVisible();
            await expect(page.locator("[data-test-id='context-row']").filter({ hasText: CLUSTER_2 })).toHaveCount(0);
            await page.locator("[data-test-id='contexts-search'] input").fill("");
        });
    });

    // ── Contexts page: empty-state guidance ───────────────────────────────────

    test.describe("contexts page empty state", () => {
        // A genuinely-empty context list is not reproducible against the live
        // kwok clusters, so the contexts payload is mocked for these tests.
        const EMPTY_PAYLOAD = { contexts: [], current: null };
        const ONE_CONTEXT_PAYLOAD = {
            contexts: [{ name: "only-context", cluster: "only-cluster", user: "only-user", namespace: null }],
            current: "only-context",
        };

        test.afterAll(async () => {
            await page.unroute("**/api/contexts");
        });

        test("genuinely-empty state shows EKS and AKS add-a-context commands", async () => {
            await page.route("**/api/contexts", async (route) => {
                await route.fulfill({ json: EMPTY_PAYLOAD });
            });
            await page.goto("/contexts", { waitUntil: "networkidle" });

            const empty = page.locator("[data-test-id='no-contexts-empty']");
            await expect(empty).toBeVisible();
            await expect(empty).toContainText("No contexts found.");
            await expect(empty).toContainText("reload this page");
            await expect(empty).toContainText("aws eks update-kubeconfig --name <cluster-name> --region <region>");
            await expect(empty).toContainText("az aks get-credentials --resource-group <resource-group> --name <cluster-name>");
            await expect(page.locator("[data-test-id='no-contexts-match']")).toHaveCount(0);
        });

        test("filtered-empty state shows the search message, not the add-a-context commands", async () => {
            await page.route("**/api/contexts", async (route) => {
                await route.fulfill({ json: ONE_CONTEXT_PAYLOAD });
            });
            await page.goto("/contexts", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='context-row']")).toHaveCount(1);

            await page.locator("[data-test-id='contexts-search'] input").fill("no-such-context-zzz");
            const match = page.locator("[data-test-id='no-contexts-match']");
            await expect(match).toBeVisible();
            await expect(match).toContainText("No contexts match the search.");
            await expect(match).not.toContainText("aws eks update-kubeconfig");
            await expect(page.locator("[data-test-id='no-contexts-empty']")).toHaveCount(0);
            await page.locator("[data-test-id='contexts-search'] input").fill("");
        });
    });

    // ── Namespaces page ───────────────────────────────────────────────────────

    test.describe("namespaces page", () => {
        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await page.goto("/namespaces", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='namespace-row']").first()).toBeVisible();
        });

        test.afterAll(() => {
            // Clear any namespace default set during tests.
            execSync(`kubectl config set-context ${CLUSTER_1} --namespace=`, { stdio: "ignore" });
        });

        test("shows standard Kubernetes namespaces including default and kube-system", async () => {
            const names = await page.locator("[data-test-id='namespace-row']").allTextContents();
            expect(names.some((n) => n.includes("default"))).toBe(true);
            expect(names.some((n) => n.includes("kube-system"))).toBe(true);
        });

        test("shows a Resources column with a numeric count per namespace", async () => {
            await expect(
                page.locator("[data-test-id='namespaces-list'] thead th").filter({ hasText: "Resources" })
            ).toBeVisible();
            const counts = await page.locator("[data-test-id='namespace-resource-count']").allTextContents();
            expect(counts.length).toBeGreaterThan(0);
            // Every cell is either a non-negative integer or the em-dash placeholder
            // shown when the count could not be determined.
            expect(counts.every((c) => c === "—" || /^\d+$/.test(c.trim()))).toBe(true);
        });

        test("Resources count agrees between the list column and the detail page", async () => {
            // Read the list-column Resources count for the kube-system row (a
            // namespace that always has pods), then open its detail page and
            // confirm the Details-tab Resources stat shows the same number.
            await page.locator("[data-test-id='namespaces-filter'] input").fill("kube-system");
            const row = page.locator("[data-test-id='namespace-row']")
                .filter({ hasText: "kube-system" }).first();
            const listCount = (
                await row.locator("[data-test-id='namespace-resource-count']").textContent()
            )?.trim();
            await page.locator("[data-test-id='namespaces-filter'] input").fill("");
            await page.goto("/namespaces/kube-system", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='namespace-detail']")).toBeVisible();
            await expect(
                page.locator("[data-test-id='namespace-stat'][data-stat='resources']")
            ).toContainText(listCount!);
            // Return to the list so later tests in this block start from /namespaces.
            await page.goto("/namespaces", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='namespace-row']").first()).toBeVisible();
        });

        // Every namespace carries the auto-applied kubernetes.io/metadata.name
        // label, and the Labels column participates in the search, so a bare
        // "kube" now matches every row. Filter on "kube-system" instead: that
        // string is unique to the kube-system namespace (name and label value),
        // so it still excludes "default".
        test("filtering narrows the list to matching namespaces", async () => {
            await page.locator("[data-test-id='namespaces-filter'] input").fill("kube-system");
            const names = await page.locator("[data-test-id='namespace-row'] td:first-child").allTextContents();
            expect(names.some((n) => n.includes("kube-system"))).toBe(true);
            expect(names.every((n) => n.toLowerCase().includes("kube-system"))).toBe(true);
            expect(names.some((n) => /^default/.test(n))).toBe(false);
        });

        test("shows no-namespaces-match message when filter has no results", async () => {
            await page.locator("[data-test-id='namespaces-filter'] input").fill("zzznotfound");
            await expect(page.locator("[data-test-id='no-namespaces-match']")).toBeVisible();
        });

        test("clearing the filter restores all namespaces", async () => {
            await page.locator("[data-test-id='namespaces-filter'] input").fill("");
            await expect(page.locator("[data-test-id='no-namespaces-match']")).toHaveCount(0);
            const count = await page.locator("[data-test-id='namespace-row']").count();
            expect(count).toBeGreaterThan(0);
        });

        test("clicking Name header sorts A-Z (default before kube-system)", async () => {
            await page.locator("[data-test-id='namespaces-list'] thead th").filter({ hasText: "Name" }).click();
            const names = await page.locator("[data-test-id='namespace-row'] td:first-child").allTextContents();
            const defaultIdx = names.findIndex((n) => /^default/.test(n));
            const systemIdx = names.findIndex((n) => n.includes("kube-system"));
            expect(defaultIdx).toBeLessThan(systemIdx);
        });

        test("clicking Name header again sorts Z-A (kube-system before default)", async () => {
            await page.locator("[data-test-id='namespaces-list'] thead th").filter({ hasText: "Name" }).click();
            const names = await page.locator("[data-test-id='namespace-row'] td:first-child").allTextContents();
            const defaultIdx = names.findIndex((n) => /^default/.test(n));
            const systemIdx = names.findIndex((n) => n.includes("kube-system"));
            expect(systemIdx).toBeLessThan(defaultIdx);
        });

        test("Set as active button activates a namespace", async () => {
            const defaultRow = page.locator("[data-test-id='namespace-row']").filter({ hasText: /^default/ });
            await defaultRow.locator("button", { hasText: "Set as active" }).click();
            await expect(defaultRow.locator(".MuiChip-root", { hasText: "active" })).toBeVisible();
        });

        test("Set as default button changes to Clear default after clicking", async () => {
            const list = page.locator("[data-test-id='namespaces-list']");
            const btn = list.locator("button", { hasText: "Set as default" }).first();
            await btn.click();
            await expect(list.locator("button", { hasText: "Clear default" }).first()).toBeVisible();
        });

        test("clicking a namespace row navigates to its detail page", async () => {
            await page.locator("[data-test-id='namespaces-filter'] input").fill("");
            const defaultRow = page.locator("[data-test-id='namespace-row']").filter({ hasText: /^default/ }).first();
            // Click the Name cell (not an action button) to navigate to the detail page.
            await defaultRow.locator("td:first-child").click();
            await expect(page).toHaveURL(/\/namespaces\/default/);
            await expect(page.locator("[data-test-id='namespace-detail']")).toBeVisible();
            // Return to the list so later tests in this block start from /namespaces.
            await page.goto("/namespaces", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='namespace-row']").first()).toBeVisible();
        });

        test("clicking an action button does not navigate to the detail page", async () => {
            const defaultRow = page.locator("[data-test-id='namespace-row']").filter({ hasText: /^default/ }).first();
            await defaultRow.locator("button", { hasText: /Set as active|Clear active/ }).click();
            // Still on the list page; the action button's click did not navigate to a
            // detail page. The button may append a ?namespace=... query, so allow a
            // query string but require the path to remain the bare list path (no
            // /namespaces/<name> segment).
            await expect(page).toHaveURL(/\/namespaces(\?|$)/);
            await expect(page.locator("[data-test-id='namespace-detail']")).toHaveCount(0);
        });

        test("namespaces page redirects to /contexts when no context is selected", async () => {
            unsetContext();
            await page.goto("/namespaces", { waitUntil: "networkidle" });
            await expect(page).toHaveURL(/\/contexts/);
            setContext(CLUSTER_1);
        });
    });

    // ── Context picker ────────────────────────────────────────────────────────

    test.describe("context picker", () => {
        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await navigateTo();
        });

        async function openPicker(): Promise<void> {
            await page.locator("[aria-label='context picker']").click();
            await expect(page.locator("[data-test-id='context-quick-picker-dropdown']")).toBeVisible();
        }

        async function closePicker(): Promise<void> {
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='context-quick-picker-dropdown']")).not.toBeVisible();
        }

        test("opens as a dropdown anchored to the header, not a modal dialog", async () => {
            await openPicker();
            // The picker is a popover/menu anchored to the header, not a modal dialog.
            await expect(page.locator("[role='dialog']")).toHaveCount(0);
            const buttonBox = await page.locator("[aria-label='context picker']").boundingBox();
            const dropdownBox = await page.locator("[data-test-id='context-quick-picker-dropdown']").boundingBox();
            expect(buttonBox).not.toBeNull();
            expect(dropdownBox).not.toBeNull();
            // The dropdown opens below the trigger button in the header.
            expect(dropdownBox!.y).toBeGreaterThanOrEqual(buttonBox!.y);
            await closePicker();
        });

        test("opens with the Ctrl+K keyboard shortcut", async () => {
            await page.keyboard.press("Control+k");
            await expect(page.locator("[data-test-id='context-quick-picker-dropdown']")).toBeVisible();
            await closePicker();
        });

        test("renders a MUI arrow pointing at the trigger button", async () => {
            await openPicker();
            // The arrow is the built-in MUI Tooltip arrow (.MuiTooltip-arrow), not a hand-rolled CSS beak.
            const arrow = page.locator(".MuiTooltip-arrow");
            await expect(arrow).toBeVisible();
            const arrowBox = await arrow.boundingBox();
            const buttonBox = await page.locator("[aria-label='context picker']").boundingBox();
            const dropdownBox = await page.locator("[data-test-id='context-quick-picker-dropdown']").boundingBox();
            expect(arrowBox).not.toBeNull();
            expect(buttonBox).not.toBeNull();
            expect(dropdownBox).not.toBeNull();
            // The arrow sits between the button and the dropdown body, pointing up at the button.
            expect(arrowBox!.y).toBeGreaterThanOrEqual(buttonBox!.y);
            expect(arrowBox!.y).toBeLessThanOrEqual(dropdownBox!.y + 1);
            // The dropdown panel has a visible border so its edges (and the arrow) stay
            // visible in dark mode, where the panel shares the nav bar's background colour.
            const panelBorder = await page.locator(".MuiTooltip-tooltip").evaluate((el) => {
                const style = window.getComputedStyle(el);
                return { width: style.borderTopWidth, color: style.borderTopColor };
            });
            expect(parseFloat(panelBorder.width)).toBeGreaterThan(0);
            expect(panelBorder.color).not.toBe("rgba(0, 0, 0, 0)");
            expect(panelBorder.color).not.toBe("transparent");
            await closePicker();
        });

        test("shows both clusters", async () => {
            await openPicker();
            const rows = page.locator("[data-test-id='context-quick-picker-row']");
            await expect(rows.filter({ hasText: CLUSTER_1 })).toBeVisible();
            await expect(rows.filter({ hasText: CLUSTER_2 })).toBeVisible();
            await closePicker();
        });

        test("filter hides non-matching context rows", async () => {
            await openPicker();
            await page.locator("[data-test-id='context-quick-picker-dropdown'] input").fill(CLUSTER_1);
            await expect(page.locator("[data-test-id='context-quick-picker-row']").filter({ hasText: CLUSTER_1 })).toBeVisible();
            await expect(page.locator("[data-test-id='context-quick-picker-row']").filter({ hasText: CLUSTER_2 })).toHaveCount(0);
            await closePicker();
        });

        test("selecting a context closes the picker and updates the context display", async () => {
            await openPicker();
            await page.locator("[data-test-id='context-quick-picker-row']").filter({ hasText: CLUSTER_2 }).click();
            await expect(page.locator("[data-test-id='context-quick-picker-dropdown']")).not.toBeVisible();
            await expect(page.locator("[aria-haspopup='listbox']")).toContainText(CLUSTER_2);
        });

        test.afterAll(() => {
            setContext(CLUSTER_1);
        });
    });

    // ── Namespace picker ──────────────────────────────────────────────────────

    test.describe("namespace picker", () => {
        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await navigateTo();
        });

        async function openPicker(): Promise<void> {
            await page.locator("[aria-label='namespace picker']").click();
            await expect(page.locator("[data-test-id='namespace-quick-picker-dropdown']")).toBeVisible();
        }

        async function closePicker(): Promise<void> {
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='namespace-quick-picker-dropdown']")).not.toBeVisible();
        }

        test("opens as a dropdown anchored to the header, not a modal dialog", async () => {
            await openPicker();
            // The picker is a popover/menu anchored to the header, not a modal dialog.
            await expect(page.locator("[role='dialog']")).toHaveCount(0);
            const buttonBox = await page.locator("[aria-label='namespace picker']").boundingBox();
            const dropdownBox = await page.locator("[data-test-id='namespace-quick-picker-dropdown']").boundingBox();
            expect(buttonBox).not.toBeNull();
            expect(dropdownBox).not.toBeNull();
            // The dropdown opens below the trigger button in the header.
            expect(dropdownBox!.y).toBeGreaterThanOrEqual(buttonBox!.y);
            await closePicker();
        });

        test("opens with the Ctrl+Shift+K keyboard shortcut", async () => {
            await page.keyboard.press("Control+Shift+K");
            await expect(page.locator("[data-test-id='namespace-quick-picker-dropdown']")).toBeVisible();
            await closePicker();
        });

        test("renders a MUI arrow pointing at the trigger button", async () => {
            await openPicker();
            // The arrow is the built-in MUI Tooltip arrow (.MuiTooltip-arrow), not a hand-rolled CSS beak.
            const arrow = page.locator(".MuiTooltip-arrow");
            await expect(arrow).toBeVisible();
            const arrowBox = await arrow.boundingBox();
            const buttonBox = await page.locator("[aria-label='namespace picker']").boundingBox();
            const dropdownBox = await page.locator("[data-test-id='namespace-quick-picker-dropdown']").boundingBox();
            expect(arrowBox).not.toBeNull();
            expect(buttonBox).not.toBeNull();
            expect(dropdownBox).not.toBeNull();
            // The arrow sits between the button and the dropdown body, pointing up at the button.
            expect(arrowBox!.y).toBeGreaterThanOrEqual(buttonBox!.y);
            expect(arrowBox!.y).toBeLessThanOrEqual(dropdownBox!.y + 1);
            // The dropdown panel has a visible border so its edges (and the arrow) stay
            // visible in dark mode, where the panel shares the nav bar's background colour.
            const panelBorder = await page.locator(".MuiTooltip-tooltip").evaluate((el) => {
                const style = window.getComputedStyle(el);
                return { width: style.borderTopWidth, color: style.borderTopColor };
            });
            expect(parseFloat(panelBorder.width)).toBeGreaterThan(0);
            expect(panelBorder.color).not.toBe("rgba(0, 0, 0, 0)");
            expect(panelBorder.color).not.toBe("transparent");
            await closePicker();
        });

        test("shows All namespaces row", async () => {
            await openPicker();
            await expect(page.locator("[data-test-id='namespace-quick-picker-all']")).toBeVisible();
            await closePicker();
        });

        test("shows namespace rows for the active context", async () => {
            await openPicker();
            await expect(page.locator("[data-test-id='namespace-quick-picker-row']").first()).toBeVisible();
            await closePicker();
        });

        test("filter hides non-matching namespace rows", async () => {
            await openPicker();
            await page.locator("[data-test-id='namespace-quick-picker-dropdown'] input").fill("kube");
            const nsTexts = await page.locator("[data-test-id='namespace-quick-picker-row']").allTextContents();
            expect(nsTexts.every((n) => n.toLowerCase().includes("kube"))).toBe(true);
            await closePicker();
        });

        test("selecting a namespace closes the picker", async () => {
            await openPicker();
            await page.locator("[data-test-id='namespace-quick-picker-row']").filter({ hasText: /^default/ }).click();
            await expect(page.locator("[data-test-id='namespace-quick-picker-dropdown']")).not.toBeVisible();
        });

        test("reopening the picker shows the selected namespace highlighted", async () => {
            await openPicker();
            const defaultRow = page.locator("[data-test-id='namespace-quick-picker-row']").filter({ hasText: /^default/ });
            await expect(defaultRow).toHaveClass(/Mui-selected/);
            await closePicker();
        });

        test("clicking All namespaces clears the namespace selection", async () => {
            await openPicker();
            await page.locator("[data-test-id='namespace-quick-picker-all']").click();
            await expect(page.locator("[data-test-id='namespace-quick-picker-dropdown']")).not.toBeVisible();
            await openPicker();
            await expect(page.locator("[data-test-id='namespace-quick-picker-all']")).toHaveClass(/Mui-selected/);
            await closePicker();
        });

    });

    // ── Shareable URL state ─────────────────────────────────────────────────────

    test.describe("shareable url state", () => {
        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await navigateTo();
        });

        test.afterAll(async () => {
            setContext(CLUSTER_1);
            // Return to a param-free URL so later blocks start from the terminal default.
            await page.goto("/cluster", { waitUntil: "networkidle" });
        });

        test("selecting a context via the header dropdown writes ?context to the URL", async () => {
            await page.locator("[aria-haspopup='listbox']").click();
            await page.locator(`[data-value="${CLUSTER_2}"]`).click();
            await expect(page).toHaveURL(new RegExp(`context=${CLUSTER_2}`));
        });

        test("selecting a namespace via the picker writes ?namespace to the URL", async () => {
            await page.locator("[aria-label='namespace picker']").click();
            await page.locator("[data-test-id='namespace-quick-picker-row']").filter({ hasText: /^default/ }).click();
            await expect(page).toHaveURL(/namespace=default/);
        });

        test("clearing the namespace removes ?namespace from the URL", async () => {
            await page.locator("[aria-label='namespace picker']").click();
            await page.locator("[data-test-id='namespace-quick-picker-all']").click();
            await expect(page).not.toHaveURL(/namespace=/);
        });

        test("navigating to a URL with ?context restores that context in the header", async () => {
            await page.goto(`/cluster?context=${CLUSTER_2}`, { waitUntil: "networkidle" });
            await expect(page.locator("[aria-haspopup='listbox']")).toContainText(CLUSTER_2);
        });

        test("navigating to a URL with ?context shows that context's nodes", async () => {
            await page.goto(`/nodes?context=${CLUSTER_2}`, { waitUntil: "networkidle" });
            await waitForNodeRows();
            const names = await getNodeNames();
            expect(names).toContain("node-alpha");
            expect(names).not.toContain("node-cp");
        });

        test("navigating to a URL with ?namespace restores the namespace chip in the header", async () => {
            await page.goto(`/nodes?context=${CLUSTER_1}&namespace=kube-system`, { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='header-namespace-chip']")).toHaveText("kube-system");
        });

        test("the context param survives navigation to a workloads page via the sidebar", async () => {
            await page.goto(`/cluster?context=${CLUSTER_2}`, { waitUntil: "networkidle" });
            await page.locator("nav a[href^='/nodes']").click();
            await expect(page).toHaveURL(new RegExp(`context=${CLUSTER_2}`));
            await waitForNodeRows();
            const names = await getNodeNames();
            expect(names).toContain("node-alpha");
        });
    });

    // ── Share button ──────────────────────────────────────────────────────────

    test.describe("share button", () => {
        test.beforeAll(async () => {
            // The button copies to the clipboard, which needs explicit permission in the browser context.
            await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
            setContext(CLUSTER_1);
        });

        test.afterAll(async () => {
            setContext(CLUSTER_1);
            await page.goto("/cluster", { waitUntil: "networkidle" });
        });

        test("is visible on every page", async () => {
            await page.goto("/cluster", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='share-button']")).toBeVisible();
        });

        test("copies the current page URL (page, context, and namespace) to the clipboard", async () => {
            await page.goto(`/nodes?context=${CLUSTER_1}&namespace=kube-system`, { waitUntil: "networkidle" });
            await page.locator("[data-test-id='share-button']").click();
            const copied = await page.evaluate(() => navigator.clipboard.readText());
            expect(copied).toBe(page.url());
            expect(copied).toContain("/nodes");
            expect(copied).toContain(`context=${CLUSTER_1}`);
            expect(copied).toContain("namespace=kube-system");
        });

        test("copies a resource detail URL so the exact resource can be shared", async () => {
            await page.goto(`/nodes/node-cp?context=${CLUSTER_1}`, { waitUntil: "networkidle" });
            await page.locator("[data-test-id='share-button']").click();
            const copied = await page.evaluate(() => navigator.clipboard.readText());
            expect(copied).toContain("/nodes/node-cp");
            expect(copied).toContain(`context=${CLUSTER_1}`);
        });

        test("shows copied feedback after clicking", async () => {
            await page.goto("/cluster", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='share-button']").click();
            await expect(page.locator("[data-test-id='share-button']")).toHaveAttribute("aria-label", "share link");
            await expect(page.locator("[aria-label='share link'] svg[data-icon='check']")).toBeVisible();
        });
    });

    // ── Workloads pages ───────────────────────────────────────────────────────

    test.describe("deployments page", () => {
        const FAKE_DEPLOYMENTS = {
            deployments: [
                {
                    name: "nginx",
                    namespace: "default",
                    ready: "2/2",
                    upToDate: 2,
                    available: 2,
                    createdAt: new Date().toISOString(),
                },
            ],
        };

        const FAKE_DEPLOYMENT_DETAIL = {
            kind: "deployments",
            name: "nginx",
            namespace: "default",
            createdAt: new Date().toISOString(),
            labels: { app: "nginx" },
            selector: { app: "nginx" },
            stats: [
                { label: "Ready", value: "2/2" },
                { label: "Up-to-date", value: "2" },
                { label: "Available", value: "2" },
            ],
            pods: [
                {
                    name: "nginx-abc",
                    namespace: "default",
                    phase: "Running",
                    ready: "1/1",
                    containerCount: 1,
                    restarts: 0,
                    createdAt: new Date().toISOString(),
                    node: "node-worker",
                },
            ],
            events: [],
        };

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await page.route("**/api/deployments/default/nginx*", async (route) => {
                await route.fulfill({
                    json: FAKE_DEPLOYMENT_DETAIL,
                });
            });
            await page.route("**/api/deployments*", async (route) => {
                await route.fulfill({
                json: FAKE_DEPLOYMENTS,
            });
            });
            await page.goto("/deployments", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='deployments-table']")).toBeVisible();
        });

        test.afterAll(async () => {
            await page.unroute("**/api/deployments*");
            await page.unroute("**/api/deployments/default/nginx*");
        });

        test("shows page title Deployments", async () => {
            await expect(page.locator("[data-test-id='breadcrumb-item']").first()).toHaveText("Deployments");
        });

        test("has column headers Name, Namespace, Ready, Up-to-date, Available, Age", async () => {
            const table = page.locator("[data-test-id='deployments-table']");
            for (const col of ["Name", "Namespace", "Ready", "Up-to-date", "Available", "Age"]) {
                await expect(table.getByRole("columnheader", { name: col, exact: true })).toBeVisible();
            }
        });

        test("shows a row for the fake deployment", async () => {
            await expect(page.locator("[data-test-id='deployment-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='deployment-row'] td:first-child")).toHaveText("nginx");
        });

        test("stats header shows total/healthy/error (1 deployment, ready 2/2)", async () => {
            await expect(page.locator("[data-test-id='deployments-stats-total']")).toHaveText("Total: 1");
            await expect(page.locator("[data-test-id='deployments-stats-healthy']")).toHaveText("Healthy: 1");
            await expect(page.locator("[data-test-id='deployments-stats-error']")).toHaveText("Error: 0");
        });

        test("search filters deployment rows by the typed term", async () => {
            // A matching term keeps the row.
            await page.locator("[data-test-id='deployments-search'] input").fill("nginx");
            await expect(page.locator("[data-test-id='deployment-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='deployment-row'] td:first-child")).toHaveText("nginx");
            // A non-matching term hides every row and shows the no-match message.
            await page.locator("[data-test-id='deployments-search'] input").fill("zzznotfound");
            await expect(page.locator("[data-test-id='deployment-row']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='no-deployments-match']")).toBeVisible();
            // Clearing the search restores the full list.
            await page.locator("[data-test-id='deployments-search'] input").fill("");
            await expect(page.locator("[data-test-id='deployment-row']")).toHaveCount(1);
        });

        test("clicking a deployment row navigates to its detail URL", async () => {
            await page.locator("[data-test-id='deployment-row']").click();
            await expect(page).toHaveURL(/\/deployments\/default\/nginx/);
            await page.goto("/deployments", { waitUntil: "networkidle" });
        });

        test("the deployment detail page renders content and is not blank", async () => {
            await page.goto("/deployments/default/nginx", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='breadcrumb-item']").first()).toHaveText("Deployments");
            await expect(page.locator("[data-test-id='workload-detail']")).toBeVisible();
            await expect(page.locator("[data-test-id='workload-stat']").filter({ hasText: "Ready" })).toContainText("2/2");
            await page.goto("/deployments", { waitUntil: "networkidle" });
        });

        test("the deployment detail Pods sub-tab lists the workload's pods", async () => {
            await page.goto("/deployments/default/nginx", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='workload-tab-pods']").click();
            await expect(page.locator("[data-test-id='workload-panel-pods']")).toBeVisible();
            await expect(page.locator("[data-test-id='workload-pod-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='workload-pod-row'] td:first-child")).toHaveText("nginx-abc");
            await page.goto("/deployments", { waitUntil: "networkidle" });
        });

        test("the deployment detail Pods sub-tab shows the stats header (1 Running pod)", async () => {
            await page.goto("/deployments/default/nginx", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='workload-tab-pods']").click();
            await expect(page.locator("[data-test-id='workload-pods-stats-total']")).toHaveText("Total: 1");
            await expect(page.locator("[data-test-id='workload-pods-stats-healthy']")).toHaveText("Healthy: 1");
            await expect(page.locator("[data-test-id='workload-pods-stats-error']")).toHaveText("Error: 0");
            await page.goto("/deployments", { waitUntil: "networkidle" });
        });

        test("clicking a pod row on the deployment Pods sub-tab navigates to the pod detail", async () => {
            await page.goto("/deployments/default/nginx", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='workload-tab-pods']").click();
            await page.locator("[data-test-id='workload-pod-row']").click();
            await expect(page).toHaveURL(/\/pods\/default\/nginx-abc/);
            await page.goto("/deployments", { waitUntil: "networkidle" });
        });

        test("the workload Namespace reference links to the namespace detail page", async () => {
            await page.goto("/deployments/default/nginx", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='workload-detail-namespace-link']").click();
            await expect(page).toHaveURL(/\/namespaces\/default/);
            await page.goto("/deployments", { waitUntil: "networkidle" });
        });

        test("the Node cell on the deployment Pods sub-tab links to the node detail page without triggering the row's pod navigation", async () => {
            await page.goto("/deployments/default/nginx", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='workload-tab-pods']").click();
            await page.locator("[data-test-id='workload-pod-node-link']").click();
            // The node link wins over the row's pod navigation.
            await expect(page).toHaveURL(/\/nodes\/node-worker/);
            await page.goto("/deployments", { waitUntil: "networkidle" });
        });

        test("the deployment detail Labels tab shows the workload's own labels", async () => {
            await page.goto("/deployments/default/nginx", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='workload-tab-labels']").click();
            await expect(page.locator("[data-test-id='labels-table']")).toBeVisible();
            await expect(
                page.locator("[data-test-id='label-row']").filter({ hasText: "app" })
            ).toContainText("nginx");
            await page.goto("/deployments", { waitUntil: "networkidle" });
        });

        test("the deployment detail Commands tab lists read-only kubectl suggestions", async () => {
            await page.goto("/deployments/default/nginx", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='workload-tab-commands']").click();
            await expect(page.locator("[data-test-id='commands-tab']")).toBeVisible();
            await expect(page.locator("[data-test-id='commands-readonly-note']")).toBeVisible();
            const commands = await page.locator("[data-test-id='command-text']").allTextContents();
            expect(commands).toContain("kubectl describe deployment nginx -n default");
            expect(commands).toContain("kubectl rollout restart deployment/nginx -n default");
            await page.goto("/deployments", { waitUntil: "networkidle" });
        });
    });

    test.describe("stateful sets page", () => {
        const FAKE_STATEFULSETS = {
            statefulSets: [
                {
                    name: "postgres",
                    namespace: "default",
                    ready: "1/1",
                    createdAt: new Date().toISOString(),
                },
            ],
        };

        const FAKE_STATEFULSET_DETAIL = {
            kind: "statefulsets",
            name: "postgres",
            namespace: "default",
            createdAt: new Date().toISOString(),
            labels: { app: "postgres" },
            selector: { app: "postgres" },
            stats: [
                { label: "Ready", value: "1/1" },
                { label: "Current", value: "1" },
                { label: "Updated", value: "1" },
            ],
            pods: [
                {
                    name: "postgres-0",
                    namespace: "default",
                    phase: "Running",
                    ready: "1/1",
                    containerCount: 1,
                    restarts: 0,
                    createdAt: new Date().toISOString(),
                    node: "node-worker",
                },
            ],
            events: [],
        };

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await page.route("**/api/statefulsets/default/postgres*", async (route) => {
                await route.fulfill({
                    json: FAKE_STATEFULSET_DETAIL,
                });
            });
            await page.route("**/api/statefulsets*", async (route) => {
                await route.fulfill({
                json: FAKE_STATEFULSETS,
            });
            });
            await page.goto("/statefulsets", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='statefulsets-table']")).toBeVisible();
        });

        test.afterAll(async () => {
            await page.unroute("**/api/statefulsets*");
            await page.unroute("**/api/statefulsets/default/postgres*");
        });

        test("shows page title StatefulSets", async () => {
            await expect(page.locator("[data-test-id='breadcrumb-item']").first()).toHaveText("StatefulSets");
        });

        test("shows a row for the fake stateful set", async () => {
            await expect(page.locator("[data-test-id='statefulset-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='statefulset-row'] td:first-child")).toHaveText("postgres");
        });

        test("stats header shows total/healthy/error (1 stateful set, ready 1/1)", async () => {
            await expect(page.locator("[data-test-id='statefulsets-stats-total']")).toHaveText("Total: 1");
            await expect(page.locator("[data-test-id='statefulsets-stats-healthy']")).toHaveText("Healthy: 1");
            await expect(page.locator("[data-test-id='statefulsets-stats-error']")).toHaveText("Error: 0");
        });

        test("search filters stateful set rows by the typed term", async () => {
            await page.locator("[data-test-id='statefulsets-search'] input").fill("postgres");
            await expect(page.locator("[data-test-id='statefulset-row']")).toHaveCount(1);
            await page.locator("[data-test-id='statefulsets-search'] input").fill("zzznotfound");
            await expect(page.locator("[data-test-id='statefulset-row']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='no-statefulsets-match']")).toBeVisible();
            await page.locator("[data-test-id='statefulsets-search'] input").fill("");
            await expect(page.locator("[data-test-id='statefulset-row']")).toHaveCount(1);
        });

        test("clicking a stateful set row navigates to its detail URL", async () => {
            await page.locator("[data-test-id='statefulset-row']").click();
            await expect(page).toHaveURL(/\/statefulsets\/default\/postgres/);
            await page.goto("/statefulsets", { waitUntil: "networkidle" });
        });

        test("the stateful set detail page renders content and is not blank", async () => {
            await page.goto("/statefulsets/default/postgres", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='breadcrumb-item']").first()).toHaveText("StatefulSets");
            await expect(page.locator("[data-test-id='workload-detail']")).toBeVisible();
            await expect(page.locator("[data-test-id='workload-stat']").filter({ hasText: "Ready" })).toContainText("1/1");
            await page.goto("/statefulsets", { waitUntil: "networkidle" });
        });

        test("the stateful set detail Pods sub-tab lists the workload's pods", async () => {
            await page.goto("/statefulsets/default/postgres", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='workload-tab-pods']").click();
            await expect(page.locator("[data-test-id='workload-panel-pods']")).toBeVisible();
            await expect(page.locator("[data-test-id='workload-pod-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='workload-pod-row'] td:first-child")).toHaveText("postgres-0");
            await page.goto("/statefulsets", { waitUntil: "networkidle" });
        });

        test("the stateful set detail Pods sub-tab shows the stats header (1 Running pod)", async () => {
            await page.goto("/statefulsets/default/postgres", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='workload-tab-pods']").click();
            await expect(page.locator("[data-test-id='workload-pods-stats-total']")).toHaveText("Total: 1");
            await expect(page.locator("[data-test-id='workload-pods-stats-healthy']")).toHaveText("Healthy: 1");
            await expect(page.locator("[data-test-id='workload-pods-stats-error']")).toHaveText("Error: 0");
            await page.goto("/statefulsets", { waitUntil: "networkidle" });
        });
    });

    test.describe("daemon sets page", () => {
        const FAKE_DAEMONSETS = {
            daemonSets: [
                {
                    name: "fluentd",
                    namespace: "kube-system",
                    desired: 2,
                    current: 2,
                    ready: 2,
                    upToDate: 2,
                    available: 2,
                    createdAt: new Date().toISOString(),
                },
            ],
        };

        const FAKE_DAEMONSET_DETAIL = {
            kind: "daemonsets",
            name: "fluentd",
            namespace: "kube-system",
            createdAt: new Date().toISOString(),
            labels: { app: "fluentd" },
            selector: { app: "fluentd" },
            stats: [
                { label: "Desired", value: "2" },
                { label: "Current", value: "2" },
                { label: "Ready", value: "2" },
                { label: "Up-to-date", value: "2" },
                { label: "Available", value: "2" },
            ],
            pods: [
                {
                    name: "fluentd-xyz",
                    namespace: "kube-system",
                    phase: "Running",
                    ready: "1/1",
                    containerCount: 1,
                    restarts: 0,
                    createdAt: new Date().toISOString(),
                    node: "node-worker",
                },
            ],
            events: [],
        };

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await page.route("**/api/daemonsets/kube-system/fluentd*", async (route) => {
                await route.fulfill({
                    json: FAKE_DAEMONSET_DETAIL,
                });
            });
            await page.route("**/api/daemonsets*", async (route) => {
                await route.fulfill({
                json: FAKE_DAEMONSETS,
            });
            });
            await page.goto("/daemonsets", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='daemonsets-table']")).toBeVisible();
        });

        test.afterAll(async () => {
            await page.unroute("**/api/daemonsets*");
            await page.unroute("**/api/daemonsets/kube-system/fluentd*");
        });

        test("shows page title DaemonSets", async () => {
            await expect(page.locator("[data-test-id='breadcrumb-item']").first()).toHaveText("DaemonSets");
        });

        test("shows a row for the fake daemon set", async () => {
            await expect(page.locator("[data-test-id='daemonset-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='daemonset-row'] td:first-child")).toHaveText("fluentd");
        });

        test("stats header shows total/healthy/error (1 daemon set, 2/2 ready)", async () => {
            await expect(page.locator("[data-test-id='daemonsets-stats-total']")).toHaveText("Total: 1");
            await expect(page.locator("[data-test-id='daemonsets-stats-healthy']")).toHaveText("Healthy: 1");
            await expect(page.locator("[data-test-id='daemonsets-stats-error']")).toHaveText("Error: 0");
        });

        test("search filters daemon set rows by the typed term", async () => {
            await page.locator("[data-test-id='daemonsets-search'] input").fill("fluentd");
            await expect(page.locator("[data-test-id='daemonset-row']")).toHaveCount(1);
            await page.locator("[data-test-id='daemonsets-search'] input").fill("zzznotfound");
            await expect(page.locator("[data-test-id='daemonset-row']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='no-daemonsets-match']")).toBeVisible();
            await page.locator("[data-test-id='daemonsets-search'] input").fill("");
            await expect(page.locator("[data-test-id='daemonset-row']")).toHaveCount(1);
        });

        test("clicking a daemon set row navigates to its detail URL", async () => {
            await page.locator("[data-test-id='daemonset-row']").click();
            await expect(page).toHaveURL(/\/daemonsets\/kube-system\/fluentd/);
            await page.goto("/daemonsets", { waitUntil: "networkidle" });
        });

        test("the daemon set detail page renders content and is not blank", async () => {
            await page.goto("/daemonsets/kube-system/fluentd", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='breadcrumb-item']").first()).toHaveText("DaemonSets");
            await expect(page.locator("[data-test-id='workload-detail']")).toBeVisible();
            await expect(page.locator("[data-test-id='workload-stat']").filter({ hasText: "Desired" })).toContainText("2");
            await page.goto("/daemonsets", { waitUntil: "networkidle" });
        });

        test("the daemon set detail Pods sub-tab lists the workload's pods and links to pod detail", async () => {
            await page.goto("/daemonsets/kube-system/fluentd", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='workload-tab-pods']").click();
            await expect(page.locator("[data-test-id='workload-panel-pods']")).toBeVisible();
            await expect(page.locator("[data-test-id='workload-pod-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='workload-pod-row'] td:first-child")).toHaveText("fluentd-xyz");
            await page.locator("[data-test-id='workload-pod-row']").click();
            await expect(page).toHaveURL(/\/pods\/kube-system\/fluentd-xyz/);
            await page.goto("/daemonsets", { waitUntil: "networkidle" });
        });

        test("the daemon set detail Pods sub-tab shows the stats header (1 Running pod)", async () => {
            await page.goto("/daemonsets/kube-system/fluentd", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='workload-tab-pods']").click();
            await expect(page.locator("[data-test-id='workload-pods-stats-total']")).toHaveText("Total: 1");
            await expect(page.locator("[data-test-id='workload-pods-stats-healthy']")).toHaveText("Healthy: 1");
            await expect(page.locator("[data-test-id='workload-pods-stats-error']")).toHaveText("Error: 0");
            await page.goto("/daemonsets", { waitUntil: "networkidle" });
        });
    });

    test.describe("workload Pods sub-tab empty state", () => {
        const FAKE_DEPLOYMENT_NO_PODS = {
            kind: "deployments",
            name: "empty",
            namespace: "default",
            createdAt: new Date().toISOString(),
            labels: { app: "empty" },
            selector: { app: "empty" },
            stats: [{ label: "Ready", value: "0/0" }],
            pods: [],
            events: [],
        };

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await page.route("**/api/deployments/default/empty*", async (route) => {
                await route.fulfill({ json: FAKE_DEPLOYMENT_NO_PODS });
            });
        });

        test.afterAll(async () => {
            await page.unroute("**/api/deployments/default/empty*");
        });

        test("shows a clear empty state when the workload owns no pods", async () => {
            await page.goto("/deployments/default/empty", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='workload-tab-pods']").click();
            await expect(page.locator("[data-test-id='workload-panel-pods']")).toBeVisible();
            await expect(page.locator("[data-test-id='no-workload-pods']")).toBeVisible();
            await expect(page.locator("[data-test-id='workload-pod-row']")).toHaveCount(0);
        });

        test("the stats header renders zeroed in the empty state", async () => {
            await page.goto("/deployments/default/empty", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='workload-tab-pods']").click();
            await expect(page.locator("[data-test-id='workload-pods-stats-total']")).toHaveText("Total: 0");
            await expect(page.locator("[data-test-id='workload-pods-stats-healthy']")).toHaveText("Healthy: 0");
            await expect(page.locator("[data-test-id='workload-pods-stats-error']")).toHaveText("Error: 0");
        });
    });

    // ── Clickable rows ────────────────────────────────────────────────────────

    test.describe("clickable node rows", () => {
        const FAKE_NODE_DETAIL = {
            name: "node-cp",
            status: "Ready",
            roles: ["control-plane"],
            version: "v1.29.0",
            createdAt: new Date().toISOString(),
            conditions: [],
            capacity: { cpu: "4", memory: "8Gi", pods: "110" },
            allocatable: { cpu: "3900m", memory: "7Gi", pods: "110" },
            addresses: [],
            labels: {},
            pods: [],
            events: [],
        };

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await page.route("**/api/nodes/node-cp*", async (route) => {
                await route.fulfill({
                json: FAKE_NODE_DETAIL,
            });
            });
            await page.goto("/nodes", { waitUntil: "networkidle" });
            await waitForNodeRows();
        });

        test.afterAll(async () => {
            await page.unroute("**/api/nodes/node-cp*");
        });

        test("clicking a node row navigates to its detail page", async () => {
            await page.locator("[data-test-id='node-row']").filter({ hasText: "node-cp" }).click();
            await expect(page).toHaveURL(/\/nodes\/node-cp/);
            await expect(page.locator("[data-test-id='breadcrumb-item']").first()).toHaveText("Nodes");
        });
    });

    // ── Pod detail page ───────────────────────────────────────────────────────

    test.describe("pod detail page", () => {
        const FAKE_POD_DETAIL = {
            name: "nginx-abc",
            namespace: "default",
            phase: "Running",
            node: "node-worker",
            podIP: "10.0.0.1",
            createdAt: new Date().toISOString(),
            labels: { app: "nginx" },
            containers: [
                {
                    name: "nginx",
                    image: "nginx:latest",
                    ready: true,
                    restarts: 0,
                    state: "Running",
                    stateReason: "",
                },
                {
                    name: "sidecar",
                    image: "busybox:latest",
                    ready: true,
                    restarts: 0,
                    state: "Running",
                    stateReason: "",
                },
            ],
            initContainers: [
                {
                    name: "init-setup",
                    image: "busybox:1.36",
                    ready: true,
                    restarts: 0,
                    state: "Terminated",
                    stateReason: "Completed",
                },
            ],
            events: [
                {
                    type: "Normal",
                    reason: "Pulled",
                    message: "Successfully pulled image",
                    count: 1,
                    lastSeen: new Date().toISOString(),
                },
            ],
        };

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await page.route("**/api/pods/default/nginx-abc*", async (route) => {
                await route.fulfill({
                    json: FAKE_POD_DETAIL,
                });
            });
            await page.goto("/pods/default/nginx-abc", { waitUntil: "networkidle" });
        });

        test.afterAll(async () => {
            await page.unroute("**/api/pods/default/nginx-abc*");
        });

        test("shows page title Pods", async () => {
            await expect(page.locator("[data-test-id='breadcrumb-item']").first()).toHaveText("Pods");
        });

        test("shows the pod name as heading", async () => {
            await expect(page.getByRole("heading", { name: "nginx-abc" })).toBeVisible();
        });

        test("shows Running status chip", async () => {
            await expect(page.locator(".MuiChip-label", { hasText: "Running" }).first()).toBeVisible();
        });

        test("defaults to the Status tab showing the events table", async () => {
            await expect(page.locator("[data-test-id='pod-panel-detail']")).toBeVisible();
            await expect(page.locator("[data-test-id='event-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='pod-panel-containers']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='pod-panel-init-containers']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='pod-panel-logs']")).toHaveCount(0);
        });

        test("the Namespace reference links to the namespace detail page", async () => {
            await page.goto("/pods/default/nginx-abc", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='pod-detail-namespace-link']").click();
            await expect(page).toHaveURL(/\/namespaces\/default/);
            // Return to the pod detail page for the remaining tests in this block.
            await page.goto("/pods/default/nginx-abc", { waitUntil: "networkidle" });
        });

        test("the Node reference links to the node detail page", async () => {
            await page.goto("/pods/default/nginx-abc", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='pod-detail-node-link']").click();
            await expect(page).toHaveURL(/\/nodes\/node-worker/);
            await page.goto("/pods/default/nginx-abc", { waitUntil: "networkidle" });
        });

        test("clicking the Containers tab shows only the regular containers", async () => {
            await page.locator("[data-test-id='pod-tab-containers']").click();
            await expect(page.locator("[data-test-id='pod-panel-containers']")).toBeVisible();
            const names = await page.locator("[data-test-id='container-row'] td:first-child").allTextContents();
            expect(names).toContain("nginx");
            expect(names).toContain("sidecar");
            expect(names).not.toContain("init-setup");
            // Init containers live on their own separate tab/panel.
            await expect(page.locator("[data-test-id='pod-panel-init-containers']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='pod-panel-detail']")).toHaveCount(0);
        });

        test("clicking the Init Containers tab shows only the init containers", async () => {
            await page.locator("[data-test-id='pod-tab-init-containers']").click();
            await expect(page.locator("[data-test-id='pod-panel-init-containers']")).toBeVisible();
            const names = await page.locator("[data-test-id='init-container-row'] td:first-child").allTextContents();
            expect(names).toEqual(["init-setup"]);
            await expect(page.locator("[data-test-id='container-row']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='pod-panel-containers']")).toHaveCount(0);
        });

        test("clicking the Logs tab auto-loads and streams the log viewer with realistic content", async () => {
            // Opening the Logs tab starts the live stream automatically: no button to
            // load logs or start streaming, and the stream request fires on mount.
            const streamRequest = page.waitForRequest((req) => req.url().includes("/logs/stream"));
            await page.locator("[data-test-id='pod-tab-logs']").click();
            await streamRequest;
            await expect(page.locator("[data-test-id='pod-panel-logs']")).toBeVisible();
            await expect(page.locator("[data-test-id='log-viewer']")).toBeVisible();
            await expect(page.locator("[data-test-id='log-viewer']")).toContainText("kube-probe/1.29");
            await expect(page.locator("[data-test-id='log-viewer']")).toContainText("start worker processes");
        });

        test("there is no load-logs or start-stream button", async () => {
            // Logs auto-load and auto-stream, so no explicit load/start control exists.
            await expect(page.locator("[data-test-id='log-load']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='log-live-toggle']")).toHaveCount(0);
        });

        test("while streaming with no lines yet the log panel shows the progress indicator, not loading text", async () => {
            // Intercept the stream and delay its first line so the pre-line streaming
            // state is observable; the panel must show the spinner, not "(waiting for logs...)".
            await page.route("**/api/pods/default/nginx-abc/logs/stream*", async (route) => {
                await new Promise((resolve) => setTimeout(resolve, 1500));
                // The pod log stream uses the default SSE `message` event (raw lines).
                await route.fulfill({
                    headers: { "Content-Type": "text/event-stream" },
                    body: `data: start worker processes\n\n`,
                });
            });
            await page.goto("/pods/default/nginx-abc", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='pod-tab-logs']").click();
            // The spinner stands in for the loading state; no "(waiting for logs...)" text.
            await expect(page.locator("[data-test-id='log-viewer'] [data-test-id='loading-indicator']")).toBeVisible();
            await expect(page.locator("[data-test-id='log-viewer']")).not.toContainText("waiting for logs");
            // Once a line arrives, the indicator is gone and the line is shown.
            await expect(page.locator("[data-test-id='log-viewer']")).toContainText("start worker processes");
            await expect(page.locator("[data-test-id='log-viewer'] [data-test-id='loading-indicator']")).toHaveCount(0);
            // Restore the real backend stream and re-open the Logs tab for later tests.
            await page.unroute("**/api/pods/default/nginx-abc/logs/stream*");
            await page.goto("/pods/default/nginx-abc", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='pod-tab-logs']").click();
            await expect(page.locator("[data-test-id='log-viewer']")).toBeVisible();
        });

        test("container selector is visible and lists both containers", async () => {
            await expect(page.locator("[data-test-id='log-viewer']")).toBeVisible();
            await expect(page.locator("[data-test-id='log-container-select']")).toBeVisible();
            await page.locator("[data-test-id='log-container-select'] [role='combobox']").click();
            const options = await page.locator("[data-test-id='log-container-option']").allTextContents();
            expect(options).toContain("nginx");
            expect(options).toContain("sidecar");
            await page.keyboard.press("Escape");
        });

        test("switching container restarts the stream with the correct container param", async () => {
            const requestPromise = page.waitForRequest((req) => req.url().includes("/logs/stream") && req.url().includes("container=sidecar"));
            await page.locator("[data-test-id='log-container-select'] [role='combobox']").click();
            await page.locator("[data-test-id='log-container-option']").filter({ hasText: "sidecar" }).click();
            await requestPromise;
        });

        test("changing tail lines restarts the stream with the correct tail param", async () => {
            const requestPromise = page.waitForRequest((req) => req.url().includes("/logs/stream") && req.url().includes("tail=50"));
            await page.locator("[data-test-id='log-tail-select'] [role='combobox']").click();
            await page.locator("[data-test-id='log-tail-option']").filter({ hasText: /^50$/ }).click();
            await requestPromise;
        });

        test("refresh button re-opens the log stream", async () => {
            // The fake-logs backend closes the stream after emitting its lines, so the
            // refresh button re-enables. Clicking it restarts the stream from scratch.
            const refresh = page.locator("[data-test-id='log-refresh']");
            await expect(refresh).toBeEnabled();
            const requestPromise = page.waitForRequest((req) => req.url().includes("/logs/stream"));
            await refresh.click();
            await requestPromise;
            await expect(page.locator("[data-test-id='log-viewer']")).toContainText("start worker processes");
        });

        test("commands tab shows the read-only guided commands", async () => {
            await page.locator("[data-test-id='pod-tab-commands']").click();
            await expect(page.locator("[data-test-id='commands-tab']")).toBeVisible();
            await expect(page.locator("[data-test-id='commands-readonly-note']")).toBeVisible();
        });

        test("commands tab lists kubectl suggestions for the pod", async () => {
            const commands = await page.locator("[data-test-id='command-text']").allTextContents();
            expect(commands).toContain("kubectl describe pod nginx-abc -n default");
            expect(commands).toContain("kubectl logs nginx-abc -n default");
            expect(commands).toContain("kubectl delete pod nginx-abc -n default");
        });

        test("commands tab has a copy button per command", async () => {
            const rowCount = await page.locator("[data-test-id='command-row']").count();
            const copyCount = await page.locator("[data-test-id='command-copy']").count();
            expect(rowCount).toBeGreaterThan(0);
            expect(copyCount).toBe(rowCount);
        });

        test("commands tab copies a command to the clipboard", async () => {
            await page.locator("[data-test-id='command-copy']").first().click();
            const clip = await page.evaluate(() => navigator.clipboard.readText());
            expect(clip).toBe("kubectl describe pod nginx-abc -n default");
        });

        test("commands tab search filters the command list", async () => {
            const before = await page.locator("[data-test-id='command-row']").count();
            await page.locator("[data-test-id='commands-search'] input").fill("delete");
            const after = await page.locator("[data-test-id='command-row']").count();
            expect(after).toBeLessThan(before);
            const commands = await page.locator("[data-test-id='command-text']").allTextContents();
            expect(commands).toContain("kubectl delete pod nginx-abc -n default");
            expect(commands).not.toContain("kubectl describe pod nginx-abc -n default");
            await page.locator("[data-test-id='commands-search'] input").fill("");
        });
    });

    // ── Labels tab (per-detail-page, single resource's own labels) ──────────────

    test.describe("pod detail Labels tab", () => {
        // A pod with several labels so sort and search are observable. The Labels
        // tab shows only this one pod's own labels, as a Key / Value table.
        const FAKE_POD_LABELLED = {
            name: "web-1",
            namespace: "default",
            phase: "Running",
            node: "node-worker",
            podIP: "10.0.0.9",
            createdAt: new Date().toISOString(),
            labels: { app: "web", tier: "frontend", env: "prod" },
            containers: [
                { name: "web", image: "web:1", ready: true, restarts: 0, state: "Running", stateReason: "" },
            ],
            initContainers: [],
            events: [],
        };

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await page.route("**/api/pods/default/web-1*", async (route) => {
                await route.fulfill({ json: FAKE_POD_LABELLED });
            });
            await page.goto("/pods/default/web-1", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='pod-tab-labels']").click();
            await expect(page.locator("[data-test-id='labels-tab']")).toBeVisible();
        });

        test.afterAll(async () => {
            await page.unroute("**/api/pods/default/web-1*");
        });

        test("renders the Labels tab as a Key / Value table with one row per label", async () => {
            await expect(page.locator("[data-test-id='labels-table']")).toBeVisible();
            await expect(page.locator("[data-test-id='label-row']")).toHaveCount(3);
            // Default order is by key: app, env, tier.
            const keys = await page.locator("[data-test-id='label-row'] td:first-child").allTextContents();
            expect(keys).toEqual(["app", "env", "tier"]);
        });

        test("sorting on the Key column reverses the row order", async () => {
            // Click once for ascending (already the default), then again for descending.
            await page.locator("[data-test-id='labels-header-key']").click();
            await page.locator("[data-test-id='labels-header-key']").click();
            const keys = await page.locator("[data-test-id='label-row'] td:first-child").allTextContents();
            expect(keys).toEqual(["tier", "env", "app"]);
            // Restore ascending so later tests start from a known order.
            await page.locator("[data-test-id='labels-header-key']").click();
        });

        test("searching filters the rows to matching labels", async () => {
            await page.locator("[data-test-id='labels-filter'] input").fill("tier");
            await expect(page.locator("[data-test-id='label-row']")).toHaveCount(1);
            const keys = await page.locator("[data-test-id='label-row'] td:first-child").allTextContents();
            expect(keys).toEqual(["tier"]);
        });

        test("a non-matching search shows the no-match message", async () => {
            await page.locator("[data-test-id='labels-filter'] input").fill("zzzznope");
            await expect(page.locator("[data-test-id='no-labels-match']")).toBeVisible();
            await expect(page.locator("[data-test-id='label-row']")).toHaveCount(0);
        });

        test("clearing the search restores all label rows", async () => {
            await page.locator("[data-test-id='labels-filter'] input").fill("");
            await expect(page.locator("[data-test-id='label-row']")).toHaveCount(3);
        });
    });

    // ── Pod detail page without init containers ─────────────────────────────────

    test.describe("pod detail page without init containers", () => {
        const FAKE_POD_DETAIL_NO_INIT = {
            name: "redis-xyz",
            namespace: "default",
            phase: "Running",
            node: "node-worker",
            podIP: "10.0.0.2",
            createdAt: new Date().toISOString(),
            labels: { app: "redis" },
            containers: [
                {
                    name: "redis",
                    image: "redis:7",
                    ready: true,
                    restarts: 0,
                    state: "Running",
                    stateReason: "",
                },
            ],
            initContainers: [],
            events: [],
        };

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await page.route("**/api/pods/default/redis-xyz*", async (route) => {
                await route.fulfill({
                    json: FAKE_POD_DETAIL_NO_INIT,
                });
            });
            await page.goto("/pods/default/redis-xyz", { waitUntil: "networkidle" });
        });

        test.afterAll(async () => {
            await page.unroute("**/api/pods/default/redis-xyz*");
        });

        test("hides the Init Containers tab when the pod has no init containers", async () => {
            await expect(page.locator("[data-test-id='pod-tab-containers']")).toBeVisible();
            await expect(page.locator("[data-test-id='pod-tab-init-containers']")).toHaveCount(0);
        });

        test("still shows the regular containers on the Containers tab", async () => {
            await page.locator("[data-test-id='pod-tab-containers']").click();
            await expect(page.locator("[data-test-id='pod-panel-containers']")).toBeVisible();
            const names = await page.locator("[data-test-id='container-row'] td:first-child").allTextContents();
            expect(names).toEqual(["redis"]);
            await expect(page.locator("[data-test-id='pod-panel-init-containers']")).toHaveCount(0);
        });
    });

    // ── Container detail page ───────────────────────────────────────────────────

    test.describe("container detail page", () => {
        const FAKE_POD_DETAIL = {
            name: "nginx-abc",
            namespace: "default",
            phase: "Running",
            node: "node-worker",
            podIP: "10.0.0.1",
            createdAt: new Date().toISOString(),
            labels: { app: "nginx" },
            containers: [
                {
                    name: "nginx",
                    image: "nginx:latest",
                    ready: true,
                    restarts: 2,
                    state: "Running",
                    stateReason: "",
                },
                {
                    name: "sidecar",
                    image: "busybox:latest",
                    ready: true,
                    restarts: 0,
                    state: "Running",
                    stateReason: "",
                },
            ],
            initContainers: [
                {
                    name: "init-setup",
                    image: "busybox:1.36",
                    ready: true,
                    restarts: 0,
                    state: "Terminated",
                    stateReason: "Completed",
                },
            ],
            events: [],
        };

        const FAKE_POD_YAML = "apiVersion: v1\nkind: Pod\nmetadata:\n  name: nginx-abc\n  namespace: default\n";

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
            await page.route("**/api/pods/default/nginx-abc*", async (route) => {
                await route.fulfill({ json: FAKE_POD_DETAIL });
            });
            await page.route("**/api/yaml/pods/nginx-abc*", async (route) => {
                await route.fulfill({ json: { yaml: FAKE_POD_YAML } });
            });
            await page.goto("/pods/default/nginx-abc", { waitUntil: "networkidle" });
        });

        test.afterAll(async () => {
            await page.unroute("**/api/pods/default/nginx-abc*");
            await page.unroute("**/api/yaml/pods/nginx-abc*");
        });

        test("a container row in the Containers tab drills down to the container detail page", async () => {
            await page.goto("/pods/default/nginx-abc", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='pod-tab-containers']").click();
            await page.locator("[data-test-id='container-row']").filter({ hasText: "nginx" }).first().click();
            await expect(page).toHaveURL(/\/pods\/default\/nginx-abc\/containers\/nginx/);
            await expect(page.getByRole("heading", { name: "nginx" })).toBeVisible();
        });

        test("breadcrumbs reflect the pod -> container trail", async () => {
            await page.goto("/pods/default/nginx-abc/containers/nginx", { waitUntil: "networkidle" });
            const items = await page.locator("[data-test-id='breadcrumb-item']").allTextContents();
            // The full pod -> container trail is five crumbs (Pods, namespace, pod,
            // container, sub-tab), which exceeds MAX_TRAIL_ITEMS (4), so the trail
            // collapses its inner crumbs into a single "..." crumb, keeping the
            // first crumb and the last two.
            expect(items).toEqual(["Pods", "...", "nginx", "Status"]);
        });

        test("clicking the Pods breadcrumb returns to the pods list", async () => {
            await page.goto("/pods/default/nginx-abc/containers/nginx", { waitUntil: "networkidle" });
            // The pod crumb (nginx-abc) is collapsed into the "..." crumb on the
            // five-crumb container trail, so back-navigation is via the visible
            // root "Pods" crumb, which is always kept.
            await page.locator("[data-test-id='breadcrumb-item']").filter({ hasText: "Pods" }).click();
            await expect(page).toHaveURL(/\/pods$/);
        });

        test("defaults to the Status tab showing the container details", async () => {
            await page.goto("/pods/default/nginx-abc/containers/nginx", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='container-panel-detail']")).toBeVisible();
            await expect(page.locator("[data-test-id='container-panel-detail']")).toContainText("nginx:latest");
            await expect(page.locator("[data-test-id='container-panel-detail']")).toContainText("Running");
        });

        test("Logs tab auto-streams logs for the selected container", async () => {
            await page.goto("/pods/default/nginx-abc/containers/nginx", { waitUntil: "networkidle" });
            const streamRequest = page.waitForRequest((req) =>
                req.url().includes("/logs/stream") && req.url().includes("container=nginx"));
            await page.locator("[data-test-id='container-tab-logs']").click();
            await streamRequest;
            await expect(page.locator("[data-test-id='container-panel-logs']")).toBeVisible();
            await expect(page.locator("[data-test-id='log-viewer']")).toBeVisible();
        });

        test("Commands tab lists kubectl suggestions for the container", async () => {
            await page.goto("/pods/default/nginx-abc/containers/nginx", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='container-tab-commands']").click();
            await expect(page.locator("[data-test-id='commands-tab']")).toBeVisible();
            const commands = await page.locator("[data-test-id='command-text']").allTextContents();
            expect(commands).toContain("kubectl logs nginx-abc -c nginx -n default");
            expect(commands).toContain("kubectl exec -it nginx-abc -c nginx -- sh -n default");
        });

        test("YAML tab renders the parent pod yaml", async () => {
            await page.goto("/pods/default/nginx-abc/containers/nginx", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='container-tab-yaml']").click();
            await expect(page.locator("[data-test-id='container-panel-yaml']")).toBeVisible();
            await expect(page.locator("[data-test-id='yaml-content']")).toContainText("kind: Pod");
            await expect(page.locator("[data-test-id='yaml-content']")).toContainText("name: nginx-abc");
        });

        test("an init container row also drills down to a container detail page", async () => {
            await page.goto("/pods/default/nginx-abc", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='pod-tab-init-containers']").click();
            await page.locator("[data-test-id='init-container-row']").filter({ hasText: "init-setup" }).first().click();
            await expect(page).toHaveURL(/\/pods\/default\/nginx-abc\/containers\/init-setup/);
            await expect(page.getByRole("heading", { name: "init-setup" })).toBeVisible();
            await expect(page.locator(".MuiChip-label", { hasText: "Init Container" })).toBeVisible();
        });
    });

    // ── Node detail page ──────────────────────────────────────────────────────

    test.describe("node detail page", () => {
        const FAKE_NODE_DETAIL = {
            name: "node-cp",
            status: "Ready",
            roles: ["control-plane"],
            version: "v1.29.0",
            createdAt: new Date().toISOString(),
            conditions: [
                {
                    type: "Ready",
                    status: "True",
                    message: "kubelet is posting ready status",
                    lastTransition: new Date().toISOString(),
                },
            ],
            capacity: { cpu: "4", memory: "8Gi", pods: "110" },
            allocatable: { cpu: "3900m", memory: "7Gi", pods: "110" },
            addresses: [{ type: "InternalIP", address: "192.168.1.1" }],
            labels: { "kubernetes.io/hostname": "node-cp" },
            pods: [
                {
                    name: "coredns-abc",
                    namespace: "kube-system",
                    phase: "Running",
                    ready: "1/1",
                    restarts: 0,
                    createdAt: new Date().toISOString(),
                    node: "node-cp",
                },
            ],
            events: [
                {
                    type: "Warning",
                    reason: "NodeNotReady",
                    message: "Node node-cp status is now: NodeNotReady",
                    count: 3,
                    lastSeen: new Date().toISOString(),
                },
            ],
        };

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await page.route("**/api/nodes/node-cp*", async (route) => {
                await route.fulfill({
                json: FAKE_NODE_DETAIL,
            });
            });
            await page.goto("/nodes/node-cp", { waitUntil: "networkidle" });
        });

        test.beforeEach(async () => {
            // Reset to the default Status tab between tests.
            await page.goto("/nodes/node-cp", { waitUntil: "networkidle" });
        });

        test.afterAll(async () => {
            await page.unroute("**/api/nodes/node-cp*");
        });

        test("shows page title Nodes", async () => {
            await expect(page.locator("[data-test-id='breadcrumb-item']").first()).toHaveText("Nodes");
        });

        test("shows the node name as heading", async () => {
            await expect(page.getByRole("heading", { name: "node-cp" })).toBeVisible();
        });

        test("shows Ready status chip", async () => {
            await expect(page.locator(".MuiChip-label", { hasText: "Ready" }).first()).toBeVisible();
        });

        test("shows the Ready condition in the conditions table", async () => {
            await expect(page.locator("[data-test-id='condition-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='condition-row'] td:first-child")).toHaveText("Ready");
        });

        test("shows cpu, memory, pods rows in capacity table", async () => {
            await expect(page.getByRole("cell", { name: "cpu" })).toBeVisible();
            await expect(page.getByRole("cell", { name: "memory" })).toBeVisible();
            await expect(page.getByRole("cell", { name: "pods" })).toBeVisible();
        });

        test("shows the tabs and defaults to Status", async () => {
            await expect(page.locator("[data-test-id='node-tab-detail']")).toBeVisible();
            await expect(page.locator("[data-test-id='node-tab-pods']")).toBeVisible();
            await expect(page.locator("[data-test-id='node-tab-events']")).toBeVisible();
            await expect(page.locator("[data-test-id='node-tab-labels']")).toBeVisible();
            await expect(page.locator("[data-test-id='node-panel-detail']")).toBeVisible();
            await expect(page.locator("[data-test-id='node-panel-pods']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='node-panel-events']")).toHaveCount(0);
        });

        test("Labels tab shows the node's own labels as a Key / Value table", async () => {
            await page.locator("[data-test-id='node-tab-labels']").click();
            await expect(page.locator("[data-test-id='labels-table']")).toBeVisible();
            await expect(
                page.locator("[data-test-id='label-row']").filter({ hasText: "kubernetes.io/hostname" })
            ).toContainText("node-cp");
        });

        test("shows the scheduled pod in the pods table on the Pods tab", async () => {
            await page.locator("[data-test-id='node-tab-pods']").click();
            await expect(page.locator("[data-test-id='node-panel-pods']")).toBeVisible();
            await expect(page.locator("[data-test-id='node-pod-row'] td:first-child")).toHaveText("coredns-abc");
        });

        test("shows node events on the Events tab", async () => {
            await page.locator("[data-test-id='node-tab-events']").click();
            await expect(page.locator("[data-test-id='node-panel-events']")).toBeVisible();
            await expect(page.locator("[data-test-id='node-event-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='node-event-row'] td:nth-child(2)")).toHaveText("NodeNotReady");
        });

        test("clicking a pod row in node detail navigates to pod detail", async () => {
            await page.route("**/api/pods/kube-system/coredns-abc*", async (route) => {
                await route.fulfill({
                    json: {
                        name: "coredns-abc",
                        namespace: "kube-system",
                        phase: "Running",
                        node: "node-cp",
                        podIP: "10.0.0.2",
                        createdAt: new Date().toISOString(),
                        labels: {},
                        containers: [],
                        initContainers: [],
                        events: [],
                    },
                });
            });
            await page.locator("[data-test-id='node-tab-pods']").click();
            await page.locator("[data-test-id='node-pod-row']").click();
            await expect(page).toHaveURL(/\/pods\/kube-system\/coredns-abc/);
            await page.unroute("**/api/pods/kube-system/coredns-abc*");
        });

        test("commands tab shows guided commands for the node", async () => {
            await page.locator("[data-test-id='node-tab-commands']").click();
            await expect(page.locator("[data-test-id='commands-tab']")).toBeVisible();
            const commands = await page.locator("[data-test-id='command-text']").allTextContents();
            expect(commands).toContain("kubectl describe node node-cp");
            expect(commands).toContain("kubectl drain node-cp --ignore-daemonsets --delete-emptydir-data");
        });
    });

    // ── Performance tabs (scaffold stubs) ───────────────────────────────────────

    test.describe("Performance tabs", () => {
        const FAKE_PERF_NODE_DETAIL = {
            name: "node-cp",
            status: "Ready",
            roles: ["control-plane"],
            version: "v1.29.0",
            createdAt: new Date().toISOString(),
            conditions: [
                {
                    type: "Ready",
                    status: "True",
                    message: "kubelet is posting ready status",
                    lastTransition: new Date().toISOString(),
                },
            ],
            capacity: { cpu: "4", memory: "8Gi", pods: "110" },
            allocatable: { cpu: "3900m", memory: "7Gi", pods: "110" },
            addresses: [{ type: "InternalIP", address: "192.168.1.1" }],
            labels: { "kubernetes.io/hostname": "node-cp" },
            pods: [],
            events: [],
        };

        const FAKE_PERF_POD_DETAIL = {
            name: "nginx-abc",
            namespace: "default",
            phase: "Running",
            node: "node-cp",
            podIP: "10.0.0.5",
            createdAt: new Date().toISOString(),
            labels: {},
            containers: [],
            initContainers: [],
            events: [],
        };

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await page.route("**/api/nodes/node-cp*", async (route) => {
                await route.fulfill({ json: FAKE_PERF_NODE_DETAIL });
            });
            await page.route("**/api/pods/default/nginx-abc*", async (route) => {
                await route.fulfill({ json: FAKE_PERF_POD_DETAIL });
            });
        });

        test.afterAll(async () => {
            await page.unroute("**/api/nodes/node-cp*");
            await page.unroute("**/api/pods/default/nginx-abc*");
        });

        test("cluster home shows Overview and Performance tabs, defaulting to Overview", async () => {
            await page.goto("/cluster", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='cluster-tab-overview']")).toBeVisible();
            await expect(page.locator("[data-test-id='cluster-tab-performance']")).toBeVisible();
            // Overview is the default panel and still renders the stat tiles unchanged.
            await expect(page.locator("[data-test-id='cluster-panel-overview']")).toBeVisible();
            await expect(page.locator("[data-test-id='stat-server-version']")).toBeVisible();
            await expect(page.locator("[data-test-id='cluster-panel-performance']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='perf-cluster-stub']")).toHaveCount(0);
        });

        test("selecting the cluster Performance tab renders its stub placeholder", async () => {
            await page.goto("/cluster", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='cluster-tab-performance']").click();
            await expect(page.locator("[data-test-id='cluster-panel-performance']")).toBeVisible();
            await expect(page.locator("[data-test-id='perf-cluster-stub']")).toBeVisible();
            await expect(page.locator("[data-test-id='perf-cluster-stub']")).toContainText("Performance metrics coming soon");
            // The Overview panel is no longer mounted once Performance is selected.
            await expect(page.locator("[data-test-id='cluster-panel-overview']")).toHaveCount(0);
        });

        test("node detail shows a Performance tab whose stub renders when selected", async () => {
            await page.goto("/nodes/node-cp", { waitUntil: "networkidle" });
            // Existing tabs still render alongside the new Performance tab.
            await expect(page.locator("[data-test-id='node-tab-detail']")).toBeVisible();
            await expect(page.locator("[data-test-id='node-tab-performance']")).toBeVisible();
            await expect(page.locator("[data-test-id='node-panel-performance']")).toHaveCount(0);
            await page.locator("[data-test-id='node-tab-performance']").click();
            await expect(page.locator("[data-test-id='node-panel-performance']")).toBeVisible();
            await expect(page.locator("[data-test-id='perf-node-stub']")).toBeVisible();
            await expect(page.locator("[data-test-id='perf-node-stub']")).toContainText("Performance metrics coming soon");
        });

        test("pod detail shows a Performance tab whose stub renders when selected", async () => {
            await page.goto("/pods/default/nginx-abc", { waitUntil: "networkidle" });
            // Existing tabs still render alongside the new Performance tab.
            await expect(page.locator("[data-test-id='pod-tab-detail']")).toBeVisible();
            await expect(page.locator("[data-test-id='pod-tab-performance']")).toBeVisible();
            await expect(page.locator("[data-test-id='pod-panel-performance']")).toHaveCount(0);
            await page.locator("[data-test-id='pod-tab-performance']").click();
            await expect(page.locator("[data-test-id='pod-panel-performance']")).toBeVisible();
            await expect(page.locator("[data-test-id='perf-pod-stub']")).toBeVisible();
            await expect(page.locator("[data-test-id='perf-pod-stub']")).toContainText("Performance metrics coming soon");
        });
    });

    // ── Namespace detail page ───────────────────────────────────────────────────

    test.describe("namespace detail page", () => {
        const FAKE_NAMESPACE_DETAIL = {
            name: "team-a",
            phase: "Active",
            createdAt: new Date().toISOString(),
            labels: { "kubernetes.io/metadata.name": "team-a", team: "alpha" },
            annotations: { owner: "platform" },
            resources: [
                { kind: "Pod", name: "web-abc", status: "Running", detailPath: "/pods/team-a/web-abc" },
                { kind: "Deployment", name: "web", status: "2/3 ready", detailPath: "/deployments/team-a/web" },
            ],
            quotas: [{ name: "compute", hard: { "requests.cpu": "4", pods: "10" } }],
            limits: [
                {
                    name: "mem-limit",
                    type: "Container",
                    resource: "memory",
                    min: "64Mi",
                    max: "1Gi",
                    defaultRequest: "128Mi",
                    default: "256Mi",
                },
            ],
        };

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await page.route("**/api/namespaces/team-a*", async (route) => {
                await route.fulfill({ json: FAKE_NAMESPACE_DETAIL });
            });
            await page.goto("/namespaces/team-a", { waitUntil: "networkidle" });
        });

        test.beforeEach(async () => {
            // Reset to the default Details tab between tests.
            await page.goto("/namespaces/team-a", { waitUntil: "networkidle" });
        });

        test.afterAll(async () => {
            await page.unroute("**/api/namespaces/team-a*");
        });

        test("shows the namespace name as heading and an Active phase chip", async () => {
            await expect(page.getByRole("heading", { name: "team-a" })).toBeVisible();
            await expect(page.locator("[data-test-id='namespace-phase-chip']")).toHaveText("Active");
        });

        test("breadcrumb trail starts at Namespaces", async () => {
            await expect(page.locator("[data-test-id='breadcrumb-item']").first()).toHaveText("Namespaces");
        });

        test("shows the five tabs and defaults to Details", async () => {
            await expect(page.locator("[data-test-id='namespace-tab-detail']")).toBeVisible();
            await expect(page.locator("[data-test-id='namespace-tab-resources']")).toBeVisible();
            await expect(page.locator("[data-test-id='namespace-tab-labels']")).toBeVisible();
            await expect(page.locator("[data-test-id='namespace-tab-commands']")).toBeVisible();
            await expect(page.locator("[data-test-id='namespace-tab-yaml']")).toBeVisible();
            await expect(page.locator("[data-test-id='namespace-panel-detail']")).toBeVisible();
            await expect(page.locator("[data-test-id='namespace-panel-resources']")).toHaveCount(0);
        });

        test("Details tab shows annotations, quotas, and limit ranges (labels are on the Labels tab)", async () => {
            // Labels moved to their own Labels tab (see labels-tab); the Status tab
            // no longer renders an inline label-chip card.
            await expect(page.locator("[data-test-id='namespace-labels']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='namespace-annotations']")).toContainText("owner");
            await expect(page.locator("[data-test-id='namespace-quota-row']").first()).toContainText("requests.cpu");
            await expect(page.locator("[data-test-id='namespace-limit-row']").first()).toContainText("memory");
        });

        test("Labels tab shows the namespace's own labels as a Key / Value table", async () => {
            await page.locator("[data-test-id='namespace-tab-labels']").click();
            await expect(page.locator("[data-test-id='labels-table']")).toBeVisible();
            const keys = await page.locator("[data-test-id='label-row'] td:first-child").allTextContents();
            expect(keys).toContain("team");
            // Target the row whose Key cell is exactly "team" so the value assertion
            // is not confused by the metadata.name row whose value also contains "team".
            const teamRow = page.locator("[data-test-id='label-row']").filter({
                has: page.locator("td:first-child", { hasText: /^team$/ }),
            });
            await expect(teamRow).toContainText("alpha");
        });

        test("Details tab Resources stat counts pods only, matching the list column", async () => {
            // The fixture has one Pod and one Deployment. The headline Resources
            // stat counts pods only (1), so it agrees with the namespaces list
            // column (also pods only), even though the Resources tab lists both.
            await expect(
                page.locator("[data-test-id='namespace-stat'][data-stat='resources']")
            ).toContainText("1");
        });

        test("Resources tab lists the contained resources with search and sort", async () => {
            await page.locator("[data-test-id='namespace-tab-resources']").click();
            await expect(page.locator("[data-test-id='namespace-resources-table']")).toBeVisible();
            await expect(page.locator("[data-test-id='namespace-resource-row']")).toHaveCount(2);
            // Search narrows to the deployment only.
            await page.locator("[data-test-id='namespace-resources-filter'] input").fill("web ");
            // Both rows contain "web" so both remain; narrow to the Deployment kind.
            await page.locator("[data-test-id='namespace-resources-filter'] input").fill("Deployment");
            await expect(page.locator("[data-test-id='namespace-resource-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='namespace-resource-row']").first()).toContainText("web");
            // Clearing the filter restores both rows.
            await page.locator("[data-test-id='namespace-resources-filter'] input").fill("");
            await expect(page.locator("[data-test-id='namespace-resource-row']")).toHaveCount(2);
            // The Kind header sorts the table.
            await page.locator("[data-test-id='namespace-resources-table'] thead th").filter({ hasText: "Kind" }).click();
            const kinds = await page.locator("[data-test-id='namespace-resource-row'] td:first-child").allTextContents();
            expect(kinds[0]).toBe("Deployment");
        });

        test("clicking a resource row navigates to that resource's detail page", async () => {
            await page.route("**/api/pods/team-a/web-abc*", async (route) => {
                await route.fulfill({
                    json: {
                        name: "web-abc",
                        namespace: "team-a",
                        phase: "Running",
                        node: "node-cp",
                        podIP: "10.0.0.5",
                        createdAt: new Date().toISOString(),
                        labels: {},
                        containers: [],
                        initContainers: [],
                        events: [],
                    },
                });
            });
            await page.locator("[data-test-id='namespace-tab-resources']").click();
            await page.locator("[data-test-id='namespace-resource-row']").filter({ hasText: "web-abc" }).click();
            await expect(page).toHaveURL(/\/pods\/team-a\/web-abc/);
            await page.unroute("**/api/pods/team-a/web-abc*");
        });

        test("Commands tab shows guided commands for the namespace", async () => {
            await page.locator("[data-test-id='namespace-tab-commands']").click();
            await expect(page.locator("[data-test-id='commands-tab']")).toBeVisible();
            const commands = await page.locator("[data-test-id='command-text']").allTextContents();
            expect(commands).toContain("kubectl describe namespace team-a");
            expect(commands).toContain("kubectl get all -n team-a");
        });

        test("YAML tab renders the namespace yaml", async () => {
            await page.route("**/api/yaml/namespaces/team-a*", async (route) => {
                await route.fulfill({ json: { yaml: "apiVersion: v1\nkind: Namespace\nmetadata:\n  name: team-a\n" } });
            });
            await page.locator("[data-test-id='namespace-tab-yaml']").click();
            await expect(page.locator("[data-test-id='namespace-panel-yaml']")).toBeVisible();
            await expect(page.locator("[data-test-id='yaml-content']")).toContainText("kind: Namespace");
            await expect(page.locator("[data-test-id='yaml-content']")).toContainText("name: team-a");
            await page.unroute("**/api/yaml/namespaces/team-a*");
        });
    });

    // ── Pods page ─────────────────────────────────────────────────────────────

    test.describe("pods page", () => {
        // Predictable pod data injected via route interception.
        const FAKE_PODS = {
            pods: [
                {
                    name: "nginx-abc",
                    namespace: "default",
                    phase: "Running",
                    ready: "2/3",
                    containerCount: 3,
                    restarts: 0,
                    createdAt: new Date().toISOString(),
                    node: "node-worker",
                },
                {
                    name: "redis-xyz",
                    namespace: "kube-system",
                    phase: "Pending",
                    ready: "0/1",
                    containerCount: 1,
                    restarts: 2,
                    createdAt: new Date().toISOString(),
                    node: "node-cp",
                },
            ],
        };

        // Install a route override that returns FAKE_PODS for every /api/pods request.
        async function interceptPods(): Promise<void> {
            await page.route("**/api/pods*", async (route) => {
                await route.fulfill({ json: FAKE_PODS });
            });
        }

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await interceptPods();
            await page.goto("/pods", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='pods-table']")).toBeVisible();
        });

        test.afterAll(async () => {
            await page.unroute("**/api/pods*");
            setContext(CLUSTER_1);
        });

        test("has all column headers in all-namespaces view", async () => {
            const table = page.locator("[data-test-id='pods-table']");
            for (const name of ["Name", "Namespace", "Status", "Ready", "Containers", "Restarts", "Node", "Age"]) {
                await expect(table.getByRole("columnheader", { name, exact: true })).toBeVisible();
            }
        });

        test("shows a row for each fake pod", async () => {
            await expect(page.locator("[data-test-id='pod-row']")).toHaveCount(2);
        });

        test("stats header shows total/healthy/error (2 pods, 1 Running, 1 Pending)", async () => {
            await expect(page.locator("[data-test-id='pods-stats-total']")).toHaveText("Total: 2");
            await expect(page.locator("[data-test-id='pods-stats-healthy']")).toHaveText("Healthy: 1");
            await expect(page.locator("[data-test-id='pods-stats-error']")).toHaveText("Error: 0");
        });

        test("shows the container count for a multi-container pod", async () => {
            const row = page.locator("[data-test-id='pod-row']").filter({ hasText: "nginx-abc" });
            await expect(row.locator("[data-test-id='pod-container-count']")).toHaveText("3");
        });

        test("shows Running chip for nginx-abc", async () => {
            const row = page.locator("[data-test-id='pod-row']").filter({ hasText: "nginx-abc" });
            await expect(row.locator(".MuiChip-label")).toHaveText("Running");
        });

        test("shows Pending chip for redis-xyz", async () => {
            const row = page.locator("[data-test-id='pod-row']").filter({ hasText: "redis-xyz" });
            await expect(row.locator(".MuiChip-label")).toHaveText("Pending");
        });

        test("search filters pods by name", async () => {
            await page.locator("[data-test-id='pods-search'] input").fill("nginx");
            await expect(page.locator("[data-test-id='pod-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='pod-row'] td:first-child")).toHaveText("nginx-abc");
        });

        test("shows no-pods-match message when search has no results", async () => {
            await page.locator("[data-test-id='pods-search'] input").fill("zzznotfound");
            await expect(page.locator("[data-test-id='no-pods-match']")).toBeVisible();
        });

        test("clearing search restores all pods", async () => {
            await page.locator("[data-test-id='pods-search'] input").fill("");
            await expect(page.locator("[data-test-id='pod-row']")).toHaveCount(2);
        });

        test("redirects to /contexts when no context is selected", async () => {
            unsetContext();
            await page.goto("/pods", { waitUntil: "networkidle" });
            await expect(page).toHaveURL(/\/contexts/);
            setContext(CLUSTER_1);
            await interceptPods();
            await page.goto("/pods", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='pods-table']")).toBeVisible();
        });

        test("shows namespace chip in header when scoped to a namespace", async () => {
            // Select a namespace via namespace picker then navigate to pods page.
            await page.locator("[aria-label='namespace picker']").click();
            await page.locator("[data-test-id='namespace-quick-picker-row']").filter({ hasText: /^default/ }).click();
            await expect(page.locator("[data-test-id='pods-table']")).toBeVisible();
            await expect(page.locator("[data-test-id='header-namespace-chip']")).toHaveText("default");
        });

        test("Namespace column is always visible regardless of namespace selection", async () => {
            const headers = page.locator("[data-test-id='pods-table'] thead th");
            await expect(headers.filter({ hasText: "Namespace" })).toBeVisible();
            // Clear namespace and confirm column remains.
            await page.locator("[aria-label='namespace picker']").click();
            await page.locator("[data-test-id='namespace-quick-picker-all']").click();
            await expect(headers.filter({ hasText: "Namespace" })).toBeVisible();
        });

        test("sends namespace query param to API when namespace is selected", async () => {
            // Replace the catch-all interceptor with one that filters by namespace.
            await page.unroute("**/api/pods*");
            await page.route("**/api/pods*", async (route) => {
                const ns = new URL(route.request().url()).searchParams.get("namespace");
                const pods = ns !== null && ns !== ""
                    ? FAKE_PODS.pods.filter((p) => p.namespace === ns)
                    : FAKE_PODS.pods;
                await route.fulfill({ json: { pods } });
            });
            // Navigate fresh to clear the React Query cache so the next namespace
            // change definitely triggers a new HTTP request.
            await page.goto("/pods", { waitUntil: "networkidle" });
            // Set up the request waiter after page settles, then change namespace.
            const requestPromise = page.waitForRequest("**/api/pods*");
            await page.locator("[aria-label='namespace picker']").click();
            await page.locator("[data-test-id='namespace-quick-picker-row']").filter({ hasText: /^default/ }).click();
            const request = await requestPromise;
            expect(new URL(request.url()).searchParams.get("namespace")).toBe("default");
        });

        test("shows only pods from the selected namespace", async () => {
            await expect(page.locator("[data-test-id='pod-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='pod-row']").filter({ hasText: "nginx-abc" })).toBeVisible();
            await expect(page.locator("[data-test-id='pod-row']").filter({ hasText: "redis-xyz" })).toHaveCount(0);
        });

        test("stats header reflects the namespace scope after refetch", async () => {
            // Scoped to the default namespace the list refetched to a single
            // Running pod, so the stats recompute from the new data.
            await expect(page.locator("[data-test-id='pods-stats-total']")).toHaveText("Total: 1");
            await expect(page.locator("[data-test-id='pods-stats-healthy']")).toHaveText("Healthy: 1");
            await expect(page.locator("[data-test-id='pods-stats-error']")).toHaveText("Error: 0");
        });
    });

    // ── YAML viewer ───────────────────────────────────────────────────────────

    test.describe("yaml sub tab", () => {
        const FAKE_POD_DETAIL = {
            name: "nginx-abc",
            namespace: "default",
            phase: "Running",
            node: "node-worker",
            podIP: "10.0.0.1",
            createdAt: new Date().toISOString(),
            labels: { app: "nginx" },
            containers: [
                { name: "nginx", image: "nginx:latest", ready: true, restarts: 0, state: "Running", stateReason: "" },
            ],
            initContainers: [],
            events: [],
        };

        const FAKE_POD_YAML = "apiVersion: v1\nkind: Pod\nmetadata:\n  name: nginx-abc\n  namespace: default\n";

        const FAKE_NODE_DETAIL = {
            name: "node-cp",
            status: "Ready",
            roles: ["control-plane"],
            version: "v1.29.0",
            createdAt: new Date().toISOString(),
            conditions: [],
            capacity: { cpu: "4", memory: "8Gi", pods: "110" },
            allocatable: { cpu: "3900m", memory: "7Gi", pods: "110" },
            addresses: [],
            labels: {},
            pods: [],
            events: [],
        };

        const FAKE_NODE_YAML = "apiVersion: v1\nkind: Node\nmetadata:\n  name: node-cp\n";

        const FAKE_WORKLOAD_DETAIL = {
            name: "web-deploy",
            namespace: "default",
            createdAt: new Date().toISOString(),
            stats: [],
            selector: { app: "web" },
            labels: { app: "web" },
            pods: [],
            events: [],
        };

        const FAKE_WORKLOAD_YAML = "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: web-deploy\n  namespace: default\n";

        const FAKE_PODS_LIST = {
            pods: [
                {
                    name: "nginx-abc",
                    namespace: "default",
                    phase: "Running",
                    ready: "1/1",
                    containerCount: 1,
                    restarts: 0,
                    createdAt: new Date().toISOString(),
                    node: "node-worker",
                },
            ],
        };

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            // The copy button writes to the clipboard, which needs explicit permission.
            await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
            await page.route("**/api/pods/default/nginx-abc*", async (route) => {
                await route.fulfill({ json: FAKE_POD_DETAIL });
            });
            await page.route("**/api/yaml/pods/nginx-abc*", async (route) => {
                await route.fulfill({ json: { yaml: FAKE_POD_YAML } });
            });
            await page.route("**/api/nodes/node-cp*", async (route) => {
                await route.fulfill({ json: FAKE_NODE_DETAIL });
            });
            await page.route("**/api/yaml/nodes/node-cp*", async (route) => {
                await route.fulfill({ json: { yaml: FAKE_NODE_YAML } });
            });
            await page.route("**/api/deployments/default/web-deploy*", async (route) => {
                await route.fulfill({ json: FAKE_WORKLOAD_DETAIL });
            });
            await page.route("**/api/yaml/deployments/web-deploy*", async (route) => {
                await route.fulfill({ json: { yaml: FAKE_WORKLOAD_YAML } });
            });
            await page.route("**/api/pods*", async (route) => {
                await route.fulfill({ json: FAKE_PODS_LIST });
            });
        });

        test.afterAll(async () => {
            await page.unroute("**/api/pods/default/nginx-abc*");
            await page.unroute("**/api/yaml/pods/nginx-abc*");
            await page.unroute("**/api/nodes/node-cp*");
            await page.unroute("**/api/yaml/nodes/node-cp*");
            await page.unroute("**/api/deployments/default/web-deploy*");
            await page.unroute("**/api/yaml/deployments/web-deploy*");
            await page.unroute("**/api/pods*");
            setContext(CLUSTER_1);
        });

        test("pod detail page exposes a YAML tab that renders the pod yaml", async () => {
            await page.goto("/pods/default/nginx-abc", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='pod-tab-yaml']")).toBeVisible();
            const requestPromise = page.waitForRequest((req) =>
                req.url().includes("/api/yaml/pods/nginx-abc") && req.url().includes("namespace=default"));
            await page.locator("[data-test-id='pod-tab-yaml']").click();
            await requestPromise;
            await expect(page.locator("[data-test-id='pod-panel-yaml']")).toBeVisible();
            await expect(page.locator("[data-test-id='yaml-content']")).toContainText("kind: Pod");
            await expect(page.locator("[data-test-id='yaml-content']")).toContainText("name: nginx-abc");
        });

        test("node detail page exposes a YAML tab that renders the node yaml", async () => {
            await page.goto("/nodes/node-cp", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='node-tab-yaml']")).toBeVisible();
            await page.locator("[data-test-id='node-tab-yaml']").click();
            await expect(page.locator("[data-test-id='node-panel-yaml']")).toBeVisible();
            await expect(page.locator("[data-test-id='yaml-content']")).toContainText("kind: Node");
            await expect(page.locator("[data-test-id='yaml-content']")).toContainText("name: node-cp");
        });

        test("workload detail page exposes a YAML tab that renders the workload yaml", async () => {
            await page.goto("/deployments/default/web-deploy", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='workload-tab-yaml']")).toBeVisible();
            await page.locator("[data-test-id='workload-tab-yaml']").click();
            await expect(page.locator("[data-test-id='workload-panel-yaml']")).toBeVisible();
            await expect(page.locator("[data-test-id='yaml-content']")).toContainText("kind: Deployment");
            await expect(page.locator("[data-test-id='yaml-content']")).toContainText("name: web-deploy");
        });

        test("the YAML tab has a copy button that copies the displayed YAML to the clipboard", async () => {
            await page.goto("/pods/default/nginx-abc", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='pod-tab-yaml']").click();
            await expect(page.locator("[data-test-id='yaml-content']")).toContainText("kind: Pod");
            const copyButton = page.locator("[data-test-id='yaml-copy-button']");
            await expect(copyButton).toBeVisible();
            await copyButton.click();
            const copied = await page.evaluate(() => navigator.clipboard.readText());
            expect(copied).toBe(FAKE_POD_YAML);
        });

        test("the copy button shows brief 'Copied' feedback after clicking", async () => {
            await page.goto("/pods/default/nginx-abc", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='pod-tab-yaml']").click();
            await expect(page.locator("[data-test-id='yaml-content']")).toContainText("kind: Pod");
            const copyButton = page.locator("[data-test-id='yaml-copy-button']");
            await copyButton.click();
            // The icon flips to a check mark as the success confirmation.
            await expect(copyButton.locator("svg[data-icon='check']")).toBeVisible();
        });

        test("while the YAML loads the progress indicator shows, not loading text", async () => {
            // Delay the YAML response so the loading state is observable.
            await page.route("**/api/yaml/pods/nginx-abc*", async (route) => {
                await new Promise((resolve) => setTimeout(resolve, 1500));
                await route.fulfill({ json: { yaml: FAKE_POD_YAML } });
            });
            await page.goto("/pods/default/nginx-abc", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='pod-tab-yaml']").click();
            // The spinner stands in for the loading state; no "Loading..." text.
            await expect(page.locator("[data-test-id='yaml-content'] [data-test-id='loading-indicator']")).toBeVisible();
            await expect(page.locator("[data-test-id='yaml-content']")).not.toContainText("Loading");
            // Once loaded, the indicator is gone and the YAML is rendered.
            await expect(page.locator("[data-test-id='yaml-content']")).toContainText("kind: Pod");
            await expect(page.locator("[data-test-id='yaml-content'] [data-test-id='loading-indicator']")).toHaveCount(0);
            // Restore the immediate response for later tests.
            await page.unroute("**/api/yaml/pods/nginx-abc*");
            await page.route("**/api/yaml/pods/nginx-abc*", async (route) => {
                await route.fulfill({ json: { yaml: FAKE_POD_YAML } });
            });
        });

        test("the copy button does not overlap the vertical scrollbar on long YAML", async () => {
            // A long YAML doc so the panel scrolls and shows a vertical scrollbar.
            const longYaml = "apiVersion: v1\nkind: Pod\nmetadata:\n  name: nginx-abc\n  namespace: default\n"
                + Array.from({ length: 400 }, (_, i) => `  line-${i}: value-${i}\n`).join("");
            await page.route("**/api/yaml/pods/nginx-abc*", async (route) => {
                await route.fulfill({ json: { yaml: longYaml } });
            });
            await page.goto("/pods/default/nginx-abc", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='pod-tab-yaml']").click();
            await expect(page.locator("[data-test-id='yaml-content']")).toContainText("kind: Pod");

            const content = page.locator("[data-test-id='yaml-content']");
            // Confirm the panel actually scrolls (otherwise the test proves nothing).
            const scrollbarWidth = await content.evaluate((el: HTMLElement) => el.offsetWidth - el.clientWidth);
            expect(scrollbarWidth).toBeGreaterThan(0);

            const button = page.locator("[data-test-id='yaml-copy-button']");
            const buttonBox = await button.boundingBox();
            const contentBox = await content.boundingBox();
            expect(buttonBox).not.toBeNull();
            expect(contentBox).not.toBeNull();
            // The scrollbar occupies the rightmost `scrollbarWidth` px of the panel.
            // The button's right edge must stay clear of that strip.
            const scrollbarLeftEdge = contentBox!.x + contentBox!.width - scrollbarWidth;
            expect(buttonBox!.x + buttonBox!.width).toBeLessThanOrEqual(scrollbarLeftEdge);

            // Restore the short-YAML route for any later test in this block.
            await page.unroute("**/api/yaml/pods/nginx-abc*");
            await page.route("**/api/yaml/pods/nginx-abc*", async (route) => {
                await route.fulfill({ json: { yaml: FAKE_POD_YAML } });
            });
        });

        test("the old YAML dialog and button are gone everywhere", async () => {
            // Detail pages no longer render a YAML button or dialog.
            await page.goto("/pods/default/nginx-abc", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='yaml-button']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='yaml-dialog']")).toHaveCount(0);
            // Pods table rows no longer carry a per-row YAML button.
            await page.goto("/pods", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='pods-table']")).toBeVisible();
            await expect(page.locator("[data-test-id='yaml-button']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='yaml-dialog']")).toHaveCount(0);
        });
    });

    // ── Pods page: status filter ────────────────────────────────────────────────

    test.describe("pods page status filter", () => {
        // One pod per phase so each filter checkbox is independently observable.
        const PHASE_PODS = {
            pods: [
                {
                    name: "pod-running",
                    namespace: "default",
                    phase: "Running",
                    ready: "1/1",
                    restarts: 0,
                    createdAt: new Date().toISOString(),
                    node: "node-worker",
                },
                {
                    name: "pod-pending",
                    namespace: "default",
                    phase: "Pending",
                    ready: "0/1",
                    restarts: 0,
                    createdAt: new Date().toISOString(),
                    node: "node-worker",
                },
                {
                    name: "pod-succeeded",
                    namespace: "default",
                    phase: "Succeeded",
                    ready: "0/1",
                    restarts: 0,
                    createdAt: new Date().toISOString(),
                    node: "node-worker",
                },
                {
                    name: "pod-failed",
                    namespace: "default",
                    phase: "Failed",
                    ready: "0/1",
                    restarts: 0,
                    createdAt: new Date().toISOString(),
                    node: "node-worker",
                },
                {
                    name: "pod-unknown",
                    namespace: "default",
                    phase: "Unknown",
                    ready: "0/1",
                    restarts: 0,
                    createdAt: new Date().toISOString(),
                    node: "node-worker",
                },
            ],
        };

        // Install a route override that returns PHASE_PODS for every /api/pods request.
        async function interceptPhasePods(): Promise<void> {
            await page.route("**/api/pods*", async (route) => {
                await route.fulfill({ json: PHASE_PODS });
            });
        }

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await interceptPhasePods();
            await page.goto("/pods", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='pods-table']")).toBeVisible();
        });

        test.afterAll(async () => {
            await page.unroute("**/api/pods*");
            setContext(CLUSTER_1);
        });

        test("shows all phases by default with the filter off", async () => {
            await expect(page.locator("[data-test-id='pod-row']")).toHaveCount(5);
            await expect(page.locator("[data-test-id='pods-filter-button']")).toHaveText("Filter: All");
            // The Status group is labelled "Status", not "Phase": no stray "Phase" label remains.
            await page.locator("[data-test-id='pods-filter-button']").click();
            await expect(page.locator("[data-test-id='pods-filter-group-phase']")).toHaveText("Status");
            await page.keyboard.press("Escape");
            await expect(page.getByText("Phase", { exact: false })).toHaveCount(0);
        });

        test("checking a single phase shows just those pods", async () => {
            await page.locator("[data-test-id='pods-filter-button']").click();
            await page.locator("[data-test-id='pods-filter-item-phase-Running']").click();
            // Close the menu to read the table.
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='pod-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='pod-row'] td:first-child")).toHaveText("pod-running");
            await expect(page.locator("[data-test-id='pods-filter-button']")).toHaveText("Filter: 1 selected");
        });

        test("checking a second phase ORs the two within the column", async () => {
            await page.locator("[data-test-id='pods-filter-button']").click();
            await page.locator("[data-test-id='pods-filter-item-phase-Pending']").click();
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='pod-row']")).toHaveCount(2);
            await expect(page.locator("[data-test-id='pods-filter-button']")).toHaveText("Filter: 2 selected");
        });

        test("a value picked in a second column ANDs across columns", async () => {
            // Running OR Pending (from the previous test) AND Health=Error keeps just
            // pod-failed/pod-unknown? No: Running/Pending are not Error. Pick Error +
            // re-pick a matching phase to show AND narrows within the OR'd phases.
            await page.locator("[data-test-id='pods-filter-button']").click();
            // Clear, then pick Pending (Pending pods are health "Other") and Health=Error.
            await page.locator("[data-test-id='pods-filter-deselect-all']").click();
            await page.locator("[data-test-id='pods-filter-item-phase-Failed']").click();
            await page.locator("[data-test-id='pods-filter-item-health-Error']").click();
            await page.keyboard.press("Escape");
            // Failed pods are classified Error, so the AND keeps exactly pod-failed.
            await expect(page.locator("[data-test-id='pod-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='pod-row'] td:first-child")).toHaveText("pod-failed");
            await expect(page.locator("[data-test-id='pods-filter-button']")).toHaveText("Filter: 2 selected");
        });

        test("the search input filters the options by column name and by value text", async () => {
            await page.locator("[data-test-id='pods-filter-button']").click();
            // Reset selection so the table is not affected while we inspect options.
            await page.locator("[data-test-id='pods-filter-deselect-all']").click();
            // Search by column name: only the Status group survives.
            await page.locator("[data-test-id='pods-filter-search'] input").fill("status");
            await expect(page.locator("[data-test-id='pods-filter-group-phase']")).toBeVisible();
            await expect(page.locator("[data-test-id='pods-filter-group-health']")).toHaveCount(0);
            // Search by value text: only the matching Running option survives.
            await page.locator("[data-test-id='pods-filter-search'] input").fill("Running");
            await expect(page.locator("[data-test-id='pods-filter-item-phase-Running']")).toBeVisible();
            await expect(page.locator("[data-test-id='pods-filter-item-phase-Pending']")).toHaveCount(0);
            // A non-matching query shows the no-match message.
            await page.locator("[data-test-id='pods-filter-search'] input").fill("zzznotfound");
            await expect(page.locator("[data-test-id='pods-filter-no-match']")).toBeVisible();
            await page.locator("[data-test-id='pods-filter-search'] input").fill("");
            await page.keyboard.press("Escape");
            // Make sure the menu has closed before the next test interacts with the page.
            await expect(page.locator("[data-test-id='pods-filter-menu']")).toBeHidden();
        });

        test("deselect all clears the selection and restores every pod", async () => {
            await page.locator("[data-test-id='pods-filter-button']").click();
            // Make a selection first so Deselect all is enabled, then clear it.
            await page.locator("[data-test-id='pods-filter-item-phase-Running']").click();
            await page.locator("[data-test-id='pods-filter-deselect-all']").click();
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='pod-row']")).toHaveCount(5);
            await expect(page.locator("[data-test-id='pods-filter-button']")).toHaveText("Filter: All");
        });
    });

    // ── Nodes page: status filter ───────────────────────────────────────────────

    test.describe("nodes page status filter", () => {
        // One node per status so each filter checkbox is independently observable.
        const STATUS_NODES = {
            nodes: [
                {
                    name: "node-ready",
                    status: "Ready",
                    roles: ["worker"],
                    version: "v1.30.0",
                    createdAt: new Date().toISOString(),
                },
                {
                    name: "node-notready",
                    status: "NotReady",
                    roles: ["worker"],
                    version: "v1.30.0",
                    createdAt: new Date().toISOString(),
                },
                {
                    name: "node-unknown",
                    status: "Unknown",
                    roles: ["worker"],
                    version: "v1.30.0",
                    createdAt: new Date().toISOString(),
                },
            ],
        };

        // Install a route override that returns STATUS_NODES for every nodes-list request.
        async function interceptStatusNodes(): Promise<void> {
            await page.route("**/api/cluster/nodes*", async (route) => {
                await route.fulfill({ json: STATUS_NODES });
            });
        }

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await interceptStatusNodes();
            await page.goto("/nodes", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='nodes-table']")).toBeVisible();
        });

        test.afterAll(async () => {
            await page.unroute("**/api/cluster/nodes*");
            setContext(CLUSTER_1);
        });

        test("shows all statuses by default with the filter off", async () => {
            await expect(page.locator("[data-test-id='node-row']")).toHaveCount(3);
            await expect(page.locator("[data-test-id='nodes-filter-button']")).toHaveText("Filter: All");
        });

        test("checking a single status shows just those nodes", async () => {
            await page.locator("[data-test-id='nodes-filter-button']").click();
            await page.locator("[data-test-id='nodes-filter-item-status-Ready']").click();
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='node-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='node-row'] td:first-child")).toHaveText("node-ready");
            await expect(page.locator("[data-test-id='nodes-filter-button']")).toHaveText("Filter: 1 selected");
        });

        test("checking a second status ORs the two within the column", async () => {
            await page.locator("[data-test-id='nodes-filter-button']").click();
            await page.locator("[data-test-id='nodes-filter-item-status-NotReady']").click();
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='node-row']")).toHaveCount(2);
            await expect(page.locator("[data-test-id='node-row']").filter({ hasText: "node-unknown" })).toHaveCount(0);
            await expect(page.locator("[data-test-id='nodes-filter-button']")).toHaveText("Filter: 2 selected");
        });

        test("deselect all clears the selection and restores every node", async () => {
            await page.locator("[data-test-id='nodes-filter-button']").click();
            await page.locator("[data-test-id='nodes-filter-deselect-all']").click();
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='node-row']")).toHaveCount(3);
            await expect(page.locator("[data-test-id='nodes-filter-button']")).toHaveText("Filter: All");
        });
    });

    // ── Pods page: health filter ────────────────────────────────────────────────

    test.describe("pods page health filter", () => {
        // Five pods spanning every phase: 2 healthy (Running, Succeeded), 2 error
        // (Failed, Unknown), 1 other (Pending). So the health filter sees 2 Healthy,
        // 2 Error, and 1 row that belongs to neither bucket.
        const HEALTH_PODS = {
            pods: [
                {
                    name: "pod-running",
                    namespace: "default",
                    phase: "Running",
                    ready: "1/1",
                    restarts: 0,
                    createdAt: new Date().toISOString(),
                    node: "node-worker",
                },
                {
                    name: "pod-succeeded",
                    namespace: "default",
                    phase: "Succeeded",
                    ready: "0/1",
                    restarts: 0,
                    createdAt: new Date().toISOString(),
                    node: "node-worker",
                },
                {
                    name: "pod-failed",
                    namespace: "default",
                    phase: "Failed",
                    ready: "0/1",
                    restarts: 0,
                    createdAt: new Date().toISOString(),
                    node: "node-worker",
                },
                {
                    name: "pod-unknown",
                    namespace: "default",
                    phase: "Unknown",
                    ready: "0/1",
                    restarts: 0,
                    createdAt: new Date().toISOString(),
                    node: "node-worker",
                },
                {
                    name: "pod-pending",
                    namespace: "default",
                    phase: "Pending",
                    ready: "0/1",
                    restarts: 0,
                    createdAt: new Date().toISOString(),
                    node: "node-worker",
                },
            ],
        };

        // Install a route override that returns HEALTH_PODS for every /api/pods request.
        async function interceptHealthPods(): Promise<void> {
            await page.route("**/api/pods*", async (route) => {
                await route.fulfill({ json: HEALTH_PODS });
            });
        }

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await interceptHealthPods();
            await page.goto("/pods", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='pods-table']")).toBeVisible();
        });

        test.afterAll(async () => {
            await page.unroute("**/api/pods*");
            setContext(CLUSTER_1);
        });

        test("shows every pod by default with the filter off", async () => {
            await expect(page.locator("[data-test-id='pod-row']")).toHaveCount(5);
            await expect(page.locator("[data-test-id='pods-filter-button']")).toHaveText("Filter: All");
        });

        test("checking only Error shows just the error pods", async () => {
            await page.locator("[data-test-id='pods-filter-button']").click();
            await page.locator("[data-test-id='pods-filter-item-health-Error']").click();
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='pod-row']")).toHaveCount(2);
            await expect(page.locator("[data-test-id='pod-row']").filter({ hasText: "pod-failed" })).toHaveCount(1);
            await expect(page.locator("[data-test-id='pod-row']").filter({ hasText: "pod-unknown" })).toHaveCount(1);
            await expect(page.locator("[data-test-id='pods-filter-button']")).toHaveText("Filter: 1 selected");
        });

        test("checking only Healthy shows just the healthy pods", async () => {
            await page.locator("[data-test-id='pods-filter-button']").click();
            // Error is currently the only one on; turn Error off and Healthy on.
            await page.locator("[data-test-id='pods-filter-item-health-Error']").click();
            await page.locator("[data-test-id='pods-filter-item-health-Healthy']").click();
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='pod-row']")).toHaveCount(2);
            await expect(page.locator("[data-test-id='pod-row']").filter({ hasText: "pod-running" })).toHaveCount(1);
            await expect(page.locator("[data-test-id='pod-row']").filter({ hasText: "pod-succeeded" })).toHaveCount(1);
            await expect(page.locator("[data-test-id='pods-filter-button']")).toHaveText("Filter: 1 selected");
        });

        test("deselect all clears the selection and restores every pod", async () => {
            await page.locator("[data-test-id='pods-filter-button']").click();
            await page.locator("[data-test-id='pods-filter-deselect-all']").click();
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='pod-row']")).toHaveCount(5);
            await expect(page.locator("[data-test-id='pods-filter-button']")).toHaveText("Filter: All");
        });
    });

    // ── Nodes page: health filter ────────────────────────────────────────────────

    test.describe("nodes page health filter", () => {
        // One node per status: 1 healthy (Ready) and 2 error (NotReady, Unknown).
        const HEALTH_NODES = {
            nodes: [
                {
                    name: "node-ready",
                    status: "Ready",
                    roles: ["worker"],
                    version: "v1.30.0",
                    createdAt: new Date().toISOString(),
                },
                {
                    name: "node-notready",
                    status: "NotReady",
                    roles: ["worker"],
                    version: "v1.30.0",
                    createdAt: new Date().toISOString(),
                },
                {
                    name: "node-unknown",
                    status: "Unknown",
                    roles: ["worker"],
                    version: "v1.30.0",
                    createdAt: new Date().toISOString(),
                },
            ],
        };

        // Install a route override that returns HEALTH_NODES for every nodes-list request.
        async function interceptHealthNodes(): Promise<void> {
            await page.route("**/api/cluster/nodes*", async (route) => {
                await route.fulfill({ json: HEALTH_NODES });
            });
        }

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await interceptHealthNodes();
            await page.goto("/nodes", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='nodes-table']")).toBeVisible();
        });

        test.afterAll(async () => {
            await page.unroute("**/api/cluster/nodes*");
            setContext(CLUSTER_1);
        });

        test("shows every node by default with the filter off", async () => {
            await expect(page.locator("[data-test-id='node-row']")).toHaveCount(3);
            await expect(page.locator("[data-test-id='nodes-filter-button']")).toHaveText("Filter: All");
        });

        test("checking only Error shows just the error nodes", async () => {
            await page.locator("[data-test-id='nodes-filter-button']").click();
            await page.locator("[data-test-id='nodes-filter-item-health-Error']").click();
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='node-row']")).toHaveCount(2);
            await expect(page.locator("[data-test-id='node-row']").filter({ hasText: "node-notready" })).toHaveCount(1);
            await expect(page.locator("[data-test-id='node-row']").filter({ hasText: "node-unknown" })).toHaveCount(1);
            await expect(page.locator("[data-test-id='nodes-filter-button']")).toHaveText("Filter: 1 selected");
        });

        test("checking only Healthy shows just the healthy node", async () => {
            await page.locator("[data-test-id='nodes-filter-button']").click();
            await page.locator("[data-test-id='nodes-filter-item-health-Error']").click();
            await page.locator("[data-test-id='nodes-filter-item-health-Healthy']").click();
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='node-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='node-row'] td:first-child")).toHaveText("node-ready");
            await expect(page.locator("[data-test-id='nodes-filter-button']")).toHaveText("Filter: 1 selected");
        });

        test("deselect all clears the selection and restores every node", async () => {
            await page.locator("[data-test-id='nodes-filter-button']").click();
            await page.locator("[data-test-id='nodes-filter-deselect-all']").click();
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='node-row']")).toHaveCount(3);
            await expect(page.locator("[data-test-id='nodes-filter-button']")).toHaveText("Filter: All");
        });
    });

    // ── Breadcrumbs ─────────────────────────────────────────────────────────────

    test.describe("breadcrumbs", () => {
        const FAKE_POD_DETAIL = {
            name: "nginx-abc",
            namespace: "default",
            phase: "Running",
            node: "node-worker",
            podIP: "10.0.0.1",
            createdAt: new Date().toISOString(),
            labels: { app: "nginx" },
            containers: [],
            initContainers: [],
            events: [],
        };

        const FAKE_NODE_DETAIL = {
            name: "node-cp",
            status: "Ready",
            roles: ["control-plane"],
            version: "v1.29.0",
            createdAt: new Date().toISOString(),
            conditions: [],
            capacity: { cpu: "4", memory: "8Gi", pods: "110" },
            allocatable: { cpu: "3900m", memory: "7Gi", pods: "110" },
            addresses: [],
            labels: {},
            pods: [],
            events: [],
        };

        // A pod whose name is well past the 24-char crumb limit, used to verify
        // the breadcrumb middle-truncates long resource names.
        const LONG_POD_NAME = "really-long-pod-name-that-exceeds-the-breadcrumb-limit-0123456789";
        const FAKE_LONG_POD_DETAIL = {
            ...FAKE_POD_DETAIL,
            name: LONG_POD_NAME,
        };

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await page.route("**/api/pods/default/nginx-abc*", async (route) => {
                await route.fulfill({ json: FAKE_POD_DETAIL });
            });
            await page.route(`**/api/pods/default/${LONG_POD_NAME}*`, async (route) => {
                await route.fulfill({ json: FAKE_LONG_POD_DETAIL });
            });
            await page.route("**/api/nodes/node-cp*", async (route) => {
                await route.fulfill({ json: FAKE_NODE_DETAIL });
            });
        });

        test.afterAll(async () => {
            await page.unroute("**/api/pods/default/nginx-abc*");
            await page.unroute(`**/api/pods/default/${LONG_POD_NAME}*`);
            await page.unroute("**/api/nodes/node-cp*");
        });

        test("renders breadcrumbs on a list page", async () => {
            await page.goto("/pods", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='breadcrumbs']")).toBeVisible();
            const items = await page.locator("[data-test-id='breadcrumb-item']").allTextContents();
            expect(items).toEqual(["Pods"]);
        });

        test("renders the full trail on the pod detail page including the active sub tab", async () => {
            await page.goto("/pods/default/nginx-abc", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='breadcrumbs']")).toBeVisible();
            const items = await page.locator("[data-test-id='breadcrumb-item']").allTextContents();
            expect(items).toEqual(["Pods", "default", "nginx-abc", "Status"]);
        });

        test("updates the sub-tab breadcrumb when switching pod tabs", async () => {
            await page.goto("/pods/default/nginx-abc", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='pod-tab-logs']").click();
            await expect(page).toHaveURL(/tab=logs/);
            await expect(page.locator("[data-test-id='breadcrumb-item']").last()).toHaveText("Logs");
            const items = await page.locator("[data-test-id='breadcrumb-item']").allTextContents();
            expect(items).toEqual(["Pods", "default", "nginx-abc", "Logs"]);
        });

        test("clicking the Pods breadcrumb navigates back to the pods list", async () => {
            await page.goto("/pods/default/nginx-abc", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='breadcrumb-item']").filter({ hasText: "Pods" }).click();
            await expect(page).toHaveURL(/\/pods$/);
            await expect(page.locator("[data-test-id='breadcrumb-item']")).toHaveCount(1);
        });

        test("renders the full trail on the node detail page", async () => {
            await page.goto("/nodes/node-cp", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='breadcrumbs']")).toBeVisible();
            const items = await page.locator("[data-test-id='breadcrumb-item']").allTextContents();
            expect(items).toEqual(["Nodes", "node-cp"]);
        });

        test("clicking the Nodes breadcrumb navigates back to the nodes list", async () => {
            await page.goto("/nodes/node-cp", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='breadcrumb-item']").filter({ hasText: "Nodes" }).click();
            await expect(page).toHaveURL(/\/nodes$/);
            await expect(page.locator("[data-test-id='breadcrumb-item']")).toHaveCount(1);
        });

        test("middle-truncates a long resource name keeping its start and end visible", async () => {
            await page.goto(`/pods/default/${LONG_POD_NAME}`, { waitUntil: "networkidle" });
            const nameCrumb = page.locator("[data-test-id='breadcrumb-item']").nth(2);
            const text = (await nameCrumb.textContent()) ?? "";
            // The shown name is shortened, with the middle replaced by "...".
            expect(text.length).toBeLessThan(LONG_POD_NAME.length);
            expect(text).toContain("...");
            // The start and end of the original name both remain visible.
            expect(text.startsWith("really-long")).toBe(true);
            expect(text.endsWith("0123456789")).toBe(true);
        });

        test("keeps the breadcrumb trail on a single line for a long name", async () => {
            await page.goto(`/pods/default/${LONG_POD_NAME}`, { waitUntil: "networkidle" });
            const trail = page.locator("[data-test-id='breadcrumbs']");
            await expect(trail).toBeVisible();
            const box = await trail.boundingBox();
            // A single line of crumb text stays under ~40px tall; a wrapped trail
            // would be roughly double that.
            expect(box).not.toBeNull();
            expect(box!.height).toBeLessThan(48);
            // The trail is still capped at four crumbs and the truncated name links to the pod.
            await expect(page.locator("[data-test-id='breadcrumb-item']")).toHaveCount(4);
        });
    });

    // ── Live logs page (stern-style multi-pod streaming) ──────────────────────

    test.describe("live logs page", () => {
        // Two fake pods used to populate the pod dropdown and drive the stream.
        const FAKE_PODS = {
            pods: [
                { name: "nginx-abc", namespace: "default", phase: "Running", ready: "1/1", restarts: 0, createdAt: new Date().toISOString(), node: "node-1" },
                { name: "redis-xyz", namespace: "default", phase: "Running", ready: "1/1", restarts: 0, createdAt: new Date().toISOString(), node: "node-1" },
            ],
        };

        // Opens the pod-picker dropdown by clicking its trigger, then waits for the
        // dropped-down search box to be visible. The picker is a real dropdown now,
        // so the search box and checkbox list are not on the page until it is open.
        async function openPicker(): Promise<void> {
            await page.locator("[data-test-id='live-logs-picker-trigger']").click();
            await expect(page.locator("[data-test-id='live-logs-search']")).toBeVisible();
        }

        // Closes the open dropdown by clicking its invisible backdrop, so it does not
        // overlay the rest of the page (e.g. the Stream button) during later assertions.
        async function closePicker(): Promise<void> {
            await page.locator(".MuiModal-root .MuiBackdrop-root").last().click();
            await expect(page.locator("[data-test-id='live-logs-search']")).toHaveCount(0);
        }

        // Builds a Server-Sent Events body that announces the matched pods then
        // emits one prefixed log line per pod, mirroring the real endpoint shape.
        function buildSseBody(podNames: string[]): string {
            const started = `event: started\ndata: ${JSON.stringify({ pods: podNames.map((n) => ({ namespace: "default", name: n })) })}\n\n`;
            const lines = podNames
                .map((n) => `event: line\ndata: ${JSON.stringify({ namespace: "default", pod: n, line: `log line from ${n}` })}\n\n`)
                .join("");
            return started + lines;
        }

        // Intercepts the SSE stream and returns a canned body for the pods whose
        // names match the request's filter (substring), like the backend does.
        async function interceptStream(): Promise<void> {
            await page.route("**/api/logs/stream*", async (route) => {
                const params = new URL(route.request().url()).searchParams;
                const selected = params.getAll("pods");
                const filter = params.get("filter") ?? "";
                // An explicit pods selection wins; otherwise filter by substring.
                const matched = selected.length > 0
                    ? FAKE_PODS.pods.map((p) => p.name).filter((name) => selected.includes(name))
                    : FAKE_PODS.pods.map((p) => p.name).filter((name) => filter === "" || name.toLowerCase().includes(filter.toLowerCase()));
                await route.fulfill({
                    headers: { "Content-Type": "text/event-stream" },
                    body: buildSseBody(matched),
                });
            });
        }

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await page.route("**/api/pods*", async (route) => {
                await route.fulfill({ json: FAKE_PODS });
            });
            await interceptStream();
            await page.goto("/logs", { waitUntil: "networkidle" });
        });

        test.afterAll(async () => {
            await page.unroute("**/api/pods*");
            await page.unroute("**/api/logs/stream*");
            setContext(CLUSTER_1);
        });

        test("shows page title Logs", async () => {
            await expect(page.locator("[data-test-id='breadcrumb-item']").first()).toHaveText("Logs");
        });

        test("renders namespace selector and a searchable pod picker dropdown", async () => {
            await expect(page.locator("[data-test-id='live-logs-namespace-select']")).toBeVisible();
            await expect(page.locator("[data-test-id='live-logs-pod-picker']")).toBeVisible();
            // Collapsed by default: the trigger shows, but the search box and pod
            // list are not on the page until the dropdown is opened.
            await expect(page.locator("[data-test-id='live-logs-picker-trigger']")).toBeVisible();
            await expect(page.locator("[data-test-id='live-logs-search']")).toHaveCount(0);
            // Clicking the trigger drops the search box and checkbox list down as an
            // overlay; the count and Clear control sit inside that dropdown.
            await openPicker();
            const dropdown = page.locator("[data-test-id='live-logs-pod-dropdown']");
            await expect(dropdown.locator("[data-test-id='live-logs-search']")).toBeVisible();
            await expect(page.locator("[data-test-id='live-logs-pod-checkbox']")).toHaveCount(2);
            await expect(dropdown.locator("[data-test-id='live-logs-selected-count']")).toBeVisible();
            await expect(dropdown.locator("[data-test-id='live-logs-clear']")).toBeVisible();
            await closePicker();
        });

        test("typing in the search box filters the pod checkbox list", async () => {
            await openPicker();
            await page.locator("[data-test-id='live-logs-search'] input").fill("nginx");
            await expect(page.locator("[data-test-id='live-logs-pod-option']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='live-logs-pod-list']")).toContainText("nginx-abc");
            await expect(page.locator("[data-test-id='live-logs-pod-list']")).not.toContainText("redis-xyz");
            await page.locator("[data-test-id='live-logs-search'] input").fill("");
            await expect(page.locator("[data-test-id='live-logs-pod-option']")).toHaveCount(2);
            await closePicker();
        });

        test("checking a pod sends it as an explicit pods selection", async () => {
            await openPicker();
            await page.locator("[data-test-id='live-logs-pod-list'] [data-test-id='live-logs-pod-option']", { hasText: "redis-xyz" })
                .locator("input").check();
            await expect(page.locator("[data-test-id='live-logs-selected-count']")).toHaveText("1 selected");
            // The trigger summarises the selection even once the dropdown closes.
            await closePicker();
            await expect(page.locator("[data-test-id='live-logs-picker-trigger']")).toContainText("1 pod(s) selected");
            const requestPromise = page.waitForRequest((req) => req.url().includes("/api/logs/stream") && req.url().includes("pods=redis-xyz"));
            await page.locator("[data-test-id='live-logs-start']").click();
            await requestPromise;
            await expect(page.locator("[data-test-id='live-logs-viewer']")).toContainText("default/redis-xyz");
            await page.locator("[data-test-id='live-logs-stop']").click();
            await openPicker();
            await page.locator("[data-test-id='live-logs-clear']").click();
            await expect(page.locator("[data-test-id='live-logs-selected-count']")).toHaveText("0 selected");
            await closePicker();
        });

        test("streaming with no pod/wildcard selected shows guidance, not a stream", async () => {
            // No pod selected and no filter: the page must refuse to stream all
            // pods and show a message telling the user to pick pods first.
            let streamRequested = false;
            const onRequest = (req: import("@playwright/test").Request) => {
                if (req.url().includes("/api/logs/stream")) {
                    streamRequested = true;
                }
            };
            page.on("request", onRequest);
            await page.locator("[data-test-id='live-logs-start']").click();
            await expect(page.locator("[data-test-id='live-logs-needs-selection']")).toBeVisible();
            await expect(page.locator("[data-test-id='live-logs-needs-selection']")).toContainText("Pick which pods to stream first");
            // No stream started: still on Stream (not Stop) and no lines rendered.
            await expect(page.locator("[data-test-id='live-logs-start']")).toBeVisible();
            await expect(page.locator("[data-test-id='live-logs-line']")).toHaveCount(0);
            expect(streamRequested).toBe(false);
            page.off("request", onRequest);
        });

        test("entering a wildcard then streaming works and clears the guidance", async () => {
            await openPicker();
            await page.locator("[data-test-id='live-logs-search'] input").fill("nginx");
            await closePicker();
            // Typing a filter clears the earlier guidance message.
            await expect(page.locator("[data-test-id='live-logs-needs-selection']")).toHaveCount(0);
            const requestPromise = page.waitForRequest((req) => req.url().includes("/api/logs/stream") && req.url().includes("filter=nginx"));
            await page.locator("[data-test-id='live-logs-start']").click();
            await requestPromise;
            await expect(page.locator("[data-test-id='live-logs-line']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='live-logs-viewer']")).toContainText("default/nginx-abc");
            await expect(page.locator("[data-test-id='live-logs-viewer']")).not.toContainText("redis-xyz");
        });

        test("matched pod chips list every streamed pod", async () => {
            await expect(page.locator("[data-test-id='live-logs-matched-pod']")).toHaveCount(1);
        });

        test("last-updated indicator starts empty then reflects streamed log lines", async () => {
            // Fresh page so no stream has run yet: the indicator reads "No logs yet".
            await page.goto("/logs", { waitUntil: "networkidle" });
            const indicator = page.locator("[data-test-id='live-logs-last-updated']");
            await expect(indicator).toHaveText("No logs yet");
            // Scope and stream; once a line lands the caption flips to "Updated just now".
            // The pod scope lives inside the picker dropdown, so open it, type the
            // wildcard filter, then close it before pressing Stream.
            await openPicker();
            await page.locator("[data-test-id='live-logs-search'] input").fill("nginx");
            await closePicker();
            await page.locator("[data-test-id='live-logs-start']").click();
            await expect(page.locator("[data-test-id='live-logs-line']")).toHaveCount(1);
            await expect(indicator).toHaveText("Updated just now");
        });

        test("Stop button replaces Stream while streaming", async () => {
            await expect(page.locator("[data-test-id='live-logs-stop']")).toBeVisible();
            await page.locator("[data-test-id='live-logs-stop']").click();
            await expect(page.locator("[data-test-id='live-logs-start']")).toBeVisible();
        });

        test("while streaming with no lines yet shows the progress indicator, not loading text", async () => {
            // Delay the stream body so the pre-line streaming state is observable.
            // Streaming requires a pod/wildcard scope, so filter to "nginx" first.
            await page.unroute("**/api/logs/stream*");
            await page.route("**/api/logs/stream*", async (route) => {
                const filter = new URL(route.request().url()).searchParams.get("filter") ?? "";
                const matched = FAKE_PODS.pods
                    .map((p) => p.name)
                    .filter((name) => filter === "" || name.toLowerCase().includes(filter.toLowerCase()));
                await new Promise((resolve) => setTimeout(resolve, 1500));
                await route.fulfill({
                    headers: { "Content-Type": "text/event-stream" },
                    body: buildSseBody(matched),
                });
            });
            await page.goto("/logs", { waitUntil: "networkidle" });
            await openPicker();
            await page.locator("[data-test-id='live-logs-search'] input").fill("nginx");
            await closePicker();
            await page.locator("[data-test-id='live-logs-start']").click();
            // The spinner stands in for the loading state; no "Waiting for log lines..." text.
            await expect(page.locator("[data-test-id='live-logs-viewer'] [data-test-id='loading-indicator']")).toBeVisible();
            await expect(page.locator("[data-test-id='live-logs-viewer']")).not.toContainText("Waiting for log lines");
            // Once lines arrive, the indicator is gone and the lines are shown.
            await expect(page.locator("[data-test-id='live-logs-line']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='live-logs-viewer'] [data-test-id='loading-indicator']")).toHaveCount(0);
            // Restore the immediate stream (afterAll unroutes it).
            await page.unroute("**/api/logs/stream*");
            await interceptStream();
        });
    });

    test.describe("live logs auto-follow", () => {
        // One pod whose stream emits enough lines to overflow the viewer, so the
        // scroll position is meaningful (there is both history above and a bottom
        // to follow).
        const FOLLOW_PODS = {
            pods: [
                { name: "nginx-abc", namespace: "default", phase: "Running", ready: "1/1", restarts: 0, createdAt: new Date().toISOString(), node: "node-1" },
            ],
        };

        // Builds an SSE body announcing the pod then emitting `count` numbered log
        // lines, so the viewer overflows and the first/last lines are identifiable.
        function buildLongSseBody(count: number): string {
            const started = `event: started\ndata: ${JSON.stringify({ pods: [{ namespace: "default", name: "nginx-abc" }] })}\n\n`;
            let body = started;
            for (let i = 1; i <= count; i++) {
                body += `event: line\ndata: ${JSON.stringify({ namespace: "default", pod: "nginx-abc", line: `line ${i}` })}\n\n`;
            }
            return body;
        }

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await page.route("**/api/pods*", async (route) => {
                await route.fulfill({ json: FOLLOW_PODS });
            });
            await page.route("**/api/logs/stream*", async (route) => {
                await route.fulfill({
                    headers: { "Content-Type": "text/event-stream" },
                    body: buildLongSseBody(200),
                });
            });
            await page.goto("/logs", { waitUntil: "networkidle" });
        });

        test.afterAll(async () => {
            await page.unroute("**/api/pods*");
            await page.unroute("**/api/logs/stream*");
            setContext(CLUSTER_1);
        });

        // Streams 200 lines into the viewer and returns the viewer locator once the
        // lines have rendered and overflowed.
        async function streamLongLog() {
            // Reload so each test starts from a fresh, non-streaming page (the
            // serial page is shared, and a prior test leaves the Stop button up).
            await page.goto("/logs", { waitUntil: "networkidle" });
            // Scope by searching: open the pod-picker dropdown, type a substring, close it.
            await page.locator("[data-test-id='live-logs-picker-trigger']").click();
            await expect(page.locator("[data-test-id='live-logs-search']")).toBeVisible();
            await page.locator("[data-test-id='live-logs-search'] input").fill("nginx");
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='live-logs-search']")).toHaveCount(0);
            await page.locator("[data-test-id='live-logs-start']").click();
            await expect(page.locator("[data-test-id='live-logs-line']")).toHaveCount(200);
            const viewer = page.locator("[data-test-id='live-logs-viewer']");
            // The content must actually overflow for scrolling to be meaningful.
            const overflows = await viewer.evaluate((el) => el.scrollHeight > el.clientHeight + 1);
            expect(overflows).toBe(true);
            return viewer;
        }

        test("when at the bottom, appended lines keep the view pinned to the bottom", async () => {
            const viewer = await streamLongLog();
            // After streaming, the view should be pinned to the very bottom.
            const distanceFromBottom = await viewer.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop);
            expect(distanceFromBottom).toBeLessThanOrEqual(4);
            // The last line is the one in view at the bottom.
            await expect(page.locator("[data-test-id='live-logs-line']").last()).toContainText("line 200");
        });

        test("after scrolling up, the position is left alone (not yanked back down)", async () => {
            const viewer = await streamLongLog();
            // Scroll the user up to the very top and let the scroll handler run.
            await viewer.evaluate((el) => { el.scrollTop = 0; });
            await viewer.dispatchEvent("scroll");
            const topBefore = await viewer.evaluate((el) => el.scrollTop);
            expect(topBefore).toBe(0);
            // The earliest line must be reachable: line 1 is visible at the top.
            await expect(page.locator("[data-test-id='live-logs-line']").first()).toContainText("line 1");
            // The viewer is the scroll container.
            const overflowY = await viewer.evaluate((el) => getComputedStyle(el).overflowY);
            expect(overflowY).toBe("scroll");
        });

        test("shows a visible, usable custom scrollbar so the offscreen history is reachable", async () => {
            await streamLongLog();
            // The browser renders the native scrollbar as an invisible auto-hiding
            // overlay, so the page draws its own always-visible bar. The track and
            // thumb must be present and have real, visible dimensions.
            const track = page.locator("[data-test-id='live-logs-scrollbar-track']");
            const thumb = page.locator("[data-test-id='live-logs-scrollbar-thumb']");
            await expect(track).toBeVisible();
            await expect(thumb).toBeVisible();
            const thumbBox = await thumb.boundingBox();
            expect(thumbBox).not.toBeNull();
            // A real, grabbable thumb: non-trivial width and height.
            expect(thumbBox!.width).toBeGreaterThanOrEqual(6);
            expect(thumbBox!.height).toBeGreaterThanOrEqual(24);
            // The thumb has real contrast against the dark panel (light grey thumb
            // on a dark track), so it is plainly visible, not an invisible gutter.
            const thumbColor = await thumb.evaluate((el) => getComputedStyle(el).backgroundColor);
            expect(thumbColor).toBe("rgb(203, 213, 225)");
        });

        test("dragging the custom scrollbar thumb scrolls up through the history", async () => {
            const viewer = await streamLongLog();
            // The view starts pinned to the bottom (line 200 in view).
            const bottomBefore = await viewer.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop);
            expect(bottomBefore).toBeLessThanOrEqual(4);
            const thumb = page.locator("[data-test-id='live-logs-scrollbar-thumb']");
            const box = (await thumb.boundingBox())!;
            // Drag the thumb up to the top of the track to scroll back to the start.
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.down();
            await page.mouse.move(box.x + box.width / 2, box.y - 1000, { steps: 10 });
            await page.mouse.up();
            // The drag scrolled the viewer up off the bottom, reaching the earliest
            // lines, and turned off auto-follow (the position holds at the top).
            const scrollTopAfter = await viewer.evaluate((el) => el.scrollTop);
            expect(scrollTopAfter).toBeLessThan(50);
            await expect(page.locator("[data-test-id='live-logs-line']").first()).toContainText("line 1");
        });
    });

    test.describe("live logs page pod-label cap", () => {
        // Twelve fake pods, more than the page's 8-chip cap, to drive the
        // "..." expander that reveals the full streaming-pod list.
        const MANY_PODS = {
            pods: Array.from({ length: 12 }, (_unused, i) => ({
                name: `pod-${i}`,
                namespace: "default",
                phase: "Running",
                ready: "1/1",
                restarts: 0,
                createdAt: new Date().toISOString(),
                node: "node-1",
            })),
        };

        // Builds an SSE body announcing every matched pod then one line per pod.
        function buildManySseBody(podNames: string[]): string {
            const started = `event: started\ndata: ${JSON.stringify({ pods: podNames.map((n) => ({ namespace: "default", name: n })) })}\n\n`;
            const lines = podNames
                .map((n) => `event: line\ndata: ${JSON.stringify({ namespace: "default", pod: n, line: `log line from ${n}` })}\n\n`)
                .join("");
            return started + lines;
        }

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await page.route("**/api/pods*", async (route) => {
                await route.fulfill({ json: MANY_PODS });
            });
            await page.route("**/api/logs/stream*", async (route) => {
                await route.fulfill({
                    headers: { "Content-Type": "text/event-stream" },
                    body: buildManySseBody(MANY_PODS.pods.map((p) => p.name)),
                });
            });
            await page.goto("/logs", { waitUntil: "networkidle" });
        });

        test.afterAll(async () => {
            await page.unroute("**/api/pods*");
            await page.unroute("**/api/logs/stream*");
            setContext(CLUSTER_1);
        });

        test("caps visible pod chips and shows a '...' expander when there are more pods", async () => {
            // Streaming requires a pod/wildcard scope first, so type a substring
            // matching every fake pod (named pod-0..pod-11) before streaming. The
            // picker is a dropdown, so open it, type, then close it.
            await page.locator("[data-test-id='live-logs-picker-trigger']").click();
            await expect(page.locator("[data-test-id='live-logs-search']")).toBeVisible();
            await page.locator("[data-test-id='live-logs-search'] input").fill("pod");
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='live-logs-search']")).toHaveCount(0);
            await page.locator("[data-test-id='live-logs-start']").click();
            // 12 pods stream but only the first 8 chips render.
            await expect(page.locator("[data-test-id='live-logs-matched-pod']")).toHaveCount(8);
            const expander = page.locator("[data-test-id='live-logs-matched-expand']");
            await expect(expander).toBeVisible();
            await expect(expander).toContainText("+4 more");
        });

        test("clicking the '...' expander reveals the full streaming-pod list", async () => {
            await page.locator("[data-test-id='live-logs-matched-expand']").click();
            await expect(page.locator("[data-test-id='live-logs-matched-pod']")).toHaveCount(12);
            await expect(page.locator("[data-test-id='live-logs-matched-expand']")).toHaveCount(0);
            // A "Show fewer" control collapses the list back to the cap.
            await page.locator("[data-test-id='live-logs-matched-collapse']").click();
            await expect(page.locator("[data-test-id='live-logs-matched-pod']")).toHaveCount(8);
            await expect(page.locator("[data-test-id='live-logs-matched-expand']")).toBeVisible();
        });
    });

    // ── Stern page (stern-powered live logs) ──────────────────────────────────

    test.describe("stern page", () => {
        // Builds a Server-Sent Events body that announces the stream then emits one
        // stern-style "namespace pod message" line per pod, mirroring the backend.
        function buildSternSseBody(query: string): string {
            const started = `event: started\ndata: ${JSON.stringify({ query, namespace: "default" })}\n\n`;
            const pods = ["nginx-abc", "redis-xyz"].filter(
                (n) => query === "" || query === ".*" || n.toLowerCase().includes(query.toLowerCase())
            );
            const lines = pods
                .map((n) => `event: line\ndata: ${JSON.stringify({ line: `default ${n} log line from ${n}` })}\n\n`)
                .join("");
            return started + lines;
        }

        // Intercepts the stern SSE stream, returning canned output for the request's
        // query, or an "unavailable" event when forceUnavailable is set.
        async function interceptSternStream(forceUnavailable: boolean): Promise<void> {
            await page.route("**/api/stern/stream*", async (route) => {
                if (forceUnavailable) {
                    await route.fulfill({
                        headers: { "Content-Type": "text/event-stream" },
                        body: `event: unavailable\ndata: ${JSON.stringify({ binary: "stern" })}\n\n`,
                    });
                    return;
                }
                const query = new URL(route.request().url()).searchParams.get("query") ?? "";
                await route.fulfill({
                    headers: { "Content-Type": "text/event-stream" },
                    body: buildSternSseBody(query),
                });
            });
        }

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await interceptSternStream(false);
            await page.goto("/stern", { waitUntil: "networkidle" });
        });

        test.afterAll(async () => {
            await page.unroute("**/api/stern/stream*");
            setContext(CLUSTER_1);
        });

        test("shows page title Stern", async () => {
            await expect(page.locator("[data-test-id='breadcrumb-item']").first()).toHaveText("Stern");
        });

        test("renders namespace and query controls", async () => {
            await expect(page.locator("[data-test-id='stern-namespace-select']")).toBeVisible();
            await expect(page.locator("[data-test-id='stern-query']")).toBeVisible();
        });

        test("streaming shows a stern-prefixed line per pod", async () => {
            await page.locator("[data-test-id='stern-start']").click();
            await expect(page.locator("[data-test-id='stern-line']")).toHaveCount(2);
            await expect(page.locator("[data-test-id='stern-viewer']")).toContainText("default nginx-abc");
            await expect(page.locator("[data-test-id='stern-viewer']")).toContainText("default redis-xyz");
        });

        test("Stop button replaces Stream while streaming", async () => {
            await expect(page.locator("[data-test-id='stern-stop']")).toBeVisible();
            await page.locator("[data-test-id='stern-stop']").click();
            await expect(page.locator("[data-test-id='stern-start']")).toBeVisible();
        });

        test("query sends the query param and restricts the streamed pods", async () => {
            await page.locator("[data-test-id='stern-query'] input").fill("nginx");
            const requestPromise = page.waitForRequest((req) => req.url().includes("/api/stern/stream") && req.url().includes("query=nginx"));
            await page.locator("[data-test-id='stern-start']").click();
            await requestPromise;
            await expect(page.locator("[data-test-id='stern-line']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='stern-viewer']")).toContainText("default nginx-abc");
            await expect(page.locator("[data-test-id='stern-viewer']")).not.toContainText("redis-xyz");
        });

        test("while streaming with no lines yet shows the progress indicator, not loading text", async () => {
            // Delay the stream body so the pre-line streaming state is observable.
            await page.unroute("**/api/stern/stream*");
            await page.route("**/api/stern/stream*", async (route) => {
                const query = new URL(route.request().url()).searchParams.get("query") ?? "";
                await new Promise((resolve) => setTimeout(resolve, 1500));
                await route.fulfill({
                    headers: { "Content-Type": "text/event-stream" },
                    body: buildSternSseBody(query),
                });
            });
            await page.goto("/stern", { waitUntil: "networkidle" });
            // Clear any leftover query from earlier tests so both pods stream.
            await page.locator("[data-test-id='stern-query'] input").fill("");
            await page.locator("[data-test-id='stern-start']").click();
            // The spinner stands in for the loading state; no "Waiting for log lines..." text.
            await expect(page.locator("[data-test-id='stern-viewer'] [data-test-id='loading-indicator']")).toBeVisible();
            await expect(page.locator("[data-test-id='stern-viewer']")).not.toContainText("Waiting for log lines");
            // Once lines arrive, the indicator is gone and the lines are shown.
            await expect(page.locator("[data-test-id='stern-line']")).toHaveCount(2);
            await expect(page.locator("[data-test-id='stern-viewer'] [data-test-id='loading-indicator']")).toHaveCount(0);
            // Restore the immediate stream for the remaining test.
            await page.unroute("**/api/stern/stream*");
            await interceptSternStream(false);
        });

        test("shows install instructions when stern is not installed", async () => {
            await page.unroute("**/api/stern/stream*");
            await interceptSternStream(true);
            await page.goto("/stern", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='stern-start']").click();
            await expect(page.locator("[data-test-id='stern-not-installed']")).toBeVisible();
            await expect(page.locator("[data-test-id='stern-not-installed']")).toContainText("brew install stern");
        });
    });

    // ── Table row hover consistency ─────────────────────────────────────────────
    // Every data table in Karse applies the same row hover treatment via the
    // shared tableRowSx() helper: hovering any data row highlights it with the
    // MUI "action.hover" background. Clickable rows (which navigate to a detail
    // page) additionally show a pointer cursor; static rows keep the default
    // cursor. These tests assert the highlight is applied consistently and that
    // the cursor matches the clickable / static distinction.

    test.describe("table row hover consistency", () => {
        test.beforeAll(() => {
            setContext(CLUSTER_1);
        });

        // Return the computed background-color of a row before and after hovering it.
        async function hoverBackgrounds(rowSelector: string): Promise<{ before: string; after: string }> {
            const row = page.locator(rowSelector).first();
            await expect(row).toBeVisible();
            // Move the pointer off any row first so the resting "before" background is
            // measured without a residual hover left over from a previous test.
            await page.mouse.move(0, 0);
            const before = await row.evaluate((el) => getComputedStyle(el).backgroundColor);
            await row.hover();
            const after = await row.evaluate((el) => getComputedStyle(el).backgroundColor);
            return { before, after };
        }

        // Return the computed cursor of the first matching row.
        async function rowCursor(rowSelector: string): Promise<string> {
            const row = page.locator(rowSelector).first();
            await expect(row).toBeVisible();
            return row.evaluate((el) => getComputedStyle(el).cursor);
        }

        test("clickable node rows highlight on hover and show a pointer cursor", async () => {
            await page.goto("/nodes", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='node-row']").first()).toBeVisible();
            const { before, after } = await hoverBackgrounds("[data-test-id='node-row']");
            expect(after).not.toBe(before);
            expect(await rowCursor("[data-test-id='node-row']")).toBe("pointer");
        });

        test("static context rows highlight on hover with the default cursor", async () => {
            await page.goto("/contexts", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='context-row']").first()).toBeVisible();
            const { before, after } = await hoverBackgrounds("[data-test-id='context-row']");
            expect(after).not.toBe(before);
            expect(await rowCursor("[data-test-id='context-row']")).toBe("default");
        });

        test("clickable namespace rows highlight on hover and show a pointer cursor", async () => {
            await page.goto("/namespaces", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='namespace-row']").first()).toBeVisible();
            const { before, after } = await hoverBackgrounds("[data-test-id='namespace-row']");
            expect(after).not.toBe(before);
            // Namespace rows now navigate to the namespace detail page, so they carry
            // the same pointer-cursor affordance as the other clickable resource rows.
            expect(await rowCursor("[data-test-id='namespace-row']")).toBe("pointer");
        });

        test("node and context rows share the same hover background color", async () => {
            await page.goto("/nodes", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='node-row']").first()).toBeVisible();
            const nodeHover = (await hoverBackgrounds("[data-test-id='node-row']")).after;
            await page.goto("/contexts", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='context-row']").first()).toBeVisible();
            const contextHover = (await hoverBackgrounds("[data-test-id='context-row']")).after;
            expect(nodeHover).toBe(contextHover);
        });
    });

    // ── Events page ─────────────────────────────────────────────────────────────

    test.describe("events page", () => {
        // Predictable event data injected via route interception.
        const FAKE_EVENTS = {
            events: [
                {
                    type: "Warning",
                    reason: "BackOff",
                    message: "Back-off restarting failed container",
                    count: 5,
                    lastSeen: new Date().toISOString(),
                    namespace: "default",
                    objectKind: "Pod",
                    objectName: "nginx-abc",
                },
                {
                    type: "Normal",
                    reason: "Scheduled",
                    message: "Successfully assigned kube-system/redis-xyz to node-cp",
                    count: 1,
                    lastSeen: new Date().toISOString(),
                    namespace: "kube-system",
                    objectKind: "Pod",
                    objectName: "redis-xyz",
                },
            ],
        };

        // Install a route override that returns FAKE_EVENTS for every /api/events request.
        async function interceptEvents(): Promise<void> {
            await page.route("**/api/events*", async (route) => {
                await route.fulfill({ json: FAKE_EVENTS });
            });
        }

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await interceptEvents();
            await page.goto("/events", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='events-table']")).toBeVisible();
        });

        test.afterAll(async () => {
            await page.unroute("**/api/events*");
            setContext(CLUSTER_1);
        });

        test("shows page title Events", async () => {
            await expect(page.locator("[data-test-id='breadcrumb-item']").first()).toHaveText("Events");
        });

        test("has all column headers", async () => {
            const table = page.locator("[data-test-id='events-table']");
            for (const name of ["Last seen", "Type", "Reason", "Object", "Message", "Count", "Namespace"]) {
                await expect(table.getByRole("columnheader", { name, exact: true })).toBeVisible();
            }
        });

        test("shows a row for each fake event", async () => {
            await expect(page.locator("[data-test-id='event-row']")).toHaveCount(2);
        });

        test("shows Warning chip for the BackOff event", async () => {
            const row = page.locator("[data-test-id='event-row']").filter({ hasText: "BackOff" });
            await expect(row.locator(".MuiChip-label")).toHaveText("Warning");
        });

        test("shows Normal chip for the Scheduled event", async () => {
            const row = page.locator("[data-test-id='event-row']").filter({ hasText: "Scheduled" });
            await expect(row.locator(".MuiChip-label")).toHaveText("Normal");
        });

        test("renders the involved object as kind/name", async () => {
            const row = page.locator("[data-test-id='event-row']").filter({ hasText: "BackOff" });
            await expect(row).toContainText("Pod/nginx-abc");
        });

        test("search filters events by reason", async () => {
            await page.locator("[data-test-id='events-search'] input").fill("BackOff");
            await expect(page.locator("[data-test-id='event-row']")).toHaveCount(1);
        });

        test("shows no-events-match message when search has no results", async () => {
            await page.locator("[data-test-id='events-search'] input").fill("zzznotfound");
            await expect(page.locator("[data-test-id='no-events-match']")).toBeVisible();
        });

        test("clearing search restores all events", async () => {
            await page.locator("[data-test-id='events-search'] input").fill("");
            await expect(page.locator("[data-test-id='event-row']")).toHaveCount(2);
        });

        test("sends namespace query param to API when namespace is selected", async () => {
            await page.unroute("**/api/events*");
            await page.route("**/api/events*", async (route) => {
                const ns = new URL(route.request().url()).searchParams.get("namespace");
                const events = ns !== null && ns !== ""
                    ? FAKE_EVENTS.events.filter((e) => e.namespace === ns)
                    : FAKE_EVENTS.events;
                await route.fulfill({ json: { events } });
            });
            await page.goto("/events", { waitUntil: "networkidle" });
            const requestPromise = page.waitForRequest("**/api/events*");
            await page.locator("[aria-label='namespace picker']").click();
            await page.locator("[data-test-id='namespace-quick-picker-row']").filter({ hasText: /^default/ }).click();
            const request = await requestPromise;
            expect(new URL(request.url()).searchParams.get("namespace")).toBe("default");
        });

        test("shows only events from the selected namespace", async () => {
            await expect(page.locator("[data-test-id='event-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='event-row']").filter({ hasText: "nginx-abc" })).toBeVisible();
            await expect(page.locator("[data-test-id='event-row']").filter({ hasText: "redis-xyz" })).toHaveCount(0);
        });
    });

    // ── Event detail page ───────────────────────────────────────────────────────

    test.describe("event detail page", () => {
        // Two events with stable uids so the detail route can address each one. The
        // Warning event's involved Pod has a detail page; the message is long so the
        // "full untruncated message" assertion is meaningful.
        const LONG_MESSAGE =
            "Back-off restarting failed container nginx in pod nginx-abc_default; the container keeps crashing on startup and kubelet is throttling restarts";
        const DETAIL_EVENTS = {
            events: [
                {
                    uid: "evt-warning-1",
                    type: "Warning",
                    reason: "BackOff",
                    message: LONG_MESSAGE,
                    count: 9,
                    source: "kubelet",
                    firstSeen: new Date(Date.now() - 3_600_000).toISOString(),
                    lastSeen: new Date().toISOString(),
                    namespace: "default",
                    objectKind: "Pod",
                    objectName: "nginx-abc",
                },
                {
                    uid: "evt-normal-1",
                    type: "Normal",
                    reason: "Scheduled",
                    message: "Successfully assigned default/redis-xyz to node-cp",
                    count: 1,
                    source: "default-scheduler",
                    firstSeen: new Date(Date.now() - 60_000).toISOString(),
                    lastSeen: new Date().toISOString(),
                    namespace: "default",
                    objectKind: "Pod",
                    objectName: "redis-xyz",
                },
            ],
        };

        async function interceptDetailEvents(): Promise<void> {
            await page.route("**/api/events*", async (route) => {
                await route.fulfill({ json: DETAIL_EVENTS });
            });
        }

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await interceptDetailEvents();
            await page.goto("/events", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='events-table']")).toBeVisible();
        });

        test.afterAll(async () => {
            await page.unroute("**/api/events*");
            setContext(CLUSTER_1);
        });

        test("clicking an event row navigates to its detail page", async () => {
            await page.goto("/events", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='event-row']").filter({ hasText: "BackOff" }).click();
            await expect(page).toHaveURL(/\/events\/evt-warning-1/);
            await expect(page.locator("[data-test-id='event-detail']")).toBeVisible();
        });

        test("shows the event fields including count and object", async () => {
            await page.goto("/events/evt-warning-1", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='event-field-reason']")).toContainText("BackOff");
            await expect(page.locator("[data-test-id='event-field-type']")).toContainText("Warning");
            await expect(page.locator("[data-test-id='event-field-count']")).toContainText("9");
            await expect(page.locator("[data-test-id='event-field-source']")).toContainText("kubelet");
            await expect(page.locator("[data-test-id='event-field-object']")).toContainText("Pod/nginx-abc");
            await expect(page.locator("[data-test-id='event-field-namespace']")).toContainText("default");
        });

        test("shows the full untruncated message", async () => {
            await page.goto("/events/evt-warning-1", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='event-field-message']")).toHaveText(LONG_MESSAGE);
        });

        test("shows first-seen and last-seen timestamps", async () => {
            await page.goto("/events/evt-warning-1", { waitUntil: "networkidle" });
            const firstSeen = await page.locator("[data-test-id='event-field-first-seen']").textContent();
            const lastSeen = await page.locator("[data-test-id='event-field-last-seen']").textContent();
            // Each shows an absolute timestamp plus a relative age in parentheses.
            expect(firstSeen).toContain("First seen");
            expect(firstSeen).toMatch(/\(.+\)/);
            expect(lastSeen).toContain("Last seen");
            expect(lastSeen).toMatch(/\(.+\)/);
        });

        test("the involved-object link navigates to the pod detail page", async () => {
            await page.goto("/events/evt-warning-1", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='event-object-link']").click();
            await expect(page).toHaveURL(/\/pods\/default\/nginx-abc/);
        });

        test("the back button returns to the events list", async () => {
            await page.goto("/events/evt-warning-1", { waitUntil: "networkidle" });
            await page.locator("[aria-label='back to events']").click();
            await expect(page).toHaveURL(/\/events($|\?)/);
            await expect(page.locator("[data-test-id='events-table']")).toBeVisible();
        });

        test("the trailing breadcrumb shows the event name, not the literal \"Event\"", async () => {
            await page.goto("/events/evt-warning-1", { waitUntil: "networkidle" });
            // The trailing crumb must be the event's own name (its reason), mirroring
            // how the other detail pages put the resource's name in the last crumb.
            await expect(page.locator("[data-test-id='breadcrumb-item']").last()).toHaveText("BackOff");
            const items = await page.locator("[data-test-id='breadcrumb-item']").allTextContents();
            expect(items).toEqual(["Events", "BackOff"]);
        });

        test("the trailing breadcrumb reflects a different event's name", async () => {
            await page.goto("/events/evt-normal-1", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='breadcrumb-item']").last()).toHaveText("Scheduled");
        });

        test("the Events breadcrumb returns to the events list", async () => {
            await page.goto("/events/evt-warning-1", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='breadcrumb-item']").filter({ hasText: "Events" }).click();
            await expect(page).toHaveURL(/\/events($|\?)/);
        });

        test("shows a not-found message for an unknown event uid", async () => {
            await page.goto("/events/does-not-exist", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='event-not-found']")).toBeVisible();
        });
    });

    // ── Events page: type filter ────────────────────────────────────────────────

    test.describe("events page type filter", () => {
        // Two Warning and one Normal event so each type checkbox is observable.
        const TYPE_EVENTS = {
            events: [
                {
                    type: "Warning",
                    reason: "BackOff",
                    message: "Back-off restarting failed container",
                    count: 5,
                    lastSeen: new Date().toISOString(),
                    namespace: "default",
                    objectKind: "Pod",
                    objectName: "nginx-warn",
                },
                {
                    type: "Warning",
                    reason: "Unhealthy",
                    message: "Readiness probe failed",
                    count: 3,
                    lastSeen: new Date().toISOString(),
                    namespace: "default",
                    objectKind: "Pod",
                    objectName: "redis-warn",
                },
                {
                    type: "Normal",
                    reason: "Scheduled",
                    message: "Successfully assigned default/web to node-cp",
                    count: 1,
                    lastSeen: new Date().toISOString(),
                    namespace: "default",
                    objectKind: "Pod",
                    objectName: "web-normal",
                },
            ],
        };

        // Install a route override that returns TYPE_EVENTS for every /api/events request.
        async function interceptTypeEvents(): Promise<void> {
            await page.route("**/api/events*", async (route) => {
                await route.fulfill({ json: TYPE_EVENTS });
            });
        }

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await interceptTypeEvents();
            await page.goto("/events", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='events-table']")).toBeVisible();
        });

        test.afterAll(async () => {
            await page.unroute("**/api/events*");
            setContext(CLUSTER_1);
        });

        test("shows all events by default with nothing checked", async () => {
            await expect(page.locator("[data-test-id='event-row']")).toHaveCount(3);
            await expect(page.locator("[data-test-id='events-filter-button']")).toHaveText("Filter: All");
        });

        test("checking Warning narrows to only Warning events", async () => {
            await page.locator("[data-test-id='events-filter-button']").click();
            await page.locator("[data-test-id='events-filter-item-type-Warning']").click();
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='event-row']")).toHaveCount(2);
            await expect(page.locator("[data-test-id='event-row']").filter({ hasText: "web-normal" })).toHaveCount(0);
            await expect(page.locator("[data-test-id='events-filter-button']")).toHaveText("Filter: 1 selected");
        });

        test("also checking Normal widens to both types", async () => {
            await page.locator("[data-test-id='events-filter-button']").click();
            await page.locator("[data-test-id='events-filter-item-type-Normal']").click();
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='event-row']")).toHaveCount(3);
            await expect(page.locator("[data-test-id='events-filter-button']")).toHaveText("Filter: 2 selected");
        });

        test("checking only Normal shows just the Normal event", async () => {
            await page.locator("[data-test-id='events-filter-button']").click();
            // Uncheck Warning, leaving only Normal checked.
            await page.locator("[data-test-id='events-filter-item-type-Warning']").click();
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='event-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='event-row']").filter({ hasText: "web-normal" })).toBeVisible();
            await expect(page.locator("[data-test-id='events-filter-button']")).toHaveText("Filter: 1 selected");
        });

        test("deselect all clears the selection and restores every event", async () => {
            await page.locator("[data-test-id='events-filter-button']").click();
            await page.locator("[data-test-id='events-filter-deselect-all']").click();
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='event-row']")).toHaveCount(3);
            await expect(page.locator("[data-test-id='events-filter-button']")).toHaveText("Filter: All");
        });
    });

    // ── Errors page ───────────────────────────────────────────────────────────

    test.describe("errors page", () => {
        // Predictable error data injected via route interception: one problem pod
        // and one Warning event.
        const FAKE_ERRORS = {
            errors: [
                {
                    source: "Pod",
                    namespace: "default",
                    objectKind: "Pod",
                    objectName: "crasher-abc",
                    reason: "CrashLoopBackOff",
                    message: "back-off 5m0s restarting failed container",
                    count: 1,
                    firstSeen: "2024-01-01T00:00:00Z",
                    lastSeen: new Date().toISOString(),
                },
                {
                    source: "Event",
                    namespace: "kube-system",
                    objectKind: "Pod",
                    objectName: "scheduler-xyz",
                    reason: "FailedScheduling",
                    message: "0/3 nodes are available",
                    count: 4,
                    firstSeen: "2024-01-02T00:00:00Z",
                    lastSeen: new Date().toISOString(),
                },
            ],
        };

        // Install a route override that returns FAKE_ERRORS for every /api/errors request.
        async function interceptErrors(): Promise<void> {
            await page.route("**/api/errors*", async (route) => {
                await route.fulfill({ json: FAKE_ERRORS });
            });
        }

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await interceptErrors();
            await page.goto("/errors", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='errors-table']")).toBeVisible();
        });

        test.afterAll(async () => {
            await page.unroute("**/api/errors*");
            setContext(CLUSTER_1);
        });

        test("shows page title Errors", async () => {
            await expect(page.locator("[data-test-id='breadcrumb-item']").first()).toHaveText("Errors");
        });

        test("has all column headers", async () => {
            const table = page.locator("[data-test-id='errors-table']");
            for (const name of ["Age", "Source", "Object", "Reason", "Message", "Count", "Namespace"]) {
                await expect(table.getByRole("columnheader", { name, exact: true })).toBeVisible();
            }
        });

        test("shows a row for each fake error", async () => {
            await expect(page.locator("[data-test-id='error-row']")).toHaveCount(2);
        });

        test("shows Pod chip for the CrashLoopBackOff error", async () => {
            const row = page.locator("[data-test-id='error-row']").filter({ hasText: "CrashLoopBackOff" });
            await expect(row.locator(".MuiChip-label")).toHaveText("Pod");
        });

        test("shows Event chip for the FailedScheduling error", async () => {
            const row = page.locator("[data-test-id='error-row']").filter({ hasText: "FailedScheduling" });
            await expect(row.locator(".MuiChip-label")).toHaveText("Event");
        });

        test("renders the involved object as kind/name", async () => {
            const row = page.locator("[data-test-id='error-row']").filter({ hasText: "CrashLoopBackOff" });
            await expect(row).toContainText("Pod/crasher-abc");
        });

        test("search filters errors by reason", async () => {
            await page.locator("[data-test-id='errors-search'] input").fill("CrashLoopBackOff");
            await expect(page.locator("[data-test-id='error-row']")).toHaveCount(1);
        });

        test("search matches a term only in the Message column", async () => {
            // "nodes are available" appears only in the FailedScheduling row's message.
            await page.locator("[data-test-id='errors-search'] input").fill("nodes are available");
            await expect(page.locator("[data-test-id='error-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='error-row']").filter({ hasText: "FailedScheduling" })).toHaveCount(1);
        });

        test("search matches a term only in the Source column", async () => {
            // "Event" is the source-chip label of only the FailedScheduling row.
            await page.locator("[data-test-id='errors-search'] input").fill("Event");
            await expect(page.locator("[data-test-id='error-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='error-row']").filter({ hasText: "FailedScheduling" })).toHaveCount(1);
        });

        test("search matches a term only in the Object column", async () => {
            // "crasher-abc" is the object name of only the CrashLoopBackOff row.
            await page.locator("[data-test-id='errors-search'] input").fill("crasher-abc");
            await expect(page.locator("[data-test-id='error-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='error-row']").filter({ hasText: "CrashLoopBackOff" })).toHaveCount(1);
        });

        test("search matches a term only in the Namespace column", async () => {
            // "kube-system" is the namespace of only the FailedScheduling row.
            await page.locator("[data-test-id='errors-search'] input").fill("kube-system");
            await expect(page.locator("[data-test-id='error-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='error-row']").filter({ hasText: "FailedScheduling" })).toHaveCount(1);
        });

        test("search matches a term only in the Count column", async () => {
            // count 4 belongs only to the FailedScheduling row.
            await page.locator("[data-test-id='errors-search'] input").fill("4");
            await expect(page.locator("[data-test-id='error-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='error-row']").filter({ hasText: "FailedScheduling" })).toHaveCount(1);
        });

        test("shows no-errors-match message when search has no results", async () => {
            await page.locator("[data-test-id='errors-search'] input").fill("zzznotfound");
            await expect(page.locator("[data-test-id='no-errors-match']")).toBeVisible();
        });

        test("clearing search restores all errors", async () => {
            await page.locator("[data-test-id='errors-search'] input").fill("");
            await expect(page.locator("[data-test-id='error-row']")).toHaveCount(2);
        });
    });

    // ── Error detail page ───────────────────────────────────────────────────────

    test.describe("error detail page", () => {
        // One problem pod and one Warning event, with distinct first/last seen times
        // and a long message so the detail page's untruncated rendering is testable.
        const LONG_MESSAGE =
            "back-off 5m0s restarting failed container app pod default/crasher-abc: this message is intentionally long so the table clips it but the detail page shows it in full without truncation";
        const FAKE_ERRORS = {
            errors: [
                {
                    source: "Pod",
                    namespace: "default",
                    objectKind: "Pod",
                    objectName: "crasher-abc",
                    reason: "CrashLoopBackOff",
                    message: LONG_MESSAGE,
                    count: 7,
                    firstSeen: "2024-01-01T00:00:00Z",
                    lastSeen: new Date().toISOString(),
                },
                {
                    source: "Event",
                    namespace: "kube-system",
                    objectKind: "Pod",
                    objectName: "scheduler-xyz",
                    reason: "FailedScheduling",
                    message: "0/3 nodes are available",
                    count: 4,
                    firstSeen: "2024-01-02T00:00:00Z",
                    lastSeen: new Date().toISOString(),
                },
                {
                    // A ReplicaSet has no detail page in Karse, so its reference must
                    // degrade to plain text rather than become a broken link.
                    source: "Event",
                    namespace: "default",
                    objectKind: "ReplicaSet",
                    objectName: "web-7d9",
                    reason: "FailedCreate",
                    message: "Error creating: pods is forbidden",
                    count: 2,
                    firstSeen: "2024-01-03T00:00:00Z",
                    lastSeen: new Date().toISOString(),
                },
            ],
        };

        async function interceptErrors(): Promise<void> {
            await page.route("**/api/errors*", async (route) => {
                await route.fulfill({ json: FAKE_ERRORS });
            });
        }

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await interceptErrors();
        });

        test.beforeEach(async () => {
            await page.goto("/errors", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='errors-table']")).toBeVisible();
        });

        test.afterAll(async () => {
            await page.unroute("**/api/errors*");
            setContext(CLUSTER_1);
        });

        test("clicking an error row navigates to its detail page", async () => {
            await page.locator("[data-test-id='error-row']").filter({ hasText: "CrashLoopBackOff" }).click();
            await expect(page.locator("[data-test-id='error-detail']")).toBeVisible();
            await expect(page).toHaveURL(/\/errors\/\d+/);
        });

        test("detail page shows every table field", async () => {
            await page.locator("[data-test-id='error-row']").filter({ hasText: "CrashLoopBackOff" }).click();
            await expect(page.locator("[data-test-id='error-detail-source']")).toContainText("Pod");
            await expect(page.locator("[data-test-id='error-detail-object']")).toContainText("Pod/crasher-abc");
            await expect(page.locator("[data-test-id='error-detail-reason-field']")).toContainText("CrashLoopBackOff");
            await expect(page.locator("[data-test-id='error-detail-namespace']")).toContainText("default");
            await expect(page.locator("[data-test-id='error-detail-count']")).toContainText("7");
            await expect(page.locator("[data-test-id='error-detail-age']")).toBeVisible();
        });

        test("detail page shows the full untruncated message", async () => {
            await page.locator("[data-test-id='error-row']").filter({ hasText: "CrashLoopBackOff" }).click();
            await expect(page.locator("[data-test-id='error-detail-message']")).toHaveText(LONG_MESSAGE);
        });

        test("detail page shows the first-seen and last-seen times", async () => {
            await page.locator("[data-test-id='error-row']").filter({ hasText: "CrashLoopBackOff" }).click();
            // 2024-01-01 is rendered in the browser's locale; assert the year is present.
            await expect(page.locator("[data-test-id='error-detail-first-seen']")).toContainText("2024");
            await expect(page.locator("[data-test-id='error-detail-last-seen']")).toContainText("ago");
        });

        test("related-object link navigates to the pod detail page", async () => {
            await page.locator("[data-test-id='error-row']").filter({ hasText: "CrashLoopBackOff" }).click();
            await page.locator("[data-test-id='error-detail-object-link']").click();
            await expect(page).toHaveURL(/\/pods\/default\/crasher-abc/);
        });

        test("an unresolvable related object renders as plain text, not a broken link", async () => {
            // The ReplicaSet error has no detail page; its object reference must be
            // plain text (a span), not an anchor, and must not navigate on click.
            await page.locator("[data-test-id='error-row']").filter({ hasText: "FailedCreate" }).click();
            const ref = page.locator("[data-test-id='error-detail-object-link']");
            await expect(ref).toContainText("ReplicaSet/web-7d9");
            await expect(ref).toHaveJSProperty("tagName", "SPAN");
            await ref.click();
            // Still on the same error detail page: no navigation happened.
            await expect(page.locator("[data-test-id='error-detail']")).toBeVisible();
        });

        test("back navigation returns to the errors list", async () => {
            await page.locator("[data-test-id='error-row']").filter({ hasText: "CrashLoopBackOff" }).click();
            await expect(page.locator("[data-test-id='error-detail']")).toBeVisible();
            await page.locator("[data-test-id='error-detail-back']").click();
            await expect(page.locator("[data-test-id='errors-table']")).toBeVisible();
            await expect(page).toHaveURL(/\/errors(\?|$)/);
        });
    });

    // ── Errors page: type filter ────────────────────────────────────────────────

    // ── Column configuration ────────────────────────────────────────────────────

    // Simulates a pointer-driven drag-and-drop from one element onto another, as dnd-kit's
    // PointerSensor expects: press on the source, move in small steps to the target (dnd-kit
    // only starts tracking once the pointer moves after the press), then release. Stepped moves
    // are needed so the sensor registers the drag and the collision detection settles on the
    // target before the drop.
    async function dragColumnOnto(sourceTestId: string, targetTestId: string): Promise<void> {
        // Resolve the live in-list element, not the DragOverlay copy. While a drag is in flight (or
        // its drop animation is settling) dnd-kit renders a free-floating overlay copy of the row
        // with the SAME data-test-id but OUTSIDE both section lists, so a bare data-test-id selector
        // can match two elements. Scoping to the section droppables (which a column id always lives
        // in, and the overlay never does) keeps the lookup unambiguous; a section target id is not
        // inside a section, so fall back to the bare selector for those.
        function inList(testId: string): ReturnType<typeof page.locator> {
            if (testId.startsWith("column-config-section-")) {
                return page.locator(`[data-test-id='${testId}']`);
            }
            return page.locator(
                `[data-test-id^='column-config-section-'] [data-test-id='${testId}']`,
            );
        }
        const source = inList(sourceTestId);
        const target = inList(targetTestId);
        const sourceBox = await source.boundingBox();
        const targetBox = await target.boundingBox();
        if (sourceBox === null || targetBox === null) {
            throw new Error("drag source or target not found");
        }
        const startX = sourceBox.x + sourceBox.width / 2;
        const startY = sourceBox.y + sourceBox.height / 2;
        const endX = targetBox.x + targetBox.width / 2;
        const endY = targetBox.y + targetBox.height / 2;
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        // Step the pointer towards the target so dnd-kit starts and tracks the drag.
        const steps = 10;
        for (let step = 1; step <= steps; step++) {
            const x = startX + ((endX - startX) * step) / steps;
            const y = startY + ((endY - startY) * step) / steps;
            await page.mouse.move(x, y);
        }
        // A final settle move on the target, then release to drop.
        await page.mouse.move(endX, endY);
        await page.mouse.up();
        // dnd-kit suppresses the single click that a browser synthesises right after a pointer
        // drag (so a drag never doubles as a click). Absorb that one suppressed click with a
        // neutral click on the modal's instructional text, so the test's next real click (e.g.
        // Close) lands.
        await page.locator("[data-test-id='column-config-modal']").getByText("Drag columns to reorder").click();
    }

    // Drags a source column to the END of a destination section: releases the pointer in the bare
    // area just below the section's last row, so the column lands as the last item rather than at a
    // mid-list insertion point. Mirrors dragColumnOnto's pointer sequence but aims at a point inside
    // the section droppable, below its last row.
    async function dragColumnToSectionEnd(sourceTestId: string, sectionTestId: string): Promise<void> {
        const source = page.locator(
            `[data-test-id^='column-config-section-'] [data-test-id='${sourceTestId}']`,
        );
        const section = page.locator(`[data-test-id='${sectionTestId}']`);
        const lastRow = section.locator("[data-test-id^='column-config-item-']").last();
        const sourceBox = await source.boundingBox();
        const sectionBox = await section.boundingBox();
        const lastRowBox = await lastRow.boundingBox();
        if (sourceBox === null || sectionBox === null) {
            throw new Error("drag source or section not found");
        }
        const startX = sourceBox.x + sourceBox.width / 2;
        const startY = sourceBox.y + sourceBox.height / 2;
        const endX = sectionBox.x + sectionBox.width / 2;
        // Aim a little below the last row (still inside the section's padded box) so the cursor sits
        // in the bare area beneath every row; if the section is empty, aim at its centre.
        const endY = lastRowBox === null
            ? sectionBox.y + sectionBox.height / 2
            : Math.min(lastRowBox.y + lastRowBox.height + 10, sectionBox.y + sectionBox.height - 4);
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        const steps = 10;
        for (let step = 1; step <= steps; step++) {
            const x = startX + ((endX - startX) * step) / steps;
            const y = startY + ((endY - startY) * step) / steps;
            await page.mouse.move(x, y);
        }
        await page.mouse.move(endX, endY);
        await page.mouse.up();
        await page.locator("[data-test-id='column-config-modal']").getByText("Drag columns to reorder").click();
    }

    // Returns the visible nodes-table column header texts (excluding the empty actions header).
    async function getNodeHeaders(): Promise<string[]> {
        const texts = await page.locator("[data-test-id='nodes-table'] thead th").allTextContents();
        return texts.map((t) => t.trim()).filter((t) => t.length > 0);
    }

    test.describe("column configuration", () => {
        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            // Start from a clean configuration so the test is deterministic.
            await page.goto("/nodes");
            await page.evaluate(() => localStorage.removeItem("karse-columns-nodes"));
            await navigateToNodes();
        });

        test("nodes table has a Columns button that opens the config modal", async () => {
            await expect(page.locator("[data-test-id='column-config-button']")).toBeVisible();
            await page.locator("[data-test-id='column-config-button']").click();
            await expect(page.locator("[data-test-id='column-config-modal']")).toBeVisible();
        });

        test("the Roles column is hidden by default and starts in the Hidden section", async () => {
            // With no saved configuration, Roles is default-hidden: it is not a table header,
            // and in the modal it sits in the Hidden section while the others are Visible.
            const headers = await getNodeHeaders();
            expect(headers).not.toContain("Roles");
            expect(headers).toContain("Name");
            const visible = page.locator("[data-test-id='column-config-section-visible']");
            for (const id of ["name", "status", "version", "age"]) {
                await expect(visible.locator(`[data-test-id='column-config-item-${id}']`)).toBeVisible();
            }
            await expect(
                page.locator("[data-test-id='column-config-section-hidden'] [data-test-id='column-config-item-roles']"),
            ).toBeVisible();
        });

        test("dragging the hidden Roles column to Visible shows it in the table", async () => {
            // Drag Roles from Hidden back into Visible.
            await dragColumnOnto("column-config-item-roles", "column-config-section-visible");
            await expect(
                page.locator("[data-test-id='column-config-section-visible'] [data-test-id='column-config-item-roles']"),
            ).toBeVisible();
            await page.locator("[data-test-id='column-config-close']").click();
            await expect(page.locator("[data-test-id='column-config-modal']")).toBeHidden();
            const headers = await getNodeHeaders();
            expect(headers).toContain("Roles");
        });

        test("dragging a column to the Hidden section hides it from the table", async () => {
            await page.locator("[data-test-id='column-config-button']").click();
            // Drag the Roles column (now visible) back onto the Hidden section.
            await dragColumnOnto("column-config-item-roles", "column-config-section-hidden");
            // The item now lives in the Hidden section.
            await expect(
                page.locator("[data-test-id='column-config-section-hidden'] [data-test-id='column-config-item-roles']"),
            ).toBeVisible();
            // Close the modal and confirm the table no longer shows the Roles header.
            await page.locator("[data-test-id='column-config-close']").click();
            await expect(page.locator("[data-test-id='column-config-modal']")).toBeHidden();
            const headers = await getNodeHeaders();
            expect(headers).not.toContain("Roles");
            expect(headers).toContain("Name");
        });

        test("reordering moves a column before another within Visible", async () => {
            await page.locator("[data-test-id='column-config-button']").click();
            // Drag Version so it sits before Status.
            await dragColumnOnto("column-config-item-version", "column-config-item-status");
            await page.locator("[data-test-id='column-config-close']").click();
            const headers = await getNodeHeaders();
            const versionIdx = headers.indexOf("Version");
            const statusIdx = headers.indexOf("Status");
            expect(versionIdx).toBeGreaterThanOrEqual(0);
            expect(statusIdx).toBeGreaterThanOrEqual(0);
            expect(versionIdx).toBeLessThan(statusIdx);
        });

        test("the configuration persists across a reload", async () => {
            await page.reload({ waitUntil: "networkidle" });
            await waitForNodeRows();
            const headers = await getNodeHeaders();
            // Roles remains hidden and Version remains before Status after reload.
            expect(headers).not.toContain("Roles");
            const versionIdx = headers.indexOf("Version");
            const statusIdx = headers.indexOf("Status");
            expect(versionIdx).toBeLessThan(statusIdx);
        });

        test("dragging a hidden column back to Visible restores it", async () => {
            await page.locator("[data-test-id='column-config-button']").click();
            await dragColumnOnto("column-config-item-roles", "column-config-section-visible");
            await page.locator("[data-test-id='column-config-close']").click();
            const headers = await getNodeHeaders();
            expect(headers).toContain("Roles");
        });

        test("a cross-section drop lands at the insertion point, not the end", async () => {
            // Start clean and deterministic.
            await page.evaluate(() => localStorage.removeItem("karse-columns-nodes"));
            await page.reload({ waitUntil: "networkidle" });
            await waitForNodeRows();
            await page.locator("[data-test-id='column-config-button']").click();
            // Hide Roles so the Hidden section has a column to drop ONTO (its insertion point).
            await dragColumnOnto("column-config-item-roles", "column-config-section-hidden");
            await expect(
                page.locator("[data-test-id='column-config-section-hidden'] [data-test-id='column-config-item-roles']"),
            ).toBeVisible();
            // Drag Age onto Roles in the Hidden section. The drop must land Age BEFORE Roles (the
            // insertion point under the cursor), not appended after it. This is the cross-section
            // mid-insertion case the preview/gap shows; the committed order must match.
            await dragColumnOnto("column-config-item-age", "column-config-item-roles");
            const hiddenItems = page.locator(
                "[data-test-id='column-config-section-hidden'] [data-test-id^='column-config-item-']",
            );
            await expect(hiddenItems).toHaveCount(2);
            // Age sits before Roles in the Hidden list (index 0), proving the drop honoured the
            // insertion point rather than appending to the end.
            await expect(hiddenItems.first()).toHaveAttribute("data-test-id", "column-config-item-age");
            await expect(hiddenItems.last()).toHaveAttribute("data-test-id", "column-config-item-roles");
            await page.locator("[data-test-id='column-config-close']").click();
        });

        test("a cross-section drop into the MIDDLE of the destination lands there", async () => {
            // Deterministic start: Roles and Age hidden (in that order); Visible has Version.
            await page.evaluate(() => {
                localStorage.setItem(
                    "karse-columns-nodes",
                    JSON.stringify({ order: ["name", "status", "version", "roles", "age"], hidden: ["roles", "age"] }),
                );
            });
            await page.reload({ waitUntil: "networkidle" });
            await waitForNodeRows();
            await page.locator("[data-test-id='column-config-button']").click();
            // Drag Version (Visible) onto Age, which sits BETWEEN Roles and the section end. Version
            // must land BEFORE Age (the insertion point under the cursor) → Hidden = Roles, Version,
            // Age — NOT appended to the end (Roles, Age, Version), which was the reported bug.
            await dragColumnOnto("column-config-item-version", "column-config-item-age");
            const hiddenItems = page.locator(
                "[data-test-id='column-config-section-hidden'] [data-test-id^='column-config-item-']",
            );
            await expect(hiddenItems).toHaveCount(3);
            await expect(hiddenItems.nth(0)).toHaveAttribute("data-test-id", "column-config-item-roles");
            await expect(hiddenItems.nth(1)).toHaveAttribute("data-test-id", "column-config-item-version");
            await expect(hiddenItems.nth(2)).toHaveAttribute("data-test-id", "column-config-item-age");
            await page.locator("[data-test-id='column-config-close']").click();
        });

        test("a cross-section drop at the END of the destination lands last", async () => {
            // Deterministic start: Roles and Age hidden (in that order); Visible has Version.
            await page.evaluate(() => {
                localStorage.setItem(
                    "karse-columns-nodes",
                    JSON.stringify({ order: ["name", "status", "version", "roles", "age"], hidden: ["roles", "age"] }),
                );
            });
            await page.reload({ waitUntil: "networkidle" });
            await waitForNodeRows();
            await page.locator("[data-test-id='column-config-button']").click();
            // Drag Version (Visible) to the END of the Hidden section (below its last row). It must
            // land as the LAST hidden item → Hidden = Roles, Age, Version. Before the fix there was
            // no end landing spot, so this drop could not place Version after Age.
            await dragColumnToSectionEnd("column-config-item-version", "column-config-section-hidden");
            const hiddenItems = page.locator(
                "[data-test-id='column-config-section-hidden'] [data-test-id^='column-config-item-']",
            );
            await expect(hiddenItems).toHaveCount(3);
            await expect(hiddenItems.nth(0)).toHaveAttribute("data-test-id", "column-config-item-roles");
            await expect(hiddenItems.nth(1)).toHaveAttribute("data-test-id", "column-config-item-age");
            await expect(hiddenItems.nth(2)).toHaveAttribute("data-test-id", "column-config-item-version");
            await page.locator("[data-test-id='column-config-close']").click();
        });

        test.afterAll(async () => {
            // Reset so later tests see the default column layout.
            await page.evaluate(() => localStorage.removeItem("karse-columns-nodes"));
        });
    });

    test.describe("errors page type filter", () => {
        // Three errors across three distinct reasons (types), so filtering by one
        // reason narrows the table predictably.
        const FAKE_ERRORS = {
            errors: [
                {
                    source: "Pod",
                    namespace: "default",
                    objectKind: "Pod",
                    objectName: "crasher-abc",
                    reason: "CrashLoopBackOff",
                    message: "back-off restarting failed container",
                    count: 1,
                    lastSeen: new Date().toISOString(),
                },
                {
                    source: "Pod",
                    namespace: "default",
                    objectKind: "Pod",
                    objectName: "puller-def",
                    reason: "ImagePullBackOff",
                    message: "Back-off pulling image",
                    count: 2,
                    lastSeen: new Date().toISOString(),
                },
                {
                    source: "Event",
                    namespace: "kube-system",
                    objectKind: "Pod",
                    objectName: "scheduler-xyz",
                    reason: "FailedScheduling",
                    message: "0/3 nodes are available",
                    count: 4,
                    lastSeen: new Date().toISOString(),
                },
            ],
        };

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await page.route("**/api/errors*", async (route) => {
                await route.fulfill({ json: FAKE_ERRORS });
            });
            await page.goto("/errors", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='errors-table']")).toBeVisible();
        });

        test.afterAll(async () => {
            await page.unroute("**/api/errors*");
            setContext(CLUSTER_1);
        });

        test("shows all errors by default with nothing checked", async () => {
            await expect(page.locator("[data-test-id='error-row']")).toHaveCount(3);
            await expect(page.locator("[data-test-id='errors-filter-button']")).toHaveText("Filter: All");
        });

        test("lists every error type present in the dropdown", async () => {
            await page.locator("[data-test-id='errors-filter-button']").click();
            for (const reason of ["CrashLoopBackOff", "FailedScheduling", "ImagePullBackOff"]) {
                await expect(page.locator(`[data-test-id='errors-filter-item-reason-${reason}']`)).toBeVisible();
            }
            await page.keyboard.press("Escape");
        });

        test("checking one type narrows the table to that type", async () => {
            await page.locator("[data-test-id='errors-filter-button']").click();
            await page.locator("[data-test-id='errors-filter-item-reason-CrashLoopBackOff']").click();
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='error-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='error-row']").filter({ hasText: "CrashLoopBackOff" })).toHaveCount(1);
            await expect(page.locator("[data-test-id='errors-filter-button']")).toHaveText("Filter: 1 selected");
        });

        test("checking a second type widens the table to both types", async () => {
            await page.locator("[data-test-id='errors-filter-button']").click();
            await page.locator("[data-test-id='errors-filter-item-reason-ImagePullBackOff']").click();
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='error-row']")).toHaveCount(2);
            await expect(page.locator("[data-test-id='error-row']").filter({ hasText: "FailedScheduling" })).toHaveCount(0);
            await expect(page.locator("[data-test-id='errors-filter-button']")).toHaveText("Filter: 2 selected");
        });

        test("deselect all clears the selection and restores all errors", async () => {
            await page.locator("[data-test-id='errors-filter-button']").click();
            await page.locator("[data-test-id='errors-filter-deselect-all']").click();
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='error-row']")).toHaveCount(3);
            await expect(page.locator("[data-test-id='errors-filter-button']")).toHaveText("Filter: All");
        });

        test("unchecking the last checked type also restores all errors", async () => {
            await page.locator("[data-test-id='errors-filter-button']").click();
            await page.locator("[data-test-id='errors-filter-item-reason-FailedScheduling']").click();
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='error-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='errors-filter-button']")).toHaveText("Filter: 1 selected");

            await page.locator("[data-test-id='errors-filter-button']").click();
            await page.locator("[data-test-id='errors-filter-item-reason-FailedScheduling']").click();
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='error-row']")).toHaveCount(3);
            await expect(page.locator("[data-test-id='errors-filter-button']")).toHaveText("Filter: All");
        });
    });

    // ── Sidebar nav ──────────────────────────────────────────────────────────────

    test.describe("sidebar nav", () => {
        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await navigateTo();
        });

        test("places the Errors link at the top of the sidebar nav", async () => {
            const nav = page.locator("[data-test-id='sidebar-nav']");
            await expect(nav).toBeVisible();
            await expect(nav.locator("[aria-label='errors']")).toBeVisible();
            // The Errors link is the first nav item, ahead of every other link.
            const firstItem = nav.locator("a[aria-label]").first();
            await expect(firstItem).toHaveAttribute("aria-label", "errors");
        });

        test("navigates to the Errors page from the sidebar nav link", async () => {
            await page.route("**/api/errors*", async (route) => {
                await route.fulfill({ json: { errors: [] } });
            });
            await page.locator("[data-test-id='sidebar-nav'] [aria-label='errors']").click();
            await expect(page.locator("[data-test-id='breadcrumb-item']").first()).toHaveText("Errors");
            await expect(page.locator("[data-test-id='no-errors-empty']")).toBeVisible();
            await page.unroute("**/api/errors*");
        });
    });

    // ── Loading indicator ──────────────────────────────────────────────────────

    test.describe("loading indicator", () => {
        // A single deterministic pod so the table renders rows once data arrives.
        const FAKE_PODS = {
            pods: [
                { name: "nginx-loading", namespace: "default", phase: "Running", ready: "1/1", restarts: 0, node: "node-worker", createdAt: new Date().toISOString() },
            ],
        };

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
        });

        test.afterAll(async () => {
            await page.unroute("**/api/pods*");
        });

        test("shows the loading indicator before data appears, then removes it", async () => {
            // Delay the pods response so the loading state is observable.
            await page.route("**/api/pods*", async (route) => {
                await new Promise((resolve) => setTimeout(resolve, 1500));
                await route.fulfill({ json: FAKE_PODS });
            });

            await page.goto("/pods");

            // The indicator is visible while the (delayed) query is in flight.
            await expect(page.locator("[data-test-id='loading-indicator']")).toBeVisible();

            // Once data loads, the indicator is gone and rows are shown.
            await expect(page.locator("[data-test-id='pod-row']").first()).toBeVisible();
            await expect(page.locator("[data-test-id='loading-indicator']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='pod-row'] td:first-child")).toHaveText("nginx-loading");
        });

        test("shows the connectivity error instead of an endless spinner when the load fails, and retries", async () => {
            // Simulate an unreachable cluster: the request never reaches a
            // responding server, so it aborts instead of returning data.
            await page.route("**/api/pods*", async (route) => {
                await route.abort("connectionrefused");
            });

            await page.goto("/pods");

            // The load fails: the spinner is gone and the connectivity error
            // (carrying the VPN/internet hint) is shown instead.
            const loadError = page.locator("[data-test-id='load-error']");
            await expect(loadError).toBeVisible();
            await expect(loadError).toContainText("Make sure your internet or VPN is connected");
            await expect(page.locator("[data-test-id='loading-indicator']")).toHaveCount(0);

            // The cluster comes back: clicking Retry re-attempts the load and the
            // table renders, so the error state is a recoverable dead-end.
            await page.unroute("**/api/pods*");
            await page.route("**/api/pods*", async (route) => {
                await route.fulfill({ json: FAKE_PODS });
            });
            await page.locator("[data-test-id='load-error-retry']").click();

            await expect(page.locator("[data-test-id='pod-row']").first()).toBeVisible();
            await expect(page.locator("[data-test-id='load-error']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='pod-row'] td:first-child")).toHaveText("nginx-loading");

            await page.unroute("**/api/pods*");
        });
    });

    // ── Labels column ──────────────────────────────────────────────────────────

    test.describe("labels column", () => {
        // Deterministic pod list with distinct labels so chip-render and
        // label-search assertions are stable.
        const FAKE_PODS = {
            pods: [
                { name: "web-pod", namespace: "default", phase: "Running", ready: "1/1", containerCount: 1, restarts: 0, node: "node-worker", createdAt: new Date().toISOString(), labels: { app: "web", tier: "frontend" } },
                { name: "db-pod", namespace: "default", phase: "Running", ready: "1/1", containerCount: 1, restarts: 0, node: "node-worker", createdAt: new Date().toISOString(), labels: { app: "db" } },
            ],
        };

        // A separate pod list with one pod carrying more labels than fit inline,
        // so its row shows the "..." control that opens the searchable labels
        // modal. Kept out of FAKE_PODS so the chip/search assertions above stay
        // on a clean two-pod set (the fuzzy search matches subsequences across
        // every cell, so an extra many-labelled pod would perturb those counts).
        const FAKE_PODS_MANY = {
            pods: [
                { name: "many-pod", namespace: "default", phase: "Running", ready: "1/1", containerCount: 1, restarts: 0, node: "node-worker", createdAt: new Date().toISOString(), labels: { app: "many", tier: "backend", env: "prod", region: "eu-west", version: "1.2.3" } },
            ],
        };

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await page.route("**/api/pods*", async (route) => {
                await route.fulfill({ json: FAKE_PODS });
            });
            await page.goto("/pods", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='pod-row']").first()).toBeVisible();
        });

        test.afterAll(async () => {
            await page.unroute("**/api/pods*");
        });

        test("the pods table has a Labels column header", async () => {
            const table = page.locator("[data-test-id='pods-table']");
            await expect(table.getByRole("columnheader", { name: "Labels", exact: true })).toBeVisible();
        });

        test("renders each pod's labels as key=value chips", async () => {
            const webRow = page.locator("[data-test-id='pod-row']").filter({ hasText: "web-pod" });
            const chips = webRow.locator("[data-test-id='labels-cell'] .MuiChip-label");
            await expect(chips).toHaveCount(2);
            await expect(chips.nth(0)).toHaveText("app=web");
            await expect(chips.nth(1)).toHaveText("tier=frontend");
        });

        test("search matches on a label value and filters to the matching pod", async () => {
            await page.locator("[data-test-id='pods-search'] input").fill("tier=frontend");
            await expect(page.locator("[data-test-id='pod-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='pod-row'] td:first-child")).toHaveText("web-pod");
            await page.locator("[data-test-id='pods-search'] input").fill("");
        });

        test("search matches on a label key shared across pods", async () => {
            await page.locator("[data-test-id='pods-search'] input").fill("app=db");
            await expect(page.locator("[data-test-id='pod-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='pod-row'] td:first-child")).toHaveText("db-pod");
            await page.locator("[data-test-id='pods-search'] input").fill("");
        });

        test.describe("many labels truncate to a searchable modal", () => {
            test.beforeAll(async () => {
                // Swap in the many-labelled pod list. This route is added after the
                // outer beforeAll's, so it takes precedence (handlers match LIFO).
                await page.route("**/api/pods*", async (route) => {
                    await route.fulfill({ json: FAKE_PODS_MANY });
                });
                await page.goto("/pods", { waitUntil: "networkidle" });
                await expect(page.locator("[data-test-id='pod-row']").filter({ hasText: "many-pod" })).toBeVisible();
            });

            test("a pod with many labels truncates to a '...' control instead of overflowing", async () => {
                const manyRow = page.locator("[data-test-id='pod-row']").filter({ hasText: "many-pod" });
                // Only the first few chips render inline; the rest are behind the control.
                const inlineChips = manyRow.locator("[data-test-id='labels-cell'] > .MuiChip-root:not([data-test-id='labels-cell-more'])");
                await expect(inlineChips).toHaveCount(3);
                await expect(manyRow.locator("[data-test-id='labels-cell-more']")).toBeVisible();
                await expect(manyRow.locator("[data-test-id='labels-cell-more'] .MuiChip-label")).toHaveText("+2 ...");
            });

            test("clicking '...' opens a modal listing every label", async () => {
                const manyRow = page.locator("[data-test-id='pod-row']").filter({ hasText: "many-pod" });
                await manyRow.locator("[data-test-id='labels-cell-more']").click();
                await expect(page.locator("[data-test-id='labels-modal']")).toBeVisible();
                // All five labels are listed in the modal.
                await expect(page.locator("[data-test-id='labels-modal-chip']")).toHaveCount(5);
            });

            test("the labels modal is searchable", async () => {
                await page.locator("[data-test-id='labels-modal-search'] input").fill("region");
                await expect(page.locator("[data-test-id='labels-modal-chip']")).toHaveCount(1);
                await expect(page.locator("[data-test-id='labels-modal-chip'] .MuiChip-label")).toHaveText("region=eu-west");
                // Clearing the search restores the full list.
                await page.locator("[data-test-id='labels-modal-search'] input").fill("");
                await expect(page.locator("[data-test-id='labels-modal-chip']")).toHaveCount(5);
            });

            test("clicking '...' opens the modal without navigating to the pod", async () => {
                // Close the modal left open by the previous test.
                await page.locator("[data-test-id='labels-modal-close']").click();
                await expect(page.locator("[data-test-id='labels-modal']")).toBeHidden();
                // Still on the pods list, not a pod detail page.
                await expect(page).toHaveURL(/\/pods(\?|$)/);
                await expect(page.locator("[data-test-id='pods-table']")).toBeVisible();
            });
        });
    });

    // ── Pods page: label filter dropdown ────────────────────────────────────────

    test.describe("pods page label filter", () => {
        // Three pods with overlapping label keys so each key/value checkbox is
        // independently observable and AND-across-keys can be verified.
        const FAKE_PODS = {
            pods: [
                { name: "web-pod", namespace: "default", phase: "Running", ready: "1/1", containerCount: 1, restarts: 0, node: "node-worker", createdAt: new Date().toISOString(), labels: { app: "web", tier: "frontend" } },
                { name: "api-pod", namespace: "default", phase: "Running", ready: "1/1", containerCount: 1, restarts: 0, node: "node-worker", createdAt: new Date().toISOString(), labels: { app: "api", tier: "frontend" } },
                { name: "db-pod", namespace: "default", phase: "Running", ready: "1/1", containerCount: 1, restarts: 0, node: "node-worker", createdAt: new Date().toISOString(), labels: { app: "db", tier: "backend" } },
            ],
        };

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await page.route("**/api/pods*", async (route) => {
                await route.fulfill({ json: FAKE_PODS });
            });
            await page.goto("/pods", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='pod-row']").first()).toBeVisible();
        });

        test.afterAll(async () => {
            await page.unroute("**/api/pods*");
            setContext(CLUSTER_1);
        });

        test("shows all pods by default with the filter reading All", async () => {
            await expect(page.locator("[data-test-id='pod-row']")).toHaveCount(3);
            await expect(page.locator("[data-test-id='pods-filter-button']")).toHaveText("Filter: All");
        });

        test("the dropdown lists the label keys present on the pods", async () => {
            await page.locator("[data-test-id='pods-filter-button']").click();
            await expect(page.locator("[data-test-id='pods-filter-group-label:app']")).toBeVisible();
            await expect(page.locator("[data-test-id='pods-filter-group-label:tier']")).toBeVisible();
            await page.keyboard.press("Escape");
        });

        test("selecting a label value narrows the table to matching pods", async () => {
            await page.locator("[data-test-id='pods-filter-button']").click();
            await page.locator("[data-test-id='pods-filter-item-label:app-web']").click();
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='pod-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='pod-row'] td:first-child")).toHaveText("web-pod");
            await expect(page.locator("[data-test-id='pods-filter-button']")).toHaveText("Filter: 1 selected");
        });

        test("selecting a second value for the same key widens to the union (OR within a key)", async () => {
            await page.locator("[data-test-id='pods-filter-button']").click();
            await page.locator("[data-test-id='pods-filter-item-label:app-api']").click();
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='pod-row']")).toHaveCount(2);
            await expect(page.locator("[data-test-id='pod-row']").filter({ hasText: "db-pod" })).toHaveCount(0);
            await expect(page.locator("[data-test-id='pods-filter-button']")).toHaveText("Filter: 2 selected");
        });

        test("adding a value on a second key narrows by AND across keys", async () => {
            await page.locator("[data-test-id='pods-filter-button']").click();
            await page.locator("[data-test-id='pods-filter-item-label:tier-backend']").click();
            await page.keyboard.press("Escape");
            // app in {web,api} AND tier=backend matches no pod (web/api are frontend).
            await expect(page.locator("[data-test-id='pod-row']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='no-pods-match']")).toBeVisible();
        });

        test("deselect all clears every filter and restores the full list", async () => {
            await page.locator("[data-test-id='pods-filter-button']").click();
            await page.locator("[data-test-id='pods-filter-deselect-all']").click();
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='pod-row']")).toHaveCount(3);
            await expect(page.locator("[data-test-id='pods-filter-button']")).toHaveText("Filter: All");
        });
    });

    // ── Deployments page: label filter dropdown (other resource kinds) ───────────

    test.describe("deployments page label filter", () => {
        // Two deployments with distinct app labels so the filter is observable on a
        // non-pod, non-node resource table.
        const FAKE_DEPLOYMENTS = {
            deployments: [
                { name: "web-deploy", namespace: "default", ready: "1/1", upToDate: 1, available: 1, createdAt: new Date().toISOString(), labels: { app: "web" } },
                { name: "db-deploy", namespace: "default", ready: "1/1", upToDate: 1, available: 1, createdAt: new Date().toISOString(), labels: { app: "db" } },
            ],
        };

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await page.route("**/api/deployments*", async (route) => {
                await route.fulfill({ json: FAKE_DEPLOYMENTS });
            });
            await page.goto("/deployments", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='deployment-row']").first()).toBeVisible();
        });

        test.afterAll(async () => {
            await page.unroute("**/api/deployments*");
            setContext(CLUSTER_1);
        });

        test("has a label-filter dropdown and shows all by default", async () => {
            await expect(page.locator("[data-test-id='deployment-row']")).toHaveCount(2);
            await expect(page.locator("[data-test-id='deployments-filter-button']")).toHaveText("Filter: All");
        });

        test("selecting a label value narrows the table; deselect all restores it", async () => {
            await page.locator("[data-test-id='deployments-filter-button']").click();
            await page.locator("[data-test-id='deployments-filter-item-label:app-web']").click();
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='deployment-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='deployment-row'] td:first-child")).toHaveText("web-deploy");

            await page.locator("[data-test-id='deployments-filter-button']").click();
            await page.locator("[data-test-id='deployments-filter-deselect-all']").click();
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='deployment-row']")).toHaveCount(2);
            await expect(page.locator("[data-test-id='deployments-filter-button']")).toHaveText("Filter: All");
        });
    });

    // ── All resources page (combined cross-kind table) ──────────────────────────

    test.describe("all resources page", () => {
        // A deterministic spread of resources across several kinds so the combined
        // table's rows, search, sort, Kind filter, and row navigation are stable.
        // Every kind the page aggregates is routed (the real cluster has nodes but no
        // workloads), so the assertions never depend on cluster contents.
        const FAKE_PODS = {
            pods: [
                { name: "nginx-pod", namespace: "default", phase: "Running", ready: "1/1", containerCount: 1, restarts: 0, node: "node-worker", createdAt: new Date().toISOString(), labels: { app: "nginx" } },
            ],
        };
        const FAKE_NODES = {
            nodes: [
                { name: "node-a", status: "Ready", roles: [], version: "v1.29.0", createdAt: new Date().toISOString(), labels: {} },
            ],
        };
        const FAKE_NAMESPACES = {
            namespaces: [
                { name: "default", labels: {}, resourceCount: 1 },
            ],
        };
        const FAKE_DEPLOYMENTS = {
            deployments: [
                { name: "web-deploy", namespace: "default", ready: "1/1", upToDate: 1, available: 1, createdAt: new Date().toISOString(), labels: { app: "web" } },
            ],
        };
        const FAKE_STATEFULSETS = {
            statefulSets: [
                { name: "db-ss", namespace: "default", ready: "1/1", createdAt: new Date().toISOString(), labels: {} },
            ],
        };
        const FAKE_DAEMONSETS = {
            daemonSets: [
                { name: "agent-ds", namespace: "kube-system", desired: 1, current: 1, ready: 1, upToDate: 1, available: 1, createdAt: new Date().toISOString(), labels: {} },
            ],
        };
        const FAKE_WORKLOAD_DETAIL = {
            kind: "deployments", name: "web-deploy", namespace: "default", createdAt: new Date().toISOString(),
            labels: { app: "web" }, selector: { app: "web" }, stats: [{ label: "Ready", value: "1/1" }], pods: [], events: [],
        };

        async function rows() {
            return page.locator("[data-test-id='all-resource-row']");
        }
        // Read the Kind cell (first column) of every visible row.
        async function kinds(): Promise<string[]> {
            return page.locator("[data-test-id='all-resource-row'] td:nth-child(1)").allTextContents();
        }
        // Read the Name cell (third column) of every visible row.
        async function names(): Promise<string[]> {
            return page.locator("[data-test-id='all-resource-row'] td:nth-child(3)").allTextContents();
        }

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await page.route("**/api/pods*", async (route) => { await route.fulfill({ json: FAKE_PODS }); });
            await page.route("**/api/cluster/nodes*", async (route) => { await route.fulfill({ json: FAKE_NODES }); });
            await page.route("**/api/namespaces*", async (route) => { await route.fulfill({ json: FAKE_NAMESPACES }); });
            await page.route("**/api/deployments/**", async (route) => { await route.fulfill({ json: FAKE_WORKLOAD_DETAIL }); });
            await page.route("**/api/deployments*", async (route) => { await route.fulfill({ json: FAKE_DEPLOYMENTS }); });
            await page.route("**/api/statefulsets*", async (route) => { await route.fulfill({ json: FAKE_STATEFULSETS }); });
            await page.route("**/api/daemonsets*", async (route) => { await route.fulfill({ json: FAKE_DAEMONSETS }); });
            await page.goto("/all-resources", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='all-resources-table']")).toBeVisible();
            await expect((await rows()).first()).toBeVisible();
        });

        test.afterAll(async () => {
            await page.unroute("**/api/pods*");
            await page.unroute("**/api/cluster/nodes*");
            await page.unroute("**/api/namespaces*");
            await page.unroute("**/api/deployments/**");
            await page.unroute("**/api/deployments*");
            await page.unroute("**/api/statefulsets*");
            await page.unroute("**/api/daemonsets*");
            setContext(CLUSTER_1);
        });

        test("the left nav has an All resources entry that opens the page", async () => {
            await page.locator("[data-test-id='sidebar-nav']").getByRole("link", { name: "all resources" }).click();
            await expect(page).toHaveURL(/\/all-resources/);
            await expect(page.locator("[data-test-id='all-resources-table']")).toBeVisible();
        });

        test("shows rows spanning more than one kind", async () => {
            await expect(await rows()).toHaveCount(6);
            const present = await kinds();
            const distinct = new Set(present);
            expect(distinct.size).toBeGreaterThan(1);
            // Every aggregated kind appears.
            expect(distinct).toEqual(new Set(["Pod", "Node", "Namespace", "Deployment", "StatefulSet", "DaemonSet"]));
        });

        test("the search box narrows the rows to those matching the typed text", async () => {
            await page.locator("[data-test-id='all-resources-search'] input").fill("nginx-pod");
            await expect(await rows()).toHaveCount(1);
            expect(await names()).toEqual(["nginx-pod"]);
            await page.locator("[data-test-id='all-resources-search'] input").fill("zzznotfound");
            await expect(await rows()).toHaveCount(0);
            await expect(page.locator("[data-test-id='no-all-resources-match']")).toBeVisible();
            await page.locator("[data-test-id='all-resources-search'] input").fill("");
            await expect(await rows()).toHaveCount(6);
        });

        test("clicking a column header sorts the table by that column", async () => {
            // Sort by Kind ascending, then descending, and confirm the order flips.
            await page.getByRole("columnheader", { name: "Kind", exact: false }).click();
            const asc = await kinds();
            await page.getByRole("columnheader", { name: "Kind", exact: false }).click();
            const desc = await kinds();
            expect(asc).toEqual([...asc].sort());
            expect(desc).toEqual([...asc].reverse());
            // Reset the sort so later tests see the default order.
            await page.getByRole("columnheader", { name: "Kind", exact: false }).click();
        });

        test("the shared filter editor filters by Kind and clears back to all", async () => {
            await expect(page.locator("[data-test-id='all-resources-filter-button']")).toHaveText("Filter: All");
            await page.locator("[data-test-id='all-resources-filter-button']").click();
            await expect(page.locator("[data-test-id='all-resources-filter-group-kind']")).toHaveText("Kind");
            // Restrict to Pods only.
            await page.locator("[data-test-id='all-resources-filter-item-kind-Pod']").click();
            await page.keyboard.press("Escape");
            await expect(await rows()).toHaveCount(1);
            expect(await kinds()).toEqual(["Pod"]);
            await expect(page.locator("[data-test-id='all-resources-filter-button']")).toHaveText("Filter: 1 selected");
            // Add Node: the two kinds are OR'd within the column.
            await page.locator("[data-test-id='all-resources-filter-button']").click();
            await page.locator("[data-test-id='all-resources-filter-item-kind-Node']").click();
            await page.keyboard.press("Escape");
            await expect(await rows()).toHaveCount(2);
            expect(new Set(await kinds())).toEqual(new Set(["Pod", "Node"]));
            // Clear back to all.
            await page.locator("[data-test-id='all-resources-filter-button']").click();
            await page.locator("[data-test-id='all-resources-filter-deselect-all']").click();
            await page.keyboard.press("Escape");
            await expect(await rows()).toHaveCount(6);
            await expect(page.locator("[data-test-id='all-resources-filter-button']")).toHaveText("Filter: All");
        });

        test("clicking a resource row navigates to that resource's detail page", async () => {
            // The deployment row links to the workload detail page.
            await page.locator("[data-test-id='all-resource-row']", { hasText: "web-deploy" }).click();
            await expect(page).toHaveURL(/\/deployments\/default\/web-deploy/);
            await expect(page.getByRole("heading", { name: "web-deploy" })).toBeVisible();
            // Return to the page for any later tests.
            await page.goto("/all-resources", { waitUntil: "networkidle" });
            await expect((await rows()).first()).toBeVisible();
        });

        test("a row click tags the destination URL with the All resources origin", async () => {
            // Clicking a row navigates to the detail page and tags the URL with
            // from=all-resources, so the detail page can show the origin breadcrumb.
            await page.locator("[data-test-id='all-resource-row']", { hasText: "web-deploy" }).click();
            await expect(page).toHaveURL(/\/deployments\/default\/web-deploy/);
            await expect(page).toHaveURL(/from=all-resources/);
            // Return to the page for any later tests.
            await page.goto("/all-resources", { waitUntil: "networkidle" });
            await expect((await rows()).first()).toBeVisible();
        });

        test("a detail page opened with the All resources origin shows it in the breadcrumb", async () => {
            // Opening a resource's detail page with the from=all-resources tag (what a
            // row click produces, and what a shared link reproduces) shows the
            // navigation path in the breadcrumb: "All resources > web-deploy" (just the
            // resource name, no kind prefix), not the deployment's own list trail. The
            // origin crumb links back.
            await page.goto("/deployments/default/web-deploy?from=all-resources", { waitUntil: "networkidle" });
            await expect(page.getByRole("heading", { name: "web-deploy" })).toBeVisible();
            const crumbs = page.locator("[data-test-id='breadcrumbs'] [data-test-id='breadcrumb-item']");
            await expect(crumbs).toHaveText(["All resources", "web-deploy"]);
            // The origin crumb links back to the All resources page.
            await crumbs.first().click();
            await expect(page).toHaveURL(/\/all-resources/);
            await expect((await rows()).first()).toBeVisible();
        });

        test("a detail page opened with the All resources origin keeps All resources selected in the nav", async () => {
            // The detail page was reached from the All resources list, so the left nav
            // keeps "All resources" highlighted rather than the resource's own page
            // ("Deployments"), reflecting where the navigation came from.
            await page.goto("/deployments/default/web-deploy?from=all-resources", { waitUntil: "networkidle" });
            await expect(page.getByRole("heading", { name: "web-deploy" })).toBeVisible();
            const nav = page.locator("[data-test-id='sidebar-nav']");
            await expect(nav.locator("a[aria-label='all resources']")).toHaveClass(/Mui-selected/);
            await expect(nav.locator("a[aria-label='deployments']")).not.toHaveClass(/Mui-selected/);
            // Return to the page for any later tests.
            await page.goto("/all-resources", { waitUntil: "networkidle" });
            await expect((await rows()).first()).toBeVisible();
        });

        test("the same detail page without the origin tag shows its normal breadcrumb", async () => {
            // Reaching the deployment directly (no from tag) shows its own trail, not
            // the All resources origin, so the origin only appears when navigated from
            // the All resources page.
            await page.goto("/deployments/default/web-deploy", { waitUntil: "networkidle" });
            await expect(page.getByRole("heading", { name: "web-deploy" })).toBeVisible();
            const crumbs = page.locator("[data-test-id='breadcrumbs'] [data-test-id='breadcrumb-item']");
            await expect(crumbs).not.toContainText(["All resources"]);
            // Return to the page for any later tests.
            await page.goto("/all-resources", { waitUntil: "networkidle" });
            await expect((await rows()).first()).toBeVisible();
        });
    });
});
