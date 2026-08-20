# quick-find

## Overview

Header-anchored, searchable quick-pickers in a command-palette style. Two are shipped today: the named context dropdown, which switches the active context, and the namespace picker button, which selects the active namespace. A broader cross-kind quick-find (search every resource and jump to its detail page) is on the roadmap but not built.

Backed by: `frontend/src/components/header.tsx`, `frontend/src/components/context-picker.tsx`, `frontend/src/lib/context-picker-rows.ts`, `frontend/src/components/namespace-quick-picker.tsx`.

## Behaviour

- The header has one context control and one namespace control. The context picker is the dropdown labelled with the active context's name, and opens on click or `Ctrl+K` (or `Cmd+K`); the namespace picker opens on click or `Ctrl+Shift+K`. There is no second context control: the search, the environment subheadings, the active chip and the shortcut all live in the named dropdown. The namespace trigger is a labelled outlined button (layers icon, the name of the active namespace, and a caret) styled to read as a pair with the context dropdown beside it, so the control that changes the namespace also states which namespace is in force. It reads "All namespaces" when none is set, the same wording as the dropdown entry that clears the selection, and a long name is ellipsised so it never pushes the rest of the header around.
- Each opens a dropdown anchored to its button, with an auto-focused search box. The search field is cleared each time the dropdown opens.
- The context picker's trigger is labelled with the active context's name (`no context` when none is active) and carries the environment chip beside it. Its dropdown lists contexts filtered by name or cluster, sorted by name, marking the active one with a chip; selecting a row switches the tab's active context. Its rows are listed under one subheading per environment, applied after the filter, so a search that hides every context in an environment hides that subheading too (see [cluster-environments](../cluster-environments/detail.md)).
- The namespace picker lists namespaces for the active context filtered by name, plus an "All namespaces" entry that clears the selection; it shows a loading state while fetching and prompts to select a context first when none is active. Selecting or clearing updates the trigger's label.
- Both pickers are keyboard-openable and dismissible by clicking outside.
- Each trigger shows a hover hint naming its keyboard shortcut ("Context picker (Ctrl+K)", "Namespace picker (Ctrl+Shift+K)") and carries an accessible name. The dropdown is rendered inside a MUI Tooltip, so the trigger is wrapped in a plain element: a Tooltip child carrying its own `title` makes MUI log an error on every render of the header.

## Acceptance Criteria

- [x] The header's named context dropdown opens on click and `Ctrl+K`, searches by name/cluster, and switches the active context. It is the header's only context control.
- [x] A header namespace quick-picker opens on click and `Ctrl+Shift+K`, searches by name, and includes "All namespaces" to clear the selection.
- [x] The namespace picker's trigger is labelled with the active namespace ("All namespaces" when none), ellipsising a long name, and is the only place the header names the namespace.
- [x] Each picker auto-focuses its search box and resets the query on open.
- [x] The namespace picker shows a loading state and prompts for a context when none is active.
- [ ] A global cross-kind quick-find that searches every resource and navigates to its detail page. (Not yet shipped; roadmap item.)

## Open Questions

None. The unchecked criterion is deliberate scope on the roadmap, not an ambiguity.
