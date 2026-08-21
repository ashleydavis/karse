# cluster-environments manual tests

Manual tests for grouping contexts by environment. See the spec: [cluster-environments](../../spec/cluster-environments/detail.md).

Karse gives every kubeconfig context an environment from the user's own editable list. Each environment is a name, a regular expression matched against the context name, and a chip colour; the first environment in the list whose expression matches wins, a context matching none is Unassigned, and an explicit per-context label beats both. The list ships as three environments (Production, Staging, Development) and is edited on the Config page's Environments subtab. Tear each fixture down with the Teardown step at the end of this doc.

## Scenario A: Every shipped environment group at once

A handcrafted kubeconfig whose ten context names cover every group. No cluster is created and none is needed: Karse lists contexts with `kubectl config view`, which reads the file and never contacts a cluster. Only the contexts page and the header context dropdown are exercised here; the cluster-data pages report load errors under this kubeconfig, which is expected.

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

- **Group headings, in this exact order, top to bottom**: Production, Staging, Development, Unassigned. That is the order of the shipped list, with the built-in Unassigned bucket always last. It is not alphabetical (which would start at Development) and it is not the kubeconfig's own order.
- **Each heading shows its count**: Production 3, Staging 2, Development 1, Unassigned 4.
- **Each context sits under the right heading**:

  | Context | Group | Why |
  |---|---|---|
  | `prod-eu-1` | Production | Production's expression matches `prod` |
  | `devops-prod` | Production | matches `prod`. **`devops` is not `dev`**, so Development does not match |
  | `prod-staging-mirror` | Production | matches **both** Production and Staging; Production is higher in the list |
  | `staging-eu-west` | Staging | matches `staging` |
  | `acme-stg-2` | Staging | matches `stg` |
  | `my-dev-box` | Development | matches `dev` |
  | `qa-cluster`, `minikube`, `apollo`, `artemis` | Unassigned | no expression in the shipped list matches |

- **`devops-prod` is the one to look at.** If it appears under Development, the shipped expressions are matching bare substrings instead of whole parts of the name, which is the defect this feature exists to avoid.
- **`prod-staging-mirror` is the other one to look at.** It must be under Production, because Production sits above Staging in the list. Scenario D reorders the list and it must follow.
- **`qa-cluster` and `minikube` are the third thing to look at.** They must be Unassigned: Karse ships three environments only, so a name Karse does not recognise waits for the user to add an environment for it rather than being sorted into a row they never asked for. Scenario D adds one.
- **Environment column**: each row shows a coloured chip naming its environment (Production red, Staging amber, Development blue, Unassigned grey). The **Set environment** column beside it holds that row's selector, reading **Auto (from name)**.
- **The selectors line up.** Read down the Set environment column: every selector starts at the same x position, even though the chips beside them say Production, Development and Unassigned and so are different widths. If they stagger, the chip is sharing a cell with the selector again.
- **The chip column can be hidden.** Click **Columns** (beside the search box), drag **Environment** from Visible to Hidden, and close the modal. The chips go, the selectors, the rows and the group headings stay, and the choice survives F5. Drag it back onto **Set environment** to restore it to its shipped place. Try the same with **Set environment** itself; **Actions** is not offered, because it is pinned to the right-hand edge of the row.
- **Matched chips are outlined, not filled.** Hover one: the tooltip reads "Matched *<Environment>* from the context name". Nothing has been labelled yet, so every chip on this page is outlined.
- **Header**: an environment chip sits immediately left of the context dropdown, reading **Production** (the active context is `prod-eu-1`). This is the "is this view pointed at production?" signal, visible without opening anything.
- **Header dropdown** (click the context name in the top bar): the entries are listed under the same subheadings in the same order, Production first, Unassigned last. Each subheading is that environment's chip, matching the badge in the nav bar beside the dropdown.
- **The dropdown's search** (open it by click or `Ctrl+K`): the same subheadings, same order. Type `acme` into its search box: only the matching contexts remain, and a subheading whose contexts were all filtered out disappears with them.
- Check the whole page in **both light and dark mode** (header colour-mode button). Every chip colour must stay legible against both backgrounds.

## Scenario B: Labelling, clearing, and persistence

Continue with Scenario A's kubeconfig and the contexts page.

### What to check

