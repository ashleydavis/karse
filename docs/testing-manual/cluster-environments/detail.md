# cluster-environments manual tests

Manual tests for grouping contexts by environment. See the spec: [cluster-environments](../../spec/cluster-environments/detail.md).

Karse gives every kubeconfig context an environment (Production, Staging, Development, Test / QA, Local, Unassigned), inferred from the context name and overridable by a label you set by hand. Tear each fixture down with the Teardown step at the end of this doc.

## Scenario A: Every environment group at once

A handcrafted kubeconfig whose nine context names cover every group. No cluster is created and none is needed: Karse lists contexts with `kubectl config view`, which reads the file and never contacts a cluster. Only the contexts page, the header dropdown and the quick-picker are exercised here; the cluster-data pages report load errors under this kubeconfig, which is expected.

**Fixture:** [_fixtures-kwok/39-environment-contexts](../_fixtures-kwok/39-environment-contexts/)

```sh
./docs/testing-manual/_fixtures-kwok/39-environment-contexts/setup.sh
```

The script prints the path of the kubeconfig it wrote. Start Karse with it (substitute the printed path):

```sh
KUBECONFIG=./fixtures-tmp/karse-environment-contexts.yaml bun run dev
```

Then open the frontend at `http://127.0.0.1:5173` and go to **Contexts** (`/contexts`).

### What to check

- **Group headings, in this exact order, top to bottom**: Production, Staging, Development, Test / QA, Local, Unassigned. The order is fixed. It is not alphabetical (which would start at Development) and it is not the kubeconfig's own order.
- **Each heading shows its count**: Production 2, Staging 2, Development 1, Test / QA 1, Local 1, Unassigned 2.
- **Each context sits under the right heading**:

  | Context | Group | Why |
  |---|---|---|
  | `prod-eu-1` | Production | `prod` segment |
  | `devops-prod` | Production | `prod` segment. **`devops` is not `dev`** |
  | `staging-eu-west` | Staging | `staging` segment |
  | `acme-stg-2` | Staging | `stg` segment |
  | `my-dev-box` | Development | `dev` segment |
  | `qa-cluster` | Test / QA | `qa` segment |
  | `minikube` | Local | `minikube` segment |
  | `apollo`, `artemis` | Unassigned | no segment matches any token |

- **`devops-prod` is the one to look at.** If it appears under Development, the inference is matching bare substrings instead of name segments, which is the defect this feature exists to avoid.
- **Environment column**: each row shows a coloured chip naming its environment (Production red, Staging amber, Development blue, Test / QA purple, Local green, Unassigned grey) beside a selector reading **Auto (from name)**.
- **Inferred chips are outlined, not filled.** Hover one: the tooltip reads "Inferred *<Environment>* from the context name". Nothing has been labelled yet, so every chip on this page is outlined.
- **Header**: an environment chip sits immediately left of the context dropdown, reading **Production** (the active context is `prod-eu-1`). This is the "is this view pointed at production?" signal, visible without opening anything.
- **Header dropdown** (click the context name in the top bar): the entries are listed under the same subheadings in the same order, Production first, Unassigned last.
- **Quick-picker** (link icon, or `Ctrl+K`): the same subheadings, same order. Type `acme` into its search box: only the matching contexts remain, and a subheading whose contexts were all filtered out disappears with them.
- Check the whole page in **both light and dark mode** (header colour-mode button). Every chip colour must stay legible against both backgrounds.

## Scenario B: Labelling, clearing, and persistence

Continue with Scenario A's kubeconfig and the contexts page.

### What to check

