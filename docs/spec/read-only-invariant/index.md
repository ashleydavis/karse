# read-only-invariant

**ID:** read-only-invariant
**Spec:** Settled
**Implementation:** Complete

Karse is read-only by design. It never sends a mutating kubectl subcommand to a cluster. The only writes it performs are to the local kubeconfig (active context and a context's default namespace), which are local file changes, not cluster operations. There is no "run any kubectl" interface: every cluster query goes through a fixed set of named adapter functions, each building a hard-coded argv.

## Sub-features
None.
