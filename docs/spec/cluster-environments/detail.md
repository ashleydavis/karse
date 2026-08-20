# cluster-environments

## Overview

A kubeconfig with many contexts is a flat list in which nothing tells production apart from development at a glance. Karse gives every context an **environment** and groups every surface that lists contexts by it, so the production clusters sit together at the top and the current view's environment is visible in the header.

The environment list is **the user's**. It is an ordered list of rows, each a name, a regular expression matched against the context name, and a chip colour, edited on the Config page's Environments subtab. Karse ships a default list, but nothing is hard-coded behind it: a default row can be renamed, re-matched, moved, or deleted like any other. An environment is either **matched** by its expression or **labelled** by hand on a context. A label always wins, and both the list and the labels persist.

Backed by: `frontend/src/lib/cluster-environments.ts` (the resolver: the list, the compilation, the precedence, the grouping, the validation), `frontend/src/components/environment-chip.tsx` (the shared chip), `frontend/src/lib/config.tsx` (the persisted list and labels), `frontend/src/pages/config/index.tsx` plus `frontend/src/pages/config/components/environments-settings.tsx` (the editor), `frontend/src/pages/contexts/components/contexts-table.tsx` (the grouped table and the labelling control), `frontend/src/components/context-picker.tsx` plus `frontend/src/lib/context-picker-rows.ts` (the header dropdown, its search, and the active-context chip).

This is a frontend-only concern. No backend route changes, no new kubectl call, and nothing is ever written to the kubeconfig: consistent with [read-only-invariant](../read-only-invariant/detail.md), resolving an environment is a display and grouping decision made in the browser.

## The environment list

An environment is a row of four fields:

| Field | Meaning |
|---|---|
| id | Stable identifier, derived from the name when the environment is created and never changed afterwards. It is what a per-context label refers to, so renaming an environment keeps its labels. |
| name | The heading and chip text. |
| pattern | A JavaScript regular expression **source string**, matched case-insensitively against the whole context name. Stored as the string the user typed, because local storage cannot hold a compiled `RegExp`. |
| color | The MUI chip colour: `error`, `warning`, `info`, `secondary`, `success` or `default`. The user picks it when adding an environment and can change it on any row. |

**Unassigned is not a row.** It is the built-in bucket for a context that matches nothing, so it has no expression, cannot be deleted, and is always rendered last. That is what lets the user clear the list entirely: with no environments defined, every context is Unassigned.

The list Karse ships with, and what "reset to defaults" restores:

| Name | Matches | Chip colour |
|---|---|---|
| Production | `(^\|[^a-z])(production\|prod\|prd)([^a-z]\|$)` | error (red) |
| Staging | `(^\|[^a-z])(staging\|stage\|stg)([^a-z]\|$)` | warning (amber) |
| Development | `(^\|[^a-z])(development\|develop\|dev)([^a-z]\|$)` | info (blue) |

Three, deliberately: they are the environments almost every kubeconfig has, and anything else (a Test / QA, a Local, an Infra) is a row the user adds for themselves in a couple of seconds. Shipping a longer list would put rows most users do not want in front of them and make the first thing they do a deletion.

Each default expression requires its token to be delimited by a non-letter or the end of the name, which is what makes `devops-prod` **Production** (its `devops` is not `dev`) and `predevelopmentplan` **Unassigned**. Digits are not delimiters, so `staging2` is still Staging. A name matching none of the three, such as `qa-cluster` or `minikube`, is Unassigned until the user adds an environment that matches it.

## Behaviour

### Resolving a context's environment

- Every context resolves to exactly one environment: its explicit label if it has one, otherwise the **first** environment in the list whose expression matches its name, otherwise Unassigned.
- **Order is precedence.** When a name matches two environments' expressions, the one nearer the top of the list wins, and moving a row changes the answer. The shipped list is ordered Production first for that reason: `prod-staging-mirror` is Production, not Staging.
- **Matching is case-insensitive and runs against the whole context name.** The expression is the whole rule: there is no token table, no name-segment splitting, and no second matching mechanism behind the list.
- A name matching no expression is Unassigned. A kubeconfig where **no** name matches puts every context under Unassigned and still renders a usable, fully functional contexts page, as does an empty list.

