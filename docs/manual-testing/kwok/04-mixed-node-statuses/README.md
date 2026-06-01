# Scenario 4: Mixed node statuses

A cluster with a Ready node, a NotReady node, and a cordoned
(Ready,SchedulingDisabled) node. Exercises the status chip colours in the nodes
table.

## How the NotReady node works

By default `kwokctl` starts the kwok-controller with `--manage-all-nodes=true`,
which drives heartbeats for every node and keeps them all Ready. That makes a
NotReady node impossible to emulate: any `Ready=False` status you patch in is
immediately overwritten.

The setup script instead starts the kwok-controller with
`--manage-all-nodes=false` and
`--manage-nodes-with-annotation-selector=kwok.x-k8s.io/node=fake`, so kwok only
manages nodes that carry the `kwok.x-k8s.io/node: fake` annotation:

- `fake-node-ready` and `fake-node-cordoned` carry the annotation, so kwok keeps
  them Ready.
- `fake-node-notready` omits the annotation, so kwok ignores it. The patched
  `Ready=False` condition is never overwritten and the node stays genuinely
  NotReady.

The cordoned node is a normal kwok-managed Ready node with `spec.unschedulable:
true`, which `kubectl` renders as `Ready,SchedulingDisabled`.

## Prerequisites

- `kwokctl` and `kubectl` on `PATH`.
- Karse running locally: `bun run dev:test` from the repo root.

## Setup

```sh
./docs/manual-testing/kwok/04-mixed-node-statuses/setup.sh
```

`kwokctl` adds a `kwok-karse-test` context to your kubeconfig automatically.
Select it in Karse.

## What to check

- **Nodes table**: three rows. `fake-node-ready` and `fake-node-cordoned` have a
  green Ready chip. `fake-node-notready` has a red NotReady chip. (Karse derives
  status from the node's `Ready` condition, so the cordoned node still shows
  Ready.)
- **Overview tiles**: node count shows `3`.

## Teardown

```sh
./docs/manual-testing/kwok/04-mixed-node-statuses/teardown.sh
```
