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
            // The cluster home page is titled "Cluster" (resource-utilization-6).
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
            for (const name of ["Name", "Status", "Version", "CPU", "Memory", "Age"]) {
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

    // ── Resource consumption sort (CPU / Memory percentage-of-node columns) ─────

    test.describe("nodes table resource consumption sort", () => {
        // Three nodes whose CPU and memory consumption (as a percentage of each node's
        // OWN allocatable) deliberately disagree, so a CPU sort and a memory sort give
        // different orders and neither can accidentally pass on the other's ordering.
        // The nodes list carries no usage; usage comes from the cluster Performance
        // snapshot, so both endpoints are mocked to keep the assertions deterministic.
        const SORT_NODES = {
            nodes: [
                { name: "node-cool", status: "Ready", roles: [], version: "v1.30.0", createdAt: new Date().toISOString(), labels: {}, instanceType: "m5.large" },
                { name: "node-hot", status: "Ready", roles: [], version: "v1.30.0", createdAt: new Date().toISOString(), labels: {}, instanceType: "m5.xlarge" },
                { name: "node-notready", status: "NotReady", roles: [], version: "v1.30.0", createdAt: new Date().toISOString(), labels: {}, instanceType: null },
            ],
        };

        // Each node's percentage is its usage ÷ its OWN allocatable, so differently-sized
        // nodes are comparable. node-cool has the bigger allocatable but lower CPU share;
        // node-hot has the smaller allocatable but higher CPU share. CPU ascending order is
        // node-cool(30%) < node-hot(60%); memory ascending is the OPPOSITE,
        // node-hot(25%) < node-cool(50%). node-notready has no usage sample, so its
        // percentages are an em-dash and it sorts to the bottom ascending.
        const PERFORMANCE = {
            metricsAvailable: true,
            nodes: [
                { name: "node-cool", usage: { cpuMillicores: 300, memoryBytes: 3_000_000_000 }, requests: { cpuMillicores: 500, memoryBytes: 3_000_000_000 }, allocatable: { cpuMillicores: 1000, memoryBytes: 6_000_000_000 } },
                { name: "node-hot", usage: { cpuMillicores: 1200, memoryBytes: 1_000_000_000 }, requests: { cpuMillicores: 1800, memoryBytes: 2_000_000_000 }, allocatable: { cpuMillicores: 2000, memoryBytes: 4_000_000_000 } },
                { name: "node-notready", usage: { cpuMillicores: null, memoryBytes: null }, requests: { cpuMillicores: 200, memoryBytes: 1_000_000_000 }, allocatable: { cpuMillicores: 1000, memoryBytes: 4_000_000_000 } },
            ],
            pods: [],
        };

        // Reads the name cell of every rendered node row, top to bottom.
        async function rowNames(): Promise<string[]> {
            return page.locator("[data-test-id='node-row'] td:first-child").allTextContents();
        }

        // Clicks a nodes-table header cell by its visible label.
        async function clickHeader(label: string): Promise<void> {
            await page.locator("[data-test-id='nodes-table'] thead th").filter({ hasText: label }).click();
        }

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await page.route("**/api/cluster/nodes*", async (route) => {
                await route.fulfill({ json: SORT_NODES });
            });
            await page.route("**/api/cluster/performance*", async (route) => {
                await route.fulfill({ json: PERFORMANCE });
            });
            await page.goto("/nodes", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='node-row']").first()).toBeVisible();
            // The CPU/Memory columns are fed by a separate cluster-performance query that
            // settles independently of the nodes list (and of `networkidle`), so the rows
            // can appear before usage has loaded — the cell then shows an em-dash. Block
            // until node-cool's CPU cell carries its real share (300m of 1000m = 30%) so
            // every test below reads percentages, not a transient em-dash. A generous
            // explicit timeout (well above Playwright's 5s default) keeps this wait robust
            // when a sibling e2e run is contending for the box and the performance query
            // lands slowly.
            await expect(
                page.locator("[data-test-id='node-row']").filter({ hasText: "node-cool" }).locator("[data-test-id='node-cpu']"),
            ).toHaveText("30%", { timeout: 20000 });
        });

        test.afterAll(async () => {
            await page.unroute("**/api/cluster/nodes*");
            await page.unroute("**/api/cluster/performance*");
        });

        test("CPU and Memory columns render each node's usage as a percentage of the node", async () => {
            await expect(page.locator("[data-test-id='nodes-table'] thead th").filter({ hasText: "CPU" })).toBeVisible();
            await expect(page.locator("[data-test-id='nodes-table'] thead th").filter({ hasText: "Memory" })).toBeVisible();
            // Three rows, three CPU cells and three memory cells.
            await expect(page.locator("[data-test-id='node-cpu']")).toHaveCount(3);
            await expect(page.locator("[data-test-id='node-memory']")).toHaveCount(3);
            // node-cool uses 300m of its own 1000m allocatable -> 30%, and 3GB of 6GB -> 50%.
            const coolRow = page.locator("[data-test-id='node-row']").filter({ hasText: "node-cool" });
            await expect(coolRow.locator("[data-test-id='node-cpu']")).toHaveText("30%");
            await expect(coolRow.locator("[data-test-id='node-memory']")).toHaveText("50%");
            // node-hot: 1200m of 2000m -> 60% CPU, 1GB of 4GB -> 25% memory.
            const hotRow = page.locator("[data-test-id='node-row']").filter({ hasText: "node-hot" });
            await expect(hotRow.locator("[data-test-id='node-cpu']")).toHaveText("60%");
            await expect(hotRow.locator("[data-test-id='node-memory']")).toHaveText("25%");
            // node-notready has no usage sample, so both columns show an em-dash.
            const notReadyRow = page.locator("[data-test-id='node-row']").filter({ hasText: "node-notready" });
            await expect(notReadyRow.locator("[data-test-id='node-cpu']")).toHaveText("—");
            await expect(notReadyRow.locator("[data-test-id='node-memory']")).toHaveText("—");
        });

        // Numeric columns sort highest-first on the first click (TanStack's default for
        // numeric values, and the useful default for "which node is most loaded"), then
        // ascending on the second click. A node with no reading sorts to the bottom
        // ascending (and so to the top descending, after the real values).
        test("clicking CPU sorts nodes by CPU percentage, highest first then ascending", async () => {
            await clickHeader("CPU");
            expect(await rowNames()).toEqual(["node-hot", "node-cool", "node-notready"]);
            await clickHeader("CPU");
            expect(await rowNames()).toEqual(["node-notready", "node-cool", "node-hot"]);
        });

        test("clicking Memory sorts nodes by memory percentage, highest first then ascending", async () => {
            await clickHeader("Memory");
            // Memory order of the metered nodes is the reverse of CPU order for these
            // fixtures, proving the memory comparator sorts on memory and not on CPU.
            expect(await rowNames()).toEqual(["node-cool", "node-hot", "node-notready"]);
            await clickHeader("Memory");
            expect(await rowNames()).toEqual(["node-notready", "node-hot", "node-cool"]);
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

    // ── Resource-consumption columns (CPU / memory sort) ───────────────────────

    test.describe("pods table resource utilization", () => {
        // Three pods with deliberately mismatched CPU and memory so that sorting by CPU
        // and by memory yield different orders. The pods list carries no usage; usage and
        // requests come from the cluster Performance snapshot, so both endpoints are mocked
        // to keep the assertions deterministic.
        const SORT_PODS = {
            pods: [
                { name: "pod-low", namespace: "default", phase: "Running", ready: "1/1", containerCount: 1, restarts: 0, node: "node-worker", createdAt: new Date().toISOString(), labels: {} },
                { name: "pod-mid", namespace: "default", phase: "Running", ready: "1/1", containerCount: 1, restarts: 0, node: "node-worker", createdAt: new Date().toISOString(), labels: {} },
                { name: "pod-high", namespace: "default", phase: "Running", ready: "1/1", containerCount: 1, restarts: 0, node: "node-worker", createdAt: new Date().toISOString(), labels: {} },
            ],
        };

        // The pods table's usage-mode percentage base is the pod's OWN REQUEST (not its
        // node share). Each pod here requests 1000m CPU / 1_000_000_000 bytes memory, so
        // the percentage is usage ÷ request. CPU ascending is low(5%) < mid(25%) < high(50%);
        // memory ascending is the OPPOSITE (high(10%) < mid(20%) < low(30%)), so a memory
        // sort cannot accidentally pass on the CPU ordering. pod-low's 5% CPU lands in the
        // "over-reserving" band (≤ 35%), the others in "OK", proving the status badge grades
        // the usage ÷ request ratio.
        const PERFORMANCE = {
            metricsAvailable: true,
            nodes: [
                { name: "node-worker", usage: { cpuMillicores: 800, memoryBytes: 600_000_000 }, requests: { cpuMillicores: 3000, memoryBytes: 3_000_000_000 }, allocatable: { cpuMillicores: 4000, memoryBytes: 8_000_000_000 } },
            ],
            pods: [
                { name: "pod-low", namespace: "default", node: "node-worker", usage: { cpuMillicores: 50, memoryBytes: 300_000_000 }, requests: { cpuMillicores: 1000, memoryBytes: 1_000_000_000 }, limits: { cpuMillicores: null, memoryBytes: null }, containers: [] },
                { name: "pod-mid", namespace: "default", node: "node-worker", usage: { cpuMillicores: 250, memoryBytes: 200_000_000 }, requests: { cpuMillicores: 1000, memoryBytes: 1_000_000_000 }, limits: { cpuMillicores: null, memoryBytes: null }, containers: [] },
                { name: "pod-high", namespace: "default", node: "node-worker", usage: { cpuMillicores: 500, memoryBytes: 100_000_000 }, requests: { cpuMillicores: 1000, memoryBytes: 1_000_000_000 }, limits: { cpuMillicores: null, memoryBytes: null }, containers: [] },
            ],
        };

        // Reads the pod-name cell of every rendered row, top to bottom.
        async function rowNames(): Promise<string[]> {
            return page.locator("[data-test-id='pod-row'] td:first-child").allTextContents();
        }

        // Clicks a pods-table header cell by its visible label.
        async function clickHeader(label: string): Promise<void> {
            await page.locator("[data-test-id='pods-table'] thead th").filter({ hasText: label }).click();
        }

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await page.route("**/api/pods*", async (route) => {
                await route.fulfill({ json: SORT_PODS });
            });
            await page.route("**/api/cluster/performance*", async (route) => {
                await route.fulfill({ json: PERFORMANCE });
            });
            await page.goto("/pods", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='pod-row']").first()).toBeVisible();
            // The resource columns are fed by a separate cluster-performance query that
            // settles independently of the pods list (and of `networkidle`), so the rows
            // can appear before usage has loaded — the cell then shows an em-dash. Block
            // until pod-high's CPU cell carries its real node-share (500m of 1000m = 50%)
            // so every test below reads percentages, not a transient em-dash. A generous
            // explicit timeout (well above Playwright's 5s default) keeps this wait robust
            // when a sibling e2e run is contending for the box and the performance query
            // lands slowly.
            await expect(
                page.locator("[data-test-id='pod-row']").filter({ hasText: "pod-high" }).locator("[data-test-id='pod-cpu']"),
            ).toHaveText("50%", { timeout: 20000 });
        });

        test.afterAll(async () => {
            await page.unroute("**/api/pods*");
            await page.unroute("**/api/cluster/performance*");
        });

        test("CPU and Memory bar columns render each pod's usage as a percentage of its OWN REQUEST", async () => {
            await expect(page.locator("[data-test-id='pods-table'] thead th").filter({ hasText: "CPU" })).toBeVisible();
            await expect(page.locator("[data-test-id='pods-table'] thead th").filter({ hasText: "Memory" })).toBeVisible();
            // Three rows, three CPU bar cells and three memory bar cells, each with a bar.
            await expect(page.locator("[data-test-id='pod-cpu-bar']")).toHaveCount(3);
            await expect(page.locator("[data-test-id='pod-memory-bar']")).toHaveCount(3);
            // Each value is a percentage of the pod's request (e.g. "25%"), not millicores.
            // toHaveText auto-retries until every cell matches, so it waits for the separate
            // cluster-performance query to populate the column. allTextContents() + toMatch
            // was a one-shot snapshot that read the pre-load "—" if the query had not yet
            // applied (a render-vs-assertion race that lost under parallel CPU load).
            await expect(page.locator("[data-test-id='pod-cpu-value']")).toHaveText([/^\d+%$/, /^\d+%$/, /^\d+%$/]);
            await expect(page.locator("[data-test-id='pod-memory-value']")).toHaveText([/^\d+%$/, /^\d+%$/, /^\d+%$/]);
            // pod-high uses 500m of its 1000m request -> 50% (its node-share would be ~13%,
            // proving the base is the request, not the node allocatable).
            await expect(
                page.locator("[data-test-id='pod-row']").filter({ hasText: "pod-high" }).locator("[data-test-id='pod-cpu-value']"),
            ).toHaveText("50%");
        });

        test("the Utilization status badge grades the usage ÷ request ratio", async () => {
            // pod-low: 5% CPU -> over-reserving (≤ 35%). pod-high: 50% CPU -> OK.
            await expect(
                page.locator("[data-test-id='pod-row']").filter({ hasText: "pod-low" }).locator("[data-test-id='util-status-badge']"),
            ).toHaveText("Over-reserving");
            await expect(
                page.locator("[data-test-id='pod-row']").filter({ hasText: "pod-high" }).locator("[data-test-id='util-status-badge']"),
            ).toHaveText("OK");
        });

        test("toggling to Requests then Absolute switches the bar value to the request quantity", async () => {
            await page.locator("[data-test-id='util-view-mode-requests']").click();
            // In requests mode the request is the base, shown as a full 100% bar.
            await expect(
                page.locator("[data-test-id='pod-row']").filter({ hasText: "pod-high" }).locator("[data-test-id='pod-cpu-value']"),
            ).toHaveText("100%");
            // Requests mode has no usage ratio to grade, so the badge is absent.
            await expect(page.locator("[data-test-id='util-status-badge']")).toHaveCount(0);
            // Absolute format shows the request quantity (1000m -> "1" core).
            await page.locator("[data-test-id='util-value-format-absolute']").click();
            await expect(
                page.locator("[data-test-id='pod-row']").filter({ hasText: "pod-high" }).locator("[data-test-id='pod-cpu-value']"),
            ).toHaveText("1");
            // Restore the defaults for the sort tests below.
            await page.locator("[data-test-id='util-view-mode-usage']").click();
            await page.locator("[data-test-id='util-value-format-percent']").click();
        });

        // Numeric columns sort highest-first on the first click (TanStack's default
        // for numeric values, and the useful default for "which pods consume most"),
        // then ascending on the second click.
        test("clicking CPU sorts pods by CPU, highest first then ascending", async () => {
            await clickHeader("CPU");
            expect(await rowNames()).toEqual(["pod-high", "pod-mid", "pod-low"]);
            await clickHeader("CPU");
            expect(await rowNames()).toEqual(["pod-low", "pod-mid", "pod-high"]);
        });

        test("clicking Memory sorts pods by memory, highest first then ascending", async () => {
            await clickHeader("Memory");
            // Memory order is the reverse of CPU order for these fixtures, proving the
            // memory comparator sorts on memory and not on CPU.
            expect(await rowNames()).toEqual(["pod-low", "pod-mid", "pod-high"]);
            await clickHeader("Memory");
            expect(await rowNames()).toEqual(["pod-high", "pod-mid", "pod-low"]);
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

        test("clicking refresh empties the on-disk cache", async () => {
            setContext(CLUSTER_1);
            await navigateTo();
            await waitForStatTiles();
            // The refresh button clears the server-side cache before re-fetching, so a
            // POST to /api/cache/clear must accompany the click.
            const clearPromise = page.waitForResponse(res =>
                res.url().includes("/api/cache/clear") && res.request().method() === "POST");
            await page.locator("[aria-label='refresh']").click();
            const cleared = await clearPromise;
            expect(cleared.status()).toBe(200);
        });
    });

    // ── Config page (cluster-data cache) ───────────────────────────────────────

    test.describe("config page", () => {
        test.beforeAll(async () => {
            setContext(CLUSTER_1);
        });

        async function navigateToConfig(): Promise<void> {
            await page.goto("/config", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='config-cache-panel']")).toBeVisible();
        }

        test("config nav item opens the config page", async () => {
            await navigateTo();
            await page.locator("[data-test-id='sidebar-nav'] [aria-label='config']").click();
            await expect(page).toHaveURL(/\/config/);
            await expect(page.locator("[data-test-id='config-cache-panel']")).toBeVisible();
            await expect(page.locator("[data-test-id='breadcrumb-item']").first()).toHaveText("Config");
        });

        test("shows the current staleness threshold", async () => {
            await navigateToConfig();
            const input = page.locator("[data-test-id='config-staleness-input']");
            // The default threshold is a non-empty numeric value.
            await expect(input).not.toHaveValue("");
            const value = await input.inputValue();
            expect(Number.isFinite(Number(value))).toBe(true);
        });

        test("rejects a negative threshold (save disabled, no request)", async () => {
            await navigateToConfig();
            const input = page.locator("[data-test-id='config-staleness-input']");
            await input.fill("-5");
            await expect(page.locator("[data-test-id='config-save-button']")).toBeDisabled();
        });

        test("saves a new threshold and persists it across reloads", async () => {
            await navigateToConfig();
            const input = page.locator("[data-test-id='config-staleness-input']");
            await input.fill("7");
            const savePromise = page.waitForResponse(res =>
                res.url().includes("/api/cache/config") && res.request().method() === "PUT");
            await page.locator("[data-test-id='config-save-button']").click();
            const saved = await savePromise;
            expect(saved.status()).toBe(200);
            await expect(page.locator("[data-test-id='config-saved-alert']")).toBeVisible();

            // Reload: the persisted value is read back from the server.
            await navigateToConfig();
            await expect(page.locator("[data-test-id='config-staleness-input']")).toHaveValue("7");
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

    // ── Autoscalers page ──────────────────────────────────────────────────────

    test.describe("autoscalers page", () => {
        // Two HPAs on the same fixture: one mid scale-up with headroom, one maxed out.
        const FAKE_AUTOSCALERS = {
            horizontalPodAutoscalers: [
                {
                    name: "nginx",
                    namespace: "default",
                    reference: "Deployment/nginx",
                    minReplicas: 2,
                    maxReplicas: 10,
                    currentReplicas: 4,
                    desiredReplicas: 6,
                    targets: "cpu: 40%/80%",
                    createdAt: new Date().toISOString(),
                    labels: { app: "nginx" },
                },
                {
                    name: "api",
                    namespace: "default",
                    reference: "Deployment/api",
                    minReplicas: 1,
                    maxReplicas: 5,
                    currentReplicas: 5,
                    desiredReplicas: 5,
                    targets: "cpu: 92%/80%",
                    createdAt: new Date().toISOString(),
                    labels: {},
                },
            ],
        };

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await page.route("**/api/horizontalpodautoscalers*", async (route) => {
                await route.fulfill({ json: FAKE_AUTOSCALERS });
            });
            await page.goto("/autoscalers", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='autoscalers-table']")).toBeVisible();
        });

        test.afterAll(async () => {
            await page.unroute("**/api/horizontalpodautoscalers*");
        });

        test("is reachable from the sidebar nav", async () => {
            await page.goto("/cluster", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='sidebar-nav'] [aria-label='autoscalers']").click();
            await expect(page.locator("[data-test-id='autoscalers-table']")).toBeVisible();
            await expect(page.locator("[data-test-id='breadcrumb-item']").first()).toHaveText("Autoscalers");
        });

        test("has column headers Name, Namespace, Reference, Targets, Replicas, Min, Max, Age", async () => {
            const table = page.locator("[data-test-id='autoscalers-table']");
            for (const col of ["Name", "Namespace", "Reference", "Targets", "Replicas", "Min", "Max", "Age"]) {
                await expect(table.getByRole("columnheader", { name: col, exact: true })).toBeVisible();
            }
        });

        test("shows a row per autoscaler with its scale target reference", async () => {
            await expect(page.locator("[data-test-id='autoscaler-row']")).toHaveCount(2);
            await expect(page.locator("[data-test-id='autoscaler-reference']").first()).toHaveText("Deployment/nginx");
        });

        test("shows the current and target metric for each autoscaler", async () => {
            const values = page.locator("[data-test-id='autoscaler-targets-value']");
            await expect(values.nth(0)).toHaveText("cpu 40%/80%");
            await expect(values.nth(1)).toHaveText("cpu 92%/80%");
        });

        test("grades the metric bar against the target (under target ok, over target critical)", async () => {
            const bars = page.locator("[data-test-id='autoscaler-targets']");
            // 40% of an 80% target is half way to it; 92% of 80% is over it.
            await expect(bars.nth(0)).toHaveAttribute("data-level", "ok");
            await expect(bars.nth(1)).toHaveAttribute("data-level", "critical");
        });

        test("shows current over desired replicas, and flags the maxed-out autoscaler", async () => {
            const values = page.locator("[data-test-id='autoscaler-replicas-value']");
            await expect(values.nth(0)).toHaveText("4/6");
            await expect(values.nth(1)).toHaveText("5/5");
            const bars = page.locator("[data-test-id='autoscaler-replicas']");
            // nginx is mid scale-up (4 of a 10 max); api sits on its max of 5.
            await expect(bars.nth(0)).toHaveAttribute("data-level", "warn");
            await expect(bars.nth(1)).toHaveAttribute("data-level", "critical");
        });

        test("shows each autoscaler's replica bounds", async () => {
            const firstRow = page.locator("[data-test-id='autoscaler-row']").first();
            await expect(firstRow.locator("td").nth(5)).toHaveText("2");
            await expect(firstRow.locator("td").nth(6)).toHaveText("10");
        });

        test("the reference links to the scale target's detail page", async () => {
            await page.locator("[data-test-id='autoscaler-reference']").first().click();
            await expect(page).toHaveURL(/\/deployments\/default\/nginx/);
            await page.goto("/autoscalers", { waitUntil: "networkidle" });
        });

        test("search filters autoscaler rows by the typed term", async () => {
            await page.locator("[data-test-id='autoscalers-search'] input").fill("nginx");
            await expect(page.locator("[data-test-id='autoscaler-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='autoscaler-row'] td:first-child")).toHaveText("nginx");
            await page.locator("[data-test-id='autoscalers-search'] input").fill("nothing-matches-this");
            await expect(page.locator("[data-test-id='autoscaler-row']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='no-autoscalers-match']")).toBeVisible();
            await page.locator("[data-test-id='autoscalers-search'] input").fill("");
            await expect(page.locator("[data-test-id='autoscaler-row']")).toHaveCount(2);
        });
    });

    test.describe("autoscalers page empty state", () => {
        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await page.route("**/api/horizontalpodautoscalers*", async (route) => {
                await route.fulfill({ json: { horizontalPodAutoscalers: [] } });
            });
            await page.goto("/autoscalers", { waitUntil: "networkidle" });
        });

        test.afterAll(async () => {
            await page.unroute("**/api/horizontalpodautoscalers*");
        });

        test("shows the empty state when the cluster has no autoscalers", async () => {
            await expect(page.locator("[data-test-id='no-autoscalers-empty']")).toBeVisible();
            await expect(page.locator("[data-test-id='autoscaler-row']")).toHaveCount(0);
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

        // The Pod detail Logs tab now uses the shared LogViewer, which streams the
        // pod over the multi-pod /api/logs/stream endpoint (SSE: a "started" event
        // then one "line" event per pod). This canned body mirrors that shape for
        // the pinned pod, so the tab can be exercised without a real cluster.
        function buildPodDetailSseBody(podName: string): string {
            const started = `event: started\ndata: ${JSON.stringify({ pods: [{ namespace: "default", name: podName }] })}\n\n`;
            const lines = [
                `event: line\ndata: ${JSON.stringify({ namespace: "default", pod: podName, line: "kube-probe/1.29 GET /healthz" })}\n\n`,
                `event: line\ndata: ${JSON.stringify({ namespace: "default", pod: podName, line: "start worker processes" })}\n\n`,
            ].join("");
            return started + lines;
        }

        async function interceptPodLogsStream(): Promise<void> {
            await page.route("**/api/logs/stream*", async (route) => {
                const selected = new URL(route.request().url()).searchParams.getAll("pods");
                const podName = selected[0] ?? "nginx-abc";
                await route.fulfill({
                    headers: { "Content-Type": "text/event-stream" },
                    body: buildPodDetailSseBody(podName),
                });
            });
        }

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await page.route("**/api/pods/default/nginx-abc*", async (route) => {
                await route.fulfill({
                    json: FAKE_POD_DETAIL,
                });
            });
            await interceptPodLogsStream();
            await page.goto("/pods/default/nginx-abc", { waitUntil: "networkidle" });
        });

        test.afterAll(async () => {
            await page.unroute("**/api/logs/stream*");
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

        test("clicking the Logs tab auto-loads and streams the shared log viewer for the pinned pod", async () => {
            // The Logs tab uses the shared LogViewer pinned to this pod, so the live
            // stream starts automatically on mount via the multi-pod /api/logs/stream
            // endpoint scoped to this one pod (pods=nginx-abc). No button starts it.
            const streamRequest = page.waitForRequest((req) => req.url().includes("/api/logs/stream") && req.url().includes("pods=nginx-abc"));
            await page.locator("[data-test-id='pod-tab-logs']").click();
            await streamRequest;
            await expect(page.locator("[data-test-id='pod-panel-logs']")).toBeVisible();
            await expect(page.locator("[data-test-id='pod-logs-viewer']")).toBeVisible();
            await expect(page.locator("[data-test-id='pod-logs-viewer']")).toContainText("kube-probe/1.29");
            await expect(page.locator("[data-test-id='pod-logs-viewer']")).toContainText("start worker processes");
            // Each line is prefixed with its pod name, like the Logs page.
            await expect(page.locator("[data-test-id='pod-logs-viewer']")).toContainText("default/nginx-abc");
        });

        test("the Logs tab's log viewer stretches down to fill the remaining viewport height", async () => {
            // Regression for logs-reusable-1: on the Pod detail Logs tab the log
            // text area must fill the leftover space down to near the viewport
            // bottom, the same as the Logs page, rather than the small fixed
            // height it had before. The viewport is 800px tall.
            await expect(page.locator("[data-test-id='pod-logs-viewer']")).toBeVisible();
            const viewport = page.viewportSize();
            expect(viewport).not.toBeNull();
            const box = await page.locator("[data-test-id='pod-logs-viewer']").boundingBox();
            expect(box).not.toBeNull();
            const bottom = box!.y + box!.height;
            // Within ~64px of the viewport bottom (the <main> padding is 24px each
            // side). The old fixed 400px-min box fell well short of this.
            expect(viewport!.height - bottom).toBeLessThan(64);
            expect(box!.height).toBeGreaterThan(300);
        });

        test("the Logs tab exposes the same options as the Logs page, with no Tail option and no Refresh button", async () => {
            await expect(page.locator("[data-test-id='pod-logs-viewer']")).toBeVisible();
            // The shared component carries none of the dropped controls: no Tail
            // selector, no Refresh button, and (the picker is pinned away) no
            // container selector or load/start button.
            await expect(page.locator("[data-test-id='log-tail-select']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='log-refresh']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='log-container-select']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='log-load']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='log-live-toggle']")).toHaveCount(0);
            // The pod is fixed here, so the Logs page's namespace/pod picker and
            // Stream button are not shown on this tab.
            await expect(page.locator("[data-test-id='pod-logs-namespace-select']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='pod-logs-pod-picker']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='pod-logs-start']")).toHaveCount(0);
        });

        test("while streaming with no lines yet the log panel shows the progress indicator, not loading text", async () => {
            // Intercept the stream and delay its first line so the pre-line streaming
            // state is observable; the panel must show the spinner, not loading text.
            await page.route("**/api/logs/stream*", async (route) => {
                const podName = new URL(route.request().url()).searchParams.getAll("pods")[0] ?? "nginx-abc";
                await new Promise((resolve) => setTimeout(resolve, 1500));
                await route.fulfill({
                    headers: { "Content-Type": "text/event-stream" },
                    body: buildPodDetailSseBody(podName),
                });
            });
            await page.goto("/pods/default/nginx-abc", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='pod-tab-logs']").click();
            // The spinner stands in for the loading state; no loading text.
            await expect(page.locator("[data-test-id='pod-logs-viewer'] [data-test-id='loading-indicator']")).toBeVisible();
            await expect(page.locator("[data-test-id='pod-logs-viewer']")).not.toContainText("waiting for logs");
            // Once a line arrives, the indicator is gone and the line is shown.
            await expect(page.locator("[data-test-id='pod-logs-viewer']")).toContainText("start worker processes");
            await expect(page.locator("[data-test-id='pod-logs-viewer'] [data-test-id='loading-indicator']")).toHaveCount(0);
            // Restore the immediate stream and re-open the Logs tab for later tests.
            await page.unroute("**/api/logs/stream*");
            await interceptPodLogsStream();
            await page.goto("/pods/default/nginx-abc", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='pod-tab-logs']").click();
            await expect(page.locator("[data-test-id='pod-logs-viewer']")).toBeVisible();
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

        test("the back button returns to the Pods list when the pod was reached the normal way", async () => {
            // Regression for performance-back-nav-1: a pod opened directly (no "from"
            // origin) backs to the Pods list, the default target.
            await page.goto("/pods/default/nginx-abc", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='pod-detail-back']")).toBeVisible();
            await page.locator("[data-test-id='pod-detail-back']").click();
            await expect(page).toHaveURL(/\/pods(\?|$)/);
            await expect(page.locator("[data-test-id='breadcrumb-item']").first()).toHaveText("Pods");
            await page.goto("/pods/default/nginx-abc", { waitUntil: "networkidle" });
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
                    containerCount: 1,
                    createdAt: new Date().toISOString(),
                    node: "node-cp",
                    labels: {},
                },
                {
                    name: "metrics-mid",
                    namespace: "kube-system",
                    phase: "Running",
                    ready: "1/1",
                    restarts: 0,
                    containerCount: 1,
                    createdAt: new Date().toISOString(),
                    node: "node-cp",
                    labels: {},
                },
                {
                    name: "busy-app",
                    namespace: "team-1",
                    phase: "Running",
                    ready: "1/1",
                    restarts: 0,
                    containerCount: 1,
                    createdAt: new Date().toISOString(),
                    node: "node-cp",
                    labels: {},
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

        // The node Performance snapshot drives both the Status page resource indicator
        // (node-level usage ÷ allocatable) and the Pods table's per-pod CPU/Memory
        // columns (each pod's usage ÷ the node's allocatable). It is stubbed once for the
        // whole node-detail describe and shared by both views.
        //
        // Per-pod usage for the node's Pods table. The node's allocatable is cpu 4000m /
        // mem 8Gi, so each pod's usage reads as a whole-number percentage of the node:
        //   coredns-abc   cpu  5%  mem 20%
        //   metrics-mid   cpu 15%  mem 10%
        //   busy-app      cpu 30%  mem  3%
        // CPU ascending: coredns, metrics-mid, busy-app.
        // Memory ascending: busy-app, metrics-mid, coredns (a distinct order, so the
        // two column sorts cannot be confused).
        const podUsage = (namespace: string, name: string, cpu: number, mem: number) => ({
            name,
            namespace,
            node: "node-cp",
            usage: { cpuMillicores: cpu, memoryBytes: mem },
            requests: { cpuMillicores: cpu, memoryBytes: mem },
            limits: { cpuMillicores: cpu, memoryBytes: mem },
            containers: [
                { name, usage: { cpuMillicores: cpu, memoryBytes: mem }, requests: { cpuMillicores: cpu, memoryBytes: mem }, limits: { cpuMillicores: cpu, memoryBytes: mem } },
            ],
        });
        const FAKE_NODE_PERFORMANCE = {
            metricsAvailable: true,
            node: {
                name: "node-cp",
                usage: { cpuMillicores: 1600, memoryBytes: 3 * 1024 * 1024 * 1024 },
                requests: { cpuMillicores: 2000, memoryBytes: 4 * 1024 * 1024 * 1024 },
                allocatable: { cpuMillicores: 4000, memoryBytes: 8 * 1024 * 1024 * 1024 },
            },
            // Per-pod usage against the node's allocatable (cpu 4000m / mem 8Gi):
            //   coredns-abc:  200m  /  20% of 8Gi  → cpu  5%, mem 20%
            //   metrics-mid:  600m  /  10% of 8Gi  → cpu 15%, mem 10%
            //   busy-app:    1200m  /   3% of 8Gi  → cpu 30%, mem  3%
            pods: [
                podUsage("kube-system", "coredns-abc", 200, 1_717_986_918),
                podUsage("kube-system", "metrics-mid", 600, 858_993_459),
                podUsage("team-1", "busy-app", 1200, 257_698_038),
            ],
        };

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            // The broad node-detail route is registered first; the performance route is
            // registered after it so Playwright (which tries the most recently added route
            // first) matches the /performance path with the performance stub.
            await page.route("**/api/nodes/node-cp*", async (route) => {
                await route.fulfill({ json: FAKE_NODE_DETAIL });
            });
            // The node Performance snapshot feeds both the Status resource indicator and
            // the Pods table's CPU/Memory columns. A separate pattern carrying the
            // explicit /performance segment is required: the broad glob's trailing `*`
            // does not cross the `/` into /performance, so without this route the
            // performance request would 404. Registered after the broad route, it also
            // wins for the /performance path (last route wins).
            await page.route("**/api/nodes/node-cp/performance*", async (route) => {
                await route.fulfill({ json: FAKE_NODE_PERFORMANCE });
            });
            await page.goto("/nodes/node-cp", { waitUntil: "networkidle" });
        });

        test.beforeEach(async () => {
            // Reset to the default Status tab between tests.
            await page.goto("/nodes/node-cp", { waitUntil: "networkidle" });
        });

        test.afterAll(async () => {
            await page.unroute("**/api/nodes/node-cp/performance*");
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

        test("shows the consumed-vs-free resource indicator with cpu, memory, pods and no disk/network", async () => {
            // The Capacity vs Allocatable table was removed (node-performance-1); the Status
            // page now shows a consumed-vs-free indicator for cpu, memory and pods only.
            await expect(page.locator("[data-test-id='node-resource-usage']")).toBeVisible();
            await expect(page.locator("[data-test-id='node-resource-indicator']")).toBeVisible();
            await expect(page.locator("[data-test-id='node-resource-cpu']")).toBeVisible();
            await expect(page.locator("[data-test-id='node-resource-memory']")).toBeVisible();
            await expect(page.locator("[data-test-id='node-resource-pods']")).toBeVisible();
            // Disk and network are not shown at all (the Metrics API does not report them).
            const indicatorText = await page.locator("[data-test-id='node-resource-indicator']").textContent();
            expect(indicatorText ?? "").not.toMatch(/disk/i);
            expect(indicatorText ?? "").not.toMatch(/network/i);
        });

        test("the cpu and memory bars show real populated percentages, not the unavailable state", async () => {
            // With the performance stub carrying live usage, CPU (1600m of 4000m = 40%) and
            // memory (3Gi of 8Gi = 38%) render a numeric "<n>% used" rather than an em-dash.
            await expect(page.locator("[data-test-id='node-resource-cpu-percent']")).toHaveText("40% used");
            await expect(page.locator("[data-test-id='node-resource-memory-percent']")).toHaveText("38% used");
            // The pods row: 3 pods scheduled of 110 allocatable = 3% (2.7% rounded).
            await expect(page.locator("[data-test-id='node-resource-pods-percent']")).toHaveText("3% used");
        });

        test("the Capacity vs Allocatable table is gone", async () => {
            await expect(page.getByText("Capacity vs Allocatable")).toHaveCount(0);
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

        test("shows the scheduled pods in the pods table on the Pods tab", async () => {
            await page.locator("[data-test-id='node-tab-pods']").click();
            await expect(page.locator("[data-test-id='node-panel-pods']")).toBeVisible();
            await expect(page.locator("[data-test-id='node-pod-row']")).toHaveCount(3);
            await expect(page.locator("[data-test-id='node-pod-row'] td:first-child").first()).toHaveText("coredns-abc");
        });

        test("the pods table shows each pod's cpu and memory as a node-share bar percentage", async () => {
            // The CPU % / Memory % bar columns render the pod's usage ÷ the node's
            // allocatable (cpu 4000m / mem 8Gi) for the default Usage + % toggles. The
            // percentage shows in each bar cell's value span. coredns-abc reads 5% cpu and
            // 20% memory.
            await page.locator("[data-test-id='node-tab-pods']").click();
            await expect(page.locator("[data-test-id='node-panel-pods']")).toBeVisible();
            await expect(page.getByRole("columnheader", { name: "CPU %" })).toBeVisible();
            await expect(page.getByRole("columnheader", { name: "Memory %" })).toBeVisible();
            const corednsRow = page
                .locator("[data-test-id='node-pod-row']")
                .filter({ hasText: "coredns-abc" });
            await expect(corednsRow.locator("[data-test-id='node-pod-cpu-value']")).toHaveText("5%");
            await expect(corednsRow.locator("[data-test-id='node-pod-memory-value']")).toHaveText("20%");
        });

        test("sorting the pods table by CPU % orders the pods by their cpu share of the node", async () => {
            await page.locator("[data-test-id='node-tab-pods']").click();
            await expect(page.locator("[data-test-id='node-panel-pods']")).toBeVisible();
            const cpuHeader = page.getByRole("columnheader", { name: "CPU %" });
            // First click: ascending. coredns 5%, metrics-mid 15%, busy-app 30%.
            await cpuHeader.click();
            await expect(page.locator("[data-test-id='node-pod-cpu-value']")).toHaveText(["5%", "15%", "30%"]);
            // Second click: descending — the reverse order.
            await cpuHeader.click();
            await expect(page.locator("[data-test-id='node-pod-cpu-value']")).toHaveText(["30%", "15%", "5%"]);
        });

        test("sorting the pods table by Memory % orders the pods by their memory share of the node", async () => {
            await page.locator("[data-test-id='node-tab-pods']").click();
            await expect(page.locator("[data-test-id='node-panel-pods']")).toBeVisible();
            const memHeader = page.getByRole("columnheader", { name: "Memory %" });
            // Ascending: busy-app 3%, metrics-mid 10%, coredns 20% (a different order
            // from the CPU sort, proving the column sorts on its own resource).
            await memHeader.click();
            await expect(page.locator("[data-test-id='node-pod-memory-value']")).toHaveText(["3%", "10%", "20%"]);
            // Descending.
            await memHeader.click();
            await expect(page.locator("[data-test-id='node-pod-memory-value']")).toHaveText(["20%", "10%", "3%"]);
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
            // Unsorted, coredns-abc is the first row (first in the fixture order).
            await page.locator("[data-test-id='node-pod-row']").first().click();
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

        // The pod Status tab now carries a "Node resources" panel that fetches the pod's
        // performance snapshot, so this scaffold pod needs a valid PodPerformance response
        // for its /performance endpoint (the broader detail mock returns a PodDetail shape).
        const FAKE_PERF_POD_PERFORMANCE = {
            metricsAvailable: true,
            pod: {
                name: "nginx-abc",
                namespace: "default",
                node: "node-cp",
                usage: { cpuMillicores: 120, memoryBytes: 320 * 1024 * 1024 },
                requests: { cpuMillicores: 0, memoryBytes: 0 },
                limits: { cpuMillicores: 0, memoryBytes: 0 },
                containers: [],
            },
            containers: [],
            node: {
                name: "node-cp",
                usage: { cpuMillicores: 1000, memoryBytes: 2 * 1024 * 1024 * 1024 },
                allocatable: { cpuMillicores: 4000, memoryBytes: 8 * 1024 * 1024 * 1024 },
            },
        };

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await page.route("**/api/nodes/node-cp*", async (route) => {
                await route.fulfill({ json: FAKE_PERF_NODE_DETAIL });
            });
            // Register the more specific /performance route last so it wins over the
            // broader nginx-abc* detail route for the performance endpoint.
            await page.route("**/api/pods/default/nginx-abc*", async (route) => {
                await route.fulfill({ json: FAKE_PERF_POD_DETAIL });
            });
            await page.route("**/api/pods/default/nginx-abc/performance*", async (route) => {
                await route.fulfill({ json: FAKE_PERF_POD_PERFORMANCE });
            });
        });

        test.afterAll(async () => {
            await page.unroute("**/api/nodes/node-cp*");
            await page.unroute("**/api/pods/default/nginx-abc*");
            await page.unroute("**/api/pods/default/nginx-abc/performance*");
        });

        test("cluster home shows Overview and Resource utilization tabs, defaulting to Overview", async () => {
            await page.goto("/cluster", { waitUntil: "networkidle" });
            // The first tab is labelled "Overview" (resource-utilization-6) but keeps its
            // "overview" URL value / test-id so existing shareable links still work.
            await expect(page.locator("[data-test-id='cluster-tab-overview']")).toHaveText("Overview");
            await expect(page.locator("[data-test-id='cluster-tab-performance']")).toHaveText("Resource utilization");
            // Overview is the default panel and still renders the stat tiles unchanged.
            await expect(page.locator("[data-test-id='cluster-panel-overview']")).toBeVisible();
            await expect(page.locator("[data-test-id='stat-server-version']")).toBeVisible();
            await expect(page.locator("[data-test-id='cluster-panel-performance']")).toHaveCount(0);
            // The cluster Performance content (performance-tabs-6) replaced the old stub.
            await expect(page.locator("[data-test-id='perf-cluster-stub']")).toHaveCount(0);
        });

        test("selecting the cluster Resource utilization tab mounts the Performance panel", async () => {
            // The cluster Resource utilization tab is now populated (a node treemap); its
            // detailed content is asserted in the "Performance tabs (cluster)" block. Here we
            // only confirm the tab switch mounts the Performance panel and unmounts the
            // Overview panel, the scaffold behaviour this block covers.
            await page.goto("/cluster", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='cluster-tab-performance']").click();
            await expect(page.locator("[data-test-id='cluster-panel-performance']")).toBeVisible();
            // The old stub placeholder is gone.
            await expect(page.locator("[data-test-id='perf-cluster-stub']")).toHaveCount(0);
            // The Overview panel is no longer mounted once Resource utilization is selected.
            await expect(page.locator("[data-test-id='cluster-panel-overview']")).toHaveCount(0);
        });

        test("node detail shows a Performance tab that mounts the Performance panel when selected", async () => {
            await page.goto("/nodes/node-cp", { waitUntil: "networkidle" });
            // Existing tabs still render alongside the Performance tab.
            await expect(page.locator("[data-test-id='node-tab-detail']")).toBeVisible();
            await expect(page.locator("[data-test-id='node-tab-performance']")).toBeVisible();
            await expect(page.locator("[data-test-id='node-panel-performance']")).toHaveCount(0);
            await page.locator("[data-test-id='node-tab-performance']").click();
            await expect(page.locator("[data-test-id='node-panel-performance']")).toBeVisible();
            // The node Performance tab is now populated (performance-tabs-7); the old stub
            // is gone. Its content is asserted in the "Performance tabs (node)" block.
            await expect(page.locator("[data-test-id='perf-node-stub']")).toHaveCount(0);
        });

        test("pod detail shows a Performance tab that mounts the Performance panel when selected", async () => {
            await page.goto("/pods/default/nginx-abc", { waitUntil: "networkidle" });
            // Existing tabs still render alongside the new Performance tab.
            await expect(page.locator("[data-test-id='pod-tab-detail']")).toBeVisible();
            await expect(page.locator("[data-test-id='pod-tab-performance']")).toBeVisible();
            await expect(page.locator("[data-test-id='pod-panel-performance']")).toHaveCount(0);
            await page.locator("[data-test-id='pod-tab-performance']").click();
            await expect(page.locator("[data-test-id='pod-panel-performance']")).toBeVisible();
            // The pod Performance tab is now populated (performance-tabs-8); the old stub
            // is gone. Its content is asserted in the "Performance tabs (pod)" block.
            await expect(page.locator("[data-test-id='perf-pod-stub']")).toHaveCount(0);
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
            // Wait for the request that actually carries namespace=default, not merely the first
            // /api/pods call. Selecting the namespace can briefly re-issue the unfiltered request
            // first (more likely under parallel load), and a bare glob would capture that stray call
            // and read namespace=null. Matching on the param waits for the request the test is about.
            const requestPromise = page.waitForRequest(
                (req) => req.url().includes("/api/pods")
                    && new URL(req.url()).searchParams.get("namespace") === "default",
            );
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
            // The control is labelled "Clear" (the app-wide standard wording for this action).
            await expect(page.locator("[data-test-id='pods-filter-deselect-all']")).toHaveText("Clear");
            // Make a selection first so the Clear control is enabled, then clear it.
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

        test("the sub-tab breadcrumb reads Performance on the pod Performance tab", async () => {
            await page.goto("/pods/default/nginx-abc", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='pod-tab-performance']").click();
            await expect(page).toHaveURL(/tab=performance/);
            // Regression: this leaf crumb used to read "Status" for every tab the
            // breadcrumb label map omitted (including Performance).
            await expect(page.locator("[data-test-id='breadcrumb-item']").last()).toHaveText("Performance");
            const items = await page.locator("[data-test-id='breadcrumb-item']").allTextContents();
            expect(items).toEqual(["Pods", "default", "nginx-abc", "Performance"]);
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

    // ── Live logs page (multi-pod streaming) ──────────────────────────────────

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

        test("has no Tail option and no Refresh button", async () => {
            // The Logs page and the Pod detail Logs tab share one component, and
            // neither exposes a "Tail" selector or a Refresh button.
            await expect(page.locator("[data-test-id='log-tail-select']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='live-logs-tail-select']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='log-refresh']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='live-logs-refresh']")).toHaveCount(0);
        });

        test("the log viewer stretches down to fill the remaining viewport height", async () => {
            // Regression for logs-reusable-1: the log text area must grow to fill
            // the space left below the controls, down to near the viewport bottom,
            // rather than sitting at a small fixed height. The viewport is 800px
            // tall (set in beforeEach), so the viewer's bottom edge should land
            // close to it once the page chrome and controls are accounted for.
            const viewport = page.viewportSize();
            expect(viewport).not.toBeNull();
            const box = await page.locator("[data-test-id='live-logs-viewer']").boundingBox();
            expect(box).not.toBeNull();
            const bottom = box!.y + box!.height;
            // The viewer reaches within ~64px of the viewport bottom (the <main>
            // padding is 24px each side). A small fixed-height box would fall far
            // short, so this both proves the stretch and guards the regression.
            expect(viewport!.height - bottom).toBeLessThan(64);
            expect(box!.height).toBeGreaterThan(400);
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

        test("checked pods move to the top of the list, with a divider before the rest", async () => {
            // The two fake pods sort nginx-abc, redis-xyz alphabetically. With
            // nothing checked there is a single ordered group and no divider.
            await openPicker();
            let options = page.locator("[data-test-id='live-logs-pod-option']");
            await expect(options.nth(0)).toContainText("nginx-abc");
            await expect(options.nth(1)).toContainText("redis-xyz");
            await expect(page.locator("[data-test-id='live-logs-pod-group-divider']")).toHaveCount(0);

            // Check the alphabetically-later pod: it jumps to the top group and a
            // divider appears between it and the remaining unselected pod.
            await page.locator("[data-test-id='live-logs-pod-list'] [data-test-id='live-logs-pod-option']", { hasText: "redis-xyz" })
                .locator("input").check();
            options = page.locator("[data-test-id='live-logs-pod-option']");
            await expect(options.nth(0)).toContainText("redis-xyz");
            await expect(options.nth(1)).toContainText("nginx-abc");
            await expect(page.locator("[data-test-id='live-logs-pod-group-divider']")).toHaveCount(1);

            // The divider sits between the selected pod and the first unselected pod.
            const dividerBox = await page.locator("[data-test-id='live-logs-pod-group-divider']").boundingBox();
            const selectedBox = await options.nth(0).boundingBox();
            const unselectedBox = await options.nth(1).boundingBox();
            expect(dividerBox!.y).toBeGreaterThan(selectedBox!.y);
            expect(dividerBox!.y).toBeLessThan(unselectedBox!.y);

            // Checking the other pod too: every visible pod is selected, so the
            // divider disappears (no stray line when one group is empty).
            await page.locator("[data-test-id='live-logs-pod-list'] [data-test-id='live-logs-pod-option']", { hasText: "nginx-abc" })
                .locator("input").check();
            await expect(page.locator("[data-test-id='live-logs-pod-group-divider']")).toHaveCount(0);

            await page.locator("[data-test-id='live-logs-clear']").click();
            await expect(page.locator("[data-test-id='live-logs-selected-count']")).toHaveText("0 selected");
            await closePicker();
        });

        test("the selected count and Clear sit above the pod list, not below it", async () => {
            // Regression: with many pods the old footer count/Clear were pushed off
            // the bottom of the list. They now sit in a header row above the list,
            // so they stay visible however long the list grows.
            await openPicker();
            const countBox = await page.locator("[data-test-id='live-logs-selected-count']").boundingBox();
            const clearBox = await page.locator("[data-test-id='live-logs-clear']").boundingBox();
            const listBox = await page.locator("[data-test-id='live-logs-pod-list']").boundingBox();
            expect(countBox!.y).toBeLessThan(listBox!.y);
            expect(clearBox!.y).toBeLessThan(listBox!.y);
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

        // Streams both fake pods from a fresh page by checking them in the picker,
        // then presses Stream and waits for both chips and both log lines to land.
        // The shared starting point for the pod-removal tests below.
        async function streamBothPods(): Promise<void> {
            await page.goto("/logs", { waitUntil: "networkidle" });
            await openPicker();
            await page.locator("[data-test-id='live-logs-pod-list'] [data-test-id='live-logs-pod-option']", { hasText: "nginx-abc" })
                .locator("input").check();
            await page.locator("[data-test-id='live-logs-pod-list'] [data-test-id='live-logs-pod-option']", { hasText: "redis-xyz" })
                .locator("input").check();
            await closePicker();
            await page.locator("[data-test-id='live-logs-start']").click();
            await expect(page.locator("[data-test-id='live-logs-matched-pod']")).toHaveCount(2);
            await expect(page.locator("[data-test-id='live-logs-line']")).toHaveCount(2);
        }

        test("every streaming pod chip carries a close button at the end of its label", async () => {
            await streamBothPods();
            const removeButtons = page.locator("[data-test-id='live-logs-matched-pod-remove']");
            await expect(removeButtons).toHaveCount(2);
            // The close button sits at the end of the pod-name label: its left edge
            // is past the midpoint of the chip it belongs to.
            const chip = page.locator("[data-test-id='live-logs-matched-pod']", { hasText: "redis-xyz" });
            const chipBox = await chip.boundingBox();
            const buttonBox = await chip.locator("[data-test-id='live-logs-matched-pod-remove']").boundingBox();
            expect(chipBox).not.toBeNull();
            expect(buttonBox).not.toBeNull();
            expect(buttonBox!.x).toBeGreaterThan(chipBox!.x + chipBox!.width / 2);
        });

        test("clicking a pod chip's close button removes that pod from the streamed set", async () => {
            await streamBothPods();
            await expect(page.locator("[data-test-id='live-logs-matched']")).toContainText("Streaming 2 pod(s)");
            await expect(page.locator("[data-test-id='live-logs-viewer']")).toContainText("default/redis-xyz");

            // Removing redis-xyz re-scopes the stream to the remaining pod only, so
            // the removed pod's follow is torn down rather than left running.
            const rescoped = page.waitForRequest((req) =>
                req.url().includes("/api/logs/stream")
                && req.url().includes("pods=nginx-abc")
                && !req.url().includes("pods=redis-xyz"));
            await page.locator("[data-test-id='live-logs-matched-pod']", { hasText: "redis-xyz" })
                .locator("[data-test-id='live-logs-matched-pod-remove']").click();
            await rescoped;

            // Its chip is gone and the count decremented to the one remaining pod.
            await expect(page.locator("[data-test-id='live-logs-matched-pod']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='live-logs-matched']")).toContainText("Streaming 1 pod(s)");
            await expect(page.locator("[data-test-id='live-logs-matched']")).not.toContainText("redis-xyz");
            // Its lines stopped: only the surviving pod's line is in the viewer.
            await expect(page.locator("[data-test-id='live-logs-line']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='live-logs-viewer']")).toContainText("default/nginx-abc");
            await expect(page.locator("[data-test-id='live-logs-viewer']")).not.toContainText("redis-xyz");

            // The picker agrees with the chips: removing via the close button leaves
            // the same selection as unticking the pod in the picker would.
            await openPicker();
            await expect(page.locator("[data-test-id='live-logs-selected-count']")).toHaveText("1 selected");
            const options = page.locator("[data-test-id='live-logs-pod-list'] [data-test-id='live-logs-pod-option']");
            await expect(options.filter({ hasText: "nginx-abc" }).locator("input")).toBeChecked();
            await expect(options.filter({ hasText: "redis-xyz" }).locator("input")).not.toBeChecked();
            await closePicker();
        });

        test("removing the last streamed pod leaves the empty state, not a broken view", async () => {
            await streamBothPods();
            await page.locator("[data-test-id='live-logs-matched-pod']", { hasText: "redis-xyz" })
                .locator("[data-test-id='live-logs-matched-pod-remove']").click();
            await expect(page.locator("[data-test-id='live-logs-matched-pod']")).toHaveCount(1);

            // Removing the only pod left stops the stream and empties the page.
            await page.locator("[data-test-id='live-logs-matched-pod']", { hasText: "nginx-abc" })
                .locator("[data-test-id='live-logs-matched-pod-remove']").click();
            await expect(page.locator("[data-test-id='live-logs-matched']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='live-logs-line']")).toHaveCount(0);
            // Back to the un-scoped starting state: Stream (not Stop), the picker
            // cleared, and the viewer's guidance placeholder, with no error shown.
            await expect(page.locator("[data-test-id='live-logs-start']")).toBeVisible();
            await expect(page.locator("[data-test-id='live-logs-stop']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='live-logs-error']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='live-logs-viewer']")).toContainText("Check pods or type a search, then press Stream.");
            await expect(page.locator("[data-test-id='live-logs-last-updated']")).toHaveText("No logs yet");
            await expect(page.locator("[data-test-id='live-logs-picker-trigger']")).toContainText("Search pods...");
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
            // Wait for the request that actually carries namespace=default, not merely the first
            // /api/events call. Selecting the namespace can briefly re-issue the unfiltered request
            // first (more likely under parallel load), and a bare glob would capture that stray call
            // and read namespace=null. Matching on the param waits for the request the test is about.
            const requestPromise = page.waitForRequest(
                (req) => req.url().includes("/api/events")
                    && new URL(req.url()).searchParams.get("namespace") === "default",
            );
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
        // lastSeen is pinned to a fixed 2-hours-ago offset so the Age column renders a
        // stable "2h". With `new Date()` (now) the Age grew with how long the suite took to
        // reach this block; once it read "4m" the "search matches a term only in the Count
        // column" test below matched BOTH rows via the Age cell instead of only the count-4
        // row. A 2h offset floors to "2h" for the whole run (it never ticks to 3h within a
        // run) and contains no digit the Count searches use, so the search stays unambiguous
        // regardless of how long the suite takes — which varies a lot under parallel load.
        const TWO_HOURS_AGO = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
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
                    lastSeen: TWO_HOURS_AGO,
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
                    lastSeen: TWO_HOURS_AGO,
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

    // ── Related-resource links in the errors and events tables ──────────────────

    test.describe("errors and events tables link to related resources", () => {
        // Each fixture carries one reference to a kind that has a detail page (Pod)
        // and one to a kind that does not (ReplicaSet), so both the linking and the
        // graceful-degradation paths are covered from the table.
        const LINK_ERRORS = {
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
                    lastSeen: "2024-01-01T00:00:00Z",
                },
                {
                    source: "Event",
                    namespace: "default",
                    objectKind: "ReplicaSet",
                    objectName: "web-7d9",
                    reason: "FailedCreate",
                    message: "Error creating: pods \"web-7d9\" is forbidden",
                    count: 2,
                    firstSeen: "2024-01-01T00:00:00Z",
                    lastSeen: "2024-01-01T00:00:00Z",
                },
            ],
        };

        const LINK_EVENTS = {
            events: [
                {
                    uid: "evt-link-pod",
                    type: "Warning",
                    reason: "BackOff",
                    message: "Back-off restarting failed container",
                    count: 5,
                    source: "kubelet",
                    firstSeen: "2024-01-01T00:00:00Z",
                    lastSeen: "2024-01-01T00:00:00Z",
                    namespace: "default",
                    objectKind: "Pod",
                    objectName: "nginx-abc",
                },
                {
                    uid: "evt-link-rs",
                    type: "Warning",
                    reason: "FailedCreate",
                    message: "Error creating: pods \"web-7d9\" is forbidden",
                    count: 2,
                    source: "replicaset-controller",
                    firstSeen: "2024-01-01T00:00:00Z",
                    lastSeen: "2024-01-01T00:00:00Z",
                    namespace: "default",
                    objectKind: "ReplicaSet",
                    objectName: "web-7d9",
                },
            ],
        };

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await page.route("**/api/errors*", async (route) => {
                await route.fulfill({ json: LINK_ERRORS });
            });
            await page.route("**/api/events*", async (route) => {
                await route.fulfill({ json: LINK_EVENTS });
            });
        });

        test.afterAll(async () => {
            await page.unroute("**/api/errors*");
            await page.unroute("**/api/events*");
            setContext(CLUSTER_1);
        });

        test("an errors table row links its object to that pod's detail page", async () => {
            await page.goto("/errors", { waitUntil: "networkidle" });
            const link = page.locator("[data-test-id='error-row']")
                .filter({ hasText: "CrashLoopBackOff" })
                .locator("[data-test-id='error-row-object-link']");
            await expect(link).toContainText("Pod/crasher-abc");
            await link.click();
            await expect(page).toHaveURL(/\/pods\/default\/crasher-abc/);
        });

        test("the errors table object link wins over the row's own navigation", async () => {
            // The row itself navigates to the error detail page. Clicking the object
            // link must navigate to the referenced pod instead, not the error detail.
            await page.goto("/errors", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='error-row']")
                .filter({ hasText: "CrashLoopBackOff" })
                .locator("[data-test-id='error-row-object-link']")
                .click();
            await expect(page).toHaveURL(/\/pods\/default\/crasher-abc/);
            await expect(page.locator("[data-test-id='error-detail']")).toHaveCount(0);
        });

        test("an errors table object with no detail page renders as plain text", async () => {
            await page.goto("/errors", { waitUntil: "networkidle" });
            const ref = page.locator("[data-test-id='error-row']")
                .filter({ hasText: "FailedCreate" })
                .locator("[data-test-id='error-row-object-link']");
            await expect(ref).toContainText("ReplicaSet/web-7d9");
            await expect(ref).toHaveJSProperty("tagName", "SPAN");
        });

        test("an events table row links its object to that pod's detail page", async () => {
            await page.goto("/events", { waitUntil: "networkidle" });
            const link = page.locator("[data-test-id='event-row']")
                .filter({ hasText: "BackOff" })
                .locator("[data-test-id='event-row-object-link']");
            await expect(link).toContainText("Pod/nginx-abc");
            await link.click();
            await expect(page).toHaveURL(/\/pods\/default\/nginx-abc/);
        });

        test("the events table object link wins over the row's own navigation", async () => {
            // The row itself navigates to the event detail page. Clicking the object
            // link must navigate to the referenced pod instead, not the event detail.
            await page.goto("/events", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='event-row']")
                .filter({ hasText: "BackOff" })
                .locator("[data-test-id='event-row-object-link']")
                .click();
            await expect(page).toHaveURL(/\/pods\/default\/nginx-abc/);
            await expect(page.locator("[data-test-id='event-detail']")).toHaveCount(0);
        });

        test("an events table object with no detail page renders as plain text", async () => {
            await page.goto("/events", { waitUntil: "networkidle" });
            const ref = page.locator("[data-test-id='event-row']")
                .filter({ hasText: "FailedCreate" })
                .locator("[data-test-id='event-row-object-link']");
            await expect(ref).toContainText("ReplicaSet/web-7d9");
            await expect(ref).toHaveJSProperty("tagName", "SPAN");
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
        let endX = targetBox.x + targetBox.width / 2;
        let endY = targetBox.y + targetBox.height / 2;
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        // Let dnd-kit's PointerSensor process the pointerdown and attach its move listeners
        // before the pointer travels. Under heavy parallel-run CPU load that handler can run
        // late, so without this pause the first moves are missed and the drag never starts (the
        // row then never reorders).
        await page.waitForTimeout(250);
        // Step the pointer towards the target so dnd-kit starts and tracks the drag, pausing
        // briefly between steps so a CPU-starved page keeps up with the moves.
        const steps = 10;
        for (let step = 1; step <= steps; step++) {
            const x = startX + ((endX - startX) * step) / steps;
            const y = startY + ((endY - startY) * step) / steps;
            await page.mouse.move(x, y);
            await page.waitForTimeout(20);
        }
        // Re-aim at the target's LIVE position before releasing. When the target is a column row,
        // dnd-kit parks the dragged column at the cursor's insertion point during the drag, which
        // reflows the list and moves the row from where its box was captured at the start (more so
        // with more columns present). Reading the live box and re-aiming a few times converges the
        // cursor onto the row's settled centre, so the drop lands ON the row's slot — exactly what a
        // real user's cursor would do — rather than in the bare area below it (which would append to
        // the end). For a section droppable target there is no row to reflow, so this is a harmless
        // no-op re-read.
        for (let i = 0; i < 8; i++) {
            const live = await target.boundingBox();
            if (live !== null) {
                endX = live.x + live.width / 2;
                endY = live.y + live.height / 2;
            }
            await page.mouse.move(endX, endY);
            await page.waitForTimeout(120);
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
        let endX = sectionBox.x + sectionBox.width / 2;
        // Aim a little below the last row (still inside the section's padded box) so the cursor sits
        // in the bare area beneath every row; if the section is empty, aim at its centre.
        let endY = lastRowBox === null
            ? sectionBox.y + sectionBox.height / 2
            : Math.min(lastRowBox.y + lastRowBox.height + 10, sectionBox.y + sectionBox.height - 4);
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        // Let dnd-kit attach its pointer listeners before moving (see dragColumnOnto): under
        // heavy load the pointerdown handler runs late and the drag would otherwise never start.
        await page.waitForTimeout(250);
        const steps = 10;
        for (let step = 1; step <= steps; step++) {
            const x = startX + ((endX - startX) * step) / steps;
            const y = startY + ((endY - startY) * step) / steps;
            await page.mouse.move(x, y);
            await page.waitForTimeout(20);
        }
        // Re-aim at the section's LIVE bare area before releasing. Parking the dragged column in the
        // destination during the drag grows the section and reflows its rows, so the end landing spot
        // captured before the drag is stale (more so with more columns present). Aim at the live
        // section's bottom edge (just inside its padding, past every row) so the drop lands in the
        // bare area — the END — rather than on a row; reading the live box a few times lets the layout
        // settle under the cursor, as a real user's cursor would track it.
        for (let i = 0; i < 8; i++) {
            const liveSection = await section.boundingBox();
            if (liveSection !== null) {
                endX = liveSection.x + liveSection.width / 2;
                endY = liveSection.y + liveSection.height - 4;
            }
            await page.mouse.move(endX, endY);
            await page.waitForTimeout(120);
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

    // ── Pods page: filter editor multi-column layout ────────────────────────────

    test.describe("pods page filter editor multi-column layout", () => {
        // Many pods, each carrying a distinct `app` label value, so the editor's
        // `app` group has far more options than fit in a single column. This is the
        // many-values case that used to run the checkboxes off the bottom of the
        // screen; they must now fan out across multiple columns.
        const APP_VALUES = [
            "alpha", "bravo", "charlie", "delta", "echo", "foxtrot",
            "golf", "hotel", "india", "juliet", "kilo", "lima",
            "mike", "november", "oscar", "papa",
        ];
        const MANY_VALUE_PODS = {
            pods: APP_VALUES.map((app) => ({
                name: `${app}-pod`,
                namespace: "default",
                phase: "Running",
                ready: "1/1",
                containerCount: 1,
                restarts: 0,
                node: "node-worker",
                createdAt: new Date().toISOString(),
                labels: { app },
            })),
        };

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await page.route("**/api/pods*", async (route) => {
                await route.fulfill({ json: MANY_VALUE_PODS });
            });
            await page.goto("/pods", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='pod-row']").first()).toBeVisible();
        });

        test.afterAll(async () => {
            await page.unroute("**/api/pods*");
            setContext(CLUSTER_1);
        });

        test("a group with many values lays its options out across multiple columns, filling the width", async () => {
            await page.locator("[data-test-id='pods-filter-button']").click();
            const grid = page.locator("[data-test-id='pods-filter-options-label:app']");
            await expect(grid).toBeVisible();

            // Every one of the many label values has a rendered, visible option.
            const items = grid.locator("[data-test-id^='pods-filter-item-label:app-']");
            await expect(items).toHaveCount(APP_VALUES.length);
            for (let i = 0; i < APP_VALUES.length; i++) {
                await expect(items.nth(i)).toBeVisible();
            }

            // Read each option's top-left corner so the layout can be inspected.
            const corners = await items.evaluateAll((els) =>
                els.map((el) => {
                    const r = el.getBoundingClientRect();
                    return { left: Math.round(r.left), top: Math.round(r.top) };
                }),
            );

            // The options span more than one column: distinct left edges mean
            // distinct columns. A single-column layout would yield exactly one.
            const distinctLefts = new Set(corners.map((c) => c.left));
            expect(distinctLefts.size).toBeGreaterThan(1);

            // The row-flow fills the width: with several columns the group's height
            // is far shorter than 16 single-column rows would be, so the checkboxes
            // do not run down and off the screen the way the old single-column
            // layout did.
            const distinctTops = new Set(corners.map((c) => c.top));
            const distinctColumns = distinctLefts.size;
            const expectedRows = Math.ceil(APP_VALUES.length / distinctColumns);
            expect(distinctTops.size).toBeLessThanOrEqual(expectedRows);
            expect(distinctTops.size).toBeLessThan(APP_VALUES.length);

            // The grid uses the editor's width, not a narrow single column: it is
            // wider than one option cell. The columns consume the horizontal space
            // beside the group rather than leaving a wide empty margin.
            const gridBox = await grid.boundingBox();
            expect(gridBox).not.toBeNull();
            const oneItemBox = await items.first().boundingBox();
            expect(oneItemBox).not.toBeNull();
            expect(gridBox!.width).toBeGreaterThan(oneItemBox!.width * 1.5);
            await page.keyboard.press("Escape");
        });

        test("the editor body shows a scrollbar when its content overflows", async () => {
            await page.locator("[data-test-id='pods-filter-button']").click();
            const body = page.locator("[data-test-id='pods-filter-body']");
            await expect(body).toBeVisible();
            // The many-value fixture produces enough groups/options that the body's
            // content exceeds its capped height, so it scrolls: the scrollHeight
            // exceeds the visible clientHeight and the element is a scroll
            // container (overflow-y resolves to auto/scroll).
            const overflow = await body.evaluate((el) => ({
                scrollable: el.scrollHeight > el.clientHeight,
                overflowY: getComputedStyle(el).overflowY,
            }));
            expect(overflow.scrollable).toBe(true);
            expect(["auto", "scroll"]).toContain(overflow.overflowY);
            await page.keyboard.press("Escape");
        });

        test("the multi-column options still toggle the filter normally", async () => {
            await page.locator("[data-test-id='pods-filter-button']").click();
            // An option in what is necessarily a later column still toggles its value.
            await page.locator("[data-test-id='pods-filter-item-label:app-papa']").click();
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='pod-row']")).toHaveCount(1);
            await expect(page.locator("[data-test-id='pod-row'] td:first-child")).toHaveText("papa-pod");
            await expect(page.locator("[data-test-id='pods-filter-button']")).toHaveText("Filter: 1 selected");
            // Clear so the suite leaves the editor as it found it.
            await page.locator("[data-test-id='pods-filter-button']").click();
            await page.locator("[data-test-id='pods-filter-deselect-all']").click();
            await page.keyboard.press("Escape");
            await expect(page.locator("[data-test-id='pod-row']")).toHaveCount(APP_VALUES.length);
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
        const FAKE_HPAS = {
            horizontalPodAutoscalers: [
                { name: "web-hpa", namespace: "default", reference: "Deployment/web-deploy", minReplicas: 1, maxReplicas: 10, currentReplicas: 3, targets: "cpu: 40%/80%", createdAt: new Date().toISOString(), labels: { app: "web" } },
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
            await page.route("**/api/horizontalpodautoscalers*", async (route) => { await route.fulfill({ json: FAKE_HPAS }); });
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
            await page.unroute("**/api/horizontalpodautoscalers*");
            setContext(CLUSTER_1);
        });

        test("the left nav has an All resources entry that opens the page", async () => {
            await page.locator("[data-test-id='sidebar-nav']").getByRole("link", { name: "all resources" }).click();
            await expect(page).toHaveURL(/\/all-resources/);
            await expect(page.locator("[data-test-id='all-resources-table']")).toBeVisible();
        });

        test("shows rows spanning more than one kind", async () => {
            await expect(await rows()).toHaveCount(7);
            const present = await kinds();
            const distinct = new Set(present);
            expect(distinct.size).toBeGreaterThan(1);
            // Every aggregated kind appears, including HorizontalPodAutoscaler.
            expect(distinct).toEqual(new Set(["Pod", "Node", "Namespace", "Deployment", "StatefulSet", "DaemonSet", "HorizontalPodAutoscaler"]));
        });

        test("the search box narrows the rows to those matching the typed text", async () => {
            await page.locator("[data-test-id='all-resources-search'] input").fill("nginx-pod");
            await expect(await rows()).toHaveCount(1);
            expect(await names()).toEqual(["nginx-pod"]);
            await page.locator("[data-test-id='all-resources-search'] input").fill("zzznotfound");
            await expect(await rows()).toHaveCount(0);
            await expect(page.locator("[data-test-id='no-all-resources-match']")).toBeVisible();
            await page.locator("[data-test-id='all-resources-search'] input").fill("");
            await expect(await rows()).toHaveCount(7);
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
            await expect(await rows()).toHaveCount(7);
            await expect(page.locator("[data-test-id='all-resources-filter-button']")).toHaveText("Filter: All");
        });

        test("the Kind filter offers HorizontalPodAutoscaler and narrows to the HPA row", async () => {
            // HPAs are selectable in the All resources filter and show on the page.
            await page.locator("[data-test-id='all-resources-filter-button']").click();
            await page.locator("[data-test-id='all-resources-filter-item-kind-HorizontalPodAutoscaler']").click();
            await page.keyboard.press("Escape");
            await expect(await rows()).toHaveCount(1);
            expect(await kinds()).toEqual(["HorizontalPodAutoscaler"]);
            expect(await names()).toEqual(["web-hpa"]);
            // Clear back to all so later tests see the full set.
            await page.locator("[data-test-id='all-resources-filter-button']").click();
            await page.locator("[data-test-id='all-resources-filter-deselect-all']").click();
            await page.keyboard.press("Escape");
            await expect(await rows()).toHaveCount(7);
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

    // ── Performance tabs (cluster) ──────────────────────────────────────────────
    // The backend runs with KARSE_FAKE_METRICS=1 (set in scripts/e2e-tests.sh), so the
    // Metrics API returns canned node usage keyed by the seeded node names (node-cp,
    // node-worker). The cluster Performance tab therefore renders a Breakdown treemap
    // whose leaves are those nodes, each sized by usage and labelled with its share of
    // the cluster total. (cluster-performance-1 reworked this from a pod treemap, and
    // removed the Hot spots heatmap and Top consumers table.)
    test.describe("Performance tabs (cluster)", () => {
        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await page.goto("/cluster", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='cluster-tab-performance']")).toBeVisible();
            await page.locator("[data-test-id='cluster-tab-performance']").click();
            // The lazy query fires only once the tab is active; wait for the treemap.
            await expect(page.locator("[data-test-id='perf-treemap']")).toBeVisible();
        });

        test("renders the node treemap with no heatmap or top-consumers table", async () => {
            await expect(page.locator("[data-test-id='perf-treemap']")).toBeVisible();
            // The Hot spots heatmap and Top consumers table were removed.
            await expect(page.locator("[data-test-id='perf-heatmap']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='perf-top-consumers']")).toHaveCount(0);
        });

        test("the treemap shows node boxes, not pod boxes", async () => {
            await expect(page.locator("[data-test-id='perf-treemap']")).toBeVisible();
            const labels = await page
                .locator("[data-test-id='perf-treemap'] text")
                .allTextContents();
            const joined = labels.join(" ");
            // The seeded cluster nodes appear as treemap leaves.
            expect(joined).toContain("node-cp");
            expect(joined).toContain("node-worker");
            // Pods are no longer treemap cells: the seeded pod names must be absent.
            expect(joined).not.toContain("web");
            expect(joined).not.toContain("api");
        });

        test("each node box shows its percentage of the cluster total", async () => {
            await expect(page.locator("[data-test-id='perf-treemap']")).toBeVisible();
            const labels = await page
                .locator("[data-test-id='perf-treemap'] text")
                .allTextContents();
            // At least one node leaf carries a "<name> <n>%" label (the share of total).
            const withShare = labels.filter((t) => /%/.test(t));
            expect(withShare.length).toBeGreaterThan(0);
            expect(withShare.some((t) => /node-(cp|worker)\s+\d+%/.test(t))).toBe(true);
        });

        test("the metric toggle is present with CPU selected by default", async () => {
            await expect(page.locator("[data-test-id='perf-metric-toggle']")).toBeVisible();
            await expect(
                page.locator("[data-test-id='perf-metric-cpu']")
            ).toHaveAttribute("aria-pressed", "true");
        });

        test("toggling to Memory keeps the node treemap rendered", async () => {
            await page.locator("[data-test-id='perf-metric-memory']").click();
            await expect(
                page.locator("[data-test-id='perf-metric-memory']")
            ).toHaveAttribute("aria-pressed", "true");
            await expect(page.locator("[data-test-id='perf-treemap']")).toBeVisible();
            const labels = await page
                .locator("[data-test-id='perf-treemap'] text")
                .allTextContents();
            expect(labels.join(" ")).toContain("node-cp");
            // Restore CPU for any later assertions / a clean state.
            await page.locator("[data-test-id='perf-metric-cpu']").click();
        });

        test("clicking a node box navigates to that node's Performance tab", async () => {
            await page.goto("/cluster", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='cluster-tab-performance']").click();
            await expect(page.locator("[data-test-id='perf-treemap']")).toBeVisible();
            // nivo renders each leaf as an SVG rect with the node label as text. Clicking
            // the node-cp leaf label drills into that node's detail page on its Performance
            // tab. force: the label text sits over the rect that carries the click handler.
            await page
                .locator("[data-test-id='perf-treemap'] text")
                .filter({ hasText: /node-cp/ })
                .first()
                .click({ force: true });
            await expect(page).toHaveURL(/\/nodes\/node-cp/);
            await expect(page).toHaveURL(/tab=performance/);
            await expect(page.locator("[data-test-id='node-tab-performance']")).toBeVisible();
        });

        test("hovering a node box shows a tooltip with the node and its cluster share", async () => {
            await page.goto("/cluster", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='cluster-tab-performance']").click();
            await expect(page.locator("[data-test-id='perf-treemap']")).toBeVisible();
            await page
                .locator("[data-test-id='perf-treemap'] text")
                .filter({ hasText: /node-cp/ })
                .first()
                .hover({ force: true });
            const tooltip = page.locator("[data-test-id='perf-treemap-tooltip']");
            await expect(tooltip).toBeVisible();
            await expect(tooltip).toContainText("node-cp");
            // The tooltip names the node's share of the cluster total.
            await expect(tooltip).toContainText(/% of cluster/);
        });
    });

    // ── Cluster treemap long node-name middle-truncation ────────────────────────
    // A long node name overflows a treemap box, so its leaf label is middle-truncated
    // (truncateMiddle to ~14 chars) before the cluster share — resource-utilization-5.
    // The hover tooltip is not truncated: it shows the full node name.
    // The cluster Performance treemap is built from the /api/cluster/performance node
    // list, so this block mocks that endpoint with a long-named node to inject the long
    // leaf, without seeding a real long-named node (which other tests' node counts assert).
    // It is its own top-level block with self-contained route setup/teardown so it never
    // disturbs the shared page state the "Performance tabs (cluster)" block relies on.
    test.describe("cluster treemap long node-name truncation", () => {
        const LONG_NODE = "node-with-a-very-long-hostname-worker-01";
        // A full ClusterPerformance snapshot. The Cluster Overview tab (the default tab this
        // block lands on before clicking Performance) renders health signals, the workloads
        // table, and the node-utilization strip from this same endpoint, so totals/health/
        // workloads and each node's requests must be present or the Overview render throws
        // and the tab bar never appears. The treemap this block asserts on is built from nodes.
        const PERFORMANCE = {
            metricsAvailable: true,
            nodes: [
                { name: LONG_NODE, usage: { cpuMillicores: 1200, memoryBytes: 3_000_000_000 }, requests: { cpuMillicores: 1000, memoryBytes: 2_000_000_000 }, allocatable: { cpuMillicores: 4000, memoryBytes: 8_000_000_000 } },
                { name: "node-worker", usage: { cpuMillicores: 800, memoryBytes: 2_000_000_000 }, requests: { cpuMillicores: 600, memoryBytes: 1_000_000_000 }, allocatable: { cpuMillicores: 4000, memoryBytes: 8_000_000_000 } },
            ],
            pods: [],
            totals: {
                usage: { cpuMillicores: 2000, memoryBytes: 5_000_000_000 },
                requests: { cpuMillicores: 1600, memoryBytes: 3_000_000_000 },
                allocatable: { cpuMillicores: 8000, memoryBytes: 16_000_000_000 },
            },
            health: {
                pendingPods: 0,
                oomKillCount: 0,
                nodeCount: 2,
                nodePressure: { memoryPressure: 0, diskPressure: 0, pidPressure: 0 },
                cpuThrottlingAvailable: false,
            },
            workloads: [],
        };

        test.beforeAll(async () => {
            setContext(CLUSTER_1);
            await page.route("**/api/cluster/performance*", async (route) => {
                await route.fulfill({ json: PERFORMANCE });
            });
            await page.goto("/cluster", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='cluster-tab-performance']").click();
            await expect(page.locator("[data-test-id='perf-treemap']")).toBeVisible();
        });

        test.afterAll(async () => {
            await page.unroute("**/api/cluster/performance*");
        });

        test("the long node leaf label is middle-truncated with an ellipsis", async () => {
            const labels = await page
                .locator("[data-test-id='perf-treemap'] text")
                .allTextContents();
            const joined = labels.join(" ");
            // truncateMiddle(LONG_NODE, 14) keeps 7 start + "..." + 7 end chars.
            expect(joined).toContain("node-wi...rker-01");
            // The full untruncated name must not appear in any box label.
            expect(joined).not.toContain(LONG_NODE);
        });

        test("the tooltip title shows the full untruncated node name", async () => {
            await page
                .locator("[data-test-id='perf-treemap'] text")
                .filter({ hasText: /node-wi\.\.\.rker-01/ })
                .first()
                .hover({ force: true });
            const tooltip = page.locator("[data-test-id='perf-treemap-tooltip']");
            await expect(tooltip).toBeVisible();
            // The box label is truncated, but the hover tooltip shows the full name.
            await expect(tooltip).toContainText(LONG_NODE);
            await expect(tooltip).not.toContainText("node-wi...rker-01");
            // The title sits on a single line (white-space: nowrap) so the tooltip
            // widens to fit the full name rather than wrapping it onto many lines.
            const title = tooltip.locator("[data-test-id='perf-treemap-tooltip-title']");
            await expect(title).toHaveCSS("white-space", "nowrap");
        });
    });

    // ── Performance tabs (node) ─────────────────────────────────────────────────
    // The backend runs with KARSE_FAKE_METRICS=1 (set in scripts/e2e-tests.sh), so the
    // pods scheduled on node-cp (worker in jobs, cache in infra) match the canned
    // per-container fake metrics by name, and node-cp carries an explicit 4-core/8Gi
    // allocatable (patched in scripts/e2e-tests.sh). The node Performance tab therefore
    // renders a single Breakdown treemap (namespace → pod) where each pod box is sized by
    // and labelled with its percentage of the node. The Provisioning subtab and the
    // standalone Breakdown subtab were removed (node-performance-1): Breakdown is now the
    // Performance tab itself.
    test.describe("Performance tabs (node)", () => {
        test.beforeAll(async () => {
            setContext(CLUSTER_1);
        });

        test("renders a single Breakdown treemap with no Provisioning or Breakdown subtabs", async () => {
            await page.goto("/nodes/node-cp", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='node-tab-performance']").click();
            await expect(page.locator("[data-test-id='perf-node']")).toBeVisible();
            // The lazy query fires once the tab is active; the Breakdown treemap shows.
            await expect(page.locator("[data-test-id='perf-treemap']")).toBeVisible();
            // The Provisioning subtab and the standalone Breakdown subtab are gone.
            await expect(page.locator("[data-test-id='perf-node-subtabs']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='perf-node-subtab-breakdown']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='perf-node-subtab-provisioning']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='perf-provisioning']")).toHaveCount(0);
            // CPU is selected by default.
            await expect(
                page.locator("[data-test-id='perf-metric-cpu']")
            ).toHaveAttribute("aria-pressed", "true");
        });

        test("each pod box is labelled with its percentage of the node", async () => {
            await page.goto("/nodes/node-cp", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='node-tab-performance']").click();
            await expect(page.locator("[data-test-id='perf-treemap']")).toBeVisible();
            const labels = await page
                .locator("[data-test-id='perf-treemap'] text")
                .allTextContents();
            const joined = labels.join(" ");
            // The pods scheduled on node-cp appear as leaves (not their containers).
            expect(joined).toContain("worker");
            expect(joined).toContain("cache");
            // At least one pod leaf carries a "<name> <n>%" share-of-the-node label.
            const withShare = labels.filter((t) => /%/.test(t));
            expect(withShare.length).toBeGreaterThan(0);
            expect(withShare.some((t) => /\d+%/.test(t))).toBe(true);
        });

        test("toggling to Memory keeps the node-share treemap rendered", async () => {
            await page.goto("/nodes/node-cp", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='node-tab-performance']").click();
            await expect(page.locator("[data-test-id='perf-treemap']")).toBeVisible();
            await page.locator("[data-test-id='perf-metric-memory']").click();
            await expect(
                page.locator("[data-test-id='perf-metric-memory']")
            ).toHaveAttribute("aria-pressed", "true");
            await expect(page.locator("[data-test-id='perf-treemap']")).toBeVisible();
            const labels = await page
                .locator("[data-test-id='perf-treemap'] text")
                .allTextContents();
            expect(labels.some((t) => /%/.test(t))).toBe(true);
        });

        test("drilling into a pod and clicking back returns to this node's Performance page", async () => {
            // performance-back-nav-1: from the node Performance treemap, click a pod leaf to
            // open the pod, then click back. The back button must return to THIS node's
            // Performance page (not the Pods list), and the breadcrumb origin crumb must
            // point at the same place, so the trail and the back target agree.
            await page.goto("/nodes/node-cp", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='node-tab-performance']").click();
            await expect(page.locator("[data-test-id='perf-treemap']")).toBeVisible();
            // The node treemap nests namespace -> pod; the leaves are pods. The cache pod
            // (infra) is a leaf whose label starts with "cache", so clicking it drills into
            // the cache pod's Performance tab, tagged from=node-performance:node-cp. force:
            // the label text sits over the rect that carries the click handler.
            await page
                .locator("[data-test-id='perf-treemap'] text")
                .filter({ hasText: /^cache/ })
                .first()
                .click({ force: true });
            await expect(page).toHaveURL(/\/pods\/infra\/cache/);
            await expect(page).toHaveURL(/from=node-performance%3Anode-cp/);
            // The breadcrumb origin crumb shows the node, not the Pods trail.
            await expect(page.locator("[data-test-id='breadcrumb-item']").first()).toHaveText("node-cp");
            // Click back: it returns to node-cp's Performance tab, not the Pods list.
            await expect(page.locator("[data-test-id='pod-detail-back']")).toBeVisible();
            await page.locator("[data-test-id='pod-detail-back']").click();
            await expect(page).toHaveURL(/\/nodes\/node-cp/);
            await expect(page).toHaveURL(/tab=performance/);
            await expect(page.locator("[data-test-id='node-panel-performance']")).toBeVisible();
        });

        test("renders CPU and Memory utilization cards above the treemap, separate from the treemap metric toggle", async () => {
            // resource-utilization-9: the Performance tab carries utilization cards driven
            // by the shared View-mode / Value-format toggles, above the Breakdown treemap
            // which keeps its own CPU/Memory metric toggle. The two toggle concerns are
            // independent.
            await page.goto("/nodes/node-cp", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='node-tab-performance']").click();
            await expect(page.locator("[data-test-id='node-utilization-cards']")).toBeVisible();
            await expect(page.locator("[data-test-id='node-util-card-cpu']")).toBeVisible();
            await expect(page.locator("[data-test-id='node-util-card-memory']")).toBeVisible();
            // The cards' View-mode / Value-format toggles and the treemap's metric toggle
            // both render, on the same tab.
            await expect(page.locator("[data-test-id='util-view-mode']")).toBeVisible();
            await expect(page.locator("[data-test-id='util-value-format']")).toBeVisible();
            await expect(page.locator("[data-test-id='perf-metric-cpu']")).toBeVisible();
        });

        test("the utilization-card toggles update the cards and are independent of the treemap metric toggle", async () => {
            await page.goto("/nodes/node-cp", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='node-tab-performance']").click();
            const cpuCard = page.locator("[data-test-id='node-util-card-cpu']");
            await expect(cpuCard).toBeVisible();
            // Default Usage + % shows a percentage value.
            const percentValue = (await cpuCard.textContent()) ?? "";
            expect(percentValue).toMatch(/%/);
            // Switch the Value format to Absolute: the card now reads "used / total vCPU"
            // (no bare percentage), proving the toggle drives the card.
            await page.locator("[data-test-id='util-value-format-absolute']").click();
            await expect(cpuCard).toContainText("vCPU");
            // The treemap metric toggle is unaffected: CPU is still the selected treemap
            // metric (the two toggle concerns are independent).
            await expect(page.locator("[data-test-id='perf-metric-cpu']")).toHaveAttribute("aria-pressed", "true");
            // Switch back to % so later tests start from the default.
            await page.locator("[data-test-id='util-value-format-percent']").click();
            await expect(cpuCard).toContainText("%");
        });

        test("the pods table bars respond to the View-mode / Value-format toggles", async () => {
            await page.goto("/nodes/node-cp", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='node-tab-pods']").click();
            await expect(page.locator("[data-test-id='node-panel-pods']")).toBeVisible();
            const firstCpu = page.locator("[data-test-id='node-pod-cpu-value']").first();
            // Default Usage + % shows a percentage.
            await expect(firstCpu).toContainText("%");
            // Absolute format switches every bar to a "used / total vCPU" string.
            await page.locator("[data-test-id='util-value-format-absolute']").click();
            await expect(firstCpu).toContainText("vCPU");
        });

        test("metrics-unavailable: the treemap is replaced by a note", async () => {
            // Force the node performance endpoint to report no Metrics API: with no live
            // usage there is nothing to size the boxes by, so the Performance tab shows the
            // unavailable notice and a note in place of the treemap.
            await page.route("**/api/nodes/node-cp/performance*", async (route) => {
                await route.fulfill({
                    json: {
                        metricsAvailable: false,
                        node: {
                            name: "node-cp",
                            usage: { cpuMillicores: null, memoryBytes: null },
                            requests: { cpuMillicores: 100, memoryBytes: 134217728 },
                            allocatable: { cpuMillicores: 4000, memoryBytes: 8589934592 },
                        },
                        pods: [
                            {
                                name: "worker",
                                namespace: "jobs",
                                node: "node-cp",
                                usage: { cpuMillicores: null, memoryBytes: null },
                                requests: { cpuMillicores: 100, memoryBytes: 134217728 },
                                limits: { cpuMillicores: 500, memoryBytes: 536870912 },
                                containers: [
                                    {
                                        name: "worker",
                                        usage: { cpuMillicores: null, memoryBytes: null },
                                        requests: { cpuMillicores: 100, memoryBytes: 134217728 },
                                        limits: { cpuMillicores: 500, memoryBytes: 536870912 },
                                    },
                                ],
                            },
                        ],
                    },
                });
            });
            await page.goto("/nodes/node-cp", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='node-tab-performance']").click();
            await expect(page.locator("[data-test-id='perf-metrics-unavailable']")).toBeVisible();
            // The note replaces the treemap.
            await expect(page.locator("[data-test-id='perf-node-breakdown-unavailable']")).toBeVisible();
            await expect(page.locator("[data-test-id='perf-treemap']")).toHaveCount(0);
            await page.unroute("**/api/nodes/node-cp/performance*");
        });

        test("hovering a pod box shows a tooltip with the pod and its share of the node", async () => {
            // The shared treemap's custom tooltip applies on the node tab too: hovering the
            // "cache" pod leaf surfaces a tooltip naming that pod and its "% of node" share,
            // instead of nivo's empty default box.
            await page.goto("/nodes/node-cp", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='node-tab-performance']").click();
            await expect(page.locator("[data-test-id='perf-treemap']")).toBeVisible();
            await page
                .locator("[data-test-id='perf-treemap'] text")
                .filter({ hasText: /^cache/ })
                .first()
                .hover({ force: true });
            const tooltip = page.locator("[data-test-id='perf-treemap-tooltip']");
            await expect(tooltip).toBeVisible();
            await expect(tooltip).toContainText("cache");
            await expect(tooltip).toContainText(/% of node/);
        });

        test("the node Status resource indicator shows populated cpu/memory bars (no disk/network)", async () => {
            // With the node patched to a 4-core/8Gi allocatable and KARSE_FAKE_METRICS
            // supplying node-cp usage, the Status page indicator renders real consumed
            // percentages for CPU and memory rather than the unavailable em-dash.
            await page.goto("/nodes/node-cp", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='node-resource-indicator']")).toBeVisible();
            await expect(page.locator("[data-test-id='node-resource-cpu-percent']")).toHaveText(/\d+% used/);
            await expect(page.locator("[data-test-id='node-resource-memory-percent']")).toHaveText(/\d+% used/);
            await expect(page.locator("[data-test-id='node-resource-pods']")).toBeVisible();
            // Disk and network are not shown at all.
            const indicatorText = await page.locator("[data-test-id='node-resource-indicator']").textContent();
            expect(indicatorText ?? "").not.toMatch(/disk/i);
            expect(indicatorText ?? "").not.toMatch(/network/i);
        });
    });

    // ── Performance tabs (pod) ──────────────────────────────────────────────────
    // The backend runs with KARSE_FAKE_METRICS=1 (set in scripts/e2e-tests.sh), so the
    // seeded `web` pod (nginx + sidecar in the default namespace) matches the canned
    // per-container fake metrics by name (summing to ~120m CPU / ~320Mi memory). The pod
    // Performance tab (the leaf) shows two resource sections (CPU and Memory), each with
    // Requested / Limit / Usage-now tiles and a combined usage-vs-request-vs-limit bar (the
    // PodResourcePanel, resource-utilization-11), plus a shared Percentage / Absolute toggle
    // that switches the tile figures between the raw values and a percentage of the pod's own
    // request. There is no "Share of node" subsection (that lives on the Status tab now), no
    // treemap, no Provisioning section, and no disk/network rows.
    test.describe("Performance tabs (pod)", () => {
        test.beforeAll(async () => {
            setContext(CLUSTER_1);
        });

        test("shows the CPU/Memory resource panel with a Percentage/Absolute toggle, no share-of-node", async () => {
            await page.goto("/pods/default/web", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='pod-tab-performance']").click();
            await expect(page.locator("[data-test-id='perf-pod']")).toBeVisible();
            // The lazy query fires once the tab is active; wait for the resource panel.
            await expect(page.locator("[data-test-id='pod-resource-panel']")).toBeVisible();
            // Two resource sections: CPU and Memory, each with the three tiles and a bar.
            await expect(page.locator("[data-test-id='pod-resource-cpu']")).toBeVisible();
            await expect(page.locator("[data-test-id='pod-resource-memory']")).toBeVisible();
            await expect(page.locator("[data-test-id='pod-resource-cpu-bar']")).toBeVisible();
            await expect(page.locator("[data-test-id='pod-resource-memory-bar']")).toBeVisible();
            // Absolute is the default: the tiles read the raw spec/usage figures. `web`
            // requests 150m / limits 700m (from the seeded pod spec) and uses 120m (the fake
            // per-container metrics sum).
            await expect(page.locator("[data-test-id='pod-resource-format']")).toBeVisible();
            await expect(page.locator("[data-test-id='pod-resource-cpu-requested-value']")).toHaveText("150m");
            await expect(page.locator("[data-test-id='pod-resource-cpu-limit-value']")).toHaveText("700m");
            await expect(page.locator("[data-test-id='pod-resource-cpu-usage-value']")).toHaveText("120m");
            // Toggle to Percentage: the same figures now read as a percentage of the pod's
            // own request (request ÷ request = 100%, limit 700/150 = 467%, usage 120/150 = 80%).
            await page.locator("[data-test-id='pod-resource-format-percent']").click();
            await expect(page.locator("[data-test-id='pod-resource-cpu-requested-value']")).toHaveText("100%");
            await expect(page.locator("[data-test-id='pod-resource-cpu-limit-value']")).toHaveText("467%");
            await expect(page.locator("[data-test-id='pod-resource-cpu-usage-value']")).toHaveText("80%");
            // Toggle back to Absolute restores the raw figures.
            await page.locator("[data-test-id='pod-resource-format-absolute']").click();
            await expect(page.locator("[data-test-id='pod-resource-cpu-requested-value']")).toHaveText("150m");
            await expect(page.locator("[data-test-id='pod-resource-cpu-usage-value']")).toHaveText("120m");
            // No "Share of node" subsection on the Performance tab any more.
            await expect(page.getByText("Share of node")).toHaveCount(0);
            await expect(page.locator("[data-test-id='perf-pod-node-share-section']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='pod-node-share']")).toHaveCount(0);
            // No Provisioning section and no treemap.
            await expect(page.locator("[data-test-id='perf-provisioning']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='perf-treemap']")).toHaveCount(0);
        });

        test("metrics-unavailable: the usage tile reads em-dash and the notice is shown, no disk/network", async () => {
            // Force the pod performance endpoint to report no Metrics API: usage is null,
            // so even with a node allocatable base the percentages cannot be computed and
            // read "—". The unavailable notice is shown; disk/network never appear.
            await page.route("**/api/pods/default/web/performance*", async (route) => {
                await route.fulfill({
                    json: {
                        metricsAvailable: false,
                        pod: {
                            name: "web",
                            namespace: "default",
                            node: "node-worker",
                            usage: { cpuMillicores: null, memoryBytes: null },
                            requests: { cpuMillicores: 150, memoryBytes: 201326592 },
                            limits: { cpuMillicores: 700, memoryBytes: 671088640 },
                            containers: [],
                        },
                        containers: [],
                        node: {
                            name: "node-worker",
                            usage: { cpuMillicores: null, memoryBytes: null },
                            allocatable: { cpuMillicores: 4000, memoryBytes: 8 * 1024 * 1024 * 1024 },
                        },
                    },
                });
            });
            await page.goto("/pods/default/web", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='pod-tab-performance']").click();
            await expect(page.locator("[data-test-id='perf-metrics-unavailable']")).toBeVisible();
            // The resource panel still renders: requests/limits come from the spec, so they
            // stay populated while the live usage figure degrades to the em-dash.
            await expect(page.locator("[data-test-id='pod-resource-panel']")).toBeVisible();
            await expect(page.locator("[data-test-id='pod-resource-cpu-requested-value']")).toHaveText("150m");
            await expect(page.locator("[data-test-id='pod-resource-cpu-limit-value']")).toHaveText("700m");
            await expect(page.locator("[data-test-id='pod-resource-cpu-usage-value']")).toHaveText("—");
            // Percentage mode degrades the same way: requests/limits read as a percentage of
            // the request (100% / 467%) while the absent usage stays an em-dash.
            await page.locator("[data-test-id='pod-resource-format-percent']").click();
            await expect(page.locator("[data-test-id='pod-resource-cpu-requested-value']")).toHaveText("100%");
            await expect(page.locator("[data-test-id='pod-resource-cpu-limit-value']")).toHaveText("467%");
            await expect(page.locator("[data-test-id='pod-resource-cpu-usage-value']")).toHaveText("—");
            // No "Share of node" subsection on the Performance tab.
            await expect(page.locator("[data-test-id='pod-node-share']")).toHaveCount(0);
            // The "not reported by the Metrics API" copy must not exist anywhere.
            await expect(page.getByText("Not reported by the Metrics API")).toHaveCount(0);
            await page.unroute("**/api/pods/default/web/performance*");
        });
    });

    // ── Pod Status "Node resources" indicator ───────────────────────────────────
    // The pod Status (Detail) tab carries a "Node resources" panel reusing the same
    // percentage-of-node indicator, so the question "how much of its node is this pod
    // using?" is answered on the default tab without opening Performance.
    test.describe("Pod Status node resources indicator", () => {
        test.beforeAll(async () => {
            setContext(CLUSTER_1);
        });

        test("the Status tab shows the Node resources panel with cpu/memory percentages of the node", async () => {
            await page.goto("/pods/default/web", { waitUntil: "networkidle" });
            // Status is the default tab; the panel is present without any tab click.
            await expect(page.locator("[data-test-id='pod-node-resources']")).toBeVisible();
            await expect(page.locator("[data-test-id='pod-node-share']").first()).toBeVisible();
            await expect(page.locator("[data-test-id='pod-node-share-cpu-percent']")).toHaveText("3%");
            await expect(page.locator("[data-test-id='pod-node-share-memory-percent']")).toHaveText("4%");
            // cpu and memory only — no disk or network rows.
            await expect(page.locator("[data-test-id='pod-node-share-disk']")).toHaveCount(0);
            await expect(page.locator("[data-test-id='pod-node-share-network']")).toHaveCount(0);
        });
    });

    // ── About page ──────────────────────────────────────────────────────────────
    test.describe("about page", () => {
        test.beforeAll(() => {
            setContext(CLUSTER_1);
        });

        test("is reachable from the sidebar nav", async () => {
            await page.goto("/cluster", { waitUntil: "networkidle" });
            await page.locator("[data-test-id='sidebar-bottom-nav'] [aria-label='about']").click();
            await expect(page).toHaveURL(/\/about(\?|$)/);
            await expect(page.locator("[data-test-id='about-page']")).toBeVisible();
        });

        test("explains what Karse is and how it works", async () => {
            await page.goto("/about", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='about-what']")).toContainText("read-only Kubernetes dashboard");
            await expect(page.locator("[data-test-id='about-what']")).toContainText("kubectl");
            await expect(page.locator("[data-test-id='about-how']")).toContainText("read-only cluster queries");
            await expect(page.locator("[data-test-id='about-how']")).toContainText("use-context");
        });

        test("states who made it", async () => {
            await page.goto("/about", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='about-author']")).toContainText("Ashley Davis");
        });

        test("links to the GitHub repo and opens in a new tab", async () => {
            await page.goto("/about", { waitUntil: "networkidle" });
            const link = page.locator("[data-test-id='about-github-link']");
            await expect(link).toHaveAttribute("href", "https://github.com/ashleydavis/karse");
            await expect(link).toHaveAttribute("target", "_blank");
            await expect(link).toHaveAttribute("rel", /noopener/);
        });

        test("shows About in the breadcrumb trail", async () => {
            await page.goto("/about", { waitUntil: "networkidle" });
            await expect(page.locator("[data-test-id='breadcrumb-item']").first()).toHaveText("About");
        });
    });

    // ── Resource utilization (closing coverage) ─────────────────────────────────
    // The final resource-utilization slice (resource-utilization-13) gathers an
    // end-to-end pass over every utilisation surface, in order, against the real
    // KARSE_FAKE_METRICS=1 kwok fixture (set in scripts/e2e-tests.sh): the seeded
    // cluster-1 nodes (node-cp / node-worker patched to 4-core/8Gi, plus the NotReady
    // node-notready) and pods (web/api in default, worker in jobs, cache in infra) match
    // the canned per-container fake metrics by name, so each surface renders populated
    // usage and request figures. Detailed per-surface behaviour lives in the dedicated
    // blocks above; this block is the consolidated walk the closing ticket requires,
    // touching every surface and asserting both its default and a toggled state.
    test.describe("resource utilization", () => {
        test.describe.configure({ mode: "serial" });

        test.beforeAll(() => {
            setContext(CLUSTER_1);
        });

        // 1. Cluster Overview: stat cards + health-signals row + workloads-table toggle.
        test.describe("cluster overview cards, health signals, and workloads table toggle", () => {
            test.beforeAll(async () => {
                setContext(CLUSTER_1);
                await page.goto("/cluster", { waitUntil: "networkidle" });
                // Overview is the default tab; its panel and the stat cards render from the
                // overview snapshot, the rest from the cluster-performance snapshot.
                await expect(page.locator("[data-test-id='cluster-panel-overview']")).toBeVisible();
                await expect(page.locator("[data-test-id='stat-server-version']")).toBeVisible();
            });

            test("renders the five overview stat cards", async () => {
                await expect(page.locator("[data-test-id='stat-tiles'] > div")).toHaveCount(5);
                await expect(page.locator("[data-test-id='stat-nodes']")).toBeVisible();
                await expect(page.locator("[data-test-id='stat-pods']")).toBeVisible();
            });

            test("shows the health-signals row with its five tiles", async () => {
                const signals = page.locator("[data-test-id='cluster-health-signals']");
                await expect(signals).toBeVisible({ timeout: 20000 });
                // The five derived tiles: pending pods, OOMKills, CPU throttling (always
                // N/A from kubectl), node count, and node pressure.
                await expect(page.locator("[data-test-id='health-pending-pods']")).toBeVisible();
                await expect(page.locator("[data-test-id='health-oomkills']")).toBeVisible();
                await expect(page.locator("[data-test-id='health-cpu-throttling']")).toContainText("N/A");
                await expect(page.locator("[data-test-id='health-node-count']")).toBeVisible();
                await expect(page.locator("[data-test-id='health-node-pressure']")).toBeVisible();
            });

            test("shows the node-utilization summary strip", async () => {
                // The strip renders when the snapshot has nodes whose requests/allocatable
                // fall in a band; the seeded 4-core nodes carry pod requests, so it shows.
                await expect(page.locator("[data-test-id='node-summary-strip']")).toBeVisible({ timeout: 20000 });
            });

            test("the workloads table toggles its CPU header between usage and requests", async () => {
                const workloads = page.locator("[data-test-id='workloads-table']");
                await expect(workloads).toBeVisible({ timeout: 20000 });
                const cpuHeader = workloads.locator("thead th").filter({ hasText: "CPU" });
                // Default View mode is Usage, so the column reads "CPU usage".
                await expect(cpuHeader).toContainText("usage");
                // The workloads section owns its own View-mode/Value-format toggles (each
                // utilisation table wraps its own provider). It is the last util-view-mode on
                // the Overview tab, after the utilisation panel's own toggle. Switching it to
                // Requests re-labels this table's CPU column to "CPU requests".
                const workloadsToggle = page.locator("[data-test-id='util-view-mode']").last();
                await workloadsToggle.locator("[data-test-id='util-view-mode-requests']").click();
                await expect(cpuHeader).toContainText("requests");
                // Restore Usage so the default state is left clean.
                await workloadsToggle.locator("[data-test-id='util-view-mode-usage']").click();
                await expect(cpuHeader).toContainText("usage");
            });
        });

        // 2. Cluster Performance tab: the node treemap with a long node-name leaf that is
        // middle-truncated. The seeded cluster has no long-named node (other blocks assert
        // node counts), so the /api/cluster/performance snapshot is mocked with a long node
        // — the same fixture shape resource-utilization-5 introduced.
        test.describe("performance tab treemap truncated label", () => {
            const LONG_NODE = "node-with-a-very-long-hostname-worker-01";
            const PERFORMANCE = {
                metricsAvailable: true,
                nodes: [
                    { name: LONG_NODE, usage: { cpuMillicores: 1200, memoryBytes: 3_000_000_000 }, requests: { cpuMillicores: 1000, memoryBytes: 2_000_000_000 }, allocatable: { cpuMillicores: 4000, memoryBytes: 8_000_000_000 } },
                    { name: "node-worker", usage: { cpuMillicores: 800, memoryBytes: 2_000_000_000 }, requests: { cpuMillicores: 600, memoryBytes: 1_000_000_000 }, allocatable: { cpuMillicores: 4000, memoryBytes: 8_000_000_000 } },
                ],
                pods: [],
                totals: {
                    usage: { cpuMillicores: 2000, memoryBytes: 5_000_000_000 },
                    requests: { cpuMillicores: 1600, memoryBytes: 3_000_000_000 },
                    allocatable: { cpuMillicores: 8000, memoryBytes: 16_000_000_000 },
                },
                health: {
                    pendingPods: 0,
                    oomKillCount: 0,
                    nodeCount: 2,
                    nodePressure: { memoryPressure: 0, diskPressure: 0, pidPressure: 0 },
                    cpuThrottlingAvailable: false,
                },
                workloads: [],
            };

            test.beforeAll(async () => {
                setContext(CLUSTER_1);
                await page.route("**/api/cluster/performance*", async (route) => {
                    await route.fulfill({ json: PERFORMANCE });
                });
                await page.goto("/cluster", { waitUntil: "networkidle" });
                await page.locator("[data-test-id='cluster-tab-performance']").click();
                await expect(page.locator("[data-test-id='perf-treemap']")).toBeVisible();
            });

            test.afterAll(async () => {
                await page.unroute("**/api/cluster/performance*");
            });

            test("middle-truncates the long node leaf label and shows the full name on hover", async () => {
                const labels = await page.locator("[data-test-id='perf-treemap'] text").allTextContents();
                const joined = labels.join(" ");
                // truncateMiddle(LONG_NODE, 14) keeps 7 start + "..." + 7 end chars.
                expect(joined).toContain("node-wi...rker-01");
                expect(joined).not.toContain(LONG_NODE);
                // The hover tooltip shows the full untruncated name.
                await page
                    .locator("[data-test-id='perf-treemap'] text")
                    .filter({ hasText: /node-wi\.\.\.rker-01/ })
                    .first()
                    .hover({ force: true });
                const tooltip = page.locator("[data-test-id='perf-treemap-tooltip']");
                await expect(tooltip).toBeVisible();
                await expect(tooltip).toContainText(LONG_NODE);
            });
        });

        // 3. Nodes list page: the summary strip (stats chips) plus the CPU/Memory resource
        // bar columns, driven by the shared View-mode/Value-format toggles.
        test.describe("nodes summary strip and bar columns", () => {
            test.beforeAll(async () => {
                setContext(CLUSTER_1);
                await page.goto("/nodes", { waitUntil: "networkidle" });
                await expect(page.locator("[data-test-id='node-row']").first()).toBeVisible();
            });

            test("shows the nodes summary strip and populated CPU/Memory bar columns", async () => {
                // The summary strip (total / healthy / error chips) tops the page.
                await expect(page.locator("[data-test-id='nodes-stats']")).toBeVisible();
                await expect(page.locator("[data-test-id='nodes-stats-total']")).toBeVisible();
                // The resource columns are fed by the cluster-performance query, which settles
                // independently of networkidle, so wait for a real bar to render.
                await expect(page.locator("[data-test-id='node-cpu-bar']").first()).toBeVisible({ timeout: 20000 });
                await expect(page.locator("[data-test-id='node-memory-bar']").first()).toBeVisible({ timeout: 20000 });
                // A ready node's CPU cell reads a percentage of its allocatable.
                await expect(page.locator("[data-test-id='node-cpu-value']").first()).toHaveText(/\d+%|—/, { timeout: 20000 });
            });

            test("the View-mode/Value-format toggle switches the bar values to absolute", async () => {
                await expect(page.locator("[data-test-id='util-view-mode']")).toBeVisible();
                // Absolute format switches the CPU column away from a bare percentage to a
                // cores figure (e.g. "0.3 / 4 vCPU"); assert it no longer reads "<n>%".
                await page.locator("[data-test-id='util-value-format-absolute']").click();
                await expect(page.locator("[data-test-id='node-cpu-value']").first()).not.toHaveText(/^\d+%$/, { timeout: 20000 });
                // Restore the percentage default.
                await page.locator("[data-test-id='util-value-format-percent']").click();
            });
        });

        // 4. Node detail Performance tab: the CPU/Memory utilization cards, plus the Pods
        // sub-tab's per-pod CPU/Memory bars. node-cp carries fake usage and a 4-core/8Gi
        // allocatable, so both render populated.
        test.describe("node detail utilization cards and pods bars", () => {
            test.beforeAll(async () => {
                setContext(CLUSTER_1);
            });

            test("the Performance tab shows the CPU/Memory utilization cards", async () => {
                await page.goto("/nodes/node-cp", { waitUntil: "networkidle" });
                await page.locator("[data-test-id='node-tab-performance']").click();
                await expect(page.locator("[data-test-id='node-utilization-cards']")).toBeVisible({ timeout: 20000 });
                await expect(page.locator("[data-test-id='node-util-card-cpu']")).toBeVisible();
                await expect(page.locator("[data-test-id='node-util-card-memory']")).toBeVisible();
                // Default Usage + % shows a percentage figure on the CPU card.
                await expect(page.locator("[data-test-id='node-util-card-cpu']")).toContainText("%");
            });

            test("the Pods sub-tab shows per-pod CPU/Memory bars", async () => {
                await page.goto("/nodes/node-cp", { waitUntil: "networkidle" });
                await page.locator("[data-test-id='node-tab-pods']").click();
                await expect(page.locator("[data-test-id='node-panel-pods']")).toBeVisible();
                await expect(page.locator("[data-test-id='node-pod-row']").first()).toBeVisible({ timeout: 20000 });
                await expect(page.locator("[data-test-id='node-pod-cpu-value']").first()).toContainText("%", { timeout: 20000 });
                await expect(page.locator("[data-test-id='node-pod-memory-value']").first()).toBeVisible();
            });
        });

        // 5. Pods list page: the per-pod CPU/Memory resource bars, each a percentage of the
        // pod's own request, driven by the same shared toggles.
        test.describe("pods table bars", () => {
            test.beforeAll(async () => {
                setContext(CLUSTER_1);
                await page.goto("/pods", { waitUntil: "networkidle" });
                await expect(page.locator("[data-test-id='pod-row']").first()).toBeVisible();
            });

            test("renders populated CPU/Memory bars on each pod row", async () => {
                // The resource columns load from the cluster-performance query, separate from
                // the pods list, so wait for a real bar rather than the transient em-dash.
                await expect(page.locator("[data-test-id='pod-cpu-bar']").first()).toBeVisible({ timeout: 20000 });
                await expect(page.locator("[data-test-id='pod-memory-bar']").first()).toBeVisible({ timeout: 20000 });
                await expect(page.locator("[data-test-id='pod-cpu-value']").first()).toHaveText(/\d+%|—/, { timeout: 20000 });
            });

            test("toggling to Requests then Absolute switches the bars off a bare percentage", async () => {
                await page.locator("[data-test-id='util-view-mode-requests']").click();
                await page.locator("[data-test-id='util-value-format-absolute']").click();
                // In Requests + Absolute the CPU cell reads the request quantity (cores/millicores),
                // not a "<n>%" figure.
                await expect(page.locator("[data-test-id='pod-cpu-value']").first()).not.toHaveText(/^\d+%$/, { timeout: 20000 });
                // Restore the Usage + % defaults.
                await page.locator("[data-test-id='util-view-mode-usage']").click();
                await page.locator("[data-test-id='util-value-format-percent']").click();
            });
        });
    });
});
