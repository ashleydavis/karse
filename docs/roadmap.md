# Karse roadmap

Karse currently ships a single cluster home page (overview tiles plus a read-only nodes table) with kubeconfig context switching. This roadmap lists the features and hardening work we expect to take on next. It is a rough ordering of intent, not a commitment.

## Open questions

**Should there just be a single "resource" page?** That allows the user to pick "All resources" or select particular types (e.g. Pods and Deployments). From there the user could sort, search, and filter all resources in one place. It would also be good if they could export a CSV from there.

1. **Namespace selector**: scope the views to a chosen namespace instead of cluster-wide reads only.
2. **Workloads views**: read-only tables for pods, deployments, statefulsets, and daemonsets.
3. **Pod detail page**: a `/pods/:name` route showing containers, status, restarts, and events.
4. **Node detail page**: a `/nodes/:name` route with conditions, capacity/allocatable, and the pods scheduled on it.
5. **Log viewer**: stream a pod/container's logs read-only (`kubectl logs`), staying within the read-only invariant.
6. **Events feed**: a recent cluster events view to aid quick triage.
7. **Resource search**: a global search box across resource kinds and names.
8. **Auto-refresh / polling controls**: configurable refresh intervals per view, with a pause toggle.
9. **Audit log viewer**: surface the on-disk audit log in the UI so users can see what Karse has run.
10. **Host-header allowlist / DNS-rebinding guard**: add an explicit Host-header allowlist to the backend so the one mutating route is not protected by CORS preflight alone (the accepted risk noted in `docs/security.md`).
11. **Multi-cluster overview**: a landing page summarising every configured context at a glance.
12. **Theming and density options**: light/dark theme and a compact table density toggle.

## Performance monitoring

13. **Cluster performance dashboard**: aggregate CPU utilisation %, memory utilisation %, and allocatable vs used capacity across all nodes, shown as a summary bar or gauge on the cluster home page.
14. **Node performance view**: per-node CPU %, memory %, network I/O (bytes in/out), and disk I/O on the node detail page, pulling from the Metrics API or `kubectl top node`.
15. **Pod resource usage table**: actual CPU and memory consumption per pod alongside its requests and limits, so over- and under-provisioned workloads are immediately visible (`kubectl top pod`).
16. **Top resource consumers**: a sortable "top N pods" view ranked by CPU or memory usage, giving a quick answer to "what is eating my cluster?".
17. **Requests vs limits breakdown**: per-namespace or per-workload bar charts comparing requested resources, enforced limits, and actual usage to surface provisioning waste or risk of OOMKill.
18. **Resource quota utilisation**: show how much of each `ResourceQuota` is consumed per namespace (CPU, memory, object counts) so quota exhaustion is caught before it blocks deployments.
19. **OOMKilled and eviction tracker**: highlight pods that have been terminated due to memory pressure or evicted by the kubelet, with the exit reason, timestamp, and how many times it has happened.
20. **Historical metrics charts**: time-series sparklines or graphs for key signals (cluster CPU, cluster memory, per-node load) so trends and spikes are visible over a configurable lookback window.
21. **Per-pod CPU and memory charts**: CPU utilisation and memory usage charts on the pod detail page, showing current usage alongside requests and limits, so resource pressure on individual pods is immediately visible.
22. **All-resources browser**: a dedicated page with a searchable, sortable table listing every resource in the cluster (scoped to the selected namespace or cluster-wide), across all resource kinds, so users can browse the full inventory without knowing the specific resource type in advance.
23. **Networking views**: read-only, searchable, sortable tables for Services and Ingresses, with detail pages showing spec, status, ports, and associated endpoints.
24. **Storage views**: read-only, searchable, sortable tables for PersistentVolumes and PersistentVolumeClaims, with detail pages showing capacity, access modes, storage class, and binding status.
25. **Configuration views**: read-only, searchable, sortable tables for ConfigMaps and Secrets (key names only, values redacted for Secrets), with detail pages.
26. **Batch workload views**: read-only, searchable, sortable tables for Jobs and CronJobs, with detail pages showing schedule, last run time, and completion status.
27. **ReplicaSet view**: read-only, searchable, sortable table for ReplicaSets, with detail pages showing desired/ready/available replica counts and owner reference.
28. **RBAC views**: read-only, searchable, sortable tables for ServiceAccounts, Roles, ClusterRoles, RoleBindings, and ClusterRoleBindings, with detail pages showing rules and subjects.
29. **CRD browser**: a view listing installed CustomResourceDefinitions and allowing users to browse instances of each CRD kind in a searchable, sortable table.

## Already shipped

- **Cluster overview + nodes view**: the cluster home page combining four stat tiles (server version, node count, namespace count, pod count) and a read-only, sortable, searchable nodes table, with kubeconfig context switching in the header. Delivered by the scaffold-and-cluster-overview plan.
