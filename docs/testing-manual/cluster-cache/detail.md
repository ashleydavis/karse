# cluster-cache manual tests

Manual tests for the on-disk cluster-data cache. See the spec: [cluster-cache](../../spec/cluster-cache/detail.md).

Karse caches each successful read-only `kubectl` query on disk as a date-stamped JSON file under `cache/` (overridable via `KARSE_CACHE_DIR`), serves it while fresh, and re-fetches when it is older than the configured staleness threshold. The Config page sets the threshold; the navbar refresh button empties the cache.

Start the app first. From the repo root run:

```sh
bun run dev
```

Then open the frontend at `http://127.0.0.1:5173`. Then run the fixture's `setup.sh` and test each scenario. Tear the cluster down with the Teardown step at the end.

## Scenario: Reads are cached as date-stamped JSON files

**Fixture:** [_fixtures-kwok/01-empty-cluster-two-nodes](../_fixtures-kwok/01-empty-cluster-two-nodes/).

```sh
./docs/testing-manual/_fixtures-kwok/01-empty-cluster-two-nodes/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically. Select it in Karse.

### What to check
- Navigate around Karse (cluster overview, nodes, pods). Confirm a `cache/` directory appears at the repo root.
- Confirm it contains `*.json` files (one per distinct query) plus a `config.json`.
- Open one of the query JSON files and confirm it carries a `savedAt` stamp (a local-ISO timestamp with offset), the `args` of the kubectl call, and the captured `result`.

## Scenario: Fresh data is served from the cache; stale data is re-fetched

### What to check
- On the Config page (`/config`), set the **Staleness threshold** to a large value (e.g. `300` seconds) and Save.
- Open `logs/` (the audit log) and note the current entries, then navigate to Nodes. Re-visit Nodes again within the threshold and confirm **no new** `kubectl get nodes` line is added to the audit log — the second view was served from the cache.
- Now set the threshold to a small value (e.g. `2` seconds) and Save. Visit Nodes, wait a few seconds, and visit Nodes again. Confirm a **new** `kubectl get nodes` audit line appears — the stale entry was re-fetched.
- Set the threshold to `0` and Save. Confirm every Nodes visit produces a fresh audit line (the cache is disabled).

## Scenario: The Config page persists the threshold

### What to check
- On `/config`, change the threshold, Save, and confirm the "Saved." confirmation appears.
- Reload the page (or navigate away and back) and confirm the field shows the saved value — it is persisted server-side, not just in the browser.
- Enter a negative value and confirm the Save button is disabled and the field shows a validation error.

## Scenario: The navbar refresh button empties the cache

### What to check
- With a large threshold set, navigate around so several `cache/*.json` query files exist.
- Click the refresh (circular arrows) button in the navbar.
- Confirm the query JSON files under `cache/` are deleted (only `config.json` remains), and that the current view immediately re-fetches fresh data (a new audit line appears for the visible page's query).
- Confirm the saved staleness threshold on the Config page is unchanged — refresh empties entries but keeps the configuration.

## Scenario: Read-only cross-check

### What to check
- Inspect the cached JSON files: every `args` array is a read (`get`, `version`, `config view`, `config current-context`); none is a cluster-mutating verb. See [read-only-invariant](../read-only-invariant/detail.md).

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/01-empty-cluster-two-nodes/teardown.sh
```
