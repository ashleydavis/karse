# about-page manual tests

Manual tests for the About page. See the spec: [about-page](../../spec/about-page/detail.md).

Start the app first. From the repo root run:

```sh
bun run dev
```

Then open the frontend at `http://127.0.0.1:5173`. The About page reads nothing
from the cluster, but the app redirects to the Contexts page when no context is
selected, so a context must be active for the rest of the UI (sidebar, header) to
show. Any fixture with at least one context works.

## Scenario A: Reach and read the About page

**Fixture:** [_fixtures-kwok/13-two-contexts](../_fixtures-kwok/13-two-contexts/)

```sh
./docs/testing-manual/_fixtures-kwok/13-two-contexts/setup.sh
```

`kwokctl` adds the contexts to your kubeconfig automatically. Select one in Karse.

### What to check
- **Nav entry**: the sidebar has an "About" entry pinned to the bottom (below the
  main resource nav, in its own section). Clicking it navigates to `/about` and the
  entry becomes highlighted.
- **Breadcrumb**: the breadcrumb trail shows "About" as the current page.
- **What Karse is**: the page states Karse is a local-only, read-only Kubernetes
  dashboard that wraps the locally-installed `kubectl`.
- **How it works**: the page explains it shells out to local `kubectl` for
  read-only cluster queries, and that the only write is switching the active
  kubeconfig context (`kubectl config use-context`).
- **Author**: the page states who made Karse (Ashley Davis).
- **GitHub link**: a "View Karse on GitHub" link points at
  `https://github.com/ashleydavis/karse`. Hovering shows that URL; clicking opens
  it in a **new browser tab** (the link has `target="_blank"`).

## Scenario B: Light and dark mode

With the About page open, switch the color mode from the header (the moon/sun
icon → Light / Dark / System).

### What to check
- The page renders correctly in both light and dark mode: the card, body text, and
  the GitHub link are legible in each, matching the rest of the app's theme.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/13-two-contexts/teardown.sh
```