### Editing the list

- The Config page (`/config`) presents its settings as subtabs: **Cluster data cache** (the existing on-disk cache settings, unchanged, and the tab the page opens on) and **Environments**.
- The Environments tab lists the environments in order. Each row shows its chip (name in its colour), its name, its expression, and its colour, with controls to move it up, move it down, and delete it. The chip sits in a fixed-width column so every row's name field starts at the same place however long the environment's name is; a name too long for the column is ellipsised in the chip.
- **Add**: a name and an expression, plus a colour, appended to the end of the list. Its id is derived from the name and uniquified against the ids already in use.
- **Edit**: the name, the expression and the colour of any row, including a row that shipped as a default.
- **Delete**: any row, including a default. Its contexts fall through to whichever environment matches next, or to Unassigned.
- **Reorder**: move a row up or down, which changes precedence.
- **Clear the list**: removes every environment. Every context becomes Unassigned, and the tab says so.
- **Reset to defaults**: asks for confirmation first in a dialog that states plainly that it discards the user's custom environments and cannot be undone. Cancelling leaves the list exactly as it was; confirming restores the shipped list.
- **An invalid expression is rejected at the point of entry and is never saved.** A row whose expression does not compile, or is empty, or is longer than 200 characters, shows the reason under the field and blocks the write, so the stored list can never contain an expression that throws when it is compiled. The add control's button stays disabled until its name and expression are both usable.

### Regular expressions the user supplies

A user-supplied expression never reaches a shell or kubectl (see [read-only-invariant](../read-only-invariant/detail.md)); it is compiled and run in the browser only. The risk it does carry is a catastrophically backtracking expression making the tab unresponsive. Karse's answer is deliberate and limited: the expression is capped at 200 characters, it is compiled **once** per change to the list rather than once per context per render, and it is only ever run against context names, which are short. Karse does not attempt to detect a pathological expression, because the user typed it into their own browser and can delete or reset it from the same tab.

### Labelling a context

- Each row of the contexts page carries two environment columns: **Environment**, the resolved environment as a chip, and **Set environment**, a selector offering *Auto (from name)* and every environment in the user's list. Unassigned is not offerable, because it is not in the list; *Auto* already hands the decision back to the name.
- **The chip has a column of its own** rather than sharing a cell with the selector. A chip's width follows its environment's name, so sharing a cell pushed every row's selector to a different x position; separate columns give the selectors one left edge down the whole table. It also makes the chip an ordinary optional column: it can be hidden and reordered from the contexts table's **Columns** control, which the table now carries like the other resource tables. The selector column can be hidden the same way; the Actions column cannot, because it is pinned to the right-hand edge of the row.
- Picking an environment labels the context. Picking *Auto (from name)* clears the label, and the context falls back to whichever expression **matches**, not to Unassigned.
- A label refers to an environment's **id**, so renaming an environment keeps its labels. A label naming an environment the user has since **deleted** is ignored, and the context falls back to the match; the label itself stays in storage.
- **A labelled context is visibly distinguished from a matched one.** The chip is drawn filled when the environment came from a label and outlined when it was matched, and its hover title says which (`Labelled Production` versus `Matched Production from the context name`).
- Labelling never changes which context is active, never touches the kubeconfig, and issues no kubectl call.

### Persistence

