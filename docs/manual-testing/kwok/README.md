# KWOK scenarios

Manual test scenarios that use KWOK to simulate Kubernetes clusters without a real one. Each scenario has a `setup.sh` and `teardown.sh`.

| # | Scenario |
|---|----------|
| [01](01-empty-cluster-two-nodes/) | Empty cluster with two worker nodes |
| [02](02-empty-cluster-no-nodes/) | Empty cluster with no nodes |
| [03](03-many-nodes/) | Many nodes (20) for sort and search testing |
| [04](04-mixed-node-statuses/) | Mixed node statuses: one Ready, one NotReady |
| [05](05-nodes-with-no-roles/) | Nodes with no roles (`<none>` rendering) |
| [06](06-nodes-with-multiple-roles/) | Node with multiple roles (comma-joined list) |
| [07](07-two-pods-one-namespace/) | Two pods in one namespace |
| [08](08-two-pods-two-namespaces/) | Two pods across two namespaces |
| [09](09-many-pods-many-namespaces/) | Many pods (20) across many namespaces (5) |
| [10](10-mixed-pod-phases/) | Mixed pod phases: Running, Pending, Failed, Succeeded |
| [11](11-long-resource-names/) | Long resource names near Kubernetes length limits |
| [12](12-no-contexts/) | No contexts configured in kubeconfig |
| [13](13-two-contexts/) | Two contexts (two simultaneous KWOK clusters) |
| [14](14-many-contexts/) | Many contexts (five simultaneous KWOK clusters) |
