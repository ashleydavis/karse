# cluster-environments

## Overview

A kubeconfig with many contexts is a flat list in which nothing tells production apart from development at a glance. Karse gives every context an **environment** and groups every surface that lists contexts by it, so the production clusters sit together at the top and the current view's environment is visible in the header.

An environment is either **inferred** from the context name or **labelled** by hand. A label always wins, and labels persist.

Backed by: `frontend/src/lib/cluster-environments.ts` (the resolver: tokens, precedence, grouping), `frontend/src/components/environment-chip.tsx` (the shared chip), `frontend/src/lib/config.tsx` (the persisted labels), `frontend/src/pages/contexts/components/contexts-table.tsx` (the grouped table and the labelling control), `frontend/src/components/context-picker.tsx` (the header dropdown and the active-context chip), `frontend/src/components/context-quick-picker.tsx` (the `Ctrl+K` picker).

This is a frontend-only concern. No backend route changes, no new kubectl call, and nothing is ever written to the kubeconfig: consistent with [read-only-invariant](../read-only-invariant/detail.md), resolving an environment is a display and grouping decision made in the browser.

## The environments

| Environment | Heading | Chip colour |
|---|---|---|
| `production` | Production | error (red) |
| `staging` | Staging | warning (amber) |
| `development` | Development | info (blue) |
| `test` | Test / QA | secondary |
| `local` | Local | success (green) |
| `unassigned` | Unassigned | default (neutral) |

They are always rendered in exactly that order: **production first** so the riskiest cluster is never buried, **unassigned last** so contexts Karse could not place do not lead the list. The order is fixed, not alphabetical and not derived from the kubeconfig's own ordering. An environment no context resolved to renders no heading at all.

## Behaviour

### Resolving a context's environment

- Every context resolves to exactly one environment: its explicit label if it has one, otherwise the environment inferred from its name, otherwise `unassigned`.
- **Inference is by name segment, never by bare substring.** The name is lowercased and split on any run of non-alphanumeric characters *and* at every letter/digit boundary, so `staging2` yields the segments `staging` and `2`. A segment must equal a token exactly.
- The tokens:

  | Environment | Tokens |
  |---|---|
  | production | `prod`, `prd`, `production` |
  | staging | `stg`, `stage`, `staging` |
  | development | `dev`, `develop`, `development` |
  | test | `test`, `testing`, `qa` |
  | local | `local`, `localhost`, `minikube`, `kind` |

- Segment matching is what makes `devops-prod` **production** (its `devops` segment is not `dev`) and `predevelopmentplan` **unassigned** (no segment equals any token). `production-eu`, `acme-cluster-prod` and `ACME-PROD-1` are all production; matching is case-insensitive.
- A name carrying **more than one** token resolves to whichever of them comes first in the fixed order above, so the riskiest environment named wins: `prod-test-eu` is production, `dev-staging-mirror` is staging. A context whose name mentions production is never quietly grouped as something softer.
- A name matching nothing is `unassigned`. A kubeconfig where **no** name matches puts every context under Unassigned and still renders a usable, fully functional contexts page.

### Labelling a context

- Each row of the contexts page carries an **Environment** column: the resolved environment as a chip, plus a selector offering *Auto (from name)* and each of the five real environments. `Unassigned` is deliberately not offerable as a label; it is the absence of an environment, and *Auto* already hands the decision back to the name.
- Picking an environment labels the context. Picking *Auto (from name)* clears the label, and the context falls back to its **inferred** environment, not to Unassigned.
- **A labelled context is visibly distinguished from an inferred one.** The environment chip is drawn filled when the environment came from a label and outlined when it was inferred, and its hover title says which (`Labelled Production` versus `Inferred Production from the context name`).
- Labelling never changes which context is active, never touches the kubeconfig, and issues no kubectl call.

### Persistence

- Labels are stored in the existing `karse-config` local-storage entry alongside the other UI settings (colour mode, timestamp format), as a `contextEnvironments` map. There is no second storage key.
- The stored config is merged over the defaults on load, so an entry written before this feature is read back unchanged and simply has no labels.
- **Labels are keyed by context name.** A label for a context that is no longer in the kubeconfig produces no phantom row: only the contexts the backend actually returned are ever grouped. The label itself is left in storage, so it applies again if that context comes back.
- A stored value that is not one of the six environments (a hand-edited or stale entry) is ignored, and the context falls back to inference.
- Labels survive a page reload and an app restart, because that is what local storage gives them.

### Grouping the surfaces

- **Contexts page** (`/contexts`): the table body is split into one group per environment, each introduced by a heading row naming the environment and the number of contexts in it. Sorting and the search box run over the whole table first, so a group holds only the rows that survived them, in the sorted order; a search that hides every context in an environment hides that environment's heading too. The Environment column itself is sortable and searchable on the environment's heading text.
- **Header dropdown**: the context `Select` in the top bar lists its entries under one subheading per environment, in the same order.
- **`Ctrl+K` quick-picker**: the same, under the same subheadings, applied after its own name/cluster filter.
- All three call the same resolver module. There is no second copy of the rule.

### The active context's environment

- The top bar shows an environment chip beside the context dropdown, naming the active context's environment, so it is obvious when the current view is pointed at production without opening any picker. It is drawn filled or outlined on the same labelled-versus-inferred rule as the table's chips.
- With no context selected there is no chip.

## Acceptance Criteria

- [x] Every context resolves to an environment: an explicit label if set, otherwise the inferred one, otherwise Unassigned.
- [x] Name inference matches the common production, staging, development, test/QA and local tokens, case-insensitively and as name segments, so `devops-prod` is production.
- [x] A context can be labelled from the contexts page, and the label changed or cleared; clearing falls back to the inferred environment, not to Unassigned.
- [x] A labelled context is shown as labelled rather than inferred.
- [x] Labels persist across a page reload and an app restart, in the `karse-config` local-storage entry.
- [x] A label for a context no longer in the kubeconfig is ignored rather than shown as a phantom row, and is not lost if that context comes back.
- [x] The contexts page groups its rows by environment in the fixed order (production first, unassigned last).
- [x] The header dropdown and the `Ctrl+K` quick-picker group their entries the same way, using the same resolver.
- [x] The active context's environment is visible in the header without opening a picker.
- [x] Environment resolution never changes the active context and never writes to the kubeconfig.
- [x] A kubeconfig matching no token puts every context under Unassigned and still renders a usable page.

## Open Questions

None.
