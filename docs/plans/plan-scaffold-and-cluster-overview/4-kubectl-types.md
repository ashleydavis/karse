# Step 4: kubectl types

Define the backend type aliases shared by the adapter and routes. Covers plan section 5 (substep 14).

## Code

Create **`backend/src/kubectl/kubectl-types.ts`** exporting:

```ts
export type Context = {
  name: string;
  cluster: string;
  user: string;
  namespace: string | null;
};

export type ContextsResponse = {
  contexts: Context[];
  current: string | null;
};

export type NodeStatus = "Ready" | "NotReady" | "Unknown";

export type Node = {
  name: string;
  status: NodeStatus;
  roles: string[];           // empty array means "<none>"
  version: string;           // kubeletVersion
  createdAt: string;         // ISO timestamp; UI computes age
};

export type ClusterOverview = {
  serverVersion: string | null;   // null if cluster unreachable
  nodeCount: number;
  namespaceCount: number;
  podCount: number;
};
```

## Tests

No tests: this file contains only type aliases (no runtime code). `bun run test` is unchanged (still green).

## Verification

From `backend/`: `bun run compile` (the new types must type-check) and `bun run test` (unchanged, still passing). Run all tests and confirm they pass before marking this step complete.

## Summary

_To be completed when this step is implemented._
