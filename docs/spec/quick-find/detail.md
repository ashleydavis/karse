# quick-find

## Overview

Header-anchored, searchable quick-pickers in a command-palette style. Two are shipped today: one for switching the active context, one for selecting the active namespace. A broader cross-kind quick-find (search every resource and jump to its detail page) is on the roadmap but not built.

Backed by: `frontend/src/components/header.tsx`, `frontend/src/components/context-quick-picker.tsx`, `frontend/src/components/namespace-quick-picker.tsx`.

## Behaviour

- The header has two quick-picker buttons. The context picker (link icon) opens on click or `Ctrl+K` (or `Cmd+K`); the namespace picker (layers icon) opens on click or `Ctrl+Shift+K`.
- Each opens a dropdown anchored to its button, with an auto-focused search box. The search field is cleared each time the dropdown opens.
- The context picker lists contexts filtered by name or cluster, sorted by name, marking the active one with a chip; selecting a row switches the tab's active context.
- The namespace picker lists namespaces for the active context filtered by name, plus an "All namespaces" entry that clears the selection; it shows a loading state while fetching and prompts to select a context first when none is active.
- Both pickers are keyboard-openable and dismissible by clicking outside.

## Acceptance Criteria

- [x] A header context quick-picker opens on click and `Ctrl+K`, searches by name/cluster, and switches the active context.
- [x] A header namespace quick-picker opens on click and `Ctrl+Shift+K`, searches by name, and includes "All namespaces" to clear the selection.
- [x] Each picker auto-focuses its search box and resets the query on open.
- [x] The namespace picker shows a loading state and prompts for a context when none is active.
- [ ] A global cross-kind quick-find that searches every resource and navigates to its detail page. (Not yet shipped; roadmap item.)

## Open Questions

None. The unchecked criterion is deliberate scope on the roadmap, not an ambiguity.
