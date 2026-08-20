# cluster-environments manual tests

**Feature:** [cluster-environments](../../spec/cluster-environments/index.md)

Manual tests for grouping kubeconfig contexts by environment: the user's editable environment list (add, edit, delete, reorder, clear, reset) on the Config page's Environments subtab, the environment a context name matches, the explicit label that overrides it, the persistence of both, and the grouping on the contexts page, the header context dropdown (click or `Ctrl+K`) and the All clusters page.

## Fixtures
- [39-environment-contexts](../_fixtures-kwok/39-environment-contexts/)
- [13-two-contexts](../_fixtures-kwok/13-two-contexts/)