- **Label a context**: in the `devops-prod` row, open the Environment selector and pick **Development**. The row immediately moves out of Production and into the Development group, the Production count drops to 1 and Development rises to 2, and the group headings still render in the fixed order.
- **A labelled chip looks different**: `devops-prod`'s chip is now **filled** (solid background), where `my-dev-box`'s chip in the same group is still outlined. Hover them: the labelled one reads "Labelled Development", the matched one "Matched Development from the context name". This is how you tell what was tagged by hand.
- **The selector reflects the label**: `devops-prod`'s selector now reads **Development**, not *Auto (from name)*.
- **The selector offers your list, and only your list.** Open any selector: the options are *Auto (from name)* followed by Production, Staging and Development, which is exactly the environment list on the Config page. There is no Unassigned entry, because Unassigned is not in the list: it is the built-in bucket for a context nothing matched, and clearing the label is what hands the decision back to the name.
- **Nothing else moved**: the `active` and `default` chips are still on `prod-eu-1`. Labelling is a display concern; it must not switch the active context. Confirm in your terminal that `KUBECONFIG=./fixtures-tmp/karse-environment-contexts.yaml kubectl config current-context` still prints `prod-eu-1`, i.e. the kubeconfig was not written to.
- **The picker follows**: open the header context dropdown. `devops-prod` now appears under Development there too. Both surfaces read the same resolver, so they can never disagree.
- **The All clusters page follows too**: open **All clusters** in the left nav. Its table is split into the same environment sections, in the same order, with `devops-prod` under Development. (Under this handcrafted kubeconfig the clusters are unreachable, so the sections show error rows and no figures; the per-environment figures are checked in the [multi-cluster-overview](../multi-cluster-overview/detail.md) manual instead.)
- **The label survives a reload**: press F5. `devops-prod` is still under Development with a filled chip.
- **The label survives an app restart**: stop Karse (Ctrl+C in the terminal running it), start it again with the same command, and reload the page. `devops-prod` is still under Development. The label lives in the browser's `karse-config` local-storage entry, alongside the colour mode and timestamp format; check with DevTools → Application → Local Storage that there is exactly **one** `karse-config` entry and that it now carries a `contextEnvironments` field (and an `environments` field once you have edited the list in Scenario D). There must be no second storage key.
- **Changing a label**: set `devops-prod` to **Staging**. It moves to the Staging group. Set it back to **Development**.
- **Clearing a label falls back to the matched environment, not to Unassigned**: set `devops-prod`'s selector to **Auto (from name)**. It must return to **Production** (the environment its name matches) with an **outlined** chip. If it lands in Unassigned, the fallback is wrong.
- **A label for a context that is no longer in the kubeconfig**: label `apollo` as **Production** and confirm it moves. Stop Karse, edit the kubeconfig to remove the `apollo` context, and start Karse again. The contexts page must show no `apollo` row anywhere, in particular no phantom row under Production. Now stop Karse, put the `apollo` context back, and start again: `apollo` reappears **still labelled Production**. The label was kept, keyed by the context's name, not discarded while the context was missing.

## Scenario C: A kubeconfig where nothing matches

The second kubeconfig the fixture wrote: three context names carrying no environment token at all.

**Fixture:** [_fixtures-kwok/39-environment-contexts](../_fixtures-kwok/39-environment-contexts/) (already run in Scenario A)

```sh
KUBECONFIG=./fixtures-tmp/karse-unassigned-contexts.yaml bun run dev
```

Then open the frontend at `http://127.0.0.1:5173` and go to **Contexts**.

### What to check

- **One group only**: a single **Unassigned** heading with a count of 3, holding `apollo`, `artemis` and `hermes`. No empty Production, Staging or Development headings are rendered, even though all three are still in the list.
- **The page is still usable**: search filters the rows, the column headers still sort, "Set as active" and "Set as default" still work, and the Environment selector still offers all three environments.
- **The header chip reads Unassigned** for the active context.
- **The header context dropdown** shows a single Unassigned subheading.
- **Labelling still works from here**: label `apollo` as **Production**. A Production group appears above Unassigned, and the header chip changes to Production the moment `apollo` is the active context. Clear it again with *Auto (from name)* and the Production group disappears.
- Check both light and dark mode.

## Scenario D: Editing, clearing and resetting the environment list

The environment list is the user's. This scenario edits it from the Config page and watches the contexts page follow. Go back to Scenario A's kubeconfig:

```sh
KUBECONFIG=./fixtures-tmp/karse-environment-contexts.yaml bun run dev
```

Then open the frontend at `http://127.0.0.1:5173` and go to **Config** (`/config`).

### What to check

