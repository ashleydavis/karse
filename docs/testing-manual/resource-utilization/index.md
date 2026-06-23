# resource-utilization manual tests

**ID:** resource-utilization

Manual tests for the resource-utilization feature: the richer CPU/memory utilisation surfaces
(cluster Usage-vs-Requests cards with %/Absolute toggles, health-signal tiles, bar columns on
the nodes and pods tables, a per-controller workloads table, and node/pod utilisation panels).

The feature is being built data-foundation first: this directory mirrors `docs/spec/resource-utilization/`.
At this stage only the spec and shared `karse-types` exist (no backend logic or UI yet), so there
are no runtime steps to exercise. The full manual steps (start command, kwok fixture, toggle
interactions, screenshot checklist) land with the backend and UI tickets.

**Fixtures:** none yet — added with the backend/UI tickets, which use the `KARSE_FAKE_METRICS`
fake-metrics mode (see [performance-tabs](../performance-tabs/index.md)).

See [detail.md](./detail.md).
