# End-to-end tests

Playwright tests that run against a live Karse stack. See `scripts/e2e-tests.sh` for the automated runner, or `docs/e2e-testing.md` for the manual walkthrough.

Arguments given to the runner are passed straight through to `playwright test`, so `bun run e2e -- --grep "<test title>"` runs a single test. `KARSE_E2E_CPU_THROTTLE=<n>` slows the browser's renderer by a factor of `n` so timing failures that only happen on a loaded CI runner can be reproduced locally. Both are described in `docs/development.md` under "Running one e2e test, and slowing the browser down".