- Both the environment list and the labels live in the existing `karse-config` local-storage entry alongside the other UI settings (colour mode, timestamp format), as an `environments` array and a `contextEnvironments` map. There is no second storage key.
- The stored config is merged over the defaults on load, so an entry written **before** the list existed has no `environments` field and reads back as the shipped defaults: an existing install is unchanged until the user edits something.
- A stored empty array is a real, cleared list, not an absent one, so clearing the list persists.
- A **malformed** stored list falls back to the defaults rather than breaking the page: a value that is not an array, a row that is not an object, a row missing its id or name, a row missing its expression, or a row whose expression no longer compiles. An unrecognised colour on an otherwise valid row falls back to the neutral `default` rather than discarding the whole list.
- A stored label naming an environment not in the list is ignored, and the context falls back to the match.
- The list and the labels survive a page reload and an app restart, because that is what local storage gives them.

### Grouping the surfaces

- **Contexts page** (`/contexts`): the table body is split into one group per environment, each introduced by a heading row naming the environment and the number of contexts in it, in the user's list order with Unassigned last. Sorting and the search box run over the whole table first, so a group holds only the rows that survived them, in the sorted order; a search that hides every context in an environment hides that environment's heading too. The Environment column itself is sortable and searchable on the environment's name; the Set environment column beside it holds only a control, so it neither sorts nor feeds the search.
- **Header dropdown**: the context `Select` in the top bar lists its entries under one subheading per environment, in the same order.
- **The header dropdown's search**: the same subheadings, applied after its name/cluster filter, so a query that hides an environment's every context hides its subheading too.
- **All clusters page** (`/clusters`): the multi-cluster overview's table is split the same way, each section additionally headed by that environment's cluster count, node count and aggregate utilisation. Those figures are [multi-cluster-overview](../multi-cluster-overview/detail.md)'s; what this feature supplies is which environment each context is in and the order the sections appear in.
- All four call the same resolver module, reading the same compiled list. There is no second copy of the rule.

### The active context's environment

- The top bar shows an environment chip beside the context dropdown, naming the active context's environment, so it is obvious when the current view is pointed at production without opening any picker. It is drawn filled or outlined on the same labelled-versus-matched rule as the table's chips.
- With no context selected there is no chip.

## Acceptance Criteria

- [x] Every context resolves to an environment: an explicit label if set, otherwise the first environment in the list whose expression matches, otherwise Unassigned.
- [x] The environment list is the user's: environments can be added, edited (name, expression, colour), deleted, reordered and cleared, including the ones that shipped as defaults.
- [x] Order is precedence: when a name matches two environments, the one nearer the top of the list wins, and reordering changes the answer.
- [x] Matching is case-insensitive and runs against the whole context name, with the expression as the whole rule.
- [x] The list can be reset to the defaults behind a confirmation dialog that states the loss of custom environments; cancelling leaves the list untouched.
- [x] An invalid expression is rejected with a readable message at the point of entry and is never saved, so a stored list can never hold one that throws when compiled.
- [x] The Config page presents its settings as subtabs, with the existing cluster-data cache settings unchanged on their own tab and the environment editor alongside.
- [x] The list persists in the `karse-config` local-storage entry beside `contextEnvironments`, with no second storage key; an absent list reads back as the defaults and a malformed one falls back to them.
- [x] Clearing the list puts every context under Unassigned, and the contexts page and the header dropdown both still render and are still usable.
- [x] A context can be labelled from the contexts page, and the label changed or cleared; clearing falls back to the matched environment, not to Unassigned. A label naming a deleted environment is ignored.
- [x] A labelled context is shown as labelled rather than matched.
- [x] Labels persist across a page reload and an app restart, in the `karse-config` local-storage entry.
- [x] A label for a context no longer in the kubeconfig is ignored rather than shown as a phantom row, and is not lost if that context comes back.
- [x] The contexts page groups its rows by environment in the user's list order, with Unassigned last.
- [x] The header dropdown groups its entries the same way as the contexts page, using the same resolver, whether it was opened by click or by `Ctrl+K`.
- [x] The active context's environment is visible in the header without opening a picker.
- [x] Environment resolution never changes the active context and never writes to the kubeconfig.

## Open Questions

None.
