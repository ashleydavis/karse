# copy-button manual tests

Manual tests for the shared copy button. See the spec: [copy-button](../../spec/copy-button/detail.md).

Start the app first. From the repo root run:

```sh
bun run dev
```

Then open the frontend at `http://127.0.0.1:5173`. Each fixture stands up a `karse-test` KWOK cluster; select the `kwok-karse-test` context in Karse. Tear each one down with the Teardown step at the end of this doc.

Have a scratch text editor open throughout: every check below is only proven by pasting and reading what actually landed on the clipboard.

## Scenario A: Copy buttons on the pod detail page

One multi-container pod (`web`, with an init container) on `fake-node-1` in `default`.

**Fixture:** [_fixtures-kwok/20-pod-detail-tabs](../_fixtures-kwok/20-pod-detail-tabs/)

```sh
./docs/testing-manual/_fixtures-kwok/20-pod-detail-tabs/setup.sh
```

### What to check

- Navigate to `/pods` and click the `web` row to open `/pods/default/web`.
- **Pod name**: a small copy button sits immediately to the right of the `web` heading, before the phase chip. Click it. The icon flips to a tick and the tooltip reads "Copied" for about 1.5 seconds, then reverts to the copy icon. Paste: you get exactly `web`, with no surrounding whitespace or quotes.
- **Namespace**: on the Status tab, the Details card's Namespace field shows `default` as a link with a copy button beside it. Click the copy button. Confirm the page does **not** navigate to the namespace detail page. Paste: exactly `default`.
- **Node**: the Node field shows `fake-node-1` as a link with a copy button beside it. Click the copy button. Confirm the page does **not** navigate to the node detail page. Paste: exactly `fake-node-1`.
- **Pod IP**: the Pod IP field shows the pod's IP with a copy button beside it. Click it and paste: exactly the IP shown on screen.
- **Age has no copy button**: the Age field shows a rendered age (or a local time, if you have toggled the timestamp format in the header). Confirm there is **no** copy button beside it.
- **Container images**: open the Containers tab. Each row's Image cell has a copy button. Click the one on the `nginx` row. Confirm the page does **not** navigate to the container detail page (the Containers table is still on screen and the URL is unchanged). Paste: exactly `nginx:latest`.
- Click the `sidecar` row's image copy button and paste: exactly `busybox:latest`.
- **Init container images**: open the Init Containers tab. The `init-config` row's Image cell has a copy button. Click it and paste: exactly `busybox:latest`.
- **Row click still works**: click anywhere in a container row *other than* the copy button. The container detail page opens as before. Go back.
- **Keyboard and screen reader**: tab to a copy button. It takes focus and shows a focus ring. Press Enter or Space and confirm the value is copied. Inspect the button in dev tools and confirm its `aria-label` names what it copies (for example `copy pod name`, `copy node name`, `copy image for container nginx`).
- **Light and dark**: switch the colour mode in the header (sun / moon / auto). Confirm the copy buttons are legible and correctly aligned with their values in both modes, on the heading, in the Details grid, and in the Containers table.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/20-pod-detail-tabs/teardown.sh
```

## Scenario B: No copy button on an absent value

A pod that can never be scheduled has no node and no pod IP, so both fields show the `-` placeholder. This scenario builds on Scenario A's cluster, so run that fixture first if you have torn it down.

**Fixture:** [_fixtures-kwok/20-pod-detail-tabs](../_fixtures-kwok/20-pod-detail-tabs/)

```sh
./docs/testing-manual/_fixtures-kwok/20-pod-detail-tabs/setup.sh
```

`kwokctl` runs a real kube-scheduler, so a pod with no `nodeName` would simply be scheduled onto `fake-node-1` and given an IP. A `nodeSelector` that matches no node is what keeps it Pending. Add one:

```sh
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: pod-pending
  namespace: default
spec:
  nodeSelector:
    karse.test/no-such-node: "true"
  containers:
  - name: app
    image: app:2.1.0
EOF
```

### What to check

- Navigate to `/pods` and click the `pod-pending` row.
- On the Status tab the Node and Pod IP fields both show the `-` placeholder.
- Confirm there is **no** copy button beside either of them. There must be no way to put a dash on the clipboard.
- The Namespace field still shows `default` with a working copy button, and the heading still has its `pod-pending` copy button. Click each and paste to confirm.
- Now open the `web` pod, which is scheduled. Its Node and Pod IP fields have values, and each has a copy button. Click each and paste to confirm.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/20-pod-detail-tabs/teardown.sh
```

## Scenario C: The Commands and YAML tabs are unchanged

The Commands tab and the YAML sub tab were switched onto the shared button and clipboard helper. Their behaviour and appearance must be exactly as before.

**Fixture:** [_fixtures-kwok/20-pod-detail-tabs](../_fixtures-kwok/20-pod-detail-tabs/)

```sh
./docs/testing-manual/_fixtures-kwok/20-pod-detail-tabs/setup.sh
```

### What to check

