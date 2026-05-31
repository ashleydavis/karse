import { test, expect, type Page } from "@playwright/test";
import { execSync } from "node:child_process";

// Cluster context names injected by scripts/e2e-tests.sh
const CLUSTER_1 = process.env.KWOK_CLUSTER_1 ?? "kwok-karse-e2e-1";
const CLUSTER_2 = process.env.KWOK_CLUSTER_2 ?? "kwok-karse-e2e-2";

// Shape of the /api/cluster/nodes response body.
type NodesBody = { nodes: Array<{ name: string; status: string; [key: string]: unknown }> };

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

    // Intercept /api/cluster/nodes and force node-notready to have the given status.
    // kwok manages all nodes and keeps them Ready; this lets status-chip tests work reliably.
    async function interceptNotReadyStatus(): Promise<void> {
        await page.route("**/api/cluster/nodes*", async route => {
            const response = await route.fetch();
            const body: NodesBody = await response.json();
            const nodes = body.nodes.map(n =>
                n.name === "node-notready" ? { ...n, status: "NotReady" } : n,
            );
            await route.fulfill({ json: { nodes } });
        });
    }

    // Remove the nodes route override and reload with real cluster data.
    async function clearNodeOverride(): Promise<void> {
        await page.unroute("**/api/cluster/nodes*");
        await page.reload({ waitUntil: "networkidle" });
        await waitForNodeRows();
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
            await expect(page.locator("[data-test-id='page-title']")).toHaveText("Cluster");
        });

        test("updates page title when navigating to nodes", async () => {
            await page.goto("/nodes", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='page-title']")).toHaveText("Nodes");
        });

        test("updates page title when navigating to pods", async () => {
            await page.goto("/pods", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='page-title']")).toHaveText("Pods");
        });

        test("updates page title when navigating to namespaces", async () => {
            await page.goto("/namespaces", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='page-title']")).toHaveText("Namespaces");
        });

        test("updates page title when navigating to contexts", async () => {
            await page.goto("/contexts", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='page-title']")).toHaveText("Contexts");
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

        // kwok keeps all nodes Ready; intercept the API response to inject NotReady status
        // and verify the chip renders correctly.
        test("shows NotReady chip for node-notready", async () => {
            await interceptNotReadyStatus();
            await page.reload({ waitUntil: "networkidle" });
            await waitForNodeRows();

            const row = page.locator("[data-test-id='node-row']").filter({ hasText: "node-notready" });
            await expect(row.locator(".MuiChip-label")).toHaveText("NotReady");

            await clearNodeOverride();
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

        // Navigate fresh with an intercepted NotReady node so the sort assertion can
        // check Ready-before-NotReady ordering.
        test("clicking Status header sorts Ready rows before NotReady", async () => {
            await interceptNotReadyStatus();
            await page.reload({ waitUntil: "networkidle" });
            await waitForNodeRows();

            await page.locator("[data-test-id='nodes-table'] thead th").filter({ hasText: "Status" }).click();

            const statuses = await page.locator("[data-test-id='node-row'] .MuiChip-label").allTextContents();
            const readyIdx = statuses.indexOf("Ready");
            const notReadyIdx = statuses.indexOf("NotReady");
            expect(readyIdx).toBeGreaterThanOrEqual(0);
            expect(notReadyIdx).toBeGreaterThanOrEqual(0);
            expect(readyIdx).toBeLessThan(notReadyIdx);

            await page.unroute("**/api/cluster/nodes*");
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
            await page.locator("nav a[href='/nodes']").click();
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
            await expect(page.locator("[data-test-id='context-quick-picker-dialog']")).toBeVisible();
        }

        async function closePicker(): Promise<void> {
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='context-quick-picker-dialog']")).not.toBeVisible();
        }

        test("opens with the context picker header button", async () => {
            await openPicker();
            await closePicker();
        });

        test("opens with the Ctrl+K keyboard shortcut", async () => {
            await page.keyboard.press("Control+k");
            await expect(page.locator("[data-test-id='context-quick-picker-dialog']")).toBeVisible();
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
            await page.locator("[data-test-id='context-quick-picker-dialog'] input").fill(CLUSTER_1);
            await expect(page.locator("[data-test-id='context-quick-picker-row']").filter({ hasText: CLUSTER_1 })).toBeVisible();
            await expect(page.locator("[data-test-id='context-quick-picker-row']").filter({ hasText: CLUSTER_2 })).toHaveCount(0);
            await closePicker();
        });

        test("selecting a context closes the picker and updates the context display", async () => {
            await openPicker();
            await page.locator("[data-test-id='context-quick-picker-row']").filter({ hasText: CLUSTER_2 }).click();
            await expect(page.locator("[data-test-id='context-quick-picker-dialog']")).not.toBeVisible();
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
            await expect(page.locator("[data-test-id='namespace-quick-picker-dialog']")).toBeVisible();
        }

        async function closePicker(): Promise<void> {
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='namespace-quick-picker-dialog']")).not.toBeVisible();
        }

        test("opens with the namespace picker header button", async () => {
            await openPicker();
            await closePicker();
        });

        test("opens with the Ctrl+Shift+K keyboard shortcut", async () => {
            await page.keyboard.press("Control+Shift+K");
            await expect(page.locator("[data-test-id='namespace-quick-picker-dialog']")).toBeVisible();
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
            await page.locator("[data-test-id='namespace-quick-picker-dialog'] input").fill("kube");
            const nsTexts = await page.locator("[data-test-id='namespace-quick-picker-row']").allTextContents();
            expect(nsTexts.every((n) => n.toLowerCase().includes("kube"))).toBe(true);
            await closePicker();
        });

        test("selecting a namespace closes the picker", async () => {
            await openPicker();
            await page.locator("[data-test-id='namespace-quick-picker-row']").filter({ hasText: /^default/ }).click();
            await expect(page.locator("[data-test-id='namespace-quick-picker-dialog']")).not.toBeVisible();
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
            await expect(page.locator("[data-test-id='namespace-quick-picker-dialog']")).not.toBeVisible();
            await openPicker();
            await expect(page.locator("[data-test-id='namespace-quick-picker-all']")).toHaveClass(/Mui-selected/);
            await closePicker();
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

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
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
        });

        test("shows page title Deployments", async () => {
            await expect(page.locator("[data-test-id='page-title']")).toHaveText("Deployments");
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

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
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
        });

        test("shows page title StatefulSets", async () => {
            await expect(page.locator("[data-test-id='page-title']")).toHaveText("StatefulSets");
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

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
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
        });

        test("shows page title DaemonSets", async () => {
            await expect(page.locator("[data-test-id='page-title']")).toHaveText("DaemonSets");
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
            await expect(page.locator("[data-test-id='page-title']")).toHaveText("Node");
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
            initContainers: [],
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

        test("shows page title Pod", async () => {
            await expect(page.locator("[data-test-id='page-title']")).toHaveText("Pod");
        });

        test("shows the pod name as heading", async () => {
            await expect(page.getByRole("heading", { name: "nginx-abc" })).toBeVisible();
        });

        test("shows Running status chip", async () => {
            await expect(page.locator(".MuiChip-label", { hasText: "Running" }).first()).toBeVisible();
        });

        test("shows both containers in the containers table", async () => {
            const names = await page.locator("[data-test-id='container-row'] td:first-child").allTextContents();
            expect(names).toContain("nginx");
            expect(names).toContain("sidecar");
        });

        test("shows the event in the events table", async () => {
            await expect(page.locator("[data-test-id='event-row']")).toHaveCount(1);
        });

        test("show logs button reveals the log viewer with realistic log content", async () => {
            await page.locator("button", { hasText: "Show logs" }).click();
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
            const requestPromise = page.waitForRequest((req) => req.url().includes("/logs"));
            await page.locator("[data-test-id='log-refresh']").click();
            await requestPromise;
        });

        test("commands button opens the guided commands dialog", async () => {
            await page.locator("[data-test-id='commands-button']").click();
            await expect(page.locator("[data-test-id='commands-dialog']")).toBeVisible();
            await expect(page.locator("[data-test-id='commands-readonly-note']")).toBeVisible();
        });

        test("commands dialog lists kubectl suggestions for the pod", async () => {
            const commands = await page.locator("[data-test-id='command-text']").allTextContents();
            expect(commands).toContain("kubectl describe pod nginx-abc -n default");
            expect(commands).toContain("kubectl logs nginx-abc -n default");
            expect(commands).toContain("kubectl delete pod nginx-abc -n default");
        });

        test("commands dialog has a copy button per command", async () => {
            const rowCount = await page.locator("[data-test-id='command-row']").count();
            const copyCount = await page.locator("[data-test-id='command-copy']").count();
            expect(rowCount).toBeGreaterThan(0);
            expect(copyCount).toBe(rowCount);
            await page.keyboard.press("Escape");
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

        test.afterAll(async () => {
            await page.unroute("**/api/nodes/node-cp*");
        });

        test("shows page title Node", async () => {
            await expect(page.locator("[data-test-id='page-title']")).toHaveText("Node");
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

        test("shows the scheduled pod in the pods table", async () => {
            await expect(page.locator("[data-test-id='node-pod-row'] td:first-child")).toHaveText("coredns-abc");
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
            await page.locator("[data-test-id='node-pod-row']").click();
            await expect(page).toHaveURL(/\/pods\/kube-system\/coredns-abc/);
            await page.unroute("**/api/pods/kube-system/coredns-abc*");
        });

        test("commands button opens guided commands for the node", async () => {
            await page.goto("/nodes/node-cp", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='commands-button']").click();
            await expect(page.locator("[data-test-id='commands-dialog']")).toBeVisible();
            const commands = await page.locator("[data-test-id='command-text']").allTextContents();
            expect(commands).toContain("kubectl describe node node-cp");
            expect(commands).toContain("kubectl drain node-cp --ignore-daemonsets --delete-emptydir-data");
            await page.keyboard.press("Escape");
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
                    ready: "1/1",
                    restarts: 0,
                    createdAt: new Date().toISOString(),
                    node: "node-worker",
                },
                {
                    name: "redis-xyz",
                    namespace: "kube-system",
                    phase: "Pending",
                    ready: "0/1",
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
            for (const name of ["Name", "Namespace", "Status", "Ready", "Restarts", "Node", "Age"]) {
                await expect(table.getByRole("columnheader", { name, exact: true })).toBeVisible();
            }
        });

        test("shows a row for each fake pod", async () => {
            await expect(page.locator("[data-test-id='pod-row']")).toHaveCount(2);
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

    test.describe("yaml viewer", () => {
        const FAKE_PODS = {
            pods: [
                {
                    name: "nginx-abc",
                    namespace: "default",
                    phase: "Running",
                    ready: "1/1",
                    restarts: 0,
                    createdAt: new Date().toISOString(),
                    node: "node-worker",
                },
            ],
        };

        const FAKE_YAML = "apiVersion: v1\nkind: Pod\nmetadata:\n  name: nginx-abc\n  namespace: default\n";

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await page.route("**/api/pods*", async (route) => {
                await route.fulfill({ json: FAKE_PODS });
            });
            await page.route("**/api/yaml/pods/nginx-abc*", async (route) => {
                await route.fulfill({ json: { yaml: FAKE_YAML } });
            });
            await page.goto("/pods", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='pods-table']")).toBeVisible();
        });

        test.afterAll(async () => {
            await page.unroute("**/api/pods*");
            await page.unroute("**/api/yaml/pods/nginx-abc*");
            setContext(CLUSTER_1);
        });

        test("each pod row has a YAML button", async () => {
            const row = page.locator("[data-test-id='pod-row']").filter({ hasText: "nginx-abc" });
            await expect(row.locator("[data-test-id='yaml-button']")).toBeVisible();
        });

        test("clicking the YAML button requests yaml with the namespace param", async () => {
            const requestPromise = page.waitForRequest((req) =>
                req.url().includes("/api/yaml/pods/nginx-abc") && req.url().includes("namespace=default"));
            const row = page.locator("[data-test-id='pod-row']").filter({ hasText: "nginx-abc" });
            await row.locator("[data-test-id='yaml-button']").click();
            await requestPromise;
        });

        test("the dialog shows the raw yaml content", async () => {
            await expect(page.locator("[data-test-id='yaml-dialog']")).toBeVisible();
            await expect(page.locator("[data-test-id='yaml-content']")).toContainText("kind: Pod");
            await expect(page.locator("[data-test-id='yaml-content']")).toContainText("name: nginx-abc");
        });

        test("clicking the YAML button does not navigate to the pod detail page", async () => {
            await expect(page).toHaveURL(/\/pods$/);
        });

        test("the close button dismisses the dialog", async () => {
            await page.locator("[data-test-id='yaml-close']").click();
            await expect(page.locator("[data-test-id='yaml-dialog']")).not.toBeVisible();
        });
    });
});
