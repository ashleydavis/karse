# resource-utilization manual tests

**ID:** resource-utilization

This feature is being built data-foundation first. At this stage only the spec
(`docs/spec/resource-utilization/`) and the shared `karse-types` exist — there is no backend
logic and no UI yet, so there is nothing to exercise in the running app.

The only check for the current stage is the type/spec compile, run from the repo root:

```sh
bun run compile
```

It must succeed with the new `karse-types` (`NodeUsage.requests`, `ClusterResourceTotals`,
`ClusterHealthSignals`, `WorkloadUsage`, the extended `ClusterPerformance`, and `Node.instanceType`)
referenced.

The full manual test steps for this feature — starting the app, the kwok fixture, the
Usage/Requests and %/Absolute toggle interactions across the cluster Overview, nodes, node detail,
and pods surfaces, the health-signal tiles, the treemap label truncation, the
Metrics-API-unavailable degradation, and the light/dark screenshot checklist — are added with the
backend and UI tickets that implement those surfaces.
