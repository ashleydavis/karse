# guided-commands

**ID:** guided-commands
**Spec:** Settled
**Implementation:** Complete

Display-only kubectl commands, each with a copy button, on two surfaces: a searchable Commands tab on a resource detail page (commands that act on that resource), and context-sensitive page help in the header (where the current page's data came from, and the read-only queries that reproduce it, scoped to the selected context and namespace). Karse never executes these commands; the user copies and runs them in their own terminal. This is how Karse exposes mutating actions (delete, scale, drain, cordon) without ever performing them itself, preserving the read-only invariant.

## Sub-features
None.
