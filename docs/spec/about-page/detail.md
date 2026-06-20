# about-page

## Overview

A static About page that introduces Karse to a new user: what it is, briefly how
it works, who made it, and where to find the source. It reads nothing from the
cluster, so it renders the same regardless of the active context.

Backed by: `frontend/src/pages/about/index.tsx`, the `/about` route in
`frontend/src/app.tsx`, the bottom-pinned nav entry in
`frontend/src/components/sidebar.tsx`, and the `about` breadcrumb label in
`frontend/src/components/breadcrumbs.tsx`.

## Behaviour

- `/about` renders the About page inside the standard app layout (sidebar + header).
- The page is reachable from a dedicated "About" nav entry, pinned to the bottom
  of the sidebar (below the main resource nav, in its own section). The entry is
  highlighted when on `/about`, like every other nav item.
- The breadcrumb trail shows "About" as the (title-sized) current crumb.
- Content:
  - **What Karse is**: a local-only, read-only Kubernetes dashboard that wraps the
    locally-installed `kubectl` binary; runs entirely on the user's own machine and
    never mutates cluster state.
  - **How it works**: shells out to local `kubectl` for read-only cluster queries;
    the only write is switching the active kubeconfig context
    (`kubectl config use-context`).
  - **Who made it**: states the author (Ashley Davis, the repository owner).
  - **GitHub link**: links to `https://github.com/ashleydavis/karse`, opening in a
    new tab (`target="_blank"` with `rel="noopener noreferrer"`).
- The wording is kept aligned with `readme.md` and `docs/spec/index.md` so the
  description stays accurate.

## Acceptance Criteria

- [x] An About page is reachable from the UI (route `/about` + a sidebar nav entry).
- [x] It explains what Karse is (a local-only, read-only Kubernetes dashboard wrapping `kubectl`).
- [x] It briefly explains how it works (read-only `kubectl` queries; the only write is switching kubeconfig context).
- [x] It states who made it.
- [x] It links to the GitHub repo (`https://github.com/ashleydavis/karse`), opening in a new tab.

## Open Questions

None.
