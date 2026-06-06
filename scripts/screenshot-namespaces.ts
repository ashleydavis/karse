// Drives a headless browser to the namespaces page and saves a screenshot.
// Expects the full stack already running. Reads:
//   KARSE_E2E_URL - frontend base URL
//   CTX           - kubectl context name to scope the view to
//   SHOT_OUT      - output path for the PNG
import { chromium } from "@playwright/test";

// Captures the namespaces page (including the Resources column) to SHOT_OUT.
async function main(): Promise<void> {
    const baseUrl = process.env.KARSE_E2E_URL ?? "http://localhost:5173";
    const ctx = process.env.CTX ?? "";
    const out = process.env.SHOT_OUT;
    if (out === undefined) {
        throw new Error("SHOT_OUT must be set");
    }

    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.setViewportSize({
        width: 1280,
        height: 800,
    });

    // Pass the context explicitly in the URL so the view is scoped deterministically.
    const url = ctx === ""
        ? `${baseUrl}/namespaces`
        : `${baseUrl}/namespaces?context=${encodeURIComponent(ctx)}`;
    await page.goto(url, {
        waitUntil: "networkidle",
    });
    await page.locator("[data-test-id='namespace-row']").first().waitFor();
    await page.locator("[data-test-id='namespace-resource-count']").first().waitFor();
    await page.screenshot({
        path: out,
        fullPage: true,
    });
    await browser.close();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
