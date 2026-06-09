# container-detail

**ID:** container-detail
**Spec:** Settled
**Implementation:** Complete

The container detail page (`/pods/:namespace/:name/containers/:container`): a drill-down for a single container within a pod, reached by clicking a row in the pod detail page's Containers or Init Containers tab. Shows the container's status, its logs, copy-only kubectl commands, and the parent pod's YAML, using the same tabbed detail-page pattern as the other detail pages.

## Sub-features
None. (Logs are specified under `log-viewer`; the YAML view under `yaml-viewer`; the commands under `guided-commands`.)
