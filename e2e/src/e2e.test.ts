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
        await page.goto("/", { waitUntil: "networkidle" });
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
        await page.route("**/api/cluster/nodes", async route => {
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
        await page.unroute("**/api/cluster/nodes");
        await navigateTo();
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

        test("shows context picker dropdown when two clusters are configured", async () => {
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
            await navigateTo();
            await waitForNodeRows();
        });

        test("has all five column headers", async () => {
            const headers = page.locator("[data-test-id='nodes-table'] thead th");
            for (const name of ["Name", "Status", "Roles", "Version", "Age"]) {
                await expect(headers.filter({ hasText: name })).toBeVisible();
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
            await navigateTo();
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
            await navigateTo();
            await waitForNodeRows();
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
            await navigateTo();
            await waitForNodeRows();

            await page.locator("[data-test-id='nodes-table'] thead th").filter({ hasText: "Status" }).click();

            const statuses = await page.locator("[data-test-id='node-row'] .MuiChip-label").allTextContents();
            const readyIdx = statuses.indexOf("Ready");
            const notReadyIdx = statuses.indexOf("NotReady");
            expect(readyIdx).toBeGreaterThanOrEqual(0);
            expect(notReadyIdx).toBeGreaterThanOrEqual(0);
            expect(readyIdx).toBeLessThan(notReadyIdx);

            await page.unroute("**/api/cluster/nodes");
        });
    });

    // ── Search / filter ───────────────────────────────────────────────────────

    test.describe("search / filter", () => {
        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await navigateTo();
            await waitForNodeRows();
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
            const responsePromise = page.waitForResponse(res => res.url().includes("/api/cluster/nodes"));
            await page.locator("[aria-label='refresh']").click();
            await responsePromise;
        });
    });

    // ── Context switch ────────────────────────────────────────────────────────

    test.describe("context switch", () => {
        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await navigateTo();
            await waitForNodeRows();
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
            await expect(page.locator("[data-test-id='stat-nodes'] h5")).toHaveText("2");
        });

        test("switching back to cluster 1 restores its nodes", async () => {
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

        test("shows 'Select a context to see cluster overview' message", async () => {
            await expect(page.locator("[data-test-id='no-context-message']")).toContainText("Select a context");
        });

        test("nodes table is not rendered when there is no current context", async () => {
            await expect(page.locator("[data-test-id='nodes-table']")).toHaveCount(0);
        });
    });
});
