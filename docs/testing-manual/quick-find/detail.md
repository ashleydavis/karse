# quick-find manual tests

Manual tests for the header pickers: the named context dropdown and the namespace quick-picker. See the spec: [quick-find](../../spec/quick-find/detail.md).

The spec notes a global cross-kind quick-find is not yet shipped; these tests cover the shipped header context and namespace pickers.

Start the app first. From the repo root run:

```sh
bun run dev
```

Then open the frontend at `http://127.0.0.1:5173`. The scenario's fixture stands up a KWOK cluster; select the `kwok-karse-test` context in Karse. Tear each cluster down with the Teardown step at the end of this doc.

## Scenario: Nav-bar dropdown pickers

Two KWOK clusters run simultaneously so the context picker has more than one entry. Cluster 1 (`kwok-karse-test-1`) has three extra namespaces (`team-alpha`, `team-beta`, and `a-very-long-namespace-name-for-truncation`) so the namespace picker has rows to filter and select and the trigger's truncation can be checked.

**Fixture:** [_fixtures-kwok/24-navbar-dropdown-pickers](../_fixtures-kwok/24-navbar-dropdown-pickers/)

```sh
./docs/testing-manual/_fixtures-kwok/24-navbar-dropdown-pickers/setup.sh
```

### What to check
- **There is only one context control**: the header shows a single context control, the dropdown labelled with the active context's name. There is no separate link-icon quick-picker button beside it.
- **Context picker drops down from the nav bar** (the named dropdown or Ctrl+K): clicking the dropdown opens a popover anchored directly below it, not a centered modal dialog. There is no full-screen modal backdrop dimming the whole page.
- **Context picker search**: type into the search box and confirm non-matching contexts are hidden. Search by cluster name as well as context name: both narrow the list. The active context shows an `active` chip.
- **Context picker environment subheadings**: the rows sit under one subheading per environment. Type a query matching contexts in only one environment and confirm the other environments' subheadings disappear along with their rows.
- **The subheadings are environment badges**: each subheading is the environment's chip in the environment's colour, the same badge the top bar shows beside the dropdown, not plain heading text. Open the dropdown and compare a subheading with the badge in the nav bar: same component, same colour, same wording. Check it in light and dark mode.
- **Context picker search resets on open**: type a query that narrows the list, close the dropdown, then reopen it. The search box is empty and the full list is back.
- **Selecting a context**: click a context row. The dropdown closes, the dropdown's own label becomes the chosen context, and the cluster data updates to that cluster.
- **Namespace picker drops down from the nav bar** (the labelled namespace button or Ctrl+Shift+K): clicking the button opens a popover anchored below it, again not a centered modal.
- **Namespace picker rows**: confirm `All namespaces` plus the cluster namespaces (`default`, `team-alpha`, `team-beta`, `kube-system`, etc.) appear. Filtering by `team` should narrow to `team-alpha` and `team-beta`.
- **Namespace trigger names the scope**: with no namespace selected the trigger reads `All namespaces`; it is the only place in the header the namespace is named (there is no separate chip beside the breadcrumbs).
- **Selecting a namespace**: click a namespace row. The dropdown closes and the trigger's label becomes the chosen namespace. Reopening the picker highlights the selected namespace.
- **All namespaces**: clicking `All namespaces` clears the selection and the trigger reverts to reading `All namespaces`.
- **Long namespace name**: select `a-very-long-namespace-name-for-truncation`. The trigger ellipsises it rather than growing, and the rest of the header's buttons stay where they were.
- **Keyboard shortcuts**: Ctrl+K opens the context dropdown, Ctrl+Shift+K opens the namespace dropdown, and Escape closes either.
- **Click-away closes the picker**: clicking outside the open dropdown closes it.
- **Arrow points at the trigger**: each open dropdown shows a small arrow (the built-in MUI Tooltip arrow) between the trigger button and the dropdown body, visually pointing back up at the button that opened it. No hand-rolled CSS beak.
- **Hover hint on each trigger**: rest the pointer on the named context dropdown and confirm the browser shows the hint `Context picker (Ctrl+K)`; rest it on the labelled namespace button and confirm it shows `Namespace picker (Ctrl+Shift+K)`.
- **Console stays clean**: open the browser devtools console before loading the page, then load any page and open and close both pickers (by click and by keyboard shortcut). The console must show no "MUI: You have provided a title prop to the child of Tooltip" errors, and no other new errors or warnings. The pickers render their dropdown inside a MUI Tooltip, so a trigger button carrying its own `title` makes MUI log that error on every render of the header.
- **Border visible in both modes**: the dropdown panel (and its arrow) has a clear border so its edges stay visible in dark mode, where the panel shares the nav bar's background colour. Switch the app to dark mode, open each picker, and confirm the panel edges and arrow are clearly visible against the nav bar behind them.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/24-navbar-dropdown-pickers/teardown.sh
```
