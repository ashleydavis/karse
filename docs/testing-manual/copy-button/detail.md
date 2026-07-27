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
