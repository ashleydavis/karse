# about-page

## Overview

A static About page that introduces Karse to a new user: what it is, briefly how
it works, who made it, and where to find the source. It reads nothing from the
cluster, so it renders the same regardless of the active context.

Backed by: `frontend/src/pages/about/index.tsx`, the `/about` route in
`frontend/src/app.tsx`, the bottom-pinned nav section
(`frontend/src/components/sidebar-nav.ts`, rendered by
`frontend/src/components/sidebar.tsx`), the shared repository URLs in
`frontend/src/lib/repository.ts`, and the `about` breadcrumb label in
`frontend/src/components/breadcrumbs.tsx`.

## Behaviour

- `/about` renders the About page inside the standard app layout (sidebar + header).
- The page is reachable from a dedicated "About" nav entry, pinned to the bottom
  of the sidebar (below the main resource nav, in its own section). The entry is
  highlighted when on `/about`, like every other nav item.
- The bottom-pinned section holds two entries, in order: "Report a bug" and then
  "About". Both render like every other sidebar entry (icon, label, and a tooltip
  carrying the label when the sidebar is collapsed).
- "Report a bug" is an outbound link, not a route: it is an anchor to
  `https://github.com/ashleydavis/karse/issues/new`, opening in a new tab
  (`target="_blank"` with `rel="noopener noreferrer"`). It adds no route and no
  breadcrumb label, and it never takes the selected/active highlight, on `/about`
  or anywhere else. Karse is local-only and read-only, so it cannot take a bug
  report itself; the entry hands the user to GitHub.
- The repository URL is written once, in `frontend/src/lib/repository.ts`, as
  `GITHUB_URL` (the repository home, used by the About page's GitHub link) and
  `GITHUB_NEW_ISSUE_URL` (derived from it, used by the "Report a bug" nav entry),
  so the two surfaces cannot drift apart.
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
- [x] A "Report a bug" entry sits in the sidebar's bottom nav section, directly above "About", linking to `https://github.com/ashleydavis/karse/issues/new` in a new tab and never taking the active highlight.
- [x] The repository URL is a shared constant (`frontend/src/lib/repository.ts`), read by both the About page and the sidebar entry.

## Open Questions

None.
