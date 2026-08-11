# cluster-environments

**ID:** cluster-environments
**Spec:** Settled
**Implementation:** Complete

Every kubeconfig context resolves to an environment from the user's own editable list: an ordered set of rows, each a name, a regular expression matched against the context name, and a chip colour, edited on the Config page's Environments subtab. The first row whose expression matches wins, a context matching none is Unassigned, and an explicit per-context label beats both. Karse ships a default list of three (Production, Staging, Development) that can be edited, reordered, deleted, cleared, and reset behind a confirmation. The contexts page, the header context dropdown, and the `Ctrl+K` quick-picker all group their entries by environment, and the header shows the active context's environment without opening anything. Display and grouping only: nothing here switches a context or writes to the kubeconfig.

## Sub-features
None.
