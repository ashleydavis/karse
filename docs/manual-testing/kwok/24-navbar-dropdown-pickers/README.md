# Scenario 24: Nav-bar dropdown pickers

The context picker and namespace picker open as dropdowns anchored to their header buttons rather than as centered modal dialogs. This scenario verifies the dropdown placement, search/filter, selection, and keyboard shortcuts.

Two KWOK clusters run simultaneously so the context picker has more than one entry. Cluster 1 (`kwok-karse-test-1`) has two extra namespaces (`team-alpha`, `team-beta`) so the namespace picker has rows to filter and select.

## Prerequisites

- `kwokctl` and `kubectl` on `PATH`.
- Karse running locally: `bun run dev:test` from the repo root.

## Setup

```sh
./docs/manual-testing/kwok/24-navbar-dropdown-pickers/setup.sh
```

## What to check

- **Context picker drops down from the nav bar** (link icon or Ctrl+K): clicking the link icon in the header opens a popover anchored directly below the button, not a centered modal dialog. There is no full-screen modal backdrop dimming the whole page.
- **Context picker search**: type into the search box and confirm non-matching contexts are hidden. The active context shows an `active` chip.
- **Selecting a context**: click a context row. The dropdown closes and the header context display and cluster data update to the chosen cluster.
- **Namespace picker drops down from the nav bar** (layer-group icon or Ctrl+Shift+K): clicking the layer-group icon opens a popover anchored below the button, again not a centered modal.
- **Namespace picker rows**: confirm `All namespaces` plus the cluster namespaces (`default`, `team-alpha`, `team-beta`, `kube-system`, etc.) appear. Filtering by `team` should narrow to `team-alpha` and `team-beta`.
- **Selecting a namespace**: click a namespace row. The dropdown closes and the header namespace chip updates. Reopening the picker highlights the selected namespace.
- **All namespaces**: clicking `All namespaces` clears the selection and removes the header namespace chip.
- **Keyboard shortcuts**: Ctrl+K opens the context dropdown, Ctrl+Shift+K opens the namespace dropdown, and Escape closes either.
- **Click-away closes the picker**: clicking outside the open dropdown closes it.

## Teardown

```sh
./docs/manual-testing/kwok/24-navbar-dropdown-pickers/teardown.sh
```
