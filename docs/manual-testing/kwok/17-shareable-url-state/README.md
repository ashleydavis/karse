# Scenario 17: Shareable URL state

The important UI state (selected context, selected namespace, current page, and selected resource) lives in the URL so a link can be copied and reopened to reproduce the exact same view. Page and resource were already in the path (React Router); the selected context and namespace are now encoded as `?context=` and `?namespace=` query params and the pickers keep them in sync.

Two KWOK clusters run simultaneously so context switching is observable. Cluster 1 (`kwok-karse-test-1`) has 2 nodes; cluster 2 (`kwok-karse-test-2`) has 1 node, so the data visibly differs after a switch.

## Prerequisites

- `kwokctl` and `kubectl` on `PATH`.
- Karse running locally: `bun run dev:test` from the repo root.

## Setup

```sh
./docs/manual-testing/kwok/17-shareable-url-state/setup.sh
```

## What to check

- **Context goes into the URL**: on any page, switch context with the header dropdown (or Ctrl+K quick picker). The URL gains `?context=kwok-karse-test-2`. The node count/table updates to cluster 2's single node.
- **Namespace goes into the URL**: open the namespace picker (Ctrl+Shift+K), select `kube-system`. The URL gains `&namespace=kube-system` and the header shows the namespace chip. Selecting "All namespaces" removes the `namespace` param again.
- **Reload preserves state**: with `?context=...&namespace=...` in the address bar, reload the page (F5). The same context and namespace remain selected (no reset to the terminal default).
- **Share a link**: copy the full URL (for example `/pods?context=kwok-karse-test-2&namespace=kube-system`) and paste it into a fresh tab. The new tab opens on the same page, context, and namespace.
- **Params survive navigation**: with a context selected, click around the sidebar (Nodes, Pods, Cluster) and click into a resource detail page and back. The `?context=` (and `?namespace=` where set) param stays in the URL the whole time, and the data keeps reflecting the selected cluster.
- **Resource detail is in the path**: click a pod or node row. The resource identity is in the path (for example `/pods/kube-system/some-pod`) and the context param is carried along in the query string.
- **Backward compatible default**: open `/cluster` with no query params. The app falls back to the terminal's current context (cluster 1) and "all namespaces", exactly as before.

## Teardown

```sh
./docs/manual-testing/kwok/17-shareable-url-state/teardown.sh
```
