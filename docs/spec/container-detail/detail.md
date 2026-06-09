# container-detail

## Overview

A drill-down page for a single container within a pod, reached by clicking a container row in the pod detail page's Containers tab (or a row in the Init Containers tab).

Frontend only: `frontend/src/pages/container-detail/`. The page reuses the pod detail data (`GET /api/pods/:namespace/:name`, see `pod-detail`); a container has no kubectl resource of its own, so there is no new backend endpoint.

Route: `/pods/:namespace/:name/containers/:container`, declared in `frontend/src/app.tsx`.

## Behaviour

- A container row in the pod's Containers tab (and Init Containers tab) is clickable. Clicking it navigates to `/pods/:namespace/:name/containers/:container` for that container, preserving the shareable context/namespace query params.
- The page fetches the parent pod via `fetchPodDetail` and finds the named container in either `containers[]` or `initContainers[]`. If no container with that name exists, the page shows an error.
- The header shows the container name, a state chip (Running / Waiting / Terminated / Unknown, matching the pod's container table), an "Init Container" chip when the container is an init container, and a back arrow to the pod detail page.
- The page is organised into four tabs, mirroring the pod detail page's tab pattern, with the active tab stored in the `tab` query param so the view is shareable:
  - **Status**: the container's pod, namespace, image, state (with reason when present), ready, restarts, and whether it is an init container.
  - **Logs**: the embedded log viewer (see `log-viewer`) scoped to this single container. With only one container the viewer shows no container selector.
  - **Commands**: copy-only kubectl command suggestions for the container (see `guided-commands`), each targeting the container via `-c <container>` where applicable.
  - **YAML**: the raw YAML of the parent pod (see `yaml-viewer`); a container is part of the pod's YAML, so the pod YAML is shown.
- Breadcrumbs reflect the full trail: Pods > `<namespace>` > `<pod>` > `<container>` > `<tab>`. The pod crumb links back to the pod detail page.

## Acceptance Criteria

- [x] A container row in the pod's Containers tab is clickable and navigates to a container detail page.
- [x] The container detail page has a Status view.
- [x] The container detail page has a Logs view scoped to that container.
- [x] The container detail page has a Commands view.
- [x] The container detail page has a YAML view (the parent pod's YAML).
- [x] Breadcrumbs reflect Pods > namespace > pod > container > tab.

## Open Questions

None.
