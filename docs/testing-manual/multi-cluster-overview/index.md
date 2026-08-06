# multi-cluster-overview manual tests

**Feature:** [multi-cluster-overview](../../spec/multi-cluster-overview/index.md)

Manual tests for the All clusters page (`/clusters`): that it summarises every configured kubeconfig context at once, totals node counts and utilisation across them with the coverage stated, shows an unreachable context as an error row, links each row through to that cluster's home page, and shows the add-a-context guidance when the kubeconfig is empty.

## Fixtures
- [13-two-contexts](../_fixtures-kwok/13-two-contexts/) for the two-cluster case.
- [14-many-contexts](../_fixtures-kwok/14-many-contexts/) to see the bounded fan-out over a larger kubeconfig.
- [12-no-contexts](../_fixtures-kwok/12-no-contexts/) for the empty-kubeconfig case.
- The unreachable-context case is set up with plain `kubectl config` commands inside the steps.
