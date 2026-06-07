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

        test("renders four tiles inside the stat-tiles container", async () => {
            await expect(page.locator("[data-test-id='stat-tiles'] > div")).toHaveCount(4);
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
    });

    // ── Nodes table ───────────────────────────────────────────────────────────

    test.describe("nodes table", () => {
        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await navigateToNodes();
        });

        test("has all five column headers", async () => {
            const table = page.locator("[data-test-id='nodes-table']");
            for (const name of ["Name", "Status", "Roles", "Version", "Age"]) {
                await expect(table.getByRole("columnheader", { name, exact: true })).toBeVisible();
            }
        });

        test("shows all three nodes", async () => {
            const names = await getNodeNames();
            expect(names).toContain("node-cp");
            expect(names).toContain("node-worker");
            expect(names).toContain("node-notready");
        });

        test("shows Ready chip for node-cp", async () => {
            const row = page.locator("[data-test-id='node-row']").filter({ hasText: "node-cp" });
            await expect(row.locator(".MuiChip-label")).toHaveText("Ready");
        });

        // node-notready is created without the kwok annotation, so kwok leaves its
        // patched Ready=False status alone and it renders as genuinely NotReady.
        test("shows NotReady chip for node-notready", async () => {
            const row = page.locator("[data-test-id='node-row']").filter({ hasText: "node-notready" });
            await expect(row.locator(".MuiChip-label")).toHaveText("NotReady");
        });

        test("shows Ready chip for node-worker", async () => {
            const row = page.locator("[data-test-id='node-row']").filter({ hasText: "node-worker" });
            await expect(row.locator(".MuiChip-label")).toHaveText("Ready");
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

            const statuses = await page.locator("[data-test-id='node-row'] .MuiChip-label").allTextContents();
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

        test("filtering narrows the list to matching namespaces", async () => {
            await page.locator("[data-test-id='namespaces-filter'] input").fill("kube");
            const names = await page.locator("[data-test-id='namespace-row'] td:first-child").allTextContents();
            expect(names.every((n) => n.toLowerCase().includes("kube"))).toBe(true);
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

        test("search filters deployment rows", async () => {
            await page.locator("[data-test-id='deployments-search'] input").fill("zzznotfound");
            await expect(page.locator("[data-test-id='no-deployments-match']")).toBeVisible();
            await page.locator("[data-test-id='deployments-search'] input").fill("");
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

        test("the deployment detail page lists its selected pods", async () => {
            await page.goto("/deployments/default/nginx", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='workload-pod-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='workload-pod-row'] td:first-child")).toHaveText("nginx-abc");
            await page.goto("/deployments", { waitUntil: "networkidle" });
        });

        test("clicking a pod row on the deployment detail navigates to the pod detail", async () => {
            await page.goto("/deployments/default/nginx", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='workload-pod-row']").click();
            await expect(page).toHaveURL(/\/pods\/default\/nginx-abc/);
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
            pods: [],
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
            pods: [],
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

        test("defaults to the Detail / Status tab showing the events table", async () => {
            await expect(page.locator("[data-test-id='pod-panel-detail']")).toBeVisible();
            await expect(page.locator("[data-test-id='event-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='pod-panel-containers']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='pod-panel-init-containers']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='pod-panel-logs']")).toHaveCount(0);
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

        test("clicking the Logs tab reveals the log viewer with realistic log content", async () => {
            await page.locator("[data-test-id='pod-tab-logs']").click();
            await expect(page.locator("[data-test-id='pod-panel-logs']")).toBeVisible();
            await expect(page.locator("[data-test-id='log-viewer']")).toBeVisible();
            await expect(page.locator("[data-test-id='log-viewer']")).toContainText("kube-probe/1.29");
            await expect(page.locator("[data-test-id='log-viewer']")).toContainText("start worker processes");
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

        test("switching container fires a new logs request with the correct container param", async () => {
            const requestPromise = page.waitForRequest((req) => req.url().includes("/logs") && req.url().includes("container=sidecar"));
            await page.locator("[data-test-id='log-container-select'] [role='combobox']").click();
            await page.locator("[data-test-id='log-container-option']").filter({ hasText: "sidecar" }).click();
            await requestPromise;
        });

        test("changing tail lines fires a new logs request with the correct tail param", async () => {
            const requestPromise = page.waitForRequest((req) => req.url().includes("/logs") && req.url().includes("tail=50"));
            await page.locator("[data-test-id='log-tail-select'] [role='combobox']").click();
            await page.locator("[data-test-id='log-tail-option']").filter({ hasText: /^50$/ }).click();
            await requestPromise;
        });

        test("refresh button fires a new logs request", async () => {
            const requestPromise = page.waitForRequest((req) => req.url().includes("/logs") && !req.url().includes("/stream"));
            await page.locator("[data-test-id='log-refresh']").click();
            await requestPromise;
        });

        test("enabling live opens a streaming request and appends live log lines", async () => {
            const streamRequest = page.waitForRequest((req) => req.url().includes("/logs/stream"));
            await page.locator("[data-test-id='log-live-toggle'] input").check();
            await streamRequest;
            // The fake-logs backend streams realistic lines one at a time over SSE.
            await expect(page.locator("[data-test-id='log-viewer']")).toContainText("start worker processes");
            await expect(page.locator("[data-test-id='log-viewer']")).toContainText("kube-probe/1.29");
        });

        test("disabling live restores the snapshot log viewer", async () => {
            const snapshotRequest = page.waitForRequest((req) => req.url().includes("/logs") && !req.url().includes("/stream"));
            await page.locator("[data-test-id='log-live-toggle'] input").uncheck();
            await snapshotRequest;
            await expect(page.locator("[data-test-id='log-viewer']")).toBeVisible();
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
            // Reset to the default Status / Details tab between tests.
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

        test("shows the three tabs and defaults to Status / Details", async () => {
            await expect(page.locator("[data-test-id='node-tab-detail']")).toBeVisible();
            await expect(page.locator("[data-test-id='node-tab-pods']")).toBeVisible();
            await expect(page.locator("[data-test-id='node-tab-events']")).toBeVisible();
            await expect(page.locator("[data-test-id='node-panel-detail']")).toBeVisible();
            await expect(page.locator("[data-test-id='node-panel-pods']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='node-panel-events']")).toHaveCount(0);
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

    // ── Pods page: phase filter ─────────────────────────────────────────────────

    test.describe("pods page phase filter", () => {
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

        test("shows all phases by default", async () => {
            await expect(page.locator("[data-test-id='pod-row']")).toHaveCount(5);
            await expect(page.locator("[data-test-id='pods-phase-filter-button']")).toHaveText("Phase: All");
        });

        test("deselecting a phase hides matching pods", async () => {
            await page.locator("[data-test-id='pods-phase-filter-button']").click();
            await page.locator("[data-test-id='pods-phase-filter-item-Pending']").click();
            // Close the menu to read the table.
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='pod-row']")).toHaveCount(4);
            await expect(page.locator("[data-test-id='pod-row']").filter({ hasText: "pod-pending" })).toHaveCount(0);
            await expect(page.locator("[data-test-id='pods-phase-filter-button']")).toHaveText("Phase: 4 selected");
        });

        test("selecting only one phase shows just those pods", async () => {
            await page.locator("[data-test-id='pods-phase-filter-button']").click();
            // Turn everything off, then turn Running back on.
            for (const phase of ["Running", "Succeeded", "Failed", "Unknown"]) {
                await page.locator(`[data-test-id='pods-phase-filter-item-${phase}']`).click();
            }
            // After the previous test Pending is already off; only Running remains off too, so re-enable Running.
            await page.locator("[data-test-id='pods-phase-filter-item-Running']").click();
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='pod-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='pod-row'] td:first-child")).toHaveText("pod-running");
            await expect(page.locator("[data-test-id='pods-phase-filter-button']")).toHaveText("Phase: 1 selected");
        });

        test("deselecting every phase shows the no-match message", async () => {
            await page.locator("[data-test-id='pods-phase-filter-button']").click();
            await page.locator("[data-test-id='pods-phase-filter-item-Running']").click();
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='pod-row']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='no-pods-match']")).toBeVisible();
        });

        test("re-selecting phases restores matching pods", async () => {
            await page.locator("[data-test-id='pods-phase-filter-button']").click();
            for (const phase of ["Running", "Pending", "Succeeded", "Failed", "Unknown"]) {
                await page.locator(`[data-test-id='pods-phase-filter-item-${phase}']`).click();
            }
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='pod-row']")).toHaveCount(5);
            await expect(page.locator("[data-test-id='pods-phase-filter-button']")).toHaveText("Phase: All");
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

        test("shows all statuses by default", async () => {
            await expect(page.locator("[data-test-id='node-row']")).toHaveCount(3);
            await expect(page.locator("[data-test-id='nodes-status-filter-button']")).toHaveText("Status: All");
        });

        test("deselecting a status hides matching nodes", async () => {
            await page.locator("[data-test-id='nodes-status-filter-button']").click();
            await page.locator("[data-test-id='nodes-status-filter-item-NotReady']").click();
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='node-row']")).toHaveCount(2);
            await expect(page.locator("[data-test-id='node-row']").filter({ hasText: "node-notready" })).toHaveCount(0);
            await expect(page.locator("[data-test-id='nodes-status-filter-button']")).toHaveText("Status: 2 selected");
        });

        test("selecting only one status shows just those nodes", async () => {
            await page.locator("[data-test-id='nodes-status-filter-button']").click();
            // NotReady is already off from the previous test; turn Unknown off so only Ready remains.
            await page.locator("[data-test-id='nodes-status-filter-item-Unknown']").click();
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='node-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='node-row'] td:first-child")).toHaveText("node-ready");
            await expect(page.locator("[data-test-id='nodes-status-filter-button']")).toHaveText("Status: 1 selected");
        });

        test("deselecting every status shows the no-match message", async () => {
            await page.locator("[data-test-id='nodes-status-filter-button']").click();
            await page.locator("[data-test-id='nodes-status-filter-item-Ready']").click();
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='node-row']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='no-nodes-match']")).toBeVisible();
        });

        test("re-selecting statuses restores matching nodes", async () => {
            await page.locator("[data-test-id='nodes-status-filter-button']").click();
            for (const status of ["Ready", "NotReady", "Unknown"]) {
                await page.locator(`[data-test-id='nodes-status-filter-item-${status}']`).click();
            }
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='node-row']")).toHaveCount(3);
            await expect(page.locator("[data-test-id='nodes-status-filter-button']")).toHaveText("Status: All");
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

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await page.route("**/api/pods/default/nginx-abc*", async (route) => {
                await route.fulfill({ json: FAKE_POD_DETAIL });
            });
            await page.route("**/api/nodes/node-cp*", async (route) => {
                await route.fulfill({ json: FAKE_NODE_DETAIL });
            });
        });

        test.afterAll(async () => {
            await page.unroute("**/api/pods/default/nginx-abc*");
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
            expect(items).toEqual(["Pods", "default", "nginx-abc", "Detail / Status"]);
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
                const filter = new URL(route.request().url()).searchParams.get("filter") ?? "";
                const matched = FAKE_PODS.pods
                    .map((p) => p.name)
                    .filter((name) => filter === "" || name.toLowerCase().includes(filter.toLowerCase()));
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

        test("renders namespace, pod, and filter controls", async () => {
            await expect(page.locator("[data-test-id='live-logs-namespace-select']")).toBeVisible();
            await expect(page.locator("[data-test-id='live-logs-pod-select']")).toBeVisible();
            await expect(page.locator("[data-test-id='live-logs-filter']")).toBeVisible();
        });

        test("streaming all pods shows a prefixed line per pod", async () => {
            await page.locator("[data-test-id='live-logs-start']").click();
            await expect(page.locator("[data-test-id='live-logs-line']")).toHaveCount(2);
            await expect(page.locator("[data-test-id='live-logs-viewer']")).toContainText("default/nginx-abc");
            await expect(page.locator("[data-test-id='live-logs-viewer']")).toContainText("default/redis-xyz");
            await expect(page.locator("[data-test-id='live-logs-viewer']")).toContainText("log line from nginx-abc");
        });

        test("matched pod chips list every streamed pod", async () => {
            await expect(page.locator("[data-test-id='live-logs-matched-pod']")).toHaveCount(2);
        });

        test("Stop button replaces Stream while streaming", async () => {
            await expect(page.locator("[data-test-id='live-logs-stop']")).toBeVisible();
            await page.locator("[data-test-id='live-logs-stop']").click();
            await expect(page.locator("[data-test-id='live-logs-start']")).toBeVisible();
        });

        test("wildcard filter sends the filter param and restricts the streamed pods", async () => {
            await page.locator("[data-test-id='live-logs-filter'] input").fill("nginx");
            const requestPromise = page.waitForRequest((req) => req.url().includes("/api/logs/stream") && req.url().includes("filter=nginx"));
            await page.locator("[data-test-id='live-logs-start']").click();
            await requestPromise;
            await expect(page.locator("[data-test-id='live-logs-line']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='live-logs-viewer']")).toContainText("default/nginx-abc");
            await expect(page.locator("[data-test-id='live-logs-viewer']")).not.toContainText("redis-xyz");
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

        test("static namespace rows highlight on hover with the default cursor", async () => {
            await page.goto("/namespaces", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='namespace-row']").first()).toBeVisible();
            const { before, after } = await hoverBackgrounds("[data-test-id='namespace-row']");
            expect(after).not.toBe(before);
            expect(await rowCursor("[data-test-id='namespace-row']")).toBe("default");
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

        test("shows no-errors-match message when search has no results", async () => {
            await page.locator("[data-test-id='errors-search'] input").fill("zzznotfound");
            await expect(page.locator("[data-test-id='no-errors-match']")).toBeVisible();
        });

        test("clearing search restores all errors", async () => {
            await page.locator("[data-test-id='errors-search'] input").fill("");
            await expect(page.locator("[data-test-id='error-row']")).toHaveCount(2);
        });
    });

    // ── Sidebar bottom nav ──────────────────────────────────────────────────────

    test.describe("sidebar bottom nav", () => {
        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await navigateTo();
        });

        test("pins the Errors link to the bottom nav section", async () => {
            const bottomNav = page.locator("[data-test-id='sidebar-bottom-nav']");
            await expect(bottomNav).toBeVisible();
            await expect(bottomNav.locator("[aria-label='errors']")).toBeVisible();
        });

        test("navigates to the Errors page from the bottom nav link", async () => {
            await page.route("**/api/errors*", async (route) => {
                await route.fulfill({ json: { errors: [] } });
            });
            await page.locator("[data-test-id='sidebar-bottom-nav'] [aria-label='errors']").click();
            await expect(page.locator("[data-test-id='breadcrumb-item']").first()).toHaveText("Errors");
            await expect(page.locator("[data-test-id='no-errors-empty']")).toBeVisible();
            await page.unroute("**/api/errors*");
        });
    });
});
