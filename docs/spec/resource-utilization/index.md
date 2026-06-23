# resource-utilization

**ID:** resource-utilization
**Spec:** Draft
**Implementation:** None

The resource-utilization feature reworks Karse's performance surfaces into a richer
CPU/memory utilisation view, ported from the prototype dashboard. Cluster-wide
Usage-vs-Requests cards with %/Absolute toggles, health-signal tiles (pending pods,
OOMKills, node pressure), inline bar columns on the nodes/pods tables, a per-controller
workloads table, and node-detail utilisation cards — all driven by kubectl-readable data
(Metrics API usage, pod spec requests/limits, node allocatable, node conditions, container
`lastState.terminated.reason`). Percentage bases differ by scope: cluster total on the
cluster cards and workloads, node allocatable on the nodes table and node detail, pod
request on the pods table and pod detail. Without the Metrics API, requests and allocatable
still work and usage bars show an em-dash.

## Sub-features
None.

See the full description in [detail.md](./detail.md).
