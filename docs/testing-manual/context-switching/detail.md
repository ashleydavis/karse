# context-switching manual tests

Manual tests for context listing and switching. See the spec: [context-switching](../../spec/context-switching/detail.md).

The dropdown-picker placement and keyboard shortcuts for the context picker are covered under [quick-find](../quick-find/detail.md). Run the matching `teardown.sh` when done.

Start the app first. From the repo root run:

```sh
bun run dev
```

Then open the frontend at `http://127.0.0.1:5173`. (Scenario A below needs a custom kubeconfig, so it overrides this with its own start command.)

## Scenario A: No contexts

A kubeconfig with no clusters or contexts configured.

**Fixture:** [_fixtures-kwok/12-no-contexts](../_fixtures-kwok/12-no-contexts/)

```sh
./docs/testing-manual/_fixtures-kwok/12-no-contexts/setup.sh
```

The script writes an empty kubeconfig to `/tmp/karse-no-contexts.yaml` and prints the command to start Karse with it:

```sh
KUBECONFIG=/tmp/karse-no-contexts.yaml bun run dev:test
```

### What to check
- **Header dropdown**: shows "no context" chip with nothing selectable.
- **Contexts page** (`/contexts`): table is empty.
- **Context quick picker** (link icon or Ctrl+K): "No contexts match" message.
- **Cluster home page**: shows the "Select a context to see cluster overview." message.
- **Nodes page**: does not fire a request (no `/api/cluster/nodes` call in the network panel).
- **Pods page**: does not fire a request.

## Scenario B: Two contexts

Two KWOK clusters running simultaneously. Cluster 1 (`kwok-karse-test-1`) has 2 nodes; cluster 2 (`kwok-karse-test-2`) has 1 node, so the values are visibly distinct after a switch.

**Fixture:** [_fixtures-kwok/13-two-contexts](../_fixtures-kwok/13-two-contexts/)

```sh
./docs/testing-manual/_fixtures-kwok/13-two-contexts/setup.sh
```

### What to check
- **Contexts page** (`/contexts`): both `kwok-karse-test-1` and `kwok-karse-test-2` appear as rows with `active` and `default` chips on the current context.
- **Context quick picker** (link icon or Ctrl+K): both contexts listed and searchable.
- **Switch to cluster 2 via Contexts page**: click "Set as active" on `kwok-karse-test-2`. Confirm the `active` chip moves. Navigate to Nodes — count shows `1`, table shows `fake-node-a` only.
- **Switch via header dropdown**: use the dropdown to switch back to cluster 1. Node count returns to `2`, nodes table shows `fake-node-1` and `fake-node-2`.
- **Set as default**: on the Contexts page, click "Set as default" on cluster 2. Confirm the `default` chip moves and `kubectl config current-context` returns `kwok-karse-test-2` in your terminal.
- **active vs default divergence**: set cluster 1 as active in the tab but keep cluster 2 as default. Confirm the UI shows cluster 1 data while `kubectl` still uses cluster 2.

## Scenario C: Many contexts

Five KWOK clusters running simultaneously.

**Fixture:** [_fixtures-kwok/14-many-contexts](../_fixtures-kwok/14-many-contexts/) (takes a moment; starts five clusters in sequence)

```sh
./docs/testing-manual/_fixtures-kwok/14-many-contexts/setup.sh
```

### What to check
- **Contexts page** (`/contexts`): all five `kwok-karse-test-N` contexts appear as rows (plus any pre-existing contexts).
- **Context quick picker** (link icon or Ctrl+K): all five contexts listed. Type a partial name to filter and confirm only matching rows appear.
- **Switching**: use the quick picker or Contexts page to select each context in turn. Confirm the overview tiles and nodes table update to show that cluster's data.
- **Sidebar collapsed**: collapse the sidebar to icon-only mode using the chevron at the bottom. Confirm navigation still works via icon tooltips.
- **active vs default**: switch active context in the tab to `kwok-karse-test-3` while keeping the terminal default on `kwok-karse-test-1`. Confirm the `active` and `default` chips are on different rows.
