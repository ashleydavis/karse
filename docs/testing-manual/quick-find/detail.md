# quick-find manual tests

Manual tests for the header quick-pickers. See the spec: [quick-find](../../spec/quick-find/detail.md).

The spec notes a global cross-kind quick-find is not yet shipped; these tests cover the shipped header context and namespace pickers.

Start the app first: run `bun run dev` from the repo root and open the frontend at `http://127.0.0.1:5173`. The scenario's fixture stands up a KWOK cluster; select the `kwok-karse-test` context in Karse and run the matching `teardown.sh` when done.

## Scenario: Nav-bar dropdown pickers

Two KWOK clusters run simultaneously so the context picker has more than one entry. Cluster 1 (`kwok-karse-test-1`) has two extra namespaces (`team-alpha`, `team-beta`) so the namespace picker has rows to filter and select.

**Fixture:** [_fixtures-kwok/24-navbar-dropdown-pickers](../_fixtures-kwok/24-navbar-dropdown-pickers/)

```sh
./docs/testing-manual/_fixtures-kwok/24-navbar-dropdown-pickers/setup.sh
```

### What to check
- **Context picker drops down from the nav bar** (link icon or Ctrl+K): clicking the link icon in the header opens a popover anchored directly below the button, not a centered modal dialog. There is no full-screen modal backdrop dimming the whole page.
- **Context picker search**: type into the search box and confirm non-matching contexts are hidden. The active context shows an `active` chip.
- **Selecting a context**: click a context row. The dropdown closes and the header context display and cluster data update to the chosen cluster.
- **Namespace picker drops down from the nav bar** (layer-group icon or Ctrl+Shift+K): clicking the layer-group icon opens a popover anchored below the button, again not a centered modal.
- **Namespace picker rows**: confirm `All namespaces` plus the cluster namespaces (`default`, `team-alpha`, `team-beta`, `kube-system`, etc.) appear. Filtering by `team` should narrow to `team-alpha` and `team-beta`.
- **Selecting a namespace**: click a namespace row. The dropdown closes and the header namespace chip updates. Reopening the picker highlights the selected namespace.
- **All namespaces**: clicking `All namespaces` clears the selection and removes the header namespace chip.
- **Keyboard shortcuts**: Ctrl+K opens the context dropdown, Ctrl+Shift+K opens the namespace dropdown, and Escape closes either.
- **Click-away closes the picker**: clicking outside the open dropdown closes it.
- **Arrow points at the trigger**: each open dropdown shows a small arrow (the built-in MUI Tooltip arrow) between the trigger button and the dropdown body, visually pointing back up at the button that opened it. No hand-rolled CSS beak.
- **Border visible in both modes**: the dropdown panel (and its arrow) has a clear border so its edges stay visible in dark mode, where the panel shares the nav bar's background colour. Switch the app to dark mode, open each picker, and confirm the panel edges and arrow are clearly visible against the nav bar behind them.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/24-navbar-dropdown-pickers/teardown.sh
```