- **Label a context**: in the `devops-prod` row, open the Environment selector and pick **Development**. The row immediately moves out of Production and into the Development group, the Production count drops to 1 and Development rises to 2, and the group headings still render in the fixed order.
- **A labelled chip looks different**: `devops-prod`'s chip is now **filled** (solid background), where `my-dev-box`'s chip in the same group is still outlined. Hover them: the labelled one reads "Labelled Development", the inferred one "Inferred Development from the context name". This is how you tell what was tagged by hand.
- **The selector reflects the label**: `devops-prod`'s selector now reads **Development**, not *Auto (from name)*.
- **Unassigned is not offerable as a label.** Open any selector: the options are *Auto (from name)*, Production, Staging, Development, Test / QA, Local. There is no Unassigned entry, because clearing the label is what hands the decision back to the name.
- **Nothing else moved**: the `active` and `default` chips are still on `prod-eu-1`. Labelling is a display concern; it must not switch the active context. Confirm in your terminal that `KUBECONFIG=./fixtures-tmp/karse-environment-contexts.yaml kubectl config current-context` still prints `prod-eu-1`, i.e. the kubeconfig was not written to.
- **The pickers follow**: open the header dropdown and the `Ctrl+K` picker. `devops-prod` now appears under Development in both. All three surfaces read the same resolver, so they can never disagree.
- **The label survives a reload**: press F5. `devops-prod` is still under Development with a filled chip.
- **The label survives an app restart**: stop Karse (Ctrl+C in the terminal running it), start it again with the same command, and reload the page. `devops-prod` is still under Development. The label lives in the browser's `karse-config` local-storage entry, alongside the colour mode and timestamp format; check with DevTools → Application → Local Storage that there is exactly **one** `karse-config` entry and that it now carries a `contextEnvironments` field. There must be no second storage key.
- **Changing a label**: set `devops-prod` to **Staging**. It moves to the Staging group. Set it back to **Development**.
- **Clearing a label falls back to inference, not to Unassigned**: set `devops-prod`'s selector to **Auto (from name)**. It must return to **Production** (its inferred environment) with an **outlined** chip. If it lands in Unassigned, the fallback is wrong.
- **A label for a context that is no longer in the kubeconfig**: label `apollo` as **Production** and confirm it moves. Stop Karse, edit the kubeconfig to remove the `apollo` context, and start Karse again. The contexts page must show no `apollo` row anywhere, in particular no phantom row under Production. Now stop Karse, put the `apollo` context back, and start again: `apollo` reappears **still labelled Production**. The label was kept, keyed by the context's name, not discarded while the context was missing.

## Scenario C: A kubeconfig where nothing matches

The second kubeconfig the fixture wrote: three context names carrying no environment token at all.

**Fixture:** [_fixtures-kwok/39-environment-contexts](../_fixtures-kwok/39-environment-contexts/) (already run in Scenario A)

```sh
KUBECONFIG=./fixtures-tmp/karse-unassigned-contexts.yaml bun run dev
```

Then open the frontend at `http://127.0.0.1:5173` and go to **Contexts**.

### What to check

- **One group only**: a single **Unassigned** heading with a count of 3, holding `apollo`, `artemis` and `hermes`. No empty Production/Staging/Development/Test/Local headings are rendered.
- **The page is still usable**: search filters the rows, the column headers still sort, "Set as active" and "Set as default" still work, and the Environment selector still offers all five environments.
- **The header chip reads Unassigned** for the active context.
- **The dropdown and quick-picker** each show a single Unassigned subheading.
- **Labelling still works from here**: label `apollo` as **Production**. A Production group appears above Unassigned, and the header chip changes to Production the moment `apollo` is the active context. Clear it again with *Auto (from name)* and the Production group disappears.
- Check both light and dark mode.

## Scenario D: Real, switchable clusters

The grouping must not interfere with actually switching context. Two live KWOK clusters.

**Fixture:** [_fixtures-kwok/13-two-contexts](../_fixtures-kwok/13-two-contexts/)

```sh
./docs/testing-manual/_fixtures-kwok/13-two-contexts/setup.sh
```

Start Karse against your normal kubeconfig:

```sh
bun run dev
```

Then open the frontend at `http://127.0.0.1:5173` and go to **Contexts**.

### What to check

- Both `kwok-karse-test-1` and `kwok-karse-test-2` appear, grouped under **Test / QA**. That is correct: `kwokctl` names its contexts `kwok-karse-test-N`, so `test` is a genuine segment of both names.
- **Label `kwok-karse-test-1` as Production.** It moves into a Production group above Test / QA, and its chip fills.
- **Switching still works**: click "Set as active" on `kwok-karse-test-2`. The `active` chip moves, the Nodes page shows cluster 2's single `fake-node-a`, and the header environment chip changes to **Test / QA**. Switch back to `kwok-karse-test-1`: the header chip returns to **Production**. The environment tracks the active context.
- **"Set as default" still works** and still writes only the kubeconfig `current-context`: click it on `kwok-karse-test-2`, then confirm `kubectl config current-context` in your terminal prints `kwok-karse-test-2`. Confirm with `kubectl config view` that no environment or label field was added to the kubeconfig anywhere: the labels live only in the browser.
- **Clear the label** on `kwok-karse-test-1` with *Auto (from name)*; it returns to Test / QA.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/39-environment-contexts/teardown.sh
./docs/testing-manual/_fixtures-kwok/13-two-contexts/teardown.sh
```

Any labels you set are still in the browser's local storage. Clear them by setting each context's selector back to *Auto (from name)*, or by deleting the `karse-config` entry in DevTools (which also resets the colour mode and timestamp format).
