# Karse roadmap

Karse currently ships a single cluster home page (overview tiles plus a read-only nodes table) with kubeconfig context switching. This roadmap lists the features and hardening work we expect to take on next. It is a rough ordering of intent, not a commitment.

1. **Namespace selector**: scope the views to a chosen namespace instead of cluster-wide reads only.
2. **Workloads views**: read-only tables for pods, deployments, statefulsets, and daemonsets.
3. **Pod detail page**: a `/pods/:name` route showing containers, status, restarts, and events.
4. **Node detail page**: a `/nodes/:name` route with conditions, capacity/allocatable, and the pods scheduled on it.
5. **Log viewer**: stream a pod/container's logs read-only (`kubectl logs`), staying within the read-only invariant.
6. **Events feed**: a recent cluster events view to aid quick triage.
7. **Resource search**: a global search box across resource kinds and names.
8. **Auto-refresh / polling controls**: configurable refresh intervals per view, with a pause toggle.
9. **Audit log viewer**: surface the on-disk audit log in the UI so users can see what Karse has run.
10. **Host-header allowlist / DNS-rebinding guard**: add an explicit Host-header allowlist to the backend so the one mutating route is not protected by CORS preflight alone (the accepted risk noted in `docs/architecture.md`).
11. **Multi-cluster overview**: a landing page summarising every configured context at a glance.
12. **Theming and density options**: light/dark theme and a compact table density toggle.

## Already shipped

- **Cluster overview + nodes view**: the cluster home page combining four stat tiles (server version, node count, namespace count, pod count) and a read-only, sortable, searchable nodes table, with kubeconfig context switching in the header. Delivered by the scaffold-and-cluster-overview plan.