- Open `/pods/default/web` and click the **Commands** tab. Each command row shows the command in a dark code block with a copy button to its right, exactly as before. Click one: the icon flips to a tick, the tooltip reads "Copied", and it reverts after about 1.5 seconds. Paste: exactly the command text shown.
- Click the **YAML** tab. The copy button sits at the top-right corner of the YAML panel. Its tooltip still reads "Copy YAML" (not just "Copy"), and "Copied" after a click. Paste: exactly the YAML shown.
- While the YAML is still loading, the copy button is disabled. Hover it and confirm the tooltip still opens.
- Open a resource whose YAML is long enough to scroll (the panel shows a vertical scrollbar). Confirm the copy button stays clear of the scrollbar and does not overlap it, as covered in [yaml-viewer](../yaml-viewer/detail.md).
- **Share link**: click the share button in the header. It still copies the current page URL. Paste and confirm you get the full URL including the context and namespace query parameters.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/20-pod-detail-tabs/teardown.sh
```

## Scenario D: The copy menu on a resource name

Any value that is a resource name offers two forms rather than copying immediately. This scenario builds on Scenario A's cluster, so run that fixture first if you have torn it down.

**Fixture:** [_fixtures-kwok/20-pod-detail-tabs](../_fixtures-kwok/20-pod-detail-tabs/)

```sh
./docs/testing-manual/_fixtures-kwok/20-pod-detail-tabs/setup.sh
```

### What to check

- Open `/pods/default/web`. **Before clicking anything**, look at the control beside the `web` heading: it shows a copy icon with a small **caret** beside it, which is how a menu control is told apart from a plain one-click button. Compare it with the Pod IP's control in the Details card, which has the copy icon and **no** caret.
- Click the copy control beside the `web` heading. It does **not** copy immediately: a menu opens with exactly two entries, in this order.
  - **Short name**, showing `web` beneath it.
  - **Full path**, showing `kwok-karse-test/default/web` beneath it (the context you selected, then the namespace, then the pod).
- Click **Short name**. The menu closes, the icon flips to a tick, and pasting gives exactly `web`.
- Re-open the menu and click **Full path**. Pasting gives exactly `kwok-karse-test/default/web`.
- Press `Escape` with the menu open. It closes and nothing is copied (paste still gives what you copied last).
- **Namespace**: the Details card's Namespace field has the same menu. Its Full path is `kwok-karse-test/default`, with no trailing empty segment, because a namespace is cluster-scoped.
- **Node**: the Node field's menu gives `fake-node-1` and `kwok-karse-test/fake-node-1`, again with no namespace segment.
- **Pod IP has no menu**: click the Pod IP copy button. It copies straight away with no menu, because an IP has only one form.
- **Container**: open the Containers tab. The Name cell of the `nginx` row has a copy menu. Its Full path is `kwok-karse-test/default/web/nginx`: a container extends its pod's path. The Image cell beside it is still a plain button with no menu.
- **In a clickable row**: with the container copy menu open, confirm the container detail page has not opened and the URL is unchanged. Press `Escape`, then click **Short name** on a re-opened menu, and confirm you are still on the pod detail page.
- **Light and dark**: switch the colour mode in the header. Confirm the open menu is legible in both modes and that the monospace path text under each entry is readable.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/20-pod-detail-tabs/teardown.sh
```

## Scenario E: Copy controls across the rest of the app

Every detail page and every resource table's name column carries a copy control. This scenario builds on Scenario A's cluster.

**Fixture:** [_fixtures-kwok/20-pod-detail-tabs](../_fixtures-kwok/20-pod-detail-tabs/)

```sh
./docs/testing-manual/_fixtures-kwok/20-pod-detail-tabs/setup.sh
```

### What to check

- **Pods table** (`/pods`): each row's Name cell has a copy menu beside the name. Open it on the `web` row: `web` and `kwok-karse-test/default/web`. Choose either and confirm the pods list is still on screen and the URL is unchanged: the copy must not open the pod detail page.
- **Nodes table** (`/nodes`): the same control on the Name column. `fake-node-1`'s Full path is `kwok-karse-test/fake-node-1`, with no empty namespace segment.
- **Node detail** (`/nodes/fake-node-1`): a copy menu beside the node name in the heading. Roles and Version each have a plain button with no menu; copy each and paste to confirm the exact text. If Roles shows `<none>` there is no button on it.
- **Namespace detail** (`/namespaces/default`): a copy menu beside the namespace name in the heading, giving `default` and `kwok-karse-test/default`.
- **Container detail** (open `/pods/default/web`, Containers tab, click the `nginx` row): a copy menu beside the container name in the heading, one beside the Pod field, one beside the Namespace field, and a plain button beside Image.
- **Deployments, stateful sets, daemon sets, autoscalers, namespaces and all-resources tables**: each has the same copy menu in its Name column.
- **Workload detail** (click a deployment row): a copy menu beside the workload name in the heading and beside the Namespace field.
- **Events and errors tables**: the Object column carries a copy menu beside the object reference. Copying must not open the event or error detail page.
- **Event detail and error detail**: a copy menu beside the Object reference, and plain buttons on Reason and on the Message panel. Copy the message and confirm you get the full untruncated text.
- **Every other resource a page references, not just its own name.** On `/pods` the Namespace and Node columns each carry the menu as well as the Name column; on `/pods/default/web` the Namespace and Node fields do; on the container detail page the Pod and Namespace fields do; on a workload detail page the Namespace field and the Name and Node columns of its Pods tab do; on `/nodes/fake-node-1` the Pods tab's Name and Namespace columns do; and on the Cluster page the Workload and Namespace columns do. Open one on each and confirm the Full path entry names the right resource.
- **Cluster-scoped references have no empty segment.** Open the menu on the Node column of the pods table: the Full path reads `kwok-karse-test/fake-node-1`, not `kwok-karse-test//fake-node-1`.
- **Clicking a name still navigates.** In a table, click the name text itself (not its copy control) and confirm the row's detail page opens. Then click the copy control on the same row and confirm the page does **not** change.
- **Labels carry nothing**: confirm there is no copy control on a label chip in a table's Labels cell or in the labels modal.
- **Light and dark**: switch the colour mode and confirm every control above stays legible and aligned.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/20-pod-detail-tabs/teardown.sh
```