- **The Config page has subtabs**: **Cluster data cache** and **Environments**, and it opens on Cluster data cache. That tab is unchanged: the staleness threshold still shows its current value, still refuses a negative number, and still saves.
- **The Environments tab lists the list**: click it. Three rows, in order: Production, Staging, Development. Each row shows its chip in its colour, its name, the regular expression it matches, and a colour selector, plus up, down and delete buttons. There is **no Unassigned row**: the panel's text says why.
- **Add an environment**: in the add controls at the bottom, enter the name `Test / QA` and the expression `qa|test`, pick a colour, and click **Add**. A fourth row appears at the end. Go to **Contexts**: `qa-cluster` has left Unassigned and now sits under a **Test / QA** heading at the bottom of the environments, above Unassigned, which still holds `minikube`, `apollo` and `artemis`. This is the shipped list being three rather than five: an environment Karse does not ship is one control away.
- **Edit a default's expression**: back on the Environments tab, change **Development**'s expression to `hermes`. On the Contexts page, `my-dev-box` drops to Unassigned (nothing matches it now) and the Development group disappears. Change it back to what it was.
- **Order is precedence**: `prod-staging-mirror` is currently under Production. Click **Staging**'s up arrow so Staging sits above Production. On the Contexts page, `prod-staging-mirror` is now under **Staging**, while `prod-eu-1` and `devops-prod` stay under Production, and the group headings themselves are now Staging first. Move Production back above Staging and `prod-staging-mirror` returns to Production. This is the check that proves the order is what decides.
- **An invalid expression is refused at the point of entry**: type `prod(` into Production's expression field. A red message appears under the field reading "Not a valid regular expression: …". Reload the page (F5) and go back to the Environments tab: Production's expression is the one it had before, not `prod(`. Nothing invalid was saved. The same goes for the add controls: type `bad(` into the add expression and the **Add** button stays disabled.
- **Delete an environment**: delete **Development**. On the Contexts page, `my-dev-box` has moved to Unassigned (nothing else matches it). Deleting the row Karse shipped must be allowed: there is no hidden built-in behind it.
- **The edited list survives a reload and a restart**: press F5, then stop Karse (Ctrl+C) and start it again with the same command. The Environments tab still shows your edited list, including the `Test / QA` row you added and without the `Development` row you deleted.
- **Clear the whole list**: click **Clear the list**. Every row goes and the tab says "No environments. Every context is Unassigned." Go to **Contexts**: one **Unassigned** heading holding all ten contexts, and the page is still fully usable (search filters, headers sort, "Set as active" and "Set as default" still work). Open the header context dropdown (by click and by `Ctrl+K`): it shows a single Unassigned subheading with every context under it, and still switches context either way. Nothing may crash or render blank with an empty list.
- **Reset asks first, and cancelling changes nothing**: back on the Environments tab, click **Reset to defaults**. A dialog appears saying it discards your custom environments and cannot be undone. Click **Cancel**: the list is still empty. Nothing was restored.
- **Reset restores the defaults**: click **Reset to defaults** again and confirm. The three shipped rows are back in their shipped order with their shipped expressions and colours, and the `Test / QA` row you added is gone. On the Contexts page every context is back in the group Scenario A described.
- **A label for an environment you deleted is ignored**: label `apollo` as **Staging**, confirm it moves, then delete the **Staging** row on the Environments tab. `apollo` falls back to whatever matches next, which for `apollo` is nothing, so it returns to Unassigned rather than showing a dead label. Reset to defaults afterwards; `apollo`'s label is still stored, so it goes back to Staging.
- **An install that predates the list is unchanged**: in DevTools → Application → Local Storage, edit the `karse-config` entry and delete its `environments` field entirely (leave the rest), then reload. The Environments tab shows the three defaults, and the Contexts page groups exactly as Scenario A described. That is the upgrade path for an existing install.
- **A corrupt list falls back to the defaults**: edit `karse-config` again and set `"environments": "nonsense"` (or an array containing `{"id":"x","name":"X","pattern":"x("}`), then reload. The page must not break: the Environments tab shows the three defaults again.
- Check the Environments tab, the reset dialog and the empty list in **both light and dark mode**.

## Scenario E: Real, switchable clusters

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

- Both `kwok-karse-test-1` and `kwok-karse-test-2` appear, grouped under **Unassigned**. That is correct: `kwokctl` names its contexts `kwok-karse-test-N`, and none of the three shipped expressions matches that name.
- **Label `kwok-karse-test-1` as Production.** It moves into a Production group above Unassigned, and its chip fills.
- **Switching still works**: click "Set as active" on `kwok-karse-test-2`. The `active` chip moves, the Nodes page shows cluster 2's single `fake-node-a`, and the header environment chip changes to **Unassigned**. Switch back to `kwok-karse-test-1`: the header chip returns to **Production**. The environment tracks the active context.
- **"Set as default" still works** and still writes only the kubeconfig `current-context`: click it on `kwok-karse-test-2`, then confirm `kubectl config current-context` in your terminal prints `kwok-karse-test-2`. Confirm with `kubectl config view` that no environment or label field was added to the kubeconfig anywhere: the labels live only in the browser.
- **Clear the label** on `kwok-karse-test-1` with *Auto (from name)*; it returns to Unassigned.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/39-environment-contexts/teardown.sh
./docs/testing-manual/_fixtures-kwok/13-two-contexts/teardown.sh
```

Any labels you set, and any edits you made to the environment list, are still in the browser's local storage. Clear the labels by setting each context's selector back to *Auto (from name)*, restore the list with **Reset to defaults** on the Config page's Environments tab, or delete the `karse-config` entry in DevTools (which also resets the colour mode and timestamp format).
