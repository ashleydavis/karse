# Parallel e2e instability: root cause and fixes

Notes for re-applying the fixes after reverting the working tree. Proven by the stability ladder (`scripts/parallel-e2e/ladder.sh`) running 20-parallel x 10 iterations (200 e2e runs) to exit code 0.

## The root cause (the one parallel-concurrency bug)

etcd peer-port collision between concurrent kwok clusters. The harness reserves a unique host port for five of each cluster's components, but kwok has no flag for etcd's *peer* port: it auto-picks it, scanning down from 32767, with no cross-process coordination and a gap between "find free port" and "bind it". Under parallelism several `kwokctl` processes pick the same top-of-range peer port, one etcd dies with `creating peer listener failed: bind: address already in use`, its apiserver then can't reach etcd (`connection refused` then `Error creating leases: context deadline exceeded`), the cluster never becomes ready, and the run fails. This is what killed the original ladder at rung 20. Observed colliding ports all sat in 32745-32766 (kwok's top-of-range picks).

### Minimal fix (this is THE fix for the concurrency failure)

`scripts/kwok-lib.sh`, inside `create_cluster`, add one reserved port for etcd's peer listen URL to the `kwokctl create cluster` call:

```
--extra-args=etcd=listen-peer-urls=http://0.0.0.0:"$(reserve_port)" \
```

Only `listen-peer-urls` actually binds, so overriding just it removes the collision; the advertise/initial-cluster metadata keep kwok's auto value but bind nothing, and a single-node etcd still forms. Use exactly one etcd extra-arg: kwok panics (`index out of range`) when several components each carry multiple `--extra-args`, so the three-flag version breaks alongside cluster 1's existing `kwok-controller` extra-args. Verified: after the fix, zero `address already in use` and zero "not ready" across rungs 10/20/40.

## Secondary issues (needed for a green ladder, but NOT the parallel root cause)

These were latent and only surfaced once the etcd fix let the ladder climb past rung 20. Two are real bugs; the rest are test/harness robustness.

1. Nodes-table stale usage cache (real product bug). `frontend/src/pages/nodes/components/nodes-table.tsx`. TanStack Table memoises its row model and per-cell value cache on the data reference alone, not on columns. The CPU/Memory accessors close over `usageMap`, so when the cluster Performance snapshot arrives after the nodes list, the cached em-dash is never recomputed and the columns show `-` forever. Fix: pass a fresh array so TanStack rebuilds the row model when usage changes: `data: [...(data?.nodes ?? [])]` instead of `data: data?.nodes ?? []`.

2. Shared `e2e/test-results` directory race (main-mode harness). In main mode all parallel runs share `e2e/test-results`; Playwright clears and recreates it (and its `.playwright-artifacts-*` temp dirs) at startup, so concurrent runs race and one ENOENTs mid-mkdir. Fix: per-run output directory.
   - `e2e/playwright.config.ts`: `outputDir: process.env.KARSE_E2E_OUTPUT_DIR ?? "test-results"`.
   - `scripts/e2e-tests.sh`: set `KARSE_E2E_OUTPUT_DIR="$KARSE_KWOK_STATE_DIR/e2e-$RUN_ID.test-results"` and `export` it (near the other per-run paths), and add it to the `rm -rf` line in `cleanup`.

3. Age-column test fixture is time-dependent. `e2e/src/e2e.test.ts`, errors-page `FAKE_ERRORS`. `lastSeen: new Date()` made the rendered Age grow with how long the suite took to reach that test; once it read "4m" the "search matches a term only in the Count column" test matched both rows via the Age cell instead of only the count-4 row. Fix: pin `lastSeen` to a fixed 2-hours-ago offset so Age renders a stable "2h" (no digit the Count searches use): `const TWO_HOURS_AGO = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();` and use it for both rows' `lastSeen`.

4. Namespace `waitForRequest` races. `e2e/src/e2e.test.ts`, the pods-page and events-page "sends namespace query param" tests. A bare `waitForRequest("**/api/pods*" / "**/api/events*")` captures the first matching request; selecting the namespace can briefly re-issue the unfiltered request first (more under load), so it reads `namespace=null`. Fix: wait for the request that actually carries the param, e.g. `page.waitForRequest((req) => req.url().includes("/api/pods") && new URL(req.url()).searchParams.get("namespace") === "default")` (and the same for `/api/events`).

5. dnd-kit drag helpers flake under load. `e2e/src/e2e.test.ts`, `dragColumnOnto` and `dragColumnToSectionEnd`. Under heavy CPU load the PointerSensor's pointerdown handler attaches late, so the first pointer moves are missed and the drag never starts (the row never reorders). Fix: `await page.waitForTimeout(250)` right after `mouse.down()`; a small `waitForTimeout(20)` between step moves; and make the re-aim loop more patient (8 iterations, `waitForTimeout(120)` instead of 3 / 60).

6. Generous Playwright timeouts for the contended environment. `e2e/playwright.config.ts`: `timeout: 120000`, `expect.timeout: 30000`, `actionTimeout: 30000`, `navigationTimeout: 60000`. The default 5s expect / 10s action windows expire under CPU starvation at high fan-out.

## Ladder design change (separate from the fixes)

`scripts/parallel-e2e/ladder.sh` was changed from escalating rungs (10 20 40 80 160) to a fixed batch repeated N times: default 20-parallel x 10 iterations, args `ladder.sh <parallel> <iterations>`, exit 1 at the first batch that is not 100%, exit 0 if all pass. Reason: the escalating top rungs are bounded by host RAM on this 62 GB machine (rung 40 already peaks ~59 GB; rung 160 needs ~160-216 GB), so they fail on resources, not on any bug. Repeating a host-feasible batch is the better stability proof.

## Priority for re-application

- Must-have (the root cause): item under "Minimal fix" (kwok-lib.sh).
- Real bug worth keeping: secondary item 1 (nodes-table).
- Needed for the ladder to reach exit 0 at 20-parallel: secondary items 2-6.
