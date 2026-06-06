# namespace-selector

**ID:** namespace-selector
**Spec:** Settled
**Implementation:** Complete

Scope views to a chosen namespace instead of cluster-wide reads. Like context selection, there are two independent values: the tab-local **active** namespace (scopes the current tab's views, resets on reload) and the persisted **default** namespace for a context (written into the local kubeconfig). Driven by the namespaces page and the header quick-picker (`Ctrl+Shift+K`).

## Sub-features
None. (The header quick-picker dropdown is specced under `quick-find`.)
