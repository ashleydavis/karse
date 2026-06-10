# column-config manual tests

**Feature:** [column-config](../../spec/column-config/index.md)

Manual tests for the shared, per-table column configuration: the "Columns" button, the Visible / Hidden drag-and-drop modal, and per-table persistence across reloads.

## Fixtures
- [03-many-nodes](../_fixtures-kwok/03-many-nodes/)

Any resource table works; the nodes table is used here because its columns (Name, Status, Roles, Version, Age) are stable and easy to verify. The Roles column is hidden by default (it usually reads `<none>`), so it starts in the modal's Hidden section.
