// Decides whether the Vite dev server should open a browser on launch, and (when
// it should) which browser to spawn. Kept in its own module, separate from
// vite.config.ts, so the smoke harness can import and assert on the decision
// without pulling in Vite's plugins or launching a server.
//
// KARSE_NO_OPEN=1 suppresses opening entirely. Every non-interactive launch the
// project drives (the smoke harness, the e2e runner, any screenshot-capture run)
// sets it, so no Chrome window appears. A plain interactive `bun run dev` /
// `bun start` leaves it unset and a window opens as normal.

import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";

// Find a Chrome binary on PATH, preferring `google-chrome` then
// `google-chrome-stable`. Returns the binary name Vite's open feature should use
// as BROWSER, or undefined when none is installed (Vite then falls back to the
// OS default browser).
export function findChrome(env: NodeJS.ProcessEnv = process.env): string | undefined {
    const dirs = (env.PATH ?? "").split(delimiter).filter(Boolean);
    for (const name of ["google-chrome", "google-chrome-stable"]) {
        for (const dir of dirs) {
            if (existsSync(join(dir, name))) {
                return name;
            }
        }
    }
    return undefined;
}

// Whether the dev server should open a browser. False only when KARSE_NO_OPEN=1,
// which every automated launch sets so it never opens a Chrome window.
export function shouldOpenBrowser(env: NodeJS.ProcessEnv = process.env): boolean {
    return env.KARSE_NO_OPEN !== "1";
}
