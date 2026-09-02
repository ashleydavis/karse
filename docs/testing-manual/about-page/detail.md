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

## Scenario B: Report a bug

**Fixture:** [_fixtures-kwok/13-two-contexts](../_fixtures-kwok/13-two-contexts/) (the
same fixture as Scenario A; if it is still up, no new setup is needed)

```sh
./docs/testing-manual/_fixtures-kwok/13-two-contexts/setup.sh
```

### What to check
- **Position**: the sidebar's bottom section (below the main resource nav) holds a
  "Report a bug" entry directly above the "About" entry. It looks like every other
  nav entry: bug icon, label, same padding and spacing.
- **Link target**: hovering "Report a bug" shows
  `https://github.com/ashleydavis/karse/issues/new`. Clicking it opens GitHub's
  new-issue form for the Karse repository in a **new browser tab**, leaving Karse
  on whatever page you were on.
- **Never highlighted**: navigate to `/about` by clicking "About". "About" is
  highlighted; "Report a bug", directly above it, is **not**. It stays unhighlighted
  on every other page too.
- **No breadcrumb**: the entry adds nothing to the breadcrumb trail, because it is
  not an in-app page.
- **Collapsed sidebar**: collapse the sidebar with the chevron at its foot. "Report
  a bug" shows its icon only, with no label, like the entries above it. Hovering it
  shows a tooltip to the right reading "Report a bug", and the link still opens the
  new-issue page in a new tab.

## Scenario C: Light and dark mode

With the About page open, switch the color mode from the header (the moon/sun
icon → Light / Dark / System).

### What to check
- The page renders correctly in both light and dark mode: the card, body text, and
  the GitHub link are legible in each, matching the rest of the app's theme.
- The sidebar's bottom section, "Report a bug" included, is legible in both modes,
  expanded and collapsed, matching the entries in the main nav above it.

Teardown:

```sh
./docs/testing-manual/_fixtures-kwok/13-two-contexts/teardown.sh
```
