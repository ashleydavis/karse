# context-switching

**ID:** context-switching
**Spec:** Settled
**Implementation:** Complete

List every kubeconfig context and switch between them. Karse tracks two independent selections: the tab-local **active** context (used by the current browser tab, resets on reload) and the persisted **default** context (the kubeconfig `current-context`, written via `kubectl config use-context`). The contexts page and the header's named context dropdown (click or `Ctrl+K`) drive these selections.

## Sub-features
None. (The header dropdown's search behaviour is specced under `quick-find`.)
