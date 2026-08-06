# cluster-environments

**ID:** cluster-environments
**Spec:** Settled
**Implementation:** Complete

Every kubeconfig context resolves to an environment (Production, Staging, Development, Test / QA, Local, or Unassigned), inferred from the context name and overridable by an explicit label the developer sets on the contexts page. The contexts page, the header context dropdown, and the `Ctrl+K` quick-picker all group their entries by that environment, and the header shows the active context's environment without opening anything. Display and grouping only: nothing here switches a context or writes to the kubeconfig.

## Sub-features
None.
