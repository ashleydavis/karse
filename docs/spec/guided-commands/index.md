# guided-commands

**ID:** guided-commands
**Spec:** Settled
**Implementation:** Complete

Display-only kubectl command suggestions for a resource, shown in a searchable Commands tab on the resource detail page, each with a copy button. Karse never executes these commands; the user copies and runs them in their own terminal. This is how Karse exposes mutating actions (delete, scale, drain, cordon) without ever performing them itself, preserving the read-only invariant.

## Sub-features
None.
