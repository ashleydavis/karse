# Scripts

Shell scripts for automated testing.

| Script | Purpose |
|--------|---------|
| `smoke-tests.sh` | Spins up a KWOK cluster, starts the backend, and runs a suite of curl-based API checks. Requires `kwokctl`, `kubectl`, `bun`, `curl`, and `jq`. |
| `e2e-tests.sh` | Runs the Playwright end-to-end test suite against a live stack. |
